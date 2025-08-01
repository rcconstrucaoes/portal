/**
 * RC Construções - Módulo de Fornecedores (Revisado e Aprimorado)
 * Gerencia todas as funcionalidades relacionadas a fornecedores, incluindo
 * criação, leitura, atualização, exclusão e filtragem.
 * Aprimorado para ser robusto, com validação, e integração com outros módulos.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let validationManager;
    let utilsManager; // Para formatação de CPF/CNPJ/telefone, se necessário
    let eventHandler;
    let cloudSync; // Para sincronização de dados

    const SUPPLIERS_CONFIG = {
        tableName: 'suppliers',
        fields: {
            name: { type: 'string', required: true, label: 'Nome do Fornecedor', minLength: 3, maxLength: 150 },
            contactName: { type: 'string', required: false, label: 'Nome do Contato' },
            email: { type: 'string', required: true, label: 'E-mail de Contato' },
            phone: { type: 'string', required: true, label: 'Telefone de Contato' },
            address: { type: 'string', required: false, label: 'Endereço Completo' },
            cnpj: { type: 'string', required: false, label: 'CNPJ' }, // Opcional, dependendo da necessidade
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
     * Inicializa o Módulo de Fornecedores.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('SuppliersModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            validationManager = await waitForGlobal('ValidationManager');
            utilsManager = await waitForGlobal('UtilsManager'); // Para usar utilities como formatPhone/CNPJ
            eventHandler = await waitForGlobal('SystemEventHandler');
            cloudSync = await waitForGlobal('CloudSync').catch(() => null); // CloudSync é opcional

            logger.info('🚚 Módulo de Fornecedores inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar SuppliersModule:', error);
            (logger || console).error('Falha na inicialização do SuppliersModule. Funcionalidades de fornecedor podem não estar disponíveis.');
        }
    }

    /**
     * Valida um objeto de fornecedor contra o schema definido e regras de negócio.
     * @param {Object} supplier - O objeto de fornecedor a ser validado.
     * @returns {Object} Um objeto com 'isValid' (boolean) e 'errors' (Array de strings).
     */
    function validateSupplier(supplier) {
        const errors = [];
        let isValid = true;

        for (const fieldName in SUPPLIERS_CONFIG.fields) {
            const fieldConfig = SUPPLIERS_CONFIG.fields[fieldName];
            const value = supplier[fieldName];

            // 1. Validação de campos obrigatórios
            if (fieldConfig.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
                errors.push(`${fieldConfig.label} é obrigatório.`);
                isValid = false;
                continue; // Pula outras validações para este campo se for obrigatório e vazio
            }

            // Apenas valide se o campo tem um valor (mesmo que não seja obrigatório)
            if (value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')) {
                switch (fieldName) {
                    case 'name':
                        if (typeof value !== 'string' || value.length < fieldConfig.minLength || value.length > fieldConfig.maxLength) {
                            errors.push(`${fieldConfig.label} deve ter entre ${fieldConfig.minLength} e ${fieldConfig.maxLength} caracteres.`);
                            isValid = false;
                        }
                        break;
                    case 'email':
                        if (!validationManager.validateEmail(value)) {
                            errors.push(`${fieldConfig.label} inválido.`);
                            isValid = false;
                        }
                        break;
                    case 'phone':
                        if (!validationManager.validatePhone(value)) {
                            errors.push(`${fieldConfig.label} inválido.`);
                            isValid = false;
                        }
                        break;
                    case 'cnpj':
                        // CNPJ (simplificado aqui, você pode adicionar uma validação completa no validation.js)
                        const cleanedCnpj = String(value).replace(/\D/g, '');
                        if (cleanedCnpj && cleanedCnpj.length !== 14) {
                            errors.push(`${fieldConfig.label} deve ter 14 dígitos.`);
                            isValid = false;
                        }
                        // Você pode adicionar uma validação completa de CNPJ no `validationManager.validateCNPJ(value)`
                        break;
                    case 'createdAt':
                    case 'updatedAt':
                        if (!validationManager.validateNumber(value) || value <= 0) {
                             errors.push(`${fieldConfig.label} inválido.`); isValid = false;
                        }
                        break;
                    default:
                        // Validação de tipo genérica para outros campos
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
            logger.warn('Validação de fornecedor falhou:', errors);
        } else {
            logger.debug('Validação de fornecedor bem-sucedida.');
        }
        return { isValid, errors };
    }


    /**
     * Adiciona um novo fornecedor ao banco de dados.
     * @param {Object} supplierData - Os dados do novo fornecedor.
     * @returns {Promise<Object|null>} O fornecedor salvo com ID, ou null em caso de falha.
     */
    async function addSupplier(supplierData) {
        logger.info('Tentando adicionar novo fornecedor:', supplierData);

        // Pré-formatação de campos antes da validação
        if (supplierData.phone) supplierData.phone = utilsManager.formatPhone(supplierData.phone);
        // if (supplierData.cnpj) supplierData.cnpj = utilsManager.formatCNPJ(supplierData.cnpj); // Se houver utilitário de formatação CNPJ

        const { isValid, errors } = validateSupplier(supplierData);
        if (!isValid) {
            eventHandler.emit('supplier:validationError', errors);
            return null;
        }

        try {
            const newSupplier = {
                ...supplierData,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                syncStatus: 1 // 1 = Pendente de sincronização para push
            };
            const id = await databaseInstance.table(SUPPLIERS_CONFIG.tableName).add(newSupplier);
            const savedSupplier = { ...newSupplier, id };

            logger.success(`Fornecedor '${savedSupplier.name}' adicionado com sucesso (ID: ${id}).`);
            eventHandler.emit('supplier:added', savedSupplier);
            
            if (cloudSync) {
                await cloudSync.markItemForSync(SUPPLIERS_CONFIG.tableName, savedSupplier, 1);
            }
            return savedSupplier;
        } catch (error) {
            logger.error(`Erro ao adicionar fornecedor: ${error.message}`, supplierData);
            eventHandler.emit('supplier:addError', { data: supplierData, error: error.message });
            return null;
        }
    }

    /**
     * Obtém um fornecedor pelo seu ID.
     * @param {number} id - O ID do fornecedor.
     * @returns {Promise<Object|null>} O objeto do fornecedor, ou null se não encontrado.
     */
    async function getSupplierById(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`getSupplierById: ID inválido fornecido: ${id}`);
            return null;
        }
        try {
            const supplier = await databaseInstance.table(SUPPLIERS_CONFIG.tableName).get(id);
            if (supplier) {
                logger.debug(`Fornecedor encontrado (ID: ${id}):`, supplier);
            } else {
                logger.info(`Fornecedor não encontrado (ID: ${id}).`);
            }
            return supplier;
        } catch (error) {
            logger.error(`Erro ao obter fornecedor por ID (${id}): ${error.message}`);
            eventHandler.emit('supplier:fetchError', { id, error: error.message });
            return null;
        }
    }

    /**
     * Obtém todos os fornecedores do banco de dados.
     * @returns {Promise<Array<Object>>} Uma lista de todos os fornecedores.
     */
    async function getAllSuppliers() {
        try {
            const suppliers = await databaseInstance.table(SUPPLIERS_CONFIG.tableName).toArray();
            logger.info(`Total de ${suppliers.length} fornecedores carregados.`);
            return suppliers;
        } catch (error) {
            logger.error(`Erro ao obter todos os fornecedores: ${error.message}`);
            eventHandler.emit('supplier:fetchAllError', { error: error.message });
            return [];
        }
    }

    /**
     * Atualiza um fornecedor existente.
     * @param {number} id - O ID do fornecedor a ser atualizado.
     * @param {Object} updates - Os campos a serem atualizados no fornecedor.
     * @returns {Promise<boolean>} True se a atualização foi bem-sucedida, false caso contrário.
     */
    async function updateSupplier(id, updates) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`updateSupplier: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando atualizar fornecedor (ID: ${id}) com:`, updates);

        // Pré-formatação de campos antes da validação de updates
        if (updates.phone) updates.phone = utilsManager.formatPhone(updates.phone);
        // if (updates.cnpj) updates.cnpj = utilsManager.formatCNPJ(updates.cnpj);

        // Para validar o objeto completo, você precisaria carregar o fornecedor atual e mesclar as atualizações
        const currentSupplier = await getSupplierById(id);
        if (!currentSupplier) {
            logger.error(`updateSupplier: Fornecedor com ID ${id} não encontrado para atualização.`);
            return false;
        }
        const mergedSupplierData = { ...currentSupplier, ...updates };

        const { isValid, errors } = validateSupplier(mergedSupplierData);
        if (!isValid) {
            eventHandler.emit('supplier:validationError', errors);
            return false;
        }

        try {
            const updatedFields = { ...updates, updatedAt: Date.now(), syncStatus: 1 }; // Marca para sincronização
            await databaseInstance.table(SUPPLIERS_CONFIG.tableName).update(id, updatedFields);
            
            const updatedSupplier = await getSupplierById(id); // Busca o fornecedor atualizado para passar no evento
            logger.success(`Fornecedor (ID: ${id}) atualizado com sucesso.`);
            eventHandler.emit('supplier:updated', updatedSupplier);

            if (cloudSync && updatedSupplier) {
                await cloudSync.markItemForSync(SUPPLIERS_CONFIG.tableName, updatedSupplier, 1);
            }
            return true;
        } catch (error) {
            logger.error(`Erro ao atualizar fornecedor (ID: ${id}): ${error.message}`, updates);
            eventHandler.emit('supplier:updateError', { id, data: updates, error: error.message });
            return false;
        }
    }

    /**
     * Exclui um fornecedor pelo seu ID.
     * @param {number} id - O ID do fornecedor a ser excluído.
     * @returns {Promise<boolean>} True se a exclusão foi bem-sucedida, false caso contrário.
     */
    async function deleteSupplier(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`deleteSupplier: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando excluir fornecedor (ID: ${id}).`);
        try {
            // Se houver CloudSync, marca para exclusão na nuvem
            if (cloudSync) {
                const supplierToDelete = await getSupplierById(id);
                if (supplierToDelete) {
                    await cloudSync.markItemForSync(SUPPLIERS_CONFIG.tableName, supplierToDelete, 2); // 2 = pending_delete
                    logger.info(`Fornecedor (ID: ${id}) marcado para exclusão na nuvem.`);
                    eventHandler.emit('supplier:markedForDeletion', id);
                    return true; // Considera sucesso por ter marcado
                }
            }
            
            // Se não há sync com a nuvem, ou se a exclusão local é prioritária:
            await databaseInstance.table(SUPPLIERS_CONFIG.tableName).delete(id);
            logger.success(`Fornecedor (ID: ${id}) excluído com sucesso.`);
            eventHandler.emit('supplier:deleted', id);
            return true;
        } catch (error) {
            logger.error(`Erro ao excluir fornecedor (ID: ${id}): ${error.message}`);
            eventHandler.emit('supplier:deleteError', { id, error: error.message });
            return false;
        }
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        add: addSupplier,
        getById: getSupplierById,
        getAll: getAllSuppliers,
        update: updateSupplier,
        delete: deleteSupplier,
        validate: validateSupplier, // Expõe a função de validação diretamente
        config: SUPPLIERS_CONFIG // Expõe a configuração para referência externa
    };
})();