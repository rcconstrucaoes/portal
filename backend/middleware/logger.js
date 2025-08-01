/**
 * RC Construções - Middleware de Logging (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este middleware é responsável por:
 * - Log de todas as requisições HTTP (usando Morgan).
 * - Captura de dados de performance e duração de requisições.
 * - Log de erros e exceções não tratados em rotas.
 * - Adição de IDs de correlação para rastreamento de requisições.
 * - Mascaramento de dados sensíveis em logs.
 * - Auditoria de ações específicas (se configurado).
 */

const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const onFinished = require('on-finished');
const onHeaders = require('on-headers');
const Redis = require('ioredis'); // Para Redis, se usado para métricas de log

const logger = require('../config/logger'); // Logger central do backend
const redisConfig = require('../config/redis'); // Configurações do Redis

// Inicializa o cliente Redis se estiver habilitado na configuração
let redisClient;
if (redisConfig.enabled) {
  redisClient = new Redis(redisConfig.port, redisConfig.host, {
    password: redisConfig.password,
    db: redisConfig.db,
    keyPrefix: 'log_metrics:' // Prefixo para chaves Redis de métricas de log
  });

  redisClient.on('error', (err) => {
    logger.error('Erro de conexão com Redis (Logger Middleware):', err);
  });
  redisClient.on('connect', () => {
    logger.info('Conectado ao Redis para Métricas de Log.');
  });
} else {
  logger.warn('Redis desabilitado para métricas de log. Algumas funcionalidades podem estar limitadas.');
}


class LoggerMiddleware {
  constructor() {
    // Cabeçalhos para correlação de requisições
    this.correlationIdHeader = 'x-correlation-id';
    this.requestIdHeader = 'x-request-id';

    // Campos sensíveis para mascaramento em logs
    this.sensitiveFields = [
      'password', 'token', 'authorization', 'cookie', 'x-api-key',
      'cpf', 'cnpj', 'creditCard', 'ssn', 'socialSecurityNumber' //
    ];

    // Caminhos de URL a serem ignorados no log de requisições (ex: health checks)
    this.skipPaths = [
      '/health', '/ping', '/metrics', '/favicon.ico' //
    ];

    // Configuração do Morgan customizada para HTTP requests
    this.morganFormat = this.createMorganFormat();
  }

  /**
   * Cria um formato customizado para o Morgan.
   * Isso permite capturar mais detalhes e logar usando o Winston.
   * @returns {string} O formato da string para Morgan.
   */
  createMorganFormat() {
    // Define um token customizado para morgan para capturar o corpo da requisição ou informações de erro
    morgan.token('body', (req, res) => {
      // Retorna o corpo da requisição, mas mascara campos sensíveis
      if (req.body) {
        const body = { ...req.body
        };
        this.sensitiveFields.forEach(field => {
          if (body[field]) {
            body[field] = '[MASKED]';
          }
        });
        return JSON.stringify(body);
      }
      return undefined;
    });

    morgan.token('correlation-id', (req) => req[this.correlationIdHeader]);
    morgan.token('request-id', (req) => req[this.requestIdHeader]);
    morgan.token('user-id', (req) => req.user ? req.user.id : 'guest');
    morgan.token('user-role', (req) => req.user ? req.user.role : 'none');

    // Retorna o formato string customizado
    // [remote-addr] [user-id] [user-role] "METHOD URL HTTP/VERSION" STATUS [response-time ms] - [res[content-length]] "body" "referrer" "user-agent"
    return (tokens, req, res) => {
      // Pular logging para caminhos específicos
      if (this.skipPaths.includes(tokens.url(req, res))) { //
        return null;
      }

      const status = tokens.status(req, res);
      const isError = status >= 400; // Requisição com status de erro

      const message = [
        tokens['remote-addr'](req, res),
        `[${tokens['user-id'](req, res)}]`,
        `[${tokens['user-role'](req, res)}]`,
        `"${tokens.method(req, res)} ${tokens.url(req, res)} HTTP/${tokens['http-version'](req, res)}"`,
        status,
        `${tokens['response-time'](req, res)} ms`,
        `- ${tokens['res[content-length]'](req, res) || '-'}`,
        tokens.body(req, res) || '-',
        `"${tokens.referrer(req, res)}"`,
        `"${tokens['user-agent'](req, res)}"`
      ].join(' ');

      // Loga usando o logger central
      if (isError) {
        logger.warn('HTTP Request Error', { //
          method: tokens.method(req, res),
          url: tokens.url(req, res),
          status: status,
          responseTime: tokens['response-time'](req, res),
          userId: tokens['user-id'](req, res),
          correlationId: tokens['correlation-id'](req),
          requestId: tokens['request-id'](req),
          ip: tokens['remote-addr'](req, res),
          body: tokens.body(req, res) // Já mascarado pelo token customizado
        });
      } else {
        logger.http(message, { //
          method: tokens.method(req, res),
          url: tokens.url(req, res),
          status: status,
          responseTime: tokens['response-time'](req, res),
          userId: tokens['user-id'](req, res),
          correlationId: tokens['correlation-id'](req),
          requestId: tokens['request-id'](req),
          ip: tokens['remote-addr'](req, res)
        });
      }

      // Retorna null para que Morgan não logue no console novamente (pois Winston já está fazendo isso)
      return null;
    };
  }

  /**
   * Middleware para atribuir um ID de requisição e de correlação a cada requisição.
   * Ajuda a rastrear requisições através de microserviços e logs.
   * @returns {Function} Middleware Express.
   */
  assignRequestId() {
    return (req, res, next) => {
      // Reutiliza o correlation ID se já estiver presente no header
      const correlationId = req.headers[this.correlationIdHeader] || uuidv4();
      const requestId = uuidv4(); // Novo ID para cada requisição

      req[this.correlationIdHeader] = correlationId;
      req[this.requestIdHeader] = requestId;

      res.setHeader(this.correlationIdHeader, correlationId);
      res.setHeader(this.requestIdHeader, requestId);

      next();
    };
  }

  /**
   * Middleware de log de requisições HTTP usando Morgan.
   * @returns {Function} Middleware Express.
   */
  requestLogger() {
    return morgan(this.morganFormat, {
      skip: (req, res) => this.skipPaths.includes(req.originalUrl) // Garante que Morgan pule também
    });
  }

  /**
   * Middleware para logar erros no pipeline de requisições.
   * Deve ser colocado após todas as rotas e outros middlewares.
   * @returns {Function} Middleware Express.
   */
  errorLogger() {
    return (err, req, res, next) => {
      // Não loga erros se a resposta já foi enviada
      if (res.headersSent) {
        return next(err);
      }

      logger.error('Erro no pipeline da requisição HTTP', { //
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        error: err.message,
        stack: err.stack,
        userId: req.user?.id,
        correlationId: req[this.correlationIdHeader],
        requestId: req[this.requestIdHeader],
        ip: req.ip,
        requestBody: req.body ? JSON.stringify(this.maskSensitiveData(req.body)) : undefined, // Mascara body do erro
        headers: req.headers
      });

      // Passa o erro para o próximo middleware de tratamento de erro (se houver)
      next(err);
    };
  }

  /**
   * Middleware para auditoria de ações sensíveis.
   * Pode ser colocado em rotas específicas (ex: criação/exclusão de usuário).
   * @param {string} action - Descrição da ação de auditoria (ex: 'USER_CREATED', 'PASSWORD_CHANGED').
   * @returns {Function} Middleware Express.
   */
  auditLogger(action) {
    return (req, res, next) => {
      onFinished(res, async (err) => {
        // Apenas loga auditoria se a requisição foi bem-sucedida (status < 400)
        if (!err && res.statusCode < 400) {
          logger.info(`[AUDIT] Ação: ${action}`, { //
            userId: req.user?.id || 'guest',
            role: req.user?.role || 'none',
            action,
            details: this.maskSensitiveData(req.body), // Mascara detalhes da requisição
            ip: req.ip,
            correlationId: req[this.correlationIdHeader],
            requestId: req[this.requestIdHeader],
            status: res.statusCode
          });

          // Se Redis estiver disponível, pode-se também registrar métricas de auditoria
          if (redisClient && redisClient.connected) {
            const auditKey = `audit:${action}:${req.user?.id || 'guest'}`;
            redisClient.incr(auditKey).catch(e => logger.error('Erro Redis audit incr:', e));
            redisClient.expire(auditKey, 24 * 60 * 60).catch(e => logger.error('Erro Redis audit expire:', e)); // Expira após 24h
          }
        }
      });
      next();
    };
  }

  /**
   * Mascara dados sensíveis em um objeto (ex: req.body).
   * @param {Object} data - O objeto a ser mascarado.
   * @returns {Object} O objeto com campos sensíveis mascarados.
   */
  maskSensitiveData(data) {
    if (!data || typeof data !== 'object') return data;
    const maskedData = { ...data
    };
    this.sensitiveFields.forEach(field => {
      if (maskedData[field]) {
        maskedData[field] = '[MASKED]';
      }
    });
    return maskedData;
  }

  /**
   * Funções para obter estatísticas de logs (se Redis for usado para isso).
   */
  async getLogStats(timeframe = '1h') { //
    if (!redisClient || !redisClient.connected) {
      logger.warn('Redis não conectado. Não foi possível obter estatísticas de log.');
      return null;
    }
    try {
      const now = Math.floor(Date.now() / (1000 * 60)); // Minutos atuais
      const minutes = timeframe === '1h' ? 60 : timeframe === '24h' ? 1440 : 60;

      const stats = {
        errors: 0,
        requests: 0,
        statusCodes: {},
        auditActions: {}
      };

      for (let i = 0; i < minutes; i++) {
        const timestampMinute = now - i;
        const errorCount = await redisClient.get(`metrics:errors:${timestampMinute}`);
        if (errorCount) stats.errors += parseInt(errorCount);

        const requestCount = await redisClient.get(`metrics:requests:${timestampMinute}`);
        if (requestCount) stats.requests += parseInt(requestCount);

        const statusCodesJson = await redisClient.get(`metrics:status_codes:${timestampMinute}`);
        if (statusCodesJson) {
          const codes = JSON.parse(statusCodesJson);
          for (const code in codes) {
            stats.statusCodes[code] = (stats.statusCodes[code] || 0) + codes[code];
          }
        }
        
        // Exemplo: Coletar auditorias (se estiverem sendo logadas com este padrão)
        // const auditCounts = await redisClient.hgetall(`audit_summary:${timestampMinute}`);
        // if (auditCounts) {
        //   for (const action in auditCounts) {
        //     stats.auditActions[action] = (stats.auditActions[action] || 0) + parseInt(auditCounts[action]);
        //   }
        // }
      }

      return stats;

    } catch (error) {
      logger.error('Erro ao obter estatísticas de logs do Redis:', error);
      return null;
    }
  }

  /**
   * Incrementa contadores de métricas no Redis para cada requisição.
   * Isso é feito via `onFinished` para garantir que o status HTTP esteja disponível.
   * @returns {Function} Middleware Express.
   */
  performanceMetricsCollector() {
    return (req, res, next) => {
      // Pula para health checks e outros
      if (this.skipPaths.includes(req.originalUrl)) {
        return next();
      }

      const startTime = process.hrtime.bigint(); // Tempo de início da requisição

      onHeaders(res, () => {
        // Ocorre antes que os cabeçalhos sejam enviados ao cliente
        res.locals.startTime = startTime; // Armazena o tempo de início para uso posterior
      });

      onFinished(res, async (err) => {
        if (!redisClient || !redisClient.connected) return;

        try {
          const endTime = process.hrtime.bigint();
          const durationNs = endTime - (res.locals.startTime || startTime);
          const durationMs = Number(durationNs) / 1_000_000; // Converte nanosegundos para milissegundos

          const timestampMinute = Math.floor(Date.now() / (1000 * 60)); // Minuto atual
          
          // Incrementa o contador total de requisições
          await redisClient.incr(`metrics:requests:${timestampMinute}`);
          await redisClient.expire(`metrics:requests:${timestampMinute}`, 2 * 24 * 60 * 60); // Expira em 2 dias

          // Loga a duração da requisição
          logger.debug(`Requisição ${req.method} ${req.originalUrl} - Duração: ${durationMs.toFixed(2)}ms`, {
              duration: durationMs,
              url: req.originalUrl,
              method: req.method,
              userId: req.user?.id
          });

          // Incrementa o contador de erros se o status for >= 400
          if (res.statusCode >= 400) {
            await redisClient.incr(`metrics:errors:${timestampMinute}`);
            await redisClient.expire(`metrics:errors:${timestampMinute}`, 2 * 24 * 60 * 60);
          }

          // Registra contagem por status code
          const statusCodeKey = `metrics:status_codes:${timestampMinute}`;
          // Usa HINCRBY para um hash (melhor para muitos status codes)
          await redisClient.hincrby(statusCodeKey, res.statusCode.toString(), 1);
          await redisClient.expire(statusCodeKey, 2 * 24 * 60 * 60);

        } catch (e) {
          logger.error('Erro ao coletar métricas de performance para Redis:', e);
        }
      });
      next();
    };
  }
}

// Exporta uma instância única do middleware para ser usada em Express
module.exports = new LoggerMiddleware();