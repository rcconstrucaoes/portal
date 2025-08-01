/**
 * RC Construções - Cloud Sync System (Revisado e Aprimorado)
 * Gerencia a sincronização de dados entre o cliente (IndexedDB) e o servidor backend.
 * Este módulo é crucial para a persistência e disponibilidade dos dados através da nuvem.
 * Aprimorado para ser mais robusto, com tratamento de erros, e integração com outros módulos core.
 */

(function() {
    'use strict';

    let logger;
    let authManager;
    let databaseInstance;
    let settingsManager;

    const CLOUD_SYNC_CONFIG = {
        syncInterval: 5 * 60 * 1000, // 5 minutos entre as tentativas de sincronização completa
        maxRetries: 3, // Número máximo de tentativas para uma requisição falha
        retryDelay: 2000, // 2 segundos de delay para retries de requisição
        batchSize: 100, // Número de registros a sincronizar por lote (para push e pull)
        endpoints: {
            // Endpoints reais do seu backend
            pull: '/api/cloud-sync/pull', // Para baixar dados do servidor
            push: '/api/cloud-sync/push', // Para enviar dados para o servidor
            metadata: '/api/cloud-sync/metadata' // Para obter metadados de sincronização (opcional)
        },
        // Tabelas do IndexedDB que devem ser sincronizadas
        syncTables: [
            { name: 'users', lastSyncField: 'lastSync_users' },
            { name: 'clients', lastSyncField: 'lastSync_clients' },
            { name: 'budgets', lastSyncField: 'lastSync_budgets' },
            { name: 'contracts', lastSyncField: 'lastSync_contracts' },
            { name: 'financial', lastSyncField: 'lastSync_financial' }
        ],
        // Campo que indica o timestamp da última modificação para detectar mudanças
        // Tanto no cliente quanto no servidor.
        clientModifiedField: 'updatedAt', 
        serverModifiedField: 'updatedAt', // Assumindo o mesmo nome no servidor
        deviceIdKey: 'cloudDeviceId' // Chave para armazenar um ID único do dispositivo no settings
    };

    let syncIntervalId = null;
    let isSyncing = false; // Flag para evitar execuções simultâneas de sincronização

    /**
     * Espera por uma dependência global estar disponível.
     * Isso garante que os módulos core estejam carregados e prontos.
     * @param {string} globalName - O nome da variável global a ser esperada (e.g., 'SystemLogger').
     * @returns {Promise<any>} A instância da dependência.
     */
    async function waitForGlobal(globalName) {
        return new Promise(resolve => {
            const checkGlobal = () => {
                if (window[globalName]) {
                    resolve(window[globalName]);
                } else {
                    setTimeout(checkGlobal, 50); // Tenta novamente após 50ms
                }
            };
            checkGlobal();
        });
    }

    /**
     * Inicializa o módulo CloudSync.
     * Carrega as dependências e configura o ambiente para sincronização.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('CloudSync'));
            authManager = await waitForGlobal('AuthManager');
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            settingsManager = await waitForGlobal('SettingsManager');

            logger.info('☁️ Cloud Sync System inicializado. Aguardando ativação.');

            // Gera/carrega um ID único para este dispositivo, usado pelo servidor para rastrear sincronizações
            let deviceId = await settingsManager.getSetting(CLOUD_SYNC_CONFIG.deviceIdKey);
            if (!deviceId) {
                deviceId = generateUUID();
                await settingsManager.setSetting(CLOUD_SYNC_CONFIG.deviceIdKey, deviceId);
                logger.debug(`Novo Device ID gerado e salvo: ${deviceId}`);
            } else {
                logger.debug(`Device ID carregado: ${deviceId}`);
            }
            CLOUD_SYNC_CONFIG.deviceId = deviceId;

            // Configura listeners para eventos de autenticação
            if (window.SystemEventHandler) {
                window.SystemEventHandler.on('userLoggedIn', startAutoSync);
                window.SystemEventHandler.on('userLoggedOut', stopAutoSync);
                window.SystemEventHandler.on('authExpired', stopAutoSync); // Para parar a sincronização se o token expirar
            } else {
                logger.warn('SystemEventHandler não disponível, listeners de autenticação não configurados.');
            }

            // Se o usuário já estiver logado (e tiver um token), inicia a sincronização
            if (authManager.isAuthenticated()) {
                startAutoSync();
            }

            // Adiciona listeners para mudanças de status de rede
            window.addEventListener('online', handleOnlineStatusChange);
            window.addEventListener('offline', handleOfflineStatusChange);

        } catch (error) {
            console.error('Erro crítico ao inicializar Cloud Sync System:', error);
            (logger || console).error('Falha na inicialização do Cloud Sync System. Sincronização em nuvem desabilitada.');
        }
    }

    /**
     * Gera um UUID (Universally Unique Identifier) v4.
     * Usado para gerar um ID único para cada dispositivo cliente.
     * @returns {string} Um UUID v4.
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Inicia a sincronização automática em intervalos definidos.
     */
    function startAutoSync() {
        if (!authManager.isAuthenticated()) {
            logger.warn('Não autenticado. Sincronização automática não pode ser iniciada.');
            return;
        }
        if (syncIntervalId) {
            logger.debug('Sincronização automática já ativa.');
            return;
        }
        if (!navigator.onLine) {
            logger.warn('Dispositivo offline. Sincronização automática não pode ser iniciada.');
            return;
        }

        syncIntervalId = setInterval(fullSyncCycle, CLOUD_SYNC_CONFIG.syncInterval);
        logger.info(`Sincronização automática iniciada a cada ${CLOUD_SYNC_CONFIG.syncInterval / (1000 * 60)} minutos.`);
        // Executa a primeira sincronização imediatamente
        fullSyncCycle();
    }

    /**
     * Para a sincronização automática.
     */
    function stopAutoSync() {
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
            syncIntervalId = null;
            logger.info('Sincronização automática parada.');
        }
    }

    /**
     * Lida com a mudança de status para online.
     */
    function handleOnlineStatusChange() {
        logger.info('Conexão online restaurada. Tentando sincronizar agora...');
        if (authManager.isAuthenticated()) {
            startAutoSync(); // Tenta reiniciar a sincronização
        } else {
            logger.warn('Online, mas não autenticado. Sincronização não iniciada.');
        }
    }

    /**
     * Lida com a mudança de status para offline.
     */
    function handleOfflineStatusChange() {
        logger.warn('Conexão offline detectada. Sincronização em nuvem pausada.');
        stopAutoSync();
    }

    /**
     * Executa um ciclo completo de sincronização (pull e push) para todas as tabelas.
     * @returns {Promise<boolean>} True se o ciclo foi bem-sucedido, false caso contrário.
     */
    async function fullSyncCycle() {
        if (isSyncing || !authManager.isAuthenticated() || !navigator.onLine) {
            logger.debug(`Ciclo de sincronização ${isSyncing ? 'já em andamento' : ''}${!authManager.isAuthenticated() ? ', não autenticado' : ''}${!navigator.onLine ? ', offline' : ''}. Pulando.`);
            return false;
        }

        isSyncing = true;
        logger.info('Iniciando ciclo completo de sincronização em nuvem...');
        try {
            // Puxa dados do servidor primeiro para resolver conflitos mais cedo
            await pullDataFromServer();
            // Em seguida, envia as alterações locais para o servidor
            await pushDataToServer();
            logger.success('Ciclo de sincronização em nuvem concluído com sucesso!');
            return true;
        } catch (error) {
            logger.error(`Erro durante o ciclo de sincronização em nuvem: ${error.message}`);
            return false;
        } finally {
            isSyncing = false;
        }
    }

    /**
     * Puxa dados do servidor para o cliente (IndexedDB).
     * Baixa apenas dados mais novos que o lastSyncTimestamp local para cada tabela.
     * @returns {Promise<void>}
     */
    async function pullDataFromServer() {
        logger.debug('Iniciando pull de dados do servidor...');
        const token = authManager.getToken();
        if (!token) {
            logger.warn('Não há token de autenticação para puxar dados.');
            if (window.SystemEventHandler) window.SystemEventHandler.emit('authExpired');
            throw new Error('Unauthorized: No token available for pull.');
        }

        for (const tableConfig of CLOUD_SYNC_CONFIG.syncTables) {
            let retries = 0;
            const tableName = tableConfig.name;
            const lastSyncField = tableConfig.lastSyncField;
            
            while (retries <= CLOUD_SYNC_CONFIG.maxRetries) {
                try {
                    const lastSyncTimestamp = await settingsManager.getSetting(lastSyncField) || 0;
                    logger.debug(`Puxando para '${tableName}' desde ${new Date(lastSyncTimestamp).toISOString()}`);

                    const response = await fetch(
                        `${CLOUD_SYNC_CONFIG.endpoints.pull}?table=${tableName}&lastSync=${lastSyncTimestamp}&deviceId=${CLOUD_SYNC_CONFIG.deviceId}`,
                        {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'X-Device-Id': CLOUD_SYNC_CONFIG.deviceId // Envia o ID do dispositivo
                            }
                        }
                    );

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            logger.error('Pull falhou: Token expirado ou não autorizado.');
                            if (window.SystemEventHandler) window.SystemEventHandler.emit('authExpired');
                            throw new Error('Unauthorized'); // Força saída e logout
                        }
                        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
                    }
                    
                    const { data, serverLastSyncTimestamp } = await response.json(); // Servidor deve retornar o novo timestamp de sync

                    if (data && data.length > 0) {
                        logger.info(`Recebidos ${data.length} registros para '${tableName}'.`);
                        // Usa bulkPut para adicionar/atualizar múltiplos itens de uma vez no IndexedDB
                        await databaseInstance.table(tableName).bulkPut(data);
                        logger.success(`Dados de '${tableName}' atualizados no cliente.`);
                    } else {
                        logger.debug(`Nenhum dado novo para '${tableName}' do servidor.`);
                    }
                    // Atualiza o timestamp da última sincronização para a tabela no cliente
                    await settingsManager.setSetting(lastSyncField, serverLastSyncTimestamp || Date.now());
                    logger.debug(`lastSyncTimestamp para '${tableName}' atualizado para ${new Date(serverLastSyncTimestamp || Date.now()).toISOString()}`);
                    break; // Sai do loop de retries em caso de sucesso
                } catch (error) {
                    logger.error(`Erro ao puxar dados para a tabela '${tableName}': ${error.message}`);
                    if (error.message.includes('Unauthorized')) throw error; // Re-lança para interromper syncAllTables
                    retries++;
                    if (retries <= CLOUD_SYNC_CONFIG.maxRetries) {
                        logger.warn(`Tentando novamente pull para '${tableName}' (Tentativa ${retries}/${CLOUD_SYNC_CONFIG.maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, CLOUD_SYNC_CONFIG.retryDelay * retries));
                    } else {
                        logger.error(`Falha persistente ao puxar dados para '${tableName}' após ${CLOUD_SYNC_CONFIG.maxRetries} tentativas.`);
                    }
                }
            }
        }
    }

    /**
     * Envia dados do cliente (IndexedDB) para o servidor.
     * Assume que os itens no cliente têm um campo `syncStatus` (0: synced, 1: pending_push, 2: pending_delete).
     * @returns {Promise<void>}
     */
    async function pushDataToServer() {
        logger.debug('Iniciando push de dados para o servidor...');
        const token = authManager.getToken();
        if (!token) {
            logger.warn('Não há token de autenticação para enviar dados.');
            if (window.SystemEventHandler) window.SystemEventHandler.emit('authExpired');
            throw new Error('Unauthorized: No token available for push.');
        }

        for (const tableConfig of CLOUD_SYNC_CONFIG.syncTables) {
            let retries = 0;
            const tableName = tableConfig.name;

            while (retries <= CLOUD_SYNC_CONFIG.maxRetries) {
                try {
                    // Busca itens que precisam ser sincronizados (criados, modificados, deletados)
                    const itemsToPush = await databaseInstance.table(tableName)
                        .filter(item => item.syncStatus === 1 || item.syncStatus === 2) // 1:novo/modificado, 2:para deletar
                        .toArray();

                    if (itemsToPush.length === 0) {
                        logger.debug(`Nenhum item para enviar para '${tableName}'.`);
                        break; // Sai do loop de retries para esta tabela
                    }

                    logger.info(`Enviando ${itemsToPush.length} registros de '${tableName}' para o servidor.`);

                    const response = await fetch(CLOUD_SYNC_CONFIG.endpoints.push, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'X-Device-Id': CLOUD_SYNC_CONFIG.deviceId
                        },
                        body: JSON.stringify({
                            table: tableName,
                            data: itemsToPush, // Envia os itens pendentes
                            deviceId: CLOUD_SYNC_CONFIG.deviceId
                        })
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            logger.error('Push falhou: Token expirado ou não autorizado.');
                            if (window.SystemEventHandler) window.SystemEventHandler.emit('authExpired');
                            throw new Error('Unauthorized');
                        }
                        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
                    }

                    const result = await response.json(); // O servidor deve retornar quais IDs foram processados
                    
                    if (result.success) {
                        logger.success(`Dados de '${tableName}' enviados e confirmados pelo servidor. ${result.message || ''}`);
                        
                        // Atualiza o status de sincronização no cliente para os itens processados com sucesso
                        await Promise.all(itemsToPush.map(async item => {
                            if (result.processedIds && result.processedIds.includes(item.id)) { // Servidor confirmou o processamento
                                if (item.syncStatus === 2) { // Era uma deleção, agora remove do cliente
                                    await databaseInstance.table(tableName).delete(item.id);
                                } else { // Era uma criação/modificação, agora marca como sincronizado
                                    await databaseInstance.table(tableName).update(item.id, { 
                                        syncStatus: 0, 
                                        serverLastModified: result.serverTimestamp || Date.now() 
                                    });
                                }
                            }
                        }));
                    } else {
                        throw new Error(result.message || `Erro desconhecido ao enviar dados de '${tableName}'.`);
                    }
                    break; // Sai do loop de retries em caso de sucesso
                } catch (error) {
                    logger.error(`Erro ao enviar dados para a tabela '${tableName}': ${error.message}`);
                    if (error.message.includes('Unauthorized')) throw error;
                    retries++;
                    if (retries <= CLOUD_SYNC_CONFIG.maxRetries) {
                        logger.warn(`Tentando novamente push para '${tableName}' (Tentativa ${retries}/${CLOUD_SYNC_CONFIG.maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, CLOUD_SYNC_CONFIG.retryDelay * retries));
                    } else {
                        logger.error(`Falha persistente ao enviar dados para '${tableName}' após ${CLOUD_SYNC_CONFIG.maxRetries} tentativas.`);
                    }
                }
            }
        }
    }

    /**
     * Função para marcar um item como modificado no cliente para posterior sincronização.
     * Módulos CRUD devem chamar esta função após criar/atualizar/deletar um item.
     * @param {string} tableName - O nome da tabela onde o item foi modificado.
     * @param {Object} item - O item completo que foi modificado.
     * @param {number} status - O status de sincronização (0: synced, 1: pending_push, 2: pending_delete).
     */
    async function markItemForSync(tableName, item, status) {
        if (!databaseInstance || databaseInstance.isFallback()) {
            logger.warn(`Não foi possível marcar item para sincronização em '${tableName}': DB em modo fallback.`);
            return;
        }
        try {
            // Atualiza o item no IndexedDB com o status de sincronização
            await databaseInstance.table(tableName).update(item.id, {
                syncStatus: status,
                [CLOUD_SYNC_CONFIG.clientModifiedField]: Date.now() // Atualiza o timestamp de modificação
            });
            logger.debug(`Item ${item.id} na tabela '${tableName}' marcado com syncStatus: ${status}.`);
            // Opcional: Acionar uma sincronização imediata se for um item crítico
            // syncAllTables();
        } catch (error) {
            logger.error(`Erro ao marcar item para sincronização em '${tableName}': ${error.message}`);
        }
    }


    // Expõe a API pública do módulo
    return {
        init: init,
        start: startAutoSync,
        stop: stopAutoSync,
        syncNow: fullSyncCycle, // Dispara um ciclo completo de sincronização imediatamente
        markItemForSync: markItemForSync, // Expõe para que os módulos CRUD possam marcar itens
        getDeviceId: () => CLOUD_SYNC_CONFIG.deviceId
    };
})();