/**
 * RC Construções - Middleware de Rate Limiting (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este middleware implementa diferentes estratégias de rate limiting para proteger
 * a API contra abusos, ataques de força bruta e sobrecarga.
 * Utiliza 'express-rate-limit' e 'express-slow-down' com Redis para persistência.
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redisConfig = require('../config/redis'); // Configurações do Redis
const logger = require('../config/logger'); // Logger do backend

// Inicializa o cliente Redis para rate limiting
let redisClient;
if (redisConfig.enabled) {
  redisClient = new Redis(redisConfig.port, redisConfig.host, {
    password: redisConfig.password,
    db: redisConfig.db,
    keyPrefix: 'rate_limit:' // Prefixo para chaves Redis de rate limiting
  });

  // Tratamento de erros de conexão do Redis
  redisClient.on('error', (err) => {
    logger.error('Erro de conexão com Redis (RateLimiter Middleware):', err);
    // Em caso de erro, pode-se desabilitar o RedisStore temporariamente
    // Ou usar um fallback para o store em memória (mas perde persistência)
  });
  redisClient.on('connect', () => {
    logger.info('Conectado ao Redis para Rate Limiting.');
  });
} else {
  logger.warn('Redis desabilitado para Rate Limiting. O limitador usará um store em memória (não persistente).');
}

// Configura o Redis Store se o Redis estiver habilitado
const getRedisStore = () => {
  if (redisConfig.enabled && redisClient) {
    return new RedisStore({
      client: redisClient, //
      prefix: 'rl:', // Prefixo para chaves de RedisStore
      resetExpiryOnChange: true // Reinicia a expiração no Redis a cada hit
    });
  }
  return undefined; // Retorna undefined para usar o store em memória padrão
};

class RateLimiterMiddleware {
  constructor() {
    this.store = getRedisStore(); // Store para persistir contadores de rate limit

    // Configurações padrão para todos os limitadores (podem ser sobrescritas)
    this.defaultConfig = {
      windowMs: 15 * 60 * 1000, // - 15 minutos
      max: parseInt(process.env.RATE_LIMIT_DEFAULT_MAX || '100', 10), // - 100 requisições por janela
      standardHeaders: true, // Adiciona cabeçalhos RateLimit-* na resposta
      legacyHeaders: false, // Desabilita cabeçalhos X-RateLimit-*
      store: this.store, // - Usa o store Redis
      // Handler para quando o limite é excedido
      handler: (req, res, next, options) => {
        logger.warn('Rate limit excedido', {
          ip: req.ip,
          method: req.method,
          url: req.originalUrl,
          userId: req.user?.id || 'guest',
          limit: options.max,
          windowMs: options.windowMs,
          code: 'RATE_LIMIT_EXCEEDED'
        });
        res.status(options.statusCode).json({
          error: options.message,
          code: 'RATE_LIMIT_EXCEEDED'
        });
      },
      // Mensagem padrão de erro
      message: 'Muitas requisições desta IP, por favor, tente novamente mais tarde.'
    };
  }

  /**
   * Limitador global por IP.
   * Aplica-se a todas as requisições não autenticadas.
   */
  globalLimiter() {
    return rateLimit({
      ...this.defaultConfig,
      max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '500', 10), // - 500 requisições por janela para IPs globais
      message: 'Você atingiu o limite de requisições globais. Tente novamente mais tarde.'
    });
  }

  /**
   * Limitador para usuários autenticados (por ID de usuário, não IP).
   * Deve ser usado APÓS o middleware de autenticação.
   */
  userRoleLimiter(roleLimits = {}) {
    return rateLimit({
      ...this.defaultConfig,
      max: (req) => {
        const userRole = req.user?.role || 'guest';
        // Usa o limite específico para o papel, ou o padrão se não definido
        return parseInt(roleLimits[userRole] || this.defaultConfig.max, 10); //
      },
      keyGenerator: (req) => req.user?.id || req.ip, // Chave baseada no ID do usuário ou IP fallback
      message: 'Você atingiu o limite de requisições para o seu perfil. Tente novamente mais tarde.'
    });
  }

  /**
   * Limitador por endpoint específico.
   * Permite configurar limites diferentes para rotas sensíveis.
   * @param {number} max - Máximo de requisições.
   * @param {number} windowMs - Janela de tempo em ms.
   */
  endpointLimiter(max, windowMs) {
    return rateLimit({
      ...this.defaultConfig,
      max: max,
      windowMs: windowMs,
      message: 'Você atingiu o limite de requisições para este endpoint. Tente novamente mais tarde.'
    });
  }

  /**
   * Limitador de lentidão (slow down).
   * Atrasa as requisições após um certo número de hits, em vez de bloqueá-las.
   * Útil para APIs públicas ou que podem ser acessadas por bots.
   * @param {number} delayAfter - Começa a atrasar após este número de requisições.
   * @param {number} delayMs - Atraso adicional em ms por requisição.
   */
  slowDownLimiter(delayAfter, delayMs) {
    return slowDown({
      windowMs: this.defaultConfig.windowMs,
      delayAfter: delayAfter,
      delayMs: delayMs,
      store: this.store //
    });
  }

  /**
   * Limitador de tentativas de login (proteção contra força bruta em logins).
   * Geralmente mais agressivo.
   */
  loginLimiter() {
    return rateLimit({
      ...this.defaultConfig,
      windowMs: 5 * 60 * 1000, // - 5 minutos
      max: 5, // - 5 tentativas por IP/username
      // A chave pode ser o IP ou o username/email do corpo da requisição (se disponível)
      keyGenerator: (req) => req.body.username ? `${req.ip}:${req.body.username}` : req.ip, //
      message: {
        error: 'Muitas tentativas de login. Por favor, tente novamente mais tarde.',
        code: 'TOO_MANY_LOGIN_ATTEMPTS'
      },
      // Permite hits para 401/403 para que o login falhe, mas a contagem continue
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      // Handler para logar no logger central
      handler: (req, res, next, options) => {
        logger.warn('Tentativas de login excedidas', {
          username: req.body.username || req.ip,
          limit: options.max,
          windowMs: options.windowMs,
          ip: req.ip,
          code: 'TOO_MANY_LOGIN_ATTEMPTS'
        });
        res.status(options.statusCode).json(options.message);
      }
    });
  }

  /**
   * Middleware para verificar e bloquear IPs suspeitos no Redis.
   * Pode ser usado em conjunto com um sistema de detecção de intrusão.
   */
  blockIpMiddleware() {
    return async (req, res, next) => {
      if (!redisClient || !redisClient.connected) {
        logger.warn('Redis não conectado. Não foi possível verificar bloqueio de IP.');
        return next();
      }

      const ipBlockKey = `blocked_ip:${req.ip}`;
      try {
        const isBlocked = await redisClient.get(ipBlockKey);

        if (isBlocked) {
          logger.security('Tentativa de acesso de IP bloqueado', { //
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method
          });
          return res.status(403).json({ //
            error: 'Acesso negado. Seu IP foi temporariamente bloqueado devido a atividade suspeita.',
            code: 'IP_BLOCKED'
          });
        }
        next();
      } catch (error) {
        logger.error('Erro ao verificar/bloquear IP no Redis:', error);
        next(); // Permite continuar para não bloquear a aplicação por erro no Redis
      }
    };
  }

  /**
   * Bloqueia um IP temporariamente no Redis.
   * Pode ser chamado por um serviço de segurança ou controller.
   * @param {string} ip - O endereço IP a ser bloqueado.
   * @param {number} durationSeconds - Duração do bloqueio em segundos.
   */
  async blockIp(ip, durationSeconds) {
    if (!redisClient || !redisClient.connected) {
      logger.warn('Redis não conectado. Não foi possível bloquear IP.');
      return false;
    }
    const ipBlockKey = `blocked_ip:${ip}`;
    try {
      await redisClient.setex(ipBlockKey, durationSeconds, 'blocked');
      logger.security(`IP ${ip} bloqueado no Redis por ${durationSeconds} segundos.`);
      return true;
    } catch (error) {
      logger.error(`Erro ao bloquear IP ${ip} no Redis:`, error);
      return false;
    }
  }

  /**
   * Desbloqueia um IP.
   * @param {string} ip - O endereço IP a ser desbloqueado.
   */
  async unblockIp(ip) {
    if (!redisClient || !redisClient.connected) {
      logger.warn('Redis não conectado. Não foi possível desbloquear IP.');
      return false;
    }
    const ipBlockKey = `blocked_ip:${ip}`;
    try {
      await redisClient.del(ipBlockKey);
      logger.security(`IP ${ip} desbloqueado do Redis.`);
      return true;
    } catch (error) {
      logger.error(`Erro ao desbloquear IP ${ip} no Redis:`, error);
      return false;
    }
  }
}

// Exporta uma instância única do middleware para ser usada em Express
module.exports = new RateLimiterMiddleware();