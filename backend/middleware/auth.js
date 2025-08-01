/**
 * RC Construções - Middleware de Autenticação (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este middleware é responsável por:
 * - Verificar e validar tokens JWT para autenticação.
 * - Carregar dados do usuário autenticado para `req.user`.
 * - Verificar permissões e roles para controle de acesso.
 * - Implementar cache de usuário e blacklist de tokens para otimização e segurança.
 */

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

const authConfig = require('../config/auth'); // Configurações de autenticação (segredo JWT, expiração, roles)
const logger = require('../config/logger'); // Logger do backend
const User = require('../models/User'); // Modelo de Usuário para buscar dados do DB
const redisConfig = require('../config/redis'); // Configurações do Redis

// Inicializa o cliente Redis para cache e blacklist
const redisClient = new Redis(redisConfig.port, redisConfig.host, {
  password: redisConfig.password,
  db: redisConfig.db,
  keyPrefix: 'auth:' // Prefixo para chaves Redis relacionadas à autenticação
});

// Tratamento de erros de conexão do Redis
redisClient.on('error', (err) => {
  logger.error('Erro de conexão com Redis (Auth Middleware):', err);
});
redisClient.on('connect', () => {
  logger.info('Conectado ao Redis para Auth Middleware.');
});


class AuthMiddleware {
  constructor() {
    // Cache em memória para usuários autenticados (melhora performance)
    this.userCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos de cache para dados de usuário

    // Blacklist de tokens JWT (usando Redis para persistência e escalabilidade)
    // A chave do Redis será 'blacklist:{tokenHash}' e o valor será a expiração do token.
    this.tokenBlacklistPrefix = 'blacklist:';
    
    // Rate limiter específico para APIs autenticadas
    this.apiRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // - 15 minutos
      max: parseInt(process.env.AUTH_API_RATE_LIMIT_MAX || '1000', 10), // - 1000 requisições por janela por usuário autenticado
      message: {
        error: 'Muitas requisições. Por favor, tente novamente mais tarde.',
        code: 'TOO_MANY_REQUESTS'
      },
      // Chave baseada no ID do usuário autenticado para evitar que um único IP bloqueie múltiplos usuários
      keyGenerator: (req) => req.user?.id || req.ip, //
      standardHeaders: true,
      legacyHeaders: false,
      // Handler quando o limite é excedido
      handler: (req, res, next, options) => {
        logger.warn('Rate limit excedido para API autenticada', {
          userId: req.user?.id,
          ip: req.ip,
          route: req.originalUrl
        });
        res.status(options.statusCode).json(options.message);
      }
    });

    // Inicia a limpeza automática do cache de usuários
    this.startCacheCleanup();
  }

  /**
   * Limpa entradas expiradas do cache de usuários em memória.
   * Não afeta a blacklist Redis, que tem expiração própria.
   */
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [userId, { timestamp }] of this.userCache.entries()) {
        if (now - timestamp > this.cacheTimeout) {
          this.userCache.delete(userId);
          logger.debug(`Usuário ${userId} removido do cache de autenticação.`);
        }
      }
    }, 5 * 60 * 1000); // Executa a cada 5 minutos
  }

  /**
   * Adiciona um token à blacklist no Redis.
   * O token será invalidado até sua expiração original.
   * @param {string} token - O JWT a ser blacklisted.
   * @param {number} expiresInSeconds - Tempo de expiração do token em segundos.
   */
  async addTokenToBlacklist(token, expiresInSeconds) {
    if (!redisClient.connected) {
      logger.warn('Redis não conectado. Não foi possível adicionar token à blacklist.');
      return;
    }
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    const key = `${this.tokenBlacklistPrefix}${tokenHash}`;
    
    try {
      await redisClient.setex(key, expiresInSeconds, 'blacklisted'); // Define com expiração
      logger.info('Token adicionado à blacklist Redis', { tokenHash: tokenHash.substring(0, 10) + '...', expiresIn: expiresInSeconds });
    } catch (error) {
      logger.error('Erro ao adicionar token à blacklist no Redis:', error);
    }
  }

  /**
   * Verifica se um token está na blacklist.
   * @param {string} token - O JWT a ser verificado.
   * @returns {Promise<boolean>} True se o token estiver na blacklist, false caso contrário.
   */
  async isTokenBlacklisted(token) {
    if (!redisClient.connected) {
      // Se Redis não está conectado, por segurança, assume que não está blacklisted
      // ou pode-se decidir rejeitar a requisição dependendo da política de segurança.
      logger.warn('Redis não conectado. Verificação da blacklist ignorada.');
      return false;
    }
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    const key = `${this.tokenBlacklistPrefix}${tokenHash}`;
    try {
      const isBlacklisted = await redisClient.exists(key);
      if (isBlacklisted) {
        logger.debug('Token encontrado na blacklist', { tokenHash: tokenHash.substring(0, 10) + '...' });
      }
      return isBlacklisted === 1; // 1 se existe, 0 se não
    } catch (error) {
      logger.error('Erro ao verificar token na blacklist do Redis:', error);
      return false; // Por segurança, se houver erro, assume que não está blacklisted (ou ajuste a política)
    }
  }

  /**
   * Middleware para verificar a autenticação JWT.
   * Atribui `req.user` se o token for válido.
   */
  authenticate() {
    return async (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Tentativa de acesso não autorizado: Bearer token ausente.', { ip: req.ip });
        return res.status(401).json({
          error: 'Token de autenticação não fornecido ou mal formatado',
          code: 'AUTH_TOKEN_MISSING'
        });
      }

      const token = authHeader.split(' ')[1];

      // Verifica se o token está na blacklist
      if (await this.isTokenBlacklisted(token)) {
        logger.warn('Tentativa de acesso com token blacklisted', { tokenSnippet: token.substring(0, 30) + '...', ip: req.ip });
        return res.status(401).json({
          error: 'Token inválido ou sessão encerrada',
          code: 'TOKEN_BLACKLISTED'
        });
      }

      try {
        // Verifica e decodifica o token JWT
        const decoded = jwt.verify(token, authConfig.secret); //

        // Tenta obter o usuário do cache primeiro
        let user = this.userCache.get(decoded.id);

        if (!user) {
          // Se não estiver no cache, busca no banco de dados
          user = await User.findByPk(decoded.id, {
            attributes: ['id', 'username', 'email', 'role', 'permissions', 'isActive'] // Busca apenas campos necessários
          });

          if (!user) {
            logger.warn('Token JWT válido, mas usuário não encontrado no banco de dados', { userId: decoded.id, ip: req.ip });
            return res.status(401).json({
              error: 'Usuário não encontrado',
              code: 'USER_NOT_FOUND'
            });
          }

          if (!user.isActive) {
            logger.warn('Token JWT válido, mas usuário inativo', { userId: user.id, ip: req.ip });
            return res.status(401).json({
              error: 'Usuário inativo',
              code: 'USER_INACTIVE'
            });
          }

          // Adiciona o usuário ao cache
          this.userCache.set(user.id, { user: user, timestamp: Date.now() });
          logger.debug(`Usuário ${user.id} adicionado ao cache de autenticação.`);
        }

        // Atribui as informações do usuário à requisição
        req.user = user;
        next(); // Continua para a próxima middleware/rota

      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          logger.warn('Token JWT expirado', { ip: req.ip });
          return res.status(401).json({
            error: 'Token de autenticação expirado',
            code: 'TOKEN_EXPIRED'
          });
        } else if (error.name === 'JsonWebTokenError') {
          logger.warn('Token JWT inválido', { error: error.message, ip: req.ip });
          return res.status(401).json({
            error: 'Token de autenticação inválido',
            code: 'TOKEN_INVALID'
          });
        }
        logger.error('Erro inesperado na autenticação JWT', {
          error: error.message,
          stack: error.stack,
          ip: req.ip
        });
        return res.status(500).json({
          error: 'Erro interno do servidor na autenticação',
          code: 'SERVER_ERROR'
        });
      }
    };
  }

  /**
   * Middleware para verificar permissões de usuário.
   * @param {string|Array<string>} requiredPermissions - Permissão ou array de permissões necessárias.
   */
  authorize(requiredPermissions) {
    return (req, res, next) => {
      const userPermissions = req.user?.permissions || [];
      const userRole = req.user?.role; //

      // Se o usuário tem a permissão 'system.admin', ele tem acesso total
      if (userPermissions.includes('system.admin')) { //
        logger.debug(`Admin (${req.user.id}) autorizado via permissão 'system.admin'.`, { ip: req.ip });
        return next();
      }

      // Converte requiredPermissions para array se for uma string
      const permissionsToCheck = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

      const hasPermission = permissionsToCheck.every(perm => userPermissions.includes(perm));

      if (hasPermission) {
        logger.debug(`Usuário ${req.user.id} autorizado com permissões: ${permissionsToCheck.join(', ')}`, { ip: req.ip });
        next();
      } else {
        logger.warn('Acesso negado: Permissões insuficientes', {
          userId: req.user?.id,
          required: permissionsToCheck,
          has: userPermissions,
          ip: req.ip
        });
        return res.status(403).json({
          error: 'Acesso negado. Permissões insuficientes.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
    };
  }

  /**
   * Middleware para aplicar o rate limiter para APIs autenticadas.
   */
  applyApiRateLimit() {
    return this.apiRateLimit;
  }
}

// Exporta a instância do middleware de autenticação
module.exports = new AuthMiddleware();