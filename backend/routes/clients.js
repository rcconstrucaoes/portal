/**
 * RC Construções - Rotas de Clientes (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Define todas as rotas relacionadas à gestão de clientes:
 * - Criação, listagem, visualização, atualização e exclusão de clientes.
 * - Busca e filtros avançados.
 * - Importação e exportação de dados de clientes.
 * - Obtenção de estatísticas de clientes.
 */

const express = require('express');
const Yup = require('yup');

// Controllers
const ClientsController = require('../controllers/ClientsController');

// Middlewares
const { authenticate, authorize } = require('../middleware/auth'); // Autenticação e autorização
const { validateSchema, sanitizeXSS, validateBusinessRules, isValidCPF, isValidCNPJ } = require('../middleware/validator'); // Validação e sanitização
const { requestLogger, auditLogger } = require('../middleware/logger'); // Logger
const { endpointLimiter } = require('../middleware/rateLimiter'); // Rate Limiting

const router = express.Router();

// Aplica middlewares globais para todas as rotas de clientes
router.use(requestLogger()); // Log de todas as requisições HTTP
router.use(authenticate()); // Todas as rotas de clientes requerem autenticação


/**
 * GET /clients
 * Lista todos os clientes com paginação, busca e filtros.
 * Requer permissão 'clients.view'.
 */
router.get('/',
  authorize('clients.view'), // Apenas usuários com permissão 'clients.view' podem acessar
  endpointLimiter(100, 60 * 1000), // Limite de 100 requisições por minuto para listagem
  validateSchema(
    Yup.object().shape({
      page: Yup.number().integer().positive().optional().default(1),
      limit: Yup.number().integer().positive().max(100).optional().default(10),
      search: Yup.string().optional().default(''),
      status: Yup.string().oneOf(['', 'active', 'inactive']).optional().default(''),
      sortBy: Yup.string().oneOf(['name', 'email', 'createdAt', 'updatedAt']).optional().default('createdAt'),
      sortOrder: Yup.string().oneOf(['ASC', 'DESC']).optional().default('DESC'),
    }),
    'query'
  ),
  auditLogger('clients_listed', 'data_access'), // Log de auditoria
  ClientsController.index
);

/**
 * GET /clients/:id
 * Obtém os detalhes de um cliente específico por ID.
 * Requer permissão 'clients.view'.
 */
router.get('/:id',
  authorize('clients.view'), // Apenas usuários com permissão 'clients.view' podem acessar
  endpointLimiter(50, 60 * 1000), // Limite de 50 requisições por minuto para visualização única
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  auditLogger('client_viewed', 'data_access'), // Log de auditoria
  ClientsController.show
);

/**
 * POST /clients
 * Cria um novo cliente.
 * Requer permissão 'clients.create'.
 */
router.post('/',
  authorize('clients.create'), // Apenas usuários com permissão 'clients.create' podem criar
  endpointLimiter(10, 60 * 1000), // Limite de 10 criações por minuto
  sanitizeXSS(['name', 'email', 'address']), // Sanitiza campos de texto
  validateSchema(
    Yup.object().shape({
      name: Yup.string().required(),
      email: Yup.string().email().required(),
      phone: Yup.string().matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Formato de telefone inválido').required(),
      address: Yup.string().optional().nullable(),
      cpf: Yup.string().test('is-cpf-valid', 'CPF inválido', value => !value || isValidCPF(value)).optional().nullable(),
      // status e outros campos serão validados no controller
    }),
    'body'
  ),
  validateBusinessRules('unique_email_or_cpf'), // Exemplo de regra de negócio customizada
  auditLogger('client_created', 'data_write'), // Log de auditoria
  ClientsController.store
);

/**
 * PUT /clients/:id
 * Atualiza um cliente existente.
 * Requer permissão 'clients.edit'.
 */
router.put('/:id',
  authorize('clients.edit'), // Apenas usuários com permissão 'clients.edit' podem atualizar
  endpointLimiter(30, 60 * 1000), // Limite de 30 atualizações por minuto
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  sanitizeXSS(['name', 'email', 'address']), // Sanitiza campos de texto
  validateSchema(
    Yup.object().shape({
      name: Yup.string().optional(),
      email: Yup.string().email().optional(),
      phone: Yup.string().matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Formato de telefone inválido').optional(),
      address: Yup.string().optional().nullable(),
      cpf: Yup.string().test('is-cpf-valid', 'CPF inválido', value => !value || isValidCPF(value)).optional().nullable(),
      isActive: Yup.boolean().optional(),
    }).noUnknown(), // Proíbe campos não definidos no schema
    'body'
  ),
  auditLogger('client_updated', 'data_write'), // Log de auditoria
  ClientsController.update
);

/**
 * DELETE /clients/:id
 * Exclui um cliente.
 * Requer permissão 'clients.delete'.
 */
router.delete('/:id',
  authorize('clients.delete'), // Apenas usuários com permissão 'clients.delete' podem excluir
  endpointLimiter(5, 60 * 1000), // Limite de 5 exclusões por minuto
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  auditLogger('client_deleted', 'data_write'), // Log de auditoria
  ClientsController.delete
);

/**
 * GET /clients/stats
 * Obtém estatísticas de clientes (ex: total, ativos, inativos, novos no mês).
 * Requer permissão 'clients.view'.
 */
router.get('/stats',
  authorize('clients.view'), // Requer permissão de visualização
  endpointLimiter(30, 60 * 1000), // Limite de 30 requisições de estatísticas por minuto
  auditLogger('clients_stats_viewed', 'data_access'), // Log de auditoria
  ClientsController.getStats
);

// Rotas para Importação e Exportação (se o controlador tiver esses métodos)
/**
 * POST /clients/import
 * Importa clientes de arquivo CSV/Excel.
 * Requer permissão 'clients.create'.
 */
router.post('/import',
  authorize('clients.create'),
  // validateUpload({ fieldName: 'clientFile', maxSize: 10 * 1024 * 1024, allowedMimes: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] }),
  validateSchema(
    Yup.object().shape({
      file: Yup.string().required('Caminho do arquivo é obrigatório'), // Ou use Multer para lidar com o arquivo
      skipDuplicates: Yup.boolean().default(true),
      validateDocuments: Yup.boolean().default(true),
      dryRun: Yup.boolean().default(false)
    }),
    'body'
  ),
  auditLogger('clients_import', 'data_write'),
  ClientsController.importClients // Método no ClientsController
);

/**
 * GET /clients/export
 * Exporta clientes para CSV/Excel.
 * Requer permissão 'clients.view'.
 */
router.get('/export',
  authorize('clients.view'),
  validateSchema(
    Yup.object().shape({
      format: Yup.string().oneOf(['csv', 'xlsx', 'json']).default('csv'),
      filterByStatus: Yup.string().oneOf(['', 'active', 'inactive', 'all']).default('all')
    }),
    'query'
  ),
  auditLogger('clients_export', 'data_access'),
  ClientsController.exportClients // Método no ClientsController
);


/**
 * GET /clients/duplicate-check
 * Verifica por clientes duplicados baseado em e-mail ou CPF.
 * Requer permissão 'clients.view'.
 */
router.get('/duplicate-check',
  authorize('clients.view'),
  validateSchema(
    Yup.object().shape({
      email: Yup.string().email().optional(),
      cpf: Yup.string().optional(),
    }).test('at-least-one-field', 'Pelo menos um campo (email ou cpf) deve ser fornecido', function(value) {
      return value.email || value.cpf;
    }),
    'query'
  ),
  auditLogger('clients_duplicate_check', 'data_access'),
  ClientsController.checkDuplicates
);


// Exporta o router para ser usado pelo aplicativo Express
module.exports = router;