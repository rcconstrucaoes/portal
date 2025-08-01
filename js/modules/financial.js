/**
 * RC Construções - Módulo Financeiro (Revisado e Aprimorado)
 * Gerencia todas as funcionalidades relacionadas a entradas financeiras (receitas e despesas).
 * Inclui criação, leitura, atualização, exclusão, filtragem e sumarização de transações.
 * Aprimorado para ser robusto, com validação, e integração com outros módulos.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let validationManager;
    let utilsManager; // Para formatação de moeda/data, se necessário
    let eventHandler;
    let cloudSync; // Para sincronização de dados

    const FINANCIAL_CONFIG = {
        tableName: 'financial',
        types: ['Receita', 'Despesa'], // Tipos de transação
        categories: ['Salário', 'Serviço', 'Aluguel', 'Material', 'Equipamento', 'Manutenção', 'Imposto', 'Outros'], // Categorias comuns
        // Mapeamento de tipo para classes CSS para badges ou cores (se houver na UI)
        typeClasses: {
            'Receita': 'badge-success',
            'Despesa': 'badge-danger'
        },
        fields: {
            type: { type: 'string', required: true, label: 'Tipo', options: ['Receita', 'Despesa'] },
            description: { type: 'string', required: true, label: 'Descrição', minLength: 5, maxLength: 200 },
            amount: { type: 'number', required: true, label: 'Valor', min: 0.01 }, // Valor mínimo para evitar 0
            date: { type: 'number', required: true, label: 'Data da Transação' }, // Timestamp
            category: { type: 'string', required: true, label: 'Categoria', options: ['Material', 'Mão de Obra', 'Aluguel', 'Serviço', 'Administrativo', 'Imposto', 'Outros'] },
            referenceId: { type: 'string', required: false, label: 'ID de Referência' }, // Ex: ID de orçamento, contrato
            createdAt: { type: 'number', required: true, label: 'Data de Criação' },
            updatedAt: { type: 'number', required: true, label: 'Última Atualização' }
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
     * Inicializa o Módulo Financeiro.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('FinancialModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            validationManager = await waitForGlobal('ValidationManager');
            utilsManager = await waitForGlobal('UtilsManager'); // Para usar utilities como formatDate, formatCurrency
            eventHandler = await waitForGlobal('SystemEventHandler');
            cloudSync = await waitForGlobal('CloudSync').catch(() => null); // CloudSync é opcional

            logger.info('📊 Módulo Financeiro inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar FinancialModule:', error);
            (logger || console).error('Falha na inicialização do FinancialModule. Funcionalidades financeiras podem não estar disponíveis.');
        }
    }

    /**
     * Valida um objeto de entrada financeira contra o schema definido e regras de negócio.
     * @param {Object} entry - O objeto de entrada financeira a ser validado.
     * @returns {Object} Um objeto com 'isValid' (boolean) e 'errors' (Array de strings).
     */
    function validateFinancialEntry(entry) {
        const errors = [];
        let isValid = true;

        for (const fieldName in FINANCIAL_CONFIG.fields) {
            const fieldConfig = FINANCIAL_CONFIG.fields[fieldName];
            const value = entry[fieldName];

            // 1. Validação de campos obrigatórios
            if (fieldConfig.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
                errors.push(`${fieldConfig.label} é obrigatório.`);
                isValid = false;
                continue;
            }

            // Apenas valide se o campo tem um valor (mesmo que não seja obrigatório)
            if (value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')) {
                switch (fieldName) {
                    case 'type':
                        if (!FINANCIAL_CONFIG.types.includes(value)) {
                            errors.push(`Tipo de transação '${value}' inválido.`); isValid = false;
                        }
                        break;
                    case 'description':
                        if (typeof value !== 'string' || value.length < fieldConfig.minLength || value.length > fieldConfig.maxLength) {
                            errors.push(`${fieldConfig.label} deve ter entre ${fieldConfig.minLength} e ${fieldConfig.maxLength} caracteres.`); isValid = false;
                        }
                        break;
                    case 'amount':
                        if (!validationManager.validateNumber(value) || value < fieldConfig.min) {
                            errors.push(`${fieldConfig.label} deve ser um valor numérico positivo.`); isValid = false;
                        }
                        break;
                    case 'date':
                        if (!validationManager.validateNumber(value) || isNaN(new Date(value).getTime())) {
                            errors.push(`${fieldConfig.label} deve ser uma data válida (timestamp).`); isValid = false;
                        }
                        break;
                    case 'category':
                        if (!FINANCIAL_CONFIG.categories.includes(value)) {
                            errors.push(`Categoria '${value}' inválida.`); isValid = false;
                        }
                        break;
                    case 'createdAt':
                    case 'updatedAt':
                        if (!validationManager.validateNumber(value) || value <= 0) {
                             errors.push(`${fieldConfig.label} inválido.`); isValid = false;
                        }
                        break;
                    default:
                        // Validação de tipo genérica
                        if (fieldConfig.type === 'string' && typeof value !== 'string') {
                            errors.push(`${fieldConfig.label} deve ser um texto.`); isValid = false;
                        } else if (fieldConfig.type === 'number' && !validationManager.validateNumber(value)) {
                             errors.push(`${fieldConfig.label} deve ser um número.`); isValid = false;
                        }
                        break;
                }
            }
        }
        if (!isValid) {
            logger.warn('Validação de entrada financeira falhou:', errors);
        } else {
            logger.debug('Validação de entrada financeira bem-sucedida.');
        }
        return { isValid, errors };
    }

    /**
     * Adiciona uma nova entrada financeira ao banco de dados.
     * @param {Object} entryData - Os dados da nova entrada financeira.
     * @returns {Promise<Object|null>} A entrada salva com ID, ou null em caso de falha.
     */
    async function addFinancialEntry(entryData) {
        logger.info('Tentando adicionar nova entrada financeira:', entryData);
        const { isValid, errors } = validateFinancialEntry(entryData);
        if (!isValid) {
            eventHandler.emit('financial:validationError', errors);
            return null;
        }

        try {
            const newEntry = {
                ...entryData,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                syncStatus: 1 // 1 = Pendente de sincronização para push
            };
            const id = await databaseInstance.table(FINANCIAL_CONFIG.tableName).add(newEntry);
            const savedEntry = { ...newEntry, id };

            logger.success(`Entrada financeira (ID: ${id}) adicionada com sucesso.`);
            eventHandler.emit('financial:added', savedEntry);
            
            if (cloudSync) {
                await cloudSync.markItemForSync(FINANCIAL_CONFIG.tableName, savedEntry, 1);
            }
            return savedEntry;
        } catch (error) {
            logger.error(`Erro ao adicionar entrada financeira: ${error.message}`, entryData);
            eventHandler.emit('financial:addError', { data: entryData, error: error.message });
            return null;
        }
    }

    /**
     * Obtém uma entrada financeira pelo seu ID.
     * @param {number} id - O ID da entrada financeira.
     * @returns {Promise<Object|null>} O objeto da entrada, ou null se não encontrado.
     */
    async function getFinancialEntryById(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`getFinancialEntryById: ID inválido fornecido: ${id}`);
            return null;
        }
        try {
            const entry = await databaseInstance.table(FINANCIAL_CONFIG.tableName).get(id);
            if (entry) {
                logger.debug(`Entrada financeira encontrada (ID: ${id}):`, entry);
            } else {
                logger.info(`Entrada financeira não encontrada (ID: ${id}).`);
            }
            return entry;
        } catch (error) {
            logger.error(`Erro ao obter entrada financeira por ID (${id}): ${error.message}`);
            eventHandler.emit('financial:fetchError', { id, error: error.message });
            return null;
        }
    }

    /**
     * Obtém todas as entradas financeiras do banco de dados.
     * Pode ser filtrado por tipo e/ou período.
     * @param {Object} [filters={}] - Objeto de filtros (ex: { type: 'Receita', startDate: timestamp, endDate: timestamp }).
     * @returns {Promise<Array<Object>>} Uma lista de entradas financeiras.
     */
    async function getAllFinancialEntries(filters = {}) {
        try {
            let query = databaseInstance.table(FINANCIAL_CONFIG.tableName);

            // Filtrar por tipo (Receita/Despesa)
            if (filters.type && FINANCIAL_CONFIG.types.includes(filters.type)) {
                query = query.where('type').equals(filters.type);
            }

            let entries = await query.toArray();

            // Filtrar por período de data (cliente-side, se o Dexie não suportar range complexo)
            if (filters.startDate && filters.endDate) {
                const startDate = new Date(filters.startDate).getTime();
                const endDate = new Date(filters.endDate).getTime();
                entries = entries.filter(entry => entry.date >= startDate && entry.date <= endDate);
            }
            // Filtrar por categoria
            if (filters.category && FINANCIAL_CONFIG.categories.includes(filters.category)) {
                entries = entries.filter(entry => entry.category === filters.category);
            }


            logger.info(`Total de ${entries.length} entradas financeiras carregadas com filtros.`, filters);
            return entries;
        } catch (error) {
            logger.error(`Erro ao obter entradas financeiras: ${error.message}`, filters);
            eventHandler.emit('financial:fetchAllError', { error: error.message, filters });
            return [];
        }
    }

    /**
     * Atualiza uma entrada financeira existente.
     * @param {number} id - O ID da entrada a ser atualizada.
     * @param {Object} updates - Os campos a serem atualizados na entrada.
     * @returns {Promise<boolean>} True se a atualização foi bem-sucedida, false caso contrário.
     */
    async function updateFinancialEntry(id, updates) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`updateFinancialEntry: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando atualizar entrada financeira (ID: ${id}) com:`, updates);

        const currentEntry = await getFinancialEntryById(id);
        if (!currentEntry) {
            logger.error(`updateFinancialEntry: Entrada financeira com ID ${id} não encontrada para atualização.`);
            return false;
        }
        const mergedEntryData = { ...currentEntry, ...updates };

        const { isValid, errors } = validateFinancialEntry(mergedEntryData);
        if (!isValid) {
            eventHandler.emit('financial:validationError', errors);
            return false;
        }

        try {
            const updatedFields = { ...updates, updatedAt: Date.now(), syncStatus: 1 }; // Marca para sincronização
            await databaseInstance.table(FINANCIAL_CONFIG.tableName).update(id, updatedFields);
            
            const updatedEntry = await getFinancialEntryById(id); // Busca a entrada atualizada
            logger.success(`Entrada financeira (ID: ${id}) atualizada com sucesso.`);
            eventHandler.emit('financial:updated', updatedEntry);

            if (cloudSync && updatedEntry) {
                await cloudSync.markItemForSync(FINANCIAL_CONFIG.tableName, updatedEntry, 1);
            }
            return true;
        } catch (error) {
            logger.error(`Erro ao atualizar entrada financeira (ID: ${id}): ${error.message}`, updates);
            eventHandler.emit('financial:updateError', { id, data: updates, error: error.message });
            return false;
        }
    }

    /**
     * Exclui uma entrada financeira pelo seu ID.
     * @param {number} id - O ID da entrada a ser excluída.
     * @returns {Promise<boolean>} True se a exclusão foi bem-sucedida, false caso contrário.
     */
    async function deleteFinancialEntry(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`deleteFinancialEntry: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando excluir entrada financeira (ID: ${id}).`);
        try {
            if (cloudSync) {
                const entryToDelete = await getFinancialEntryById(id);
                if (entryToDelete) {
                    await cloudSync.markItemForSync(FINANCIAL_CONFIG.tableName, entryToDelete, 2); // 2 = pending_delete
                    logger.info(`Entrada financeira (ID: ${id}) marcada para exclusão na nuvem.`);
                    eventHandler.emit('financial:markedForDeletion', id);
                    return true;
                }
            }
            
            await databaseInstance.table(FINANCIAL_CONFIG.tableName).delete(id);
            logger.success(`Entrada financeira (ID: ${id}) excluída com sucesso.`);
            eventHandler.emit('financial:deleted', id);
            return true;
        } catch (error) {
            logger.error(`Erro ao excluir entrada financeira (ID: ${id}): ${error.message}`);
            eventHandler.emit('financial:deleteError', { id, error: error.message });
            return false;
        }
    }

    /**
     * Calcula o balanço financeiro (receitas - despesas) para um determinado período ou tipo.
     * @param {Object} [filters={}] - Filtros para as entradas financeiras.
     * @returns {Promise<number>} O balanço total.
     */
    async function calculateBalance(filters = {}) {
        logger.info('Calculando balanço financeiro...', filters);
        try {
            const entries = await getAllFinancialEntries(filters);
            let totalRevenue = 0;
            let totalExpense = 0;

            entries.forEach(entry => {
                if (entry.type === 'Receita') {
                    totalRevenue += entry.amount;
                } else if (entry.type === 'Despesa') {
                    totalExpense += entry.amount;
                }
            });

            const balance = totalRevenue - totalExpense;
            logger.info(`Balanço calculado: Receitas = ${utilsManager.formatCurrency(totalRevenue)}, Despesas = ${utilsManager.formatCurrency(totalExpense)}, Balanço = ${utilsManager.formatCurrency(balance)}`);
            return balance;
        } catch (error) {
            logger.error(`Erro ao calcular balanço financeiro: ${error.message}`);
            return 0;
        }
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        add: addFinancialEntry,
        getById: getFinancialEntryById,
        getAll: getAllFinancialEntries,
        update: updateFinancialEntry,
        delete: deleteFinancialEntry,
        calculateBalance: calculateBalance,
        validate: validateFinancialEntry, // Expõe a função de validação
        config: FINANCIAL_CONFIG // Expõe a configuração para referência externa
    };
})();