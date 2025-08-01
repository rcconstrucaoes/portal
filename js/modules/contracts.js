/**
 * RC Construções - Módulo de Contratos (Revisado e Aprimorado)
 * Gerencia todas as funcionalidades relacionadas a contratos, incluindo
 * criação, leitura, atualização, exclusão, e gestão de termos e pagamentos.
 * Aprimorado para ser robusto, com validação, e integração com outros módulos.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let validationManager;
    let utilsManager; // Para formatação de datas ou valores, se necessário
    let eventHandler;
    let cloudSync; // Para sincronização de dados

    const CONTRACTS_CONFIG = {
        tableName: 'contracts',
        defaultStatus: 'Ativo', // 'Ativo', 'Concluído', 'Suspenso', 'Cancelado'
        // Mapeamento de status para classes CSS para badges ou cores
        statusClasses: {
            'Ativo': 'badge-success',
            'Concluído': 'badge-info',
            'Suspenso': 'badge-warning',
            'Cancelado': 'badge-danger'
        },
        fields: {
            clientId: { type: 'number', required: true, label: 'Cliente' },
            budgetId: { type: 'number', required: false, label: 'Orçamento Referência' },
            title: { type: 'string', required: true, label: 'Título do Contrato', minLength: 5, maxLength: 200 },
            terms: { type: 'string', required: true, label: 'Termos e Condições' },
            value: { type: 'number', required: true, label: 'Valor Total', min: 0 },
            startDate: { type: 'number', required: true, label: 'Data de Início' }, // Timestamp
            endDate: { type: 'number', required: false, label: 'Data de Término Estimada' }, // Timestamp
            status: { type: 'string', required: true, label: 'Status', options: ['Ativo', 'Concluído', 'Suspenso', 'Cancelado'] },
            createdAt: { type: 'number', required: true, label: 'Data de Criação' },
            updatedAt: { type: 'number', required: true, label: 'Última Atualização' },
            // payments: { type: 'array', required: false, label: 'Histórico de Pagamentos' } // Pode ser uma sub-tabela ou array no contrato
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
     * Inicializa o Módulo de Contratos.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ContractsModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            validationManager = await waitForGlobal('ValidationManager');
            utilsManager = await waitForGlobal('UtilsManager'); // Para usar utilities como formatDate, formatCurrency
            eventHandler = await waitForGlobal('SystemEventHandler');
            cloudSync = await waitForGlobal('CloudSync').catch(() => null); // CloudSync é opcional

            logger.info('🤝 Módulo de Contratos inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar ContractsModule:', error);
            (logger || console).error('Falha na inicialização do ContractsModule. Funcionalidades de contrato podem não estar disponíveis.');
        }
    }

    /**
     * Valida um objeto de contrato contra o schema definido e regras de negócio.
     * @param {Object} contract - O objeto de contrato a ser validado.
     * @returns {Object} Um objeto com 'isValid' (boolean) e 'errors' (Array de strings).
     */
    function validateContract(contract) {
        const errors = [];
        let isValid = true;

        for (const fieldName in CONTRACTS_CONFIG.fields) {
            const fieldConfig = CONTRACTS_CONFIG.fields[fieldName];
            const value = contract[fieldName];

            // 1. Validação de campos obrigatórios
            if (fieldConfig.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
                errors.push(`${fieldConfig.label} é obrigatório.`);
                isValid = false;
                continue;
            }

            // Apenas valide se o campo tem um valor (mesmo que não seja obrigatório)
            if (value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')) {
                switch (fieldName) {
                    case 'title':
                    case 'terms':
                        if (typeof value !== 'string' || value.length < fieldConfig.minLength || value.length > fieldConfig.maxLength) {
                            errors.push(`${fieldConfig.label} deve ter entre ${fieldConfig.minLength} e ${fieldConfig.maxLength} caracteres.`);
                            isValid = false;
                        }
                        break;
                    case 'clientId':
                    case 'budgetId': // budgetId é opcional, mas se existir, deve ser número
                        if (!validationManager.validateNumber(value) || value <= 0) {
                            errors.push(`${fieldConfig.label} deve ser um ID numérico válido.`);
                            isValid = false;
                        }
                        break;
                    case 'value':
                        if (!validationManager.validateNumber(value) || value < fieldConfig.min) {
                            errors.push(`${fieldConfig.label} deve ser um valor numérico válido e não negativo.`);
                            isValid = false;
                        }
                        break;
                    case 'startDate':
                    case 'endDate':
                        if (!validationManager.validateNumber(value) || isNaN(new Date(value).getTime())) {
                            errors.push(`${fieldConfig.label} deve ser uma data válida (timestamp).`);
                            isValid = false;
                        }
                        break;
                    case 'status':
                        if (!CONTRACTS_CONFIG.fields.status.options.includes(value)) {
                            errors.push(`Status inválido para ${fieldConfig.label}.`);
                            isValid = false;
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
        
        // Regra de negócio: endDate não pode ser antes de startDate
        if (contract.startDate && contract.endDate && contract.endDate < contract.startDate) {
            errors.push('A Data de Término não pode ser anterior à Data de Início.');
            isValid = false;
        }

        if (!isValid) {
            logger.warn('Validação de contrato falhou:', errors);
        } else {
            logger.debug('Validação de contrato bem-sucedida.');
        }
        return { isValid, errors };
    }


    /**
     * Adiciona um novo contrato ao banco de dados.
     * @param {Object} contractData - Os dados do novo contrato.
     * @returns {Promise<Object|null>} O contrato salvo com ID, ou null em caso de falha.
     */
    async function addContract(contractData) {
        logger.info('Tentando adicionar novo contrato:', contractData);
        const { isValid, errors } = validateContract(contractData);
        if (!isValid) {
            eventHandler.emit('contract:validationError', errors);
            return null;
        }

        try {
            const newContract = {
                ...contractData,
                status: contractData.status || CONTRACTS_CONFIG.defaultStatus,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                syncStatus: 1 // 1 = Pendente de sincronização para push
            };
            const id = await databaseInstance.table(CONTRACTS_CONFIG.tableName).add(newContract);
            const savedContract = { ...newContract, id };

            logger.success(`Contrato '${savedContract.title}' adicionado com sucesso (ID: ${id}).`);
            eventHandler.emit('contract:added', savedContract);
            
            if (cloudSync) {
                await cloudSync.markItemForSync(CONTRACTS_CONFIG.tableName, savedContract, 1);
            }
            return savedContract;
        } catch (error) {
            logger.error(`Erro ao adicionar contrato: ${error.message}`, contractData);
            eventHandler.emit('contract:addError', { data: contractData, error: error.message });
            return null;
        }
    }

    /**
     * Obtém um contrato pelo seu ID.
     * @param {number} id - O ID do contrato.
     * @returns {Promise<Object|null>} O objeto do contrato, ou null se não encontrado.
     */
    async function getContractById(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`getContractById: ID inválido fornecido: ${id}`);
            return null;
        }
        try {
            const contract = await databaseInstance.table(CONTRACTS_CONFIG.tableName).get(id);
            if (contract) {
                logger.debug(`Contrato encontrado (ID: ${id}):`, contract);
            } else {
                logger.info(`Contrato não encontrado (ID: ${id}).`);
            }
            return contract;
        } catch (error) {
            logger.error(`Erro ao obter contrato por ID (${id}): ${error.message}`);
            eventHandler.emit('contract:fetchError', { id, error: error.message });
            return null;
        }
    }

    /**
     * Obtém todos os contratos do banco de dados.
     * @returns {Promise<Array<Object>>} Uma lista de todos os contratos.
     */
    async function getAllContracts() {
        try {
            const contracts = await databaseInstance.table(CONTRACTS_CONFIG.tableName).toArray();
            logger.info(`Total de ${contracts.length} contratos carregados.`);
            return contracts;
        } catch (error) {
            logger.error(`Erro ao obter todos os contratos: ${error.message}`);
            eventHandler.emit('contract:fetchAllError', { error: error.message });
            return [];
        }
    }

    /**
     * Atualiza um contrato existente.
     * @param {number} id - O ID do contrato a ser atualizado.
     * @param {Object} updates - Os campos a serem atualizados no contrato.
     * @returns {Promise<boolean>} True se a atualização foi bem-sucedida, false caso contrário.
     */
    async function updateContract(id, updates) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`updateContract: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando atualizar contrato (ID: ${id}) com:`, updates);

        // Mesclar updates com dados atuais para validar o objeto completo
        const currentContract = await getContractById(id);
        if (!currentContract) {
            logger.error(`updateContract: Contrato com ID ${id} não encontrado para atualização.`);
            return false;
        }
        const mergedContractData = { ...currentContract, ...updates };

        const { isValid, errors } = validateContract(mergedContractData);
        if (!isValid) {
            eventHandler.emit('contract:validationError', errors);
            return false;
        }

        try {
            const updatedFields = { ...updates, updatedAt: Date.now(), syncStatus: 1 }; // Marca para sincronização
            await databaseInstance.table(CONTRACTS_CONFIG.tableName).update(id, updatedFields);
            
            const updatedContract = await getContractById(id); // Busca o contrato atualizado para passar no evento
            logger.success(`Contrato (ID: ${id}) atualizado com sucesso.`);
            eventHandler.emit('contract:updated', updatedContract);

            if (cloudSync && updatedContract) {
                await cloudSync.markItemForSync(CONTRACTS_CONFIG.tableName, updatedContract, 1);
            }
            return true;
        } catch (error) {
            logger.error(`Erro ao atualizar contrato (ID: ${id}): ${error.message}`, updates);
            eventHandler.emit('contract:updateError', { id, data: updates, error: error.message });
            return false;
        }
    }

    /**
     * Exclui um contrato pelo seu ID.
     * @param {number} id - O ID do contrato a ser excluído.
     * @returns {Promise<boolean>} True se a exclusão foi bem-sucedida, false caso contrário.
     */
    async function deleteContract(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`deleteContract: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando excluir contrato (ID: ${id}).`);
        try {
            // Se houver CloudSync, marca para exclusão na nuvem
            if (cloudSync) {
                const contractToDelete = await getContractById(id);
                if (contractToDelete) {
                    await cloudSync.markItemForSync(CONTRACTS_CONFIG.tableName, contractToDelete, 2); // 2 = pending_delete
                    logger.info(`Contrato (ID: ${id}) marcado para exclusão na nuvem.`);
                    eventHandler.emit('contract:markedForDeletion', id);
                    return true; // Considera sucesso por ter marcado
                }
            }
            
            // Se não há sync com a nuvem, ou se a exclusão local é prioritária:
            await databaseInstance.table(CONTRACTS_CONFIG.tableName).delete(id);
            logger.success(`Contrato (ID: ${id}) excluído com sucesso.`);
            eventHandler.emit('contract:deleted', id);
            return true;
        } catch (error) {
            logger.error(`Erro ao excluir contrato (ID: ${id}): ${error.message}`);
            eventHandler.emit('contract:deleteError', { id, error: error.message });
            return false;
        }
    }

    /**
     * Altera o status de um contrato.
     * @param {number} id - O ID do contrato.
     * @param {string} newStatus - O novo status (ex: 'Concluído', 'Suspenso').
     * @returns {Promise<boolean>} True se o status foi alterado com sucesso.
     */
    async function changeContractStatus(id, newStatus) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`changeContractStatus: ID inválido fornecido: ${id}`);
            return false;
        }
        if (!CONTRACTS_CONFIG.fields.status.options.includes(newStatus)) { // Verifica se o status é válido
            logger.warn(`changeContractStatus: Status inválido fornecido: ${newStatus}`);
            return false;
        }
        logger.info(`Alterando status do contrato (ID: ${id}) para: ${newStatus}`);
        return await updateContract(id, { status: newStatus });
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        add: addContract,
        getById: getContractById,
        getAll: getAllContracts,
        update: updateContract,
        delete: deleteContract,
        changeStatus: changeContractStatus,
        validate: validateContract, // Expõe a função de validação
        config: CONTRACTS_CONFIG // Expõe a configuração para referência externa
    };
})();