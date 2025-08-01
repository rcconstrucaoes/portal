/**
 * RC Construções - Rotas de Logs (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este arquivo define todas as rotas relacionadas ao sistema de logs e auditoria.
 * Inclui visualização de logs, análise de auditoria e monitoramento do sistema.
 * ATENÇÃO: Estas rotas são RESTRICTED a usuários com privilégios administrativos.
 */

const express = require('express');
const Yup = require('yup');

// Controllers
const LogsController = require('../controllers/LogsController');

// Middlewares
const { authenticate, authorize } = require('../middleware/auth'); // Autenticação e autorização
const { validateSchema } = require('../middleware/validator'); // Validação de esquema
const { requestLogger, auditLogger } = require('../middleware/logger'); // Logger
const { endpointLimiter } = require('../middleware/rateLimiter'); // Rate Limiting

const router = express.Router();

// Aplica middlewares globais para todas as rotas de logs
router.use(requestLogger()); // Log de todas as requisições HTTP
router.use(authenticate()); // Todas as rotas de logs requerem autenticação
router.use(authorize('system.admin')); // SOMENTE administradores podem acessar rotas de logs


/**
 * GET /logs
 * Lista logs com paginação, busca e filtros.
 * Requer permissão 'system.admin' (já aplicada via router.use).
 */
router.get('/',
  endpointLimiter(30, 60 * 1000), // Limite de 30 requisições por minuto para listagem de logs
  validateSchema(
    Yup.object().shape({
      page: Yup.number().integer().min(1).optional().default(1),
      limit: Yup.number().integer().min(1).max(100).optional().default(10),
      search: Yup.string().optional().default(''),
      level: Yup.string()
        .oneOf(['', 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']) // Níveis de log do Winston
        .optional().default(''),
      context: Yup.string().optional().default(''), // Ex: 'AuthController', 'Database'
      startDate: Yup.date().optional().nullable(),
      endDate: Yup.date().optional().nullable(),
      sortBy: Yup.string().oneOf(['timestamp', 'level', 'context']).optional().default('timestamp'),
      sortOrder: Yup.string().oneOf(['ASC', 'DESC']).optional().default('DESC'),
    }),
    'query'
  ),
  auditLogger('logs_listed', 'system_access'), // Log de auditoria para acesso aos logs
  LogsController.index
);

/**
 * GET /logs/:id
 * Obtém os detalhes de um log específico por ID.
 * Requer permissão 'system.admin'.
 */
router.get('/:id',
  endpointLimiter(10, 60 * 1000), // Limite mais restritivo para visualização única
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  auditLogger('log_viewed', 'system_access'), // Log de auditoria
  LogsController.show
);

/**
 * GET /logs/stats
 * Obtém estatísticas de logs (ex: contagem por nível, por contexto, últimos erros).
 * Requer permissão 'system.admin'.
 */
router.get('/stats',
  endpointLimiter(20, 60 * 1000), // Limite de 20 requisições por minuto para estatísticas de logs
  auditLogger('logs_stats_viewed', 'system_access'), // Log de auditoria
  LogsController.getStats
);

// Opcional: Rota para baixar arquivos de log diretamente (muito sensível)
// router.get('/files/:filename',
//   authorize('system.admin'), // APENAS ADMIN
//   LogsController.downloadFile
// );

// Exporta o router para ser usado pelo aplicativo Express
module.exports = router;