/**
 * RC Construções - Data Versioning System (Revisado e Aprimorado)
 * Gerencia a versão do esquema do banco de dados (IndexedDB) e migrações de dados.
 * Inclui funcionalidades para snapshots automáticos e recuperação de dados.
 * Aprimorado para ser mais robusto, com melhor tratamento de dependências e logs.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let settingsManager; // Para armazenar a última versão sincronizada, se aplicável
    let utilsManager; // Para utilitários de data ou manipulação de dados

    const DATA_VERSIONING_CONFIG = {
        currentAppVersion: '5.6.1-Aprimorado', // Versão atual do aplicativo
        dbName: 'RC_Construcoes_DB', // Nome do banco de dados (deve ser o mesmo do Database.js)
        snapshotInterval: 24 * 60 * 60 * 1000, // Snapshots automáticos a cada 24 horas
        maxSnapshots: 5, // Número máximo de snapshots a manter
        // Lista de migrações (seus callbacks)
        migrations: [
            { version: 1, description: 'Schema inicial do banco de dados.', apply: async (oldDb, newDb, tx) => {
                // Exemplo de migração V1 (já definida no Database.js)
                // Se houver lógica específica aqui para a V1, adicione.
                // logger.debug('Migração v1 para v2: Iniciando...');
            }},
            { version: 2, description: 'Adição de campos de permissão e tags. Exemplo: migração real.', apply: async (oldDb, newDb, tx) => {
                // Exemplo de migração de V1 para V2.
                // Se a migração da V1 para a V2 envolveu mais do que apenas a definição do esquema no Dexie,
                // como a transformação de dados existentes, a lógica seria adicionada aqui.
                // Por exemplo:
                // await oldDb.users.toCollection().modify(user => {
                //     if (!user.permissions) user.permissions = ['default'];
                // });
                logger.info('Executando migração de V1 para V2.');
            }},
            // Exemplo de migração para uma futura versão V3
            // { version: 3, description: 'Adição da tabela de projetos e campo lastLogin para usuários.', apply: async (oldDb, newDb, tx) => {
            //     await oldDb.users.toCollection().modify(user => {
            //         user.lastLogin = user.lastLogin || null; // Adiciona campo 'lastLogin'
            //     });
            //     // newDb.projects.add({ ... }); // Adiciona dados iniciais à nova tabela 'projects'
            //     logger.info('Executando migração de V2 para V3.');
            // }}
        ]
    };

    let snapshotIntervalId = null; // ID para o setInterval dos snapshots

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
     * Inicializa o Sistema de Versionamento de Dados.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('DataVersioning'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            settingsManager = await waitForGlobal('SettingsManager');
            utilsManager = await waitForGlobal('UtilsManager'); // Para formatar datas ou outras utilidades

            logger.info('🔄 Sistema de Versionamento de Dados carregado e pronto para uso!');

            // Registra as migrações no Dexie.js
            registerDexieMigrations();

            // Configura snapshots automáticos
            await setupAutoSnapshots();

            logger.info('💡 Use window.debugVersioning para funções de debug no console');
        } catch (error) {
            console.error('Erro crítico ao inicializar Sistema de Versionamento de Dados:', error);
            (logger || console).error('Falha na inicialização do Data Versioning System. Algumas funcionalidades podem estar limitadas.');
        }
    }

    /**
     * Registra as funções de migração no Dexie.js.
     * Garante que as migrações sejam aplicadas quando a versão do DB mudar.
     */
    function registerDexieMigrations() {
        // As definições db.version().stores() no Database.js já tratam do schema upgrade.
        // As funções 'apply' aqui seriam para transformações de dados em cada migração.
        DATA_VERSIONING_CONFIG.migrations.forEach(migration => {
            // Verifica se a versão da migração é maior que a versão atual do Dexie,
            // ou se é a versão atual para garantir que o schema seja definido.
            if (databaseInstance.verno < migration.version) {
                databaseInstance.version(migration.version).upgrade(async tx => {
                    logger.info(`Iniciando migração de dados para a versão ${migration.version}: ${migration.description}`);
                    try {
                        await migration.apply(databaseInstance, databaseInstance, tx); // oldDb e newDb podem ser a mesma instância Dexie
                        logger.success(`Migração para a versão ${migration.version} concluída com sucesso.`);
                    } catch (error) {
                        logger.error(`Falha na migração para a versão ${migration.version}: ${error.message}`);
                        // Lança o erro novamente para que o Dexie o capture e aborte a transação se necessário.
                        throw error;
                    }
                });
                logger.debug(`📋 Migração registrada: v${migration.version} - ${migration.description}`);
            }
        });
        logger.debug('📋 Migrações padrão registradas');
    }

    /**
     * Configura o agendamento de snapshots automáticos do banco de dados.
     * @returns {Promise<void>}
     */
    async function setupAutoSnapshots() {
        if (snapshotIntervalId) {
            clearInterval(snapshotIntervalId);
        }

        // Realiza o primeiro snapshot após a inicialização
        await createSnapshot();

        snapshotIntervalId = setInterval(createSnapshot, DATA_VERSIONING_CONFIG.snapshotInterval);
        logger.info(`⏰ Snapshots automáticos configurados a cada ${DATA_VERSIONING_CONFIG.snapshotInterval / (1000 * 60 * 60)} horas.`);
    }

    /**
     * Cria um snapshot completo do banco de dados atual.
     * Este é um exemplo simples. Em um sistema real, o snapshot pode ser um dump para um arquivo,
     * ou uma exportação para um servidor, ou cópias de tabelas específicas.
     * @returns {Promise<void>}
     */
    async function createSnapshot() {
        logger.info('📸 Criando snapshot do banco de dados...');
        try {
            // Em um cenário real, você exportaria o DB ou tabelas específicas.
            // Para Dexie, você pode usar um método como db.export() se tiver um plugin ou implementar a lógica.
            // Exemplo conceitual:
            const snapshotData = {};
            for (const tableName in databaseInstance.tables) {
                // Evite tabelas de sistema se existirem, ou dados muito grandes
                if (!tableName.startsWith('_')) { // Exemplo: ignorar tabelas internas do Dexie
                    snapshotData[tableName] = await databaseInstance.table(tableName).toArray();
                }
            }

            // Armazena o snapshot no IndexedDB em uma tabela separada para snapshots, ou no localStorage (para exemplo)
            // Ou o envia para o servidor para backup na nuvem.
            const snapshotKey = `snapshot_${Date.now()}`;
            // Simulação de salvamento local:
            localStorage.setItem(snapshotKey, JSON.stringify(snapshotData));
            
            // Gerencia o número de snapshots
            const snapshots = Object.keys(localStorage).filter(key => key.startsWith('snapshot_')).sort();
            if (snapshots.length > DATA_VERSIONING_CONFIG.maxSnapshots) {
                const oldSnapshotKey = snapshots[0];
                localStorage.removeItem(oldSnapshotKey);
                logger.debug(`Snapshot antigo '${oldSnapshotKey}' removido.`);
            }

            logger.success(`Snapshot '${snapshotKey}' criado com sucesso.`);
            window.SystemEventHandler.emit('snapshotCreated', { key: snapshotKey, timestamp: Date.now() });

        } catch (error) {
            logger.error(`Falha ao criar snapshot: ${error.message}`);
        }
    }

    /**
     * Carrega um snapshot específico e restaura o banco de dados a partir dele.
     * **CUIDADO:** Restaurar um snapshot sobrescreve os dados atuais do banco de dados.
     * @param {string} snapshotKey - A chave do snapshot a ser carregado.
     * @returns {Promise<boolean>} True se a restauração for bem-sucedida.
     */
    async function restoreSnapshot(snapshotKey) {
        logger.warn(`Restauração de snapshot '${snapshotKey}' solicitada. ATENÇÃO: ISSO SOBRESCREVERÁ OS DADOS ATUAIS.`);
        try {
            const storedSnapshot = localStorage.getItem(snapshotKey);
            if (!storedSnapshot) {
                logger.error(`Snapshot '${snapshotKey}' não encontrado.`);
                return false;
            }

            const snapshotData = JSON.parse(storedSnapshot);

            // Abre uma transação em modo 'readwrite' para todas as tabelas
            await databaseInstance.transaction('rw', databaseInstance.tables, async () => {
                for (const tableName in databaseInstance.tables) {
                    if (snapshotData[tableName]) {
                        await databaseInstance.table(tableName).clear(); // Limpa a tabela atual
                        await databaseInstance.table(tableName).bulkAdd(snapshotData[tableName]); // Adiciona os dados do snapshot
                        logger.debug(`Tabela '${tableName}' restaurada do snapshot.`);
                    }
                }
            });

            logger.success(`Banco de dados restaurado com sucesso do snapshot '${snapshotKey}'.`);
            window.SystemEventHandler.emit('snapshotRestored', { key: snapshotKey, timestamp: Date.now() });
            return true;
        } catch (error) {
            logger.error(`Falha ao restaurar snapshot '${snapshotKey}': ${error.message}`);
            return false;
        }
    }

    /**
     * Obtém uma lista de todos os snapshots disponíveis.
     * @returns {Array<Object>} Lista de objetos de snapshot ({ key, timestamp }).
     */
    function listSnapshots() {
        const snapshots = Object.keys(localStorage)
            .filter(key => key.startsWith('snapshot_'))
            .map(key => ({
                key: key,
                timestamp: parseInt(key.replace('snapshot_', '')),
                date: utilsManager ? utilsManager.formatDate(parseInt(key.replace('snapshot_', '')), 'DD/MM/YYYY HH:mm:ss') : new Date(parseInt(key.replace('snapshot_', ''))).toLocaleString()
            }))
            .sort((a, b) => b.timestamp - a.timestamp); // Mais recentes primeiro
        logger.debug('Snapshots disponíveis:', snapshots);
        return snapshots;
    }

    // Expõe funções de depuração e utilitários para o console
    window.debugVersioning = {
        createSnapshot: createSnapshot,
        restoreSnapshot: restoreSnapshot,
        listSnapshots: listSnapshots,
        // Expor o estado atual do banco de dados (Dexie.js) para inspeção
        getDbInstance: () => databaseInstance
    };

    // Retorna a API pública do módulo
    return {
        init: init,
        createSnapshot: createSnapshot,
        restoreSnapshot: restoreSnapshot,
        listSnapshots: listSnapshots,
        // Você pode adicionar um método 'migrateNow' se houver um caso de uso para acionar migrações fora do upgrade do DB
    };
})();