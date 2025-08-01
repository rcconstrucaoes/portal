/**
 * RC Construções - Rotas Financeiras (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este arquivo define todas as rotas relacionadas às operações financeiras da API.
 * Inclui gestão de transações (receitas/despesas), balanço e relatórios financeiros.
 */

const express = require('express');
const Yup = require('yup');

// Controllers
const FinancialController = require('../controllers/FinancialController');

// Middlewares
const { authenticate, authorize } = require('../middleware/auth'); // Autenticação e autorização
const { validateSchema, sanitizeXSS, validateBusinessRules } = require('../middleware/validator'); // Validação e sanitização
const { requestLogger, auditLogger } = require('../middleware/logger'); // Logger
const { endpointLimiter } = require('../middleware/rateLimiter'); // Rate Limiting

const router = express.Router();

// Aplica middlewares globais para todas as rotas financeiras
router.use(requestLogger()); // Log de todas as requisições HTTP
router.use(authenticate()); // Todas as rotas financeiras requerem autenticação


/**
 * GET /financial/transactions
 * Lista todas as transações financeiras com paginação, busca e filtros.
 * Requer permissão 'financial.view'.
 */
router.get('/transactions',
  authorize('financial.view'), // Apenas usuários com permissão 'financial.view' podem acessar
  endpointLimiter(100, 60 * 1000), // Limite de 100 requisições por minuto para listagem
  validateSchema(
    Yup.object().shape({
      page: Yup.number().integer().positive().optional().default(1),
      limit: Yup.number().integer().positive().max(100).optional().default(10),
      search: Yup.string().optional().default(''),
      type: Yup.string().oneOf(['', 'Receita', 'Despesa']).optional().default(''), // Filtrar por tipo
      category: Yup.string().optional().default(''), // Filtrar por categoria
      startDate: Yup.date().optional().nullable(), // Filtro por data de início
      endDate: Yup.date().optional().nullable(), // Filtro por data de término
      sortBy: Yup.string().oneOf(['date', 'amount', 'type', 'category', 'createdAt', 'updatedAt']).optional().default('date'),
      sortOrder: Yup.string().oneOf(['ASC', 'DESC']).optional().default('DESC'),
    }),
    'query'
  ),
  auditLogger('financial_transactions_listed', 'data_access'), // Log de auditoria
  FinancialController.index
);

/**
 * GET /financial/transactions/:id
 * Obtém os detalhes de uma transação financeira específica por ID.
 * Requer permissão 'financial.view'.
 */
router.get('/transactions/:id',
  authorize('financial.view'), // Apenas usuários com permissão 'financial.view' podem acessar
  endpointLimiter(50, 60 * 1000), // Limite de 50 requisições por minuto para visualização única
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  auditLogger('financial_transaction_viewed', 'data_access'), // Log de auditoria
  FinancialController.show
);

/**
 * POST /financial/transactions
 * Cria uma nova transação financeira (receita ou despesa).
 * Requer permissão 'financial.edit'.
 */
router.post('/transactions',
  authorize('financial.edit'), // Apenas usuários com permissão 'financial.edit' podem criar
  endpointLimiter(10, 60 * 1000), // Limite de 10 criações por minuto
  sanitizeXSS(['description', 'category']), // Sanitiza campos de texto
  validateSchema(
    Yup.object().shape({
      type: Yup.string().oneOf(['Receita', 'Despesa']).required(),
      description: Yup.string().min(5).max(200).required(),
      amount: Yup.number().positive().required(),
      date: Yup.date().required('Data da transação é obrigatória'),
      category: Yup.string().required(),
      referenceId: Yup.string().uuid().optional().nullable(), // Opcional, se refere a outro ID (contrato, orçamento)
    }),
    'body'
  ),
  // Opcional: Adicionar validateBusinessRules aqui (ex: saldo insuficiente)
  auditLogger('financial_transaction_created', 'data_write'), // Log de auditoria
  FinancialController.store
);

/**
 * PUT /financial/transactions/:id
 * Atualiza uma transação financeira existente.
 * Requer permissão 'financial.edit'.
 */
router.put('/transactions/:id',
  authorize('financial.edit'), // Apenas usuários com permissão 'financial.edit' podem atualizar
  endpointLimiter(30, 60 * 1000), // Limite de 30 atualizações por minuto
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  sanitizeXSS(['description', 'category']), // Sanitiza campos de texto
  validateSchema(
    Yup.object().shape({
      type: Yup.string().oneOf(['Receita', 'Despesa']).optional(),
      description: Yup.string().min(5).max(200).optional(),
      amount: Yup.number().positive().optional(),
      date: Yup.date().optional(),
      category: Yup.string().optional(),
      referenceId: Yup.string().uuid().optional().nullable(),
    }).noUnknown(), // Proíbe campos não definidos no schema
    'body'
  ),
  auditLogger('financial_transaction_updated', 'data_write'), // Log de auditoria
  FinancialController.update
);

/**
 * DELETE /financial/transactions/:id
 * Exclui uma transação financeira.
 * Requer permissão 'financial.edit' (ou 'financial.delete' se for mais granular).
 */
router.delete('/transactions/:id',
  authorize('financial.edit'), // Ou 'financial.delete' se for mais granular
  endpointLimiter(5, 60 * 1000), // Limite de 5 exclusões por minuto
  validateSchema(
    Yup.object().shape({
      id: Yup.number().integer().positive().required()
    }),
    'params'
  ),
  auditLogger('financial_transaction_deleted', 'data_write'), // Log de auditoria
  FinancialController.delete
);

/**
 * GET /financial/balance
 * Calcula e retorna o balanço financeiro (receitas - despesas) para um período.
 * Requer permissão 'financial.view'.
 */
router.get('/balance',
  authorize('financial.view'), // Requer permissão de visualização
  endpointLimiter(30, 60 * 1000), // Limite de 30 requisições de balanço por minuto
  validateSchema(
    Yup.object().shape({
      startDate: Yup.date().optional().nullable(),
      endDate: Yup.date().optional().nullable(),
      type: Yup.string().oneOf(['', 'Receita', 'Despesa']).optional(), // Para balanço parcial por tipo
      category: Yup.string().optional() // Para balanço por categoria
    }),
    'query'
  ),
  auditLogger('financial_balance_viewed', 'data_access'), // Log de auditoria
  FinancialController.getBalance
);

// Rotas de Relatórios Financeiros (podem ser separadas no módulo de relatórios)
// Se você tiver um ReportsController, estas rotas podem ser movidas para lá.
/**
 * GET /financial/reports/summary
 * Gera um relatório resumo financeiro.
 * Requer permissão 'reports.generate'.
 */
// router.get('/reports/summary',
//   authorize('reports.generate'),
//   FinancialController.getSummaryReport
// );


// Exporta o router para ser usado pelo aplicativo Express
module.exports = router;