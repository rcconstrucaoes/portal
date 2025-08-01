/**
 * RC Construções - Módulo de Orçamentos (Revisado e Aprimorado)
 * Gerencia todas as funcionalidades relacionadas a orçamentos, incluindo
 * criação, leitura, atualização, exclusão, filtragem e aprovação.
 * Aprimorado para ser robusto, com validação, e integração com outros módulos.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let validationManager;
    let utilsManager; // Para formatação, se necessário
    let eventHandler;
    let cloudSync; // Para sincronização de dados

    const BUDGETS_CONFIG = {
        tableName: 'budgets',
        defaultStatus: 'Pendente', // 'Pendente', 'Aprovado', 'Rejeitado', 'Cancelado'
        // Mapeamento de status para classes CSS para badges ou cores
        statusClasses: {
            'Pendente': 'badge-warning',
            'Aprovado': 'badge-success',
            'Rejeitado': 'badge-danger',
            'Cancelado': 'badge-secondary'
        },
        // Campos que serão editáveis/visíveis na UI
        fields: {
            clientId: { type: 'number', required: true, label: 'Cliente' },
            title: { type: 'string', required: true, label: 'Título', minLength: 3, maxLength: 100 },
            description: { type: 'string', required: false, label: 'Descrição' },
            amount: { type: 'number', required: true, label: 'Valor', min: 0 },
            status: { type: 'string', required: true, label: 'Status', options: ['Pendente', 'Aprovado', 'Rejeitado', 'Cancelado'] },
            createdAt: { type: 'number', required: true, label: 'Data de Criação' },
            updatedAt: { type: 'number', required: true, label: 'Última Atualização' },
            // Adicione outros campos como 'services', 'materials', 'items', 'attachments'
            // items: { type: 'array', required: false, label: 'Itens do Orçamento' }
        }
    };

    /**
     * Espera por uma dependência global estar disponível.
     * @param {string} globalName - O nome da variável global a ser esperada.
     * @returns {Promise<any>} A instância da dependência.
     */
    async function waitForGlobal(globalName) {
        return new Promise(resolve => {
            const checkGlobal = () => {
                if (window[globalName]) {
                    resolve(window[globalName]);
                } else {
                    setTimeout(checkGlobal, 50);
                }
            };
            checkGlobal();
        });
    }

    /**
     * Inicializa o Módulo de Orçamentos.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('BudgetsModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            validationManager = await waitForGlobal('ValidationManager');
            utilsManager = await waitForGlobal('UtilsManager');
            eventHandler = await waitForGlobal('SystemEventHandler');
            cloudSync = await waitForGlobal('CloudSync').catch(() => null); // CloudSync é opcional

            logger.info('💰 Módulo de Orçamentos inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar BudgetsModule:', error);
            (logger || console).error('Falha na inicialização do BudgetsModule. Funcionalidades de orçamento podem não estar disponíveis.');
        }
    }

    /**
     * Valida um objeto de orçamento contra o schema definido.
     * @param {Object} budget - O objeto de orçamento a ser validado.
     * @returns {Object} Um objeto com 'isValid' (boolean) e 'errors' (Array de strings).
     */
    function validateBudget(budget) {
        const errors = [];
        let isValid = true;

        for (const fieldName in BUDGETS_CONFIG.fields) {
            const fieldConfig = BUDGETS_CONFIG.fields[fieldName];
            const value = budget[fieldName];

            if (fieldConfig.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
                errors.push(`${fieldConfig.label} é obrigatório.`);
                isValid = false;
                continue;
            }

            // Apenas valide se o campo não é vazio e é requerido ou se tem um valor
            if (value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')) {
                switch (fieldConfig.type) {
                    case 'string':
                        if (typeof value !== 'string') {
                            errors.push(`${fieldConfig.label} deve ser um texto.`); isValid = false;
                        } else if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
                            errors.push(`${fieldConfig.label} deve ter no mínimo ${fieldConfig.minLength} caracteres.`); isValid = false;
                        } else if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
                            errors.push(`${fieldConfig.label} deve ter no máximo ${fieldConfig.maxLength} caracteres.`); isValid = false;
                        }
                        break;
                    case 'number':
                        if (!validationManager.validateNumber(value)) {
                            errors.push(`${fieldConfig.label} deve ser um número válido.`); isValid = false;
                        } else if (fieldConfig.min !== undefined && value < fieldConfig.min) {
                            errors.push(`${fieldConfig.label} deve ser no mínimo ${fieldConfig.min}.`); isValid = false;
                        }
                        break;
                    case 'array':
                        if (!Array.isArray(value)) {
                            errors.push(`${fieldConfig.label} deve ser uma lista.`); isValid = false;
                        }
                        break;
                    case 'boolean':
                        if (typeof value !== 'boolean') {
                            errors.push(`${fieldConfig.label} deve ser verdadeiro ou falso.`); isValid = false;
                        }
                        break;
                    // Adicione mais tipos de validação conforme necessário
                }

                // Validação específica para 'status'
                if (fieldName === 'status' && !BUDGETS_CONFIG.status.options.includes(value)) {
                    errors.push(`Status inválido para ${fieldConfig.label}.`); isValid = false;
                }
            }
        }
        if (!isValid) {
            logger.warn('Validação de orçamento falhou:', errors);
        } else {
            logger.debug('Validação de orçamento bem-sucedida.');
        }
        return { isValid, errors };
    }


    /**
     * Adiciona um novo orçamento ao banco de dados.
     * @param {Object} budgetData - Os dados do novo orçamento.
     * @returns {Promise<Object|null>} O orçamento salvo com ID, ou null em caso de falha.
     */
    async function addBudget(budgetData) {
        logger.info('Tentando adicionar novo orçamento:', budgetData);
        const { isValid, errors } = validateBudget(budgetData);
        if (!isValid) {
            eventHandler.emit('budget:validationError', errors);
            return null;
        }

        try {
            const newBudget = {
                ...budgetData,
                status: budgetData.status || BUDGETS_CONFIG.defaultStatus,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                syncStatus: 1 // 1 = Pendente de sincronização para push
            };
            const id = await databaseInstance.table(BUDGETS_CONFIG.tableName).add(newBudget);
            const savedBudget = { ...newBudget, id };

            logger.success(`Orçamento '${savedBudget.title}' adicionado com sucesso (ID: ${id}).`);
            eventHandler.emit('budget:added', savedBudget);
            
            if (cloudSync) {
                await cloudSync.markItemForSync(BUDGETS_CONFIG.tableName, savedBudget, 1);
            }
            return savedBudget;
        } catch (error) {
            logger.error(`Erro ao adicionar orçamento: ${error.message}`, budgetData);
            eventHandler.emit('budget:addError', { data: budgetData, error: error.message });
            return null;
        }
    }

    /**
     * Obtém um orçamento pelo seu ID.
     * @param {number} id - O ID do orçamento.
     * @returns {Promise<Object|null>} O objeto do orçamento, ou null se não encontrado.
     */
    async function getBudgetById(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`getBudgetById: ID inválido fornecido: ${id}`);
            return null;
        }
        try {
            const budget = await databaseInstance.table(BUDGETS_CONFIG.tableName).get(id);
            if (budget) {
                logger.debug(`Orçamento encontrado (ID: ${id}):`, budget);
            } else {
                logger.info(`Orçamento não encontrado (ID: ${id}).`);
            }
            return budget;
        } catch (error) {
            logger.error(`Erro ao obter orçamento por ID (${id}): ${error.message}`);
            eventHandler.emit('budget:fetchError', { id, error: error.message });
            return null;
        }
    }

    /**
     * Obtém todos os orçamentos do banco de dados.
     * @returns {Promise<Array<Object>>} Uma lista de todos os orçamentos.
     */
    async function getAllBudgets() {
        try {
            const budgets = await databaseInstance.table(BUDGETS_CONFIG.tableName).toArray();
            logger.info(`Total de ${budgets.length} orçamentos carregados.`);
            return budgets;
        } catch (error) {
            logger.error(`Erro ao obter todos os orçamentos: ${error.message}`);
            eventHandler.emit('budget:fetchAllError', { error: error.message });
            return [];
        }
    }

    /**
     * Atualiza um orçamento existente.
     * @param {number} id - O ID do orçamento a ser atualizado.
     * @param {Object} updates - Os campos a serem atualizados no orçamento.
     * @returns {Promise<boolean>} True se a atualização foi bem-sucedida, false caso contrário.
     */
    async function updateBudget(id, updates) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`updateBudget: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando atualizar orçamento (ID: ${id}) com:`, updates);

        // Opcional: Validar apenas os campos que estão sendo atualizados
        const { isValid, errors } = validateBudget({ ...updates, id }); // Valida o objeto completo imaginário
        if (!isValid) {
            eventHandler.emit('budget:validationError', errors);
            return false;
        }

        try {
            const updatedFields = { ...updates, updatedAt: Date.now(), syncStatus: 1 }; // Marca para sincronização
            await databaseInstance.table(BUDGETS_CONFIG.tableName).update(id, updatedFields);
            
            const updatedBudget = await getBudgetById(id); // Busca o orçamento atualizado para passar no evento
            logger.success(`Orçamento (ID: ${id}) atualizado com sucesso.`);
            eventHandler.emit('budget:updated', updatedBudget);

            if (cloudSync && updatedBudget) {
                await cloudSync.markItemForSync(BUDGETS_CONFIG.tableName, updatedBudget, 1);
            }
            return true;
        } catch (error) {
            logger.error(`Erro ao atualizar orçamento (ID: ${id}): ${error.message}`, updates);
            eventHandler.emit('budget:updateError', { id, data: updates, error: error.message });
            return false;
        }
    }

    /**
     * Exclui um orçamento pelo seu ID.
     * @param {number} id - O ID do orçamento a ser excluído.
     * @returns {Promise<boolean>} True se a exclusão foi bem-sucedida, false caso contrário.
     */
    async function deleteBudget(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`deleteBudget: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando excluir orçamento (ID: ${id}).`);
        try {
            // Antes de deletar, é uma boa prática marcar para sincronização de exclusão
            if (cloudSync) {
                const budgetToDelete = await getBudgetById(id);
                if (budgetToDelete) {
                    // Marcar como deletado e enviar para o servidor, para só então remover localmente
                    await cloudSync.markItemForSync(BUDGETS_CONFIG.tableName, budgetToDelete, 2); // 2 = pending_delete
                    // O item será removido localmente APÓS a sincronização bem-sucedida pelo cloudSync.
                    // Se o cloudSync não estiver ativo ou a sincronização falhar, o item permanece marcado.
                    logger.info(`Orçamento (ID: ${id}) marcado para exclusão na nuvem.`);
                    eventHandler.emit('budget:markedForDeletion', id);
                    return true; // Considera sucesso por ter marcado
                }
            }
            
            // Se não há sync com a nuvem, ou se a exclusão local é prioritária:
            await databaseInstance.table(BUDGETS_CONFIG.tableName).delete(id);
            logger.success(`Orçamento (ID: ${id}) excluído com sucesso.`);
            eventHandler.emit('budget:deleted', id);
            return true;
        } catch (error) {
            logger.error(`Erro ao excluir orçamento (ID: ${id}): ${error.message}`);
            eventHandler.emit('budget:deleteError', { id, error: error.message });
            return false;
        }
    }

    /**
     * Altera o status de um orçamento.
     * @param {number} id - O ID do orçamento.
     * @param {string} newStatus - O novo status (ex: 'Aprovado', 'Rejeitado').
     * @returns {Promise<boolean>} True se o status foi alterado com sucesso.
     */
    async function changeBudgetStatus(id, newStatus) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`changeBudgetStatus: ID inválido fornecido: ${id}`);
            return false;
        }
        if (!BUDGETS_CONFIG.statusClasses[newStatus]) { // Verifica se o status é válido
            logger.warn(`changeBudgetStatus: Status inválido fornecido: ${newStatus}`);
            return false;
        }
        logger.info(`Alterando status do orçamento (ID: ${id}) para: ${newStatus}`);
        return await updateBudget(id, { status: newStatus });
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        add: addBudget,
        getById: getBudgetById,
        getAll: getAllBudgets,
        update: updateBudget,
        delete: deleteBudget,
        changeStatus: changeBudgetStatus,
        validate: validateBudget, // Expõe a função de validação diretamente
        config: BUDGETS_CONFIG // Expõe a configuração para referência externa
    };
})();