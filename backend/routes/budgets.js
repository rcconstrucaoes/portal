/**
 * RC Construções - Rotas de Orçamentos (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Define todas as rotas relacionadas à gestão de orçamentos:
 * - Criação, listagem, visualização, atualização e exclusão de orçamentos.
 * - Aprovação de orçamentos.
 * - Obtenção de estatísticas de orçamentos.
 */

const express = require('express');
const Yup = require('yup');

// Controllers
const BudgetsController = require('../controllers/BudgetsController');

// Middlewares
const { authenticate, authorize } = require('../middleware/auth'); // Autenticação e autorização
const { validateSchema, sanitizeXSS, validateBusinessRules } = require('../middleware/validator'); // Validação e sanitização
const { requestLogger, auditLogger } = require('../middleware/logger'); // Logger
const { endpointLimiter } = require('../middleware/rateLimiter'); // Rate Limiting

const router = express.Router();

// Aplica middlewares globais para todas as rotas de orçamentos
router.use(requestLogger()); // Log de todas as requisições HTTP
router.use(authenticate()); // Todas as rotas de orçamentos requerem autenticação


/**
 * GET /budgets
 * Lista todos os orçamentos com paginação, busca e filtros.
 * Requer permissão 'budgets.view'.
 */
router.get('/',
  authorize('budgets.view'), // Apenas usuários com permissão 'budgets.view' podem acessar
  endpointLimiter(100, 60 * 1000), // Limite de 100 requisições por minuto para listagem
  validateSchema(
    Yup.object().shape({
      page: Yup.number().integer().positive().optional().default(1),
      limit: Yup.number().integer().positive().max(100).optional().default(10),
      search: Yup.string().optional().default(''),
      status: Yup.string().oneOf(['', 'Pendente', 'Aprovado', 'Rejeitado', 'Cancelado']).optional().default(''),
      clientId: Yup.number().integer().positive().optional().nullable(),
      sortBy: Yup.string().oneOf(['title', 'amount', 'status', 'createdAt', 'updatedAt']).optional().default('createdAt'),
      sortOrder: Yup.string().oneOf(['ASC', 'DESC']).optional().default('DESC'),
    }),
    'query'
  ),
  auditLogger('budgets_listed', 'data_access'), // Log de auditoria
  BudgetsController.index
);

/**
 * GET /budgets/:id
 * Obtém os detalhes de um orçamento específico por ID.
 * Requer permissão 'budgets.view'.
 */
router.get('/:id',
  authorize('budgets.view'), // Apenas usuários com permissão 'budgets.view' podem acessar
  endpointLimiter(50, 60 * 1000), // Limite de 50 requisições por minuto para visualização única
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  auditLogger('budget_viewed', 'data_access'), // Log de auditoria
  BudgetsController.show
);

/**
 * POST /budgets
 * Cria um novo orçamento.
 * Requer permissão 'budgets.create'.
 */
router.post('/',
  authorize('budgets.create'), // Apenas usuários com permissão 'budgets.create' podem criar
  endpointLimiter(10, 60 * 1000), // Limite de 10 criações por minuto
  sanitizeXSS(['title', 'description']), // Sanitiza campos de texto
  validateSchema(
    Yup.object().shape({
      clientId: Yup.number().integer().positive().required(),
      title: Yup.string().min(3).max(100).required(),
      description: Yup.string().optional().nullable(),
      amount: Yup.number().positive().required(),
      status: Yup.string().oneOf(['Pendente', 'Aprovado', 'Rejeitado', 'Cancelado']).optional().default('Pendente')
    }),
    'body'
  ),
  // Opcional: Adicionar validateBusinessRules aqui para regras de negócio específicas
  auditLogger('budget_created', 'data_write'), // Log de auditoria
  BudgetsController.store
);

/**
 * PUT /budgets/:id
 * Atualiza um orçamento existente.
 * Requer permissão 'budgets.edit'.
 */
router.put('/:id',
  authorize('budgets.edit'), // Apenas usuários com permissão 'budgets.edit' podem atualizar
  endpointLimiter(30, 60 * 1000), // Limite de 30 atualizações por minuto
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  sanitizeXSS(['title', 'description', 'status']), // Sanitiza campos de texto
  validateSchema(
    Yup.object().shape({ // Partial() permite que nem todos os campos sejam enviados
      clientId: Yup.number().integer().positive().optional(),
      title: Yup.string().min(3).max(100).optional(),
      description: Yup.string().optional().nullable(),
      amount: Yup.number().positive().optional(),
      status: Yup.string().oneOf(['Pendente', 'Aprovado', 'Rejeitado', 'Cancelado']).optional(),
    }).noUnknown(), // Proíbe campos não definidos no schema
    'body'
  ),
  auditLogger('budget_updated', 'data_write'), // Log de auditoria
  BudgetsController.update
);

/**
 * PATCH /budgets/:id/status
 * Altera o status de um orçamento (ex: para Aprovado).
 * Requer permissão 'budgets.approve' (mais restritiva).
 */
router.patch('/:id/status',
  authorize('budgets.approve'), // Permissão específica para aprovação
  endpointLimiter(20, 60 * 1000),
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  validateSchema(
    Yup.object().shape({
      status: Yup.string().oneOf(['Pendente', 'Aprovado', 'Rejeitado', 'Cancelado']).required('Novo status é obrigatório.')
    }),
    'body'
  ),
  auditLogger('budget_status_changed', 'data_write'), // Log de auditoria
  BudgetsController.updateStatus // Método específico para mudança de status, se existir no controller
);


/**
 * DELETE /budgets/:id
 * Exclui um orçamento.
 * Requer permissão 'budgets.delete'.
 */
router.delete('/:id',
  authorize('budgets.delete'), // Apenas usuários com permissão 'budgets.delete' podem excluir
  endpointLimiter(5, 60 * 1000), // Limite de 5 exclusões por minuto
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  auditLogger('budget_deleted', 'data_write'), // Log de auditoria
  BudgetsController.delete
);

/**
 * GET /budgets/stats
 * Obtém estatísticas de orçamentos (ex: total, por status, valor médio).
 * Requer permissão 'budgets.view'.
 */
router.get('/stats',
  authorize('budgets.view'), // Requer permissão de visualização
  endpointLimiter(30, 60 * 1000), // Limite de 30 requisições de estatísticas por minuto
  auditLogger('budgets_stats_viewed', 'data_access'), // Log de auditoria
  BudgetsController.getStats
);

// Exporta o router para ser usado pelo aplicativo Express
module.exports = router;