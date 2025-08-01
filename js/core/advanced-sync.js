/**
 * RC Construções - Advanced Sync System (Revisado e Aprimorado)
 * Gerencia a sincronização avançada de dados entre o cliente (IndexedDB/LocalStorage) e o servidor.
 * Este módulo é crucial para a consistência e disponibilidade offline dos dados.
 * Aprimorado para ser mais robusto, com tratamento de erros, e integração com o SystemLogger.
 */

(function() {
    'use strict';

    // Declaração de variáveis no escopo do IIFE
    let logger;
    let dbInstance;
    let settingsManager;

    const ADVANCED_SYNC_CONFIG = {
        syncInterval: 60 * 1000, // 60 segundos entre as tentativas de sincronização
        maxRetries: 5,
        retryDelay: 5000, // 5 segundos de delay para retries
        batchSize: 50, // Número de registros a sincronizar por lote
        endpoints: {
            pull: '/api/sync/pull',
            push: '/api/sync/push',
            status: '/api/sync/status'
        },
        // Tabelas a serem sincronizadas e suas últimas versões de sincronização
        syncTables: ['users', 'clients', 'budgets', 'contracts', 'financial'],
        clientModifiedField: 'updatedAt', // Campo que indica a última modificação no cliente (timestamp)
        deviceId: null // ID do dispositivo/cliente para rastreamento no servidor
    };

    let syncIntervalId = null; // ID para o setInterval da sincronização
    let isSyncing = false;     // Flag para evitar múltiplas sincronizações simultâneas

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
                    setTimeout(checkGlobal, 50); // Tenta novamente em 50ms
                }
            };
            checkGlobal();
        });
    }

    /**
     * Inicializa o sistema de sincronização avançada.
     * Tenta obter as instâncias do logger, do banco de dados e do settingsManager.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            // Aguarda as dependências essenciais
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('AdvancedSync'));
            settingsManager = await waitForGlobal('SettingsManager');
            dbInstance = await waitForGlobal('Database').then(db => db.getInstance());

            logger.info('🌐 Advanced Sync System carregado e pronto para uso!');

            // Carrega o ID do dispositivo do SettingsManager ou gera um novo
            ADVANCED_SYNC_CONFIG.deviceId = settingsManager.getSetting('deviceId') || generateDeviceId();
            settingsManager.setSetting('deviceId', ADVANCED_SYNC_CONFIG.deviceId);
            logger.debug(`Device ID: ${ADVANCED_SYNC_CONFIG.deviceId}`);
            
            // Inicia a sincronização automática
            startAutoSync();

            // Adiciona listener para eventos online/offline para ajustar a sincronização
            window.addEventListener('online', () => {
                logger.info('Conexão online restaurada. Tentando sincronizar agora.');
                syncAllTables(); // Tenta sincronizar imediatamente ao ficar online
                startAutoSync(); // Garante que o intervalo está ativo
            });
            window.addEventListener('offline', () => {
                logger.warn('Conexão offline detectada. Sincronização automática pausada.');
                stopAutoSync(); // Pausa a sincronização automática
            });

        } catch (error) {
            console.error('Erro crítico ao inicializar Advanced Sync System:', error);
            // Fallback para logger básico se o SystemLogger falhou
            (logger || console).error('Falha na inicialização do Advanced Sync System, algumas funcionalidades podem estar indisponíveis.');
        }
    }

    /**
     * Gera um ID de dispositivo único (UUID v4).
     * @returns {string} Um ID UUID v4.
     */
    function generateDeviceId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Inicia a sincronização automática em intervalos definidos.
     */
    function startAutoSync() {
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
        }
        // Apenas inicia se estiver online
        if (navigator.onLine) {
            syncIntervalId = setInterval(syncAllTables, ADVANCED_SYNC_CONFIG.syncInterval);
            logger.info(`Sincronização automática iniciada a cada ${ADVANCED_SYNC_CONFIG.syncInterval / 1000} segundos.`);
            // Executa a primeira sincronização imediatamente
            syncAllTables();
        } else {
            logger.warn('Não foi possível iniciar a sincronização automática: offline.');
        }
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
     * Sincroniza todas as tabelas configuradas.
     * Gerencia a lógica de pull (servidor para cliente) e push (cliente para servidor).
     * @returns {Promise<boolean>} True se a sincronização foi bem-sucedida, false caso contrário.
     */
    async function syncAllTables() {
        if (isSyncing || !navigator.onLine) {
            logger.debug(`Sincronização ${isSyncing ? 'já em andamento' : 'não pode ser iniciada (offline)'}, pulando nova tentativa.`);
            return false;
        }
        isSyncing = true;
        logger.info('Iniciando sincronização de todas as tabelas...');

        try {
            // 1. Pull do servidor: Baixa dados novos ou atualizados do servidor
            await pullDataFromServer();

            // 2. Push para o servidor: Envia dados novos ou modificados do cliente para o servidor
            await pushDataToServer();

            logger.info('Sincronização de tabelas concluída com sucesso!');
            return true;
        } catch (error) {
            logger.error(`Erro geral durante a sincronização de tabelas: ${error.message}`);
            return false;
        } finally {
            isSyncing = false;
        }
    }

    /**
     * Puxa dados do servidor para o cliente (IndexedDB).
     * @returns {Promise<void>}
     */
    async function pullDataFromServer() {
        logger.debug('Puxando dados do servidor...');
        for (const tableName of ADVANCED_SYNC_CONFIG.syncTables) {
            let retries = 0;
            while (retries <= ADVANCED_SYNC_CONFIG.maxRetries) {
                try {
                    const lastSyncTimestamp = await getLastSyncTimestamp(tableName);
                    const response = await fetch(`${ADVANCED_SYNC_CONFIG.endpoints.pull}?table=${tableName}&lastSync=${lastSyncTimestamp}&deviceId=${ADVANCED_SYNC_CONFIG.deviceId}`);
                    
                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            logger.error('Sincronização falhou: Autenticação expirada ou não autorizada. Redirecionando para login...');
                            // Dispara um evento para o ModernAppManager lidar com o logout/redirecionamento
                            if (window.SystemEventHandler) {
                                window.SystemEventHandler.emit('authExpired');
                            }
                            throw new Error('Unauthorized'); // Lança erro para sair do loop
                        }
                        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
                    }
                    
                    const { data, newLastSyncTimestamp } = await response.json();

                    if (data && data.length > 0) {
                        logger.info(`Recebidos ${data.length} registros para ${tableName}. Atualizando cliente.`);
                        await dbInstance.table(tableName).bulkPut(data); // Usa bulkPut para eficiência
                        logger.success(`Dados de '${tableName}' atualizados no cliente.`);
                    } else {
                        logger.debug(`Nenhum dado novo para '${tableName}' do servidor.`);
                    }
                    // Atualiza o timestamp da última sincronização para a tabela
                    await setLastSyncTimestamp(tableName, newLastSyncTimestamp || Date.now()); 
                    break; // Sai do loop de retries em caso de sucesso
                } catch (error) {
                    logger.error(`Erro ao puxar dados para a tabela '${tableName}': ${error.message}`);
                    if (error.message === 'Unauthorized') throw error; // Re-lança para interromper syncAllTables
                    retries++;
                    if (retries <= ADVANCED_SYNC_CONFIG.maxRetries) {
                        logger.warn(`Tentando novamente puxar dados para '${tableName}' (Tentativa ${retries}/${ADVANCED_SYNC_CONFIG.maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, ADVANCED_SYNC_CONFIG.retryDelay * retries));
                    } else {
                        logger.error(`Falha persistente ao puxar dados para '${tableName}' após ${ADVANCED_SYNC_CONFIG.maxRetries} tentativas.`);
                    }
                }
            }
        }
    }

    /**
     * Envia dados do cliente (IndexedDB) para o servidor.
     * Assume que os itens a serem enviados têm um `syncStatus` (e.g., 1 para pendente de push).
     * @returns {Promise<void>}
     */
    async function pushDataToServer() {
        logger.debug('Enviando dados para o servidor...');
        for (const tableName of ADVANCED_SYNC_CONFIG.syncTables) {
            let retries = 0;
            while (retries <= ADVANCED_SYNC_CONFIG.maxRetries) {
                try {
                    // Busca itens marcados como 'pending_push' (ou similar, baseado no seu schema)
                    const itemsToPush = await dbInstance.table(tableName)
                        .filter(item => item.syncStatus === 1 || item.syncStatus === 2) // 1=novo/modificado, 2=para deletar
                        .toArray();

                    if (itemsToPush && itemsToPush.length > 0) {
                        logger.info(`Enviando ${itemsToPush.length} registros de '${tableName}' para o servidor.`);
                        
                        const response = await fetch(ADVANCED_SYNC_CONFIG.endpoints.push, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Device-Id': ADVANCED_SYNC_CONFIG.deviceId,
                                // Adicione tokens de autenticação aqui, se necessário (ex: 'Authorization': `Bearer ${token}`)
                            },
                            body: JSON.stringify({ table: tableName, data: itemsToPush })
                        });
                        
                        if (!response.ok) {
                            if (response.status === 401 || response.status === 403) {
                                logger.error('Sincronização falhou: Autenticação expirada ou não autorizada. Redirecionando para login...');
                                if (window.SystemEventHandler) {
                                    window.SystemEventHandler.emit('authExpired');
                                }
                                throw new Error('Unauthorized');
                            }
                            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
                        }
                        
                        const result = await response.json(); // Servidor deve retornar status de cada item
                        
                        if (result.success) {
                            logger.success(`Dados de '${tableName}' enviados e confirmados pelo servidor.`);
                            // Marcar itens como sincronizados no cliente (syncStatus = 0 ou removê-los se deletados)
                            await Promise.all(itemsToPush.map(async item => {
                                if (item.syncStatus === 2) { // Item foi deletado no cliente
                                    await dbInstance.table(tableName).delete(item.id);
                                } else { // Item foi criado/modificado
                                    await dbInstance.table(tableName).update(item.id, { syncStatus: 0, serverLastModified: result.serverTimestamp || Date.now() });
                                }
                            }));
                        } else {
                            throw new Error(result.message || `Erro desconhecido ao enviar dados de '${tableName}'.`);
                        }
                    } else {
                        logger.debug(`Nenhum dado para enviar para '${tableName}' no servidor.`);
                    }
                    break; // Sai do loop de retries em caso de sucesso
                } catch (error) {
                    logger.error(`Erro ao enviar dados para a tabela '${tableName}': ${error.message}`);
                    if (error.message === 'Unauthorized') throw error;
                    retries++;
                    if (retries <= ADVANCED_SYNC_CONFIG.maxRetries) {
                        logger.warn(`Tentando novamente enviar dados para '${tableName}' (Tentativa ${retries}/${ADVANCED_SYNC_CONFIG.maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, ADVANCED_SYNC_CONFIG.retryDelay * retries));
                    } else {
                        logger.error(`Falha persistente ao enviar dados para '${tableName}' após ${ADVANCED_SYNC_CONFIG.maxRetries} tentativas.`);
                    }
                }
            }
        }
    }

    /**
     * Obtém o timestamp da última sincronização para uma tabela específica.
     * Armazenado no SettingsManager.
     * @param {string} tableName - O nome da tabela.
     * @returns {Promise<number>} Timestamp da última sincronização.
     */
    async function getLastSyncTimestamp(tableName) {
        return (await settingsManager.getSetting(`lastSync_${tableName}`)) || 0;
    }

    /**
     * Define o timestamp da última sincronização para uma tabela específica.
     * @param {string} tableName - O nome da tabela.
     * @param {number} timestamp - O timestamp a ser salvo.
     * @returns {Promise<void>}
     */
    async function setLastSyncTimestamp(tableName, timestamp) {
        await settingsManager.setSetting(`lastSync_${tableName}`, timestamp);
    }

    // Expõe as funções públicas do módulo
    return {
        init: init,
        start: startAutoSync,
        stop: stopAutoSync,
        syncNow: syncAllTables, // Permite disparar a sincronização manualmente
        getDeviceId: () => ADVANCED_SYNC_CONFIG.deviceId
    };
})();