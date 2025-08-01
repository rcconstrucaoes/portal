/**
 * RC Construções - Módulo de Clientes (Revisado e Aprimorado)
 * Gerencia todas as funcionalidades relacionadas a clientes, incluindo
 * criação, leitura, atualização, exclusão, e filtragem.
 * Aprimorado para ser robusto, com validação, e integração com outros módulos.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let validationManager;
    let utilsManager; // Para formatação de CPF/telefone, se necessário
    let eventHandler;
    let cloudSync; // Para sincronização de dados

    const CLIENTS_CONFIG = {
        tableName: 'clients',
        fields: {
            name: { type: 'string', required: true, label: 'Nome Completo', minLength: 3, maxLength: 150 },
            email: { type: 'string', required: true, label: 'E-mail' },
            phone: { type: 'string', required: true, label: 'Telefone' },
            address: { type: 'string', required: false, label: 'Endereço Completo' },
            cpf: { type: 'string', required: false, label: 'CPF' }, // Opcional, dependendo da necessidade
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
     * Inicializa o Módulo de Clientes.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ClientsModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            validationManager = await waitForGlobal('ValidationManager');
            utilsManager = await waitForGlobal('UtilsManager'); // Para usar utilities como formatPhone/CPF
            eventHandler = await waitForGlobal('SystemEventHandler');
            cloudSync = await waitForGlobal('CloudSync').catch(() => null); // CloudSync é opcional

            logger.info('👥 Módulo de Clientes inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar ClientsModule:', error);
            (logger || console).error('Falha na inicialização do ClientsModule. Funcionalidades de cliente podem não estar disponíveis.');
        }
    }

    /**
     * Valida um objeto de cliente contra o schema definido e regras de negócio.
     * @param {Object} client - O objeto de cliente a ser validado.
     * @returns {Object} Um objeto com 'isValid' (boolean) e 'errors' (Array de strings).
     */
    function validateClient(client) {
        const errors = [];
        let isValid = true;

        for (const fieldName in CLIENTS_CONFIG.fields) {
            const fieldConfig = CLIENTS_CONFIG.fields[fieldName];
            const value = client[fieldName];

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
                        if (!validationManager.validatePhone(value)) { // Usa o validador de telefone do Utils
                            errors.push(`${fieldConfig.label} inválido.`);
                            isValid = false;
                        }
                        break;
                    case 'cpf':
                        if (value && !validationManager.validateCPF(value)) { // CPF é opcional, só valida se houver valor
                            errors.push(`${fieldConfig.label} inválido.`);
                            isValid = false;
                        }
                        break;
                    // Outras validações específicas por tipo de campo ou campo personalizado
                    case 'createdAt':
                    case 'updatedAt':
                        if (!validationManager.validateNumber(value) || value <= 0) { // Deve ser um timestamp válido
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
            logger.warn('Validação de cliente falhou:', errors);
        } else {
            logger.debug('Validação de cliente bem-sucedida.');
        }
        return { isValid, errors };
    }


    /**
     * Adiciona um novo cliente ao banco de dados.
     * @param {Object} clientData - Os dados do novo cliente.
     * @returns {Promise<Object|null>} O cliente salvo com ID, ou null em caso de falha.
     */
    async function addClient(clientData) {
        logger.info('Tentando adicionar novo cliente:', clientData);

        // Pre-formatação de campos antes da validação
        if (clientData.phone) clientData.phone = utilsManager.formatPhone(clientData.phone);
        if (clientData.cpf) clientData.cpf = utilsManager.formatCPF(clientData.cpf);

        const { isValid, errors } = validateClient(clientData);
        if (!isValid) {
            eventHandler.emit('client:validationError', errors);
            return null;
        }

        try {
            const newClient = {
                ...clientData,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                syncStatus: 1 // 1 = Pendente de sincronização para push
            };
            const id = await databaseInstance.table(CLIENTS_CONFIG.tableName).add(newClient);
            const savedClient = { ...newClient, id };

            logger.success(`Cliente '${savedClient.name}' adicionado com sucesso (ID: ${id}).`);
            eventHandler.emit('client:added', savedClient);
            
            if (cloudSync) {
                await cloudSync.markItemForSync(CLIENTS_CONFIG.tableName, savedClient, 1);
            }
            return savedClient;
        } catch (error) {
            logger.error(`Erro ao adicionar cliente: ${error.message}`, clientData);
            eventHandler.emit('client:addError', { data: clientData, error: error.message });
            return null;
        }
    }

    /**
     * Obtém um cliente pelo seu ID.
     * @param {number} id - O ID do cliente.
     * @returns {Promise<Object|null>} O objeto do cliente, ou null se não encontrado.
     */
    async function getClientById(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`getClientById: ID inválido fornecido: ${id}`);
            return null;
        }
        try {
            const client = await databaseInstance.table(CLIENTS_CONFIG.tableName).get(id);
            if (client) {
                logger.debug(`Cliente encontrado (ID: ${id}):`, client);
            } else {
                logger.info(`Cliente não encontrado (ID: ${id}).`);
            }
            return client;
        } catch (error) {
            logger.error(`Erro ao obter cliente por ID (${id}): ${error.message}`);
            eventHandler.emit('client:fetchError', { id, error: error.message });
            return null;
        }
    }

    /**
     * Obtém todos os clientes do banco de dados.
     * @returns {Promise<Array<Object>>} Uma lista de todos os clientes.
     */
    async function getAllClients() {
        try {
            const clients = await databaseInstance.table(CLIENTS_CONFIG.tableName).toArray();
            logger.info(`Total de ${clients.length} clientes carregados.`);
            return clients;
        } catch (error) {
            logger.error(`Erro ao obter todos os clientes: ${error.message}`);
            eventHandler.emit('client:fetchAllError', { error: error.message });
            return [];
        }
    }

    /**
     * Atualiza um cliente existente.
     * @param {number} id - O ID do cliente a ser atualizado.
     * @param {Object} updates - Os campos a serem atualizados no cliente.
     * @returns {Promise<boolean>} True se a atualização foi bem-sucedida, false caso contrário.
     */
    async function updateClient(id, updates) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`updateClient: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando atualizar cliente (ID: ${id}) com:`, updates);

        // Pre-formatação de campos antes da validação de updates
        if (updates.phone) updates.phone = utilsManager.formatPhone(updates.phone);
        if (updates.cpf) updates.cpf = utilsManager.formatCPF(updates.cpf);

        // Para validar o objeto completo, você precisaria carregar o cliente atual e mesclar as atualizações
        const currentClient = await getClientById(id);
        if (!currentClient) {
            logger.error(`updateClient: Cliente com ID ${id} não encontrado para atualização.`);
            return false;
        }
        const mergedClientData = { ...currentClient, ...updates };

        const { isValid, errors } = validateClient(mergedClientData);
        if (!isValid) {
            eventHandler.emit('client:validationError', errors);
            return false;
        }

        try {
            const updatedFields = { ...updates, updatedAt: Date.now(), syncStatus: 1 }; // Marca para sincronização
            await databaseInstance.table(CLIENTS_CONFIG.tableName).update(id, updatedFields);
            
            const updatedClient = await getClientById(id); // Busca o cliente atualizado para passar no evento
            logger.success(`Cliente (ID: ${id}) atualizado com sucesso.`);
            eventHandler.emit('client:updated', updatedClient);

            if (cloudSync && updatedClient) {
                await cloudSync.markItemForSync(CLIENTS_CONFIG.tableName, updatedClient, 1);
            }
            return true;
        } catch (error) {
            logger.error(`Erro ao atualizar cliente (ID: ${id}): ${error.message}`, updates);
            eventHandler.emit('client:updateError', { id, data: updates, error: error.message });
            return false;
        }
    }

    /**
     * Exclui um cliente pelo seu ID.
     * @param {number} id - O ID do cliente a ser excluído.
     * @returns {Promise<boolean>} True se a exclusão foi bem-sucedida, false caso contrário.
     */
    async function deleteClient(id) {
        if (!id || !validationManager.validateNumber(id)) {
            logger.warn(`deleteClient: ID inválido fornecido: ${id}`);
            return false;
        }
        logger.info(`Tentando excluir cliente (ID: ${id}).`);
        try {
            // Antes de deletar, é uma boa prática marcar para sincronização de exclusão
            if (cloudSync) {
                const clientToDelete = await getClientById(id);
                if (clientToDelete) {
                    // Marcar como deletado e enviar para o servidor, para só então remover localmente
                    await cloudSync.markItemForSync(CLIENTS_CONFIG.tableName, clientToDelete, 2); // 2 = pending_delete
                    // O item será removido localmente APÓS a sincronização bem-sucedida pelo cloudSync.
                    // Se o cloudSync não estiver ativo ou a sincronização falhar, o item permanece marcado.
                    logger.info(`Cliente (ID: ${id}) marcado para exclusão na nuvem.`);
                    eventHandler.emit('client:markedForDeletion', id);
                    return true; // Considera sucesso por ter marcado
                }
            }
            
            // Se não há sync com a nuvem, ou se a exclusão local é prioritária:
            await databaseInstance.table(CLIENTS_CONFIG.tableName).delete(id);
            logger.success(`Cliente (ID: ${id}) excluído com sucesso.`);
            eventHandler.emit('client:deleted', id);
            return true;
        } catch (error) {
            logger.error(`Erro ao excluir cliente (ID: ${id}): ${error.message}`);
            eventHandler.emit('client:deleteError', { id, error: error.message });
            return false;
        }
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        add: addClient,
        getById: getClientById,
        getAll: getAllClients,
        update: updateClient,
        delete: deleteClient,
        validate: validateClient, // Expõe a função de validação diretamente
        config: CLIENTS_CONFIG // Expõe a configuração para referência externa
    };
})();