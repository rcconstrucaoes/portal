/**
 * RC Construções - Rotas de Contratos (Backend)
 * Versão 5.1
 * 
 * Este arquivo define todas as rotas relacionadas aos contratos da API.
 * As rotas seguem padrões RESTful e incluem middleware de autenticação e validação.
 */

const express = require('express');
const router = express.Router();

// Importa o controller que contém a lógica de negócio
const ContractsController = require('../controllers/ContractsController');

// Importa os middlewares necessários
const authMiddleware = require('../middleware/auth');
const loggerMiddleware = require('../middleware/logger');
const rateLimiterMiddleware = require('../middleware/rateLimiter');
const validatorMiddleware = require('../middleware/validator');

// Aplicar middleware de autenticação para todas as rotas de contratos
router.use(authMiddleware);

// Aplicar middleware de logging para monitorar todas as operações
router.use(loggerMiddleware);

// Aplicar rate limiting para prevenir abuse
router.use(rateLimiterMiddleware);

/**
 * @route   GET /contracts
 * @desc    Lista todos os contratos
 * @access  Privado (Requer autenticação)
 * @returns {Array} Lista de contratos com dados dos clientes associados
 */
router.get('/', ContractsController.index);

/**
 * @route   GET /contracts/search
 * @desc    Busca contratos por critérios específicos
 * @access  Privado (Requer autenticação)
 * @query   {String} q - Termo de busca
 * @query   {String} status - Status do contrato
 * @query   {String} client_id - ID do cliente
 * @query   {Date} start_date - Data de início (para filtrar por período)
 * @query   {Date} end_date - Data de fim (para filtrar por período)
 * @returns {Array} Lista de contratos filtrados
 */
router.get('/search', ContractsController.search);

/**
 * @route   GET /contracts/stats
 * @desc    Retorna estatísticas dos contratos
 * @access  Privado (Requer autenticação)
 * @returns {Object} Estatísticas dos contratos (total, por status, etc.)
 */
router.get('/stats', ContractsController.stats);

/**
 * @route   GET /contracts/by-client/:client_id
 * @desc    Lista todos os contratos de um cliente específico
 * @access  Privado (Requer autenticação)
 * @param   {Number} client_id - ID do cliente
 * @returns {Array} Lista de contratos do cliente
 */
router.get('/by-client/:client_id', ContractsController.getByClient);

/**
 * @route   GET /contracts/:id
 * @desc    Busca um contrato específico pelo ID
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {Object} Dados completos do contrato
 */
router.get('/:id', ContractsController.show);

/**
 * @route   POST /contracts
 * @desc    Cria um novo contrato
 * @access  Privado (Requer autenticação)
 * @body    {Object} Dados do contrato
 * @returns {Object} Contrato criado
 */
router.post('/', 
    validatorMiddleware.validateContract, // Middleware de validação específico
    ContractsController.store
);

/**
 * @route   PUT /contracts/:id
 * @desc    Atualiza um contrato existente
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @body    {Object} Dados atualizados do contrato
 * @returns {Object} Contrato atualizado
 */
router.put('/:id', 
    validatorMiddleware.validateContractUpdate, // Validação para atualização
    ContractsController.update
);

/**
 * @route   PATCH /contracts/:id/status
 * @desc    Atualiza apenas o status de um contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @body    {String} status - Novo status do contrato
 * @returns {Object} Contrato com status atualizado
 */
router.patch('/:id/status', 
    validatorMiddleware.validateStatusUpdate,
    ContractsController.updateStatus
);

/**
 * @route   POST /contracts/:id/duplicate
 * @desc    Cria uma cópia de um contrato existente
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato a ser duplicado
 * @returns {Object} Novo contrato criado baseado no original
 */
router.post('/:id/duplicate', ContractsController.duplicate);

/**
 * @route   GET /contracts/:id/timeline
 * @desc    Retorna o histórico de alterações do contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {Array} Timeline de alterações do contrato
 */
router.get('/:id/timeline', ContractsController.getTimeline);

/**
 * @route   GET /contracts/:id/documents
 * @desc    Lista todos os documentos anexados ao contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {Array} Lista de documentos do contrato
 */
router.get('/:id/documents', ContractsController.getDocuments);

/**
 * @route   POST /contracts/:id/documents
 * @desc    Anexa um novo documento ao contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @body    {File} document - Arquivo a ser anexado
 * @returns {Object} Documento anexado
 */
router.post('/:id/documents', ContractsController.attachDocument);

/**
 * @route   DELETE /contracts/:id/documents/:document_id
 * @desc    Remove um documento do contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @param   {Number} document_id - ID do documento
 * @returns {Object} Confirmação de remoção
 */
router.delete('/:id/documents/:document_id', ContractsController.removeDocument);

/**
 * @route   GET /contracts/:id/budget
 * @desc    Retorna o orçamento detalhado do contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {Object} Orçamento detalhado do contrato
 */
router.get('/:id/budget', ContractsController.getBudget);

/**
 * @route   PUT /contracts/:id/budget
 * @desc    Atualiza o orçamento do contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @body    {Object} Dados do orçamento
 * @returns {Object} Orçamento atualizado
 */
router.put('/:id/budget', 
    validatorMiddleware.validateBudget,
    ContractsController.updateBudget
);

/**
 * @route   GET /contracts/:id/financial
 * @desc    Retorna o resumo financeiro do contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {Object} Resumo financeiro (pagamentos, pendências, etc.)
 */
router.get('/:id/financial', ContractsController.getFinancialSummary);

/**
 * @route   POST /contracts/:id/payments
 * @desc    Registra um novo pagamento para o contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @body    {Object} Dados do pagamento
 * @returns {Object} Pagamento registrado
 */
router.post('/:id/payments', 
    validatorMiddleware.validatePayment,
    ContractsController.addPayment
);

/**
 * @route   GET /contracts/:id/payments
 * @desc    Lista todos os pagamentos do contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {Array} Lista de pagamentos
 */
router.get('/:id/payments', ContractsController.getPayments);

/**
 * @route   PUT /contracts/:id/payments/:payment_id
 * @desc    Atualiza um pagamento específico
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @param   {Number} payment_id - ID do pagamento
 * @body    {Object} Dados atualizados do pagamento
 * @returns {Object} Pagamento atualizado
 */
router.put('/:id/payments/:payment_id', 
    validatorMiddleware.validatePayment,
    ContractsController.updatePayment
);

/**
 * @route   DELETE /contracts/:id/payments/:payment_id
 * @desc    Remove um pagamento do contrato
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @param   {Number} payment_id - ID do pagamento
 * @returns {Object} Confirmação de remoção
 */
router.delete('/:id/payments/:payment_id', ContractsController.removePayment);

/**
 * @route   GET /contracts/:id/export/pdf
 * @desc    Gera e retorna o contrato em formato PDF
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {File} Arquivo PDF do contrato
 */
router.get('/:id/export/pdf', ContractsController.exportPDF);

/**
 * @route   GET /contracts/:id/export/excel
 * @desc    Gera e retorna os dados do contrato em formato Excel
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {File} Arquivo Excel com dados do contrato
 */
router.get('/:id/export/excel', ContractsController.exportExcel);

/**
 * @route   POST /contracts/import
 * @desc    Importa contratos de um arquivo (CSV/Excel)
 * @access  Privado (Requer autenticação)
 * @body    {File} file - Arquivo para importação
 * @returns {Object} Resultado da importação
 */
router.post('/import', 
    validatorMiddleware.validateImportFile,
    ContractsController.importContracts
);

/**
 * @route   GET /contracts/export/bulk
 * @desc    Exporta múltiplos contratos
 * @access  Privado (Requer autenticação)
 * @query   {Array} ids - IDs dos contratos para exportar
 * @query   {String} format - Formato da exportação (pdf, excel, csv)
 * @returns {File} Arquivo com contratos exportados
 */
router.get('/export/bulk', ContractsController.bulkExport);

/**
 * @route   POST /contracts/bulk-update
 * @desc    Atualiza múltiplos contratos de uma vez
 * @access  Privado (Requer autenticação)
 * @body    {Object} Dados para atualização em lote
 * @returns {Object} Resultado da atualização em lote
 */
router.post('/bulk-update', 
    validatorMiddleware.validateBulkUpdate,
    ContractsController.bulkUpdate
);

/**
 * @route   DELETE /contracts/:id
 * @desc    Remove um contrato (soft delete)
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {Object} Confirmação de remoção
 */
router.delete('/:id', ContractsController.destroy);

/**
 * @route   POST /contracts/:id/restore
 * @desc    Restaura um contrato removido (soft delete)
 * @access  Privado (Requer autenticação)
 * @param   {Number} id - ID do contrato
 * @returns {Object} Contrato restaurado
 */
router.post('/:id/restore', ContractsController.restore);

/**
 * @route   DELETE /contracts/:id/force
 * @desc    Remove permanentemente um contrato (hard delete)
 * @access  Privado (Requer autenticação e permissões de admin)
 * @param   {Number} id - ID do contrato
 * @returns {Object} Confirmação de remoção permanente
 */
router.delete('/:id/force', 
    authMiddleware.requireAdmin, // Middleware adicional para admin
    ContractsController.forceDestroy
);

// Middleware de tratamento de erros específico para as rotas de contratos
router.use((error, req, res, next) => {
    console.error('Erro nas rotas de contratos:', error);
    
    // Se o erro já tem um status code, usa ele
    if (error.status) {
        return res.status(error.status).json({
            error: error.message || 'Erro nas operações de contrato',
            code: error.code || 'CONTRACT_ERROR'
        });
    }
    
    // Erros de validação do Sequelize
    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
            error: 'Dados inválidos fornecidos',
            details: error.errors.map(err => ({
                field: err.path,
                message: err.message
            }))
        });
    }
    
    // Erros de chave estrangeira
    if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
            error: 'Referência inválida detectada',
            message: 'Verifique se todos os IDs fornecidos são válidos'
        });
    }
    
    // Erro genérico do servidor
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Entre em contato com o suporte se o problema persistir'
    });
});

module.exports = router;