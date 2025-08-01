/**
 * RC Construções - Rotas de Sincronização (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este arquivo define todas as rotas relacionadas à sincronização de dados entre
 * cliente e servidor. Inclui sincronização de status, pull de dados e push de dados.
 */

const express = require('express');
const Yup = require('yup');

// Controllers
const SyncController = require('../controllers/SyncController');

// Middlewares
const { authenticate, authorize } = require('../middleware/auth'); // Autenticação e autorização
const { validateSchema } = require('../middleware/validator'); // Validação de esquema
const { requestLogger, auditLogger } = require('../middleware/logger'); // Logger
const { endpointLimiter } = require('../middleware/rateLimiter'); // Rate Limiting

const router = express.Router();

// Aplica middlewares globais para todas as rotas de sincronização
router.use(requestLogger()); // Log de todas as requisições HTTP
router.use(authenticate()); // Todas as rotas de sincronização requerem autenticação
// Sem uma necessidade específica, não usaremos authorize() para cada rota aqui,
// pois `authenticate` já garante que o usuário está logado.
// Se precisar de granularidade, adicione `authorize('sync.pull')` ou similar.


/**
 * GET /sync/status
 * Retorna o status atual da sincronização do servidor, como últimos timestamps.
 * Requer autenticação.
 */
router.get('/status',
  endpointLimiter(60, 60 * 1000), // Limite de 60 requisições por minuto para status
  auditLogger('sync_status_viewed', 'sync_access'), // Log de auditoria
  SyncController.status
);

/**
 * GET /sync/pull
 * Permite ao cliente puxar dados do servidor.
 * Requer autenticação.
 */
router.get('/pull',
  endpointLimiter(30, 60 * 1000), // Limite de 30 requisições de pull por minuto
  validateSchema(
    Yup.object().shape({
      table: Yup.string().required('Nome da tabela é obrigatório').matches(/^[a-zA-Z]+$/, 'Nome da tabela inválido'),
      lastSync: Yup.number().integer().min(0).required('Timestamp da última sincronização é obrigatório'),
      deviceId: Yup.string().uuid('ID do dispositivo inválido').required('ID do dispositivo é obrigatório')
    }),
    'query'
  ),
  auditLogger('sync_pull_data', 'data_sync'), // Log de auditoria
  SyncController.pull
);

/**
 * POST /sync/push
 * Permite ao cliente enviar dados (criações, atualizações, exclusões) para o servidor.
 * Requer autenticação.
 */
router.post('/push',
  endpointLimiter(20, 60 * 1000), // Limite de 20 requisições de push por minuto
  validateSchema(
    Yup.object().shape({
      table: Yup.string().required('Nome da tabela é obrigatório').matches(/^[a-zA-Z]+$/, 'Nome da tabela inválido'),
      data: Yup.array().of(Yup.object().required('Cada item de dados deve ser um objeto')).min(0).required('Array de dados é obrigatório'),
      deviceId: Yup.string().uuid('ID do dispositivo inválido').required('ID do dispositivo é obrigatório')
    }),
    'body'
  ),
  auditLogger('sync_push_data', 'data_sync'), // Log de auditoria
  SyncController.push
);

// Exporta o router para ser usado pelo aplicativo Express
module.exports = router;