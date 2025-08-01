/**
 * RC Construções - Database Manager (Revisado e Aprimorado)
 * Gerencia a conexão com o IndexedDB usando Dexie.js e oferece um fallback para localStorage.
 * Aprimorado para ser mais robusto e eficiente na gestão de dados do aplicativo.
 */

(function() { // Usando IIFE para encapsular o módulo
    let db;
    let isFallbackMode = false;
    let logger; // Variável para armazenar a instância do logger

    const DB_NAME = 'RC_Construcoes_DB';
    const DB_VERSION = 2; // Versão atual do banco de dados

    // Definição dos schemas para cada versão do banco de dados
    const schemas = {
        1: {
            users: '++id, username, email, passwordHash, role, createdAt, updatedAt',
            clients: '++id, name, contact, email, phone, address, createdAt, updatedAt',
            budgets: '++id, clientId, title, description, amount, status, createdAt, updatedAt',
            contracts: '++id, clientId, budgetId, title, terms, value, startDate, endDate, status, createdAt, updatedAt',
            financial: '++id, type, description, amount, date, category, referenceId, createdAt, updatedAt',
        },
        2: {
            // No Dexie, '++id' para chaves auto-incrementáveis. Nomes de campos para índices.
            // '*campo' para índices multiEntry (se o campo for um array).
            users: '++id, username, email, passwordHash, role, createdAt, updatedAt, *permissions',
            clients: '++id, name, contact, email, phone, address, createdAt, updatedAt',
            budgets: '++id, clientId, title, description, amount, status, createdAt, updatedAt, *tags',
            contracts: '++id, clientId, budgetId, title, terms, value, startDate, endDate, status, createdAt, updatedAt',
            financial: '++id, type, description, amount, date, category, referenceId, createdAt, updatedAt',
            // Exemplo de como adicionar uma nova tabela na versão 2 (se não existia na v1):
            // 'invoices': '++id, clientId, contractId, totalAmount, issueDate, dueDate, status, createdAt, updatedAt'
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
                    setTimeout(checkGlobal, 50); // Tenta novamente em 50ms
                }
            };
            checkGlobal();
        });
    }

    /**
     * Inicializa o DatabaseManager, tentando conectar ao IndexedDB.
     * Em caso de falha, ativa o modo fallback para localStorage.
     * @returns {Promise<void>}
     */
    async function init() {
        // Primeiro, obtenha o logger, pois ele é uma dependência crucial para logs
        logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('Database'));
        logger.info('💾 Inicializando DatabaseManager...');

        try {
            // Verifica se Dexie.js está carregado antes de instanciá-lo
            if (typeof Dexie === 'undefined') {
                throw new Error("Dexie.js não encontrado. Certifique-se de que lib/dexie.min.js está carregado ANTES de database.js.");
            }

            // Cria a instância Dexie.js
            db = new Dexie(DB_NAME);

            // Importante: O manipulador de eventos 'versionchange' deve ser definido
            // após a instância `db` ser criada, mas antes de quaisquer chamadas `db.version().stores()`
            // ou `db.open()`, pois `version().stores()` pode disparar o evento upgradeneeded,
            // que é um subtipo de versionchange.
            db.on('versionchange', (event) => {
                logger.warn('🔄 Mudança de versão do banco de dados detectada:', event);
                // Lógica para lidar com a mudança de versão (ex: informar ao usuário para recarregar)
                // Se sua aplicação pode ter múltiplas abas abertas, isso é crítico.
                // Exemplo: if (db.isOpen()) db.close(); // Fecha a conexão atual para permitir o upgrade em outra aba
                // alert('Uma atualização do banco de dados está disponível. Por favor, recarregue a página.');
            });

            // Define os schemas para cada versão.
            // Se o Dexie precisar fazer um upgrade, ele chamará o upgradeneeded/versionchange.
            // A ordem aqui (v1 antes de v2) é crucial para a migração sequencial.
            db.version(1).stores(schemas[1]);
            db.version(2).stores(schemas[2]);

            await db.open(); // Abre a conexão com o banco de dados
            logger.info(`📊 Database: ${DB_NAME} versão: ${db.verno}`);
            isFallbackMode = false;
        } catch (error) {
            logger.error('❌ Erro ao inicializar DatabaseManager com IndexedDB:', error);
            initFallbackMode(); // Se o IndexedDB falhar, tenta o modo fallback
        }
    }

    /**
     * Ativa o modo fallback para localStorage em caso de falha do IndexedDB.
     */
    function initFallbackMode() {
        logger.warn('🚧 Inicializando modo fallback (localStorage).');
        isFallbackMode = true;
        const localStorageDB = {};

        // Carrega dados existentes do localStorage para o "banco de dados" em memória
        // Isso garante que o fallback tenha os dados mais recentes que já foram salvos
        Object.keys(schemas[DB_VERSION]).forEach(tableName => {
            const storedData = localStorage.getItem(DB_NAME + '_' + tableName);
            if (storedData) {
                try {
                    localStorageDB[tableName] = JSON.parse(storedData);
                } catch (e) {
                    logger.error(`Erro ao parsear dados do localStorage para ${tableName}:`, e);
                    localStorageDB[tableName] = []; // Reset se os dados estiverem corrompidos
                }
            } else {
                localStorageDB[tableName] = [];
            }
        });

        // Simula a API do Dexie.js para compatibilidade no modo fallback
        // 'db' é reatribuído para o objeto simulado de localStorage
        db = {
            table: (tableName) => {
                // Assegura que a "tabela" existe no objeto em memória
                if (!localStorageDB[tableName]) {
                    localStorageDB[tableName] = [];
                }
                return {
                    // Simula .add()
                    add: async (item) => {
                        const id = localStorageDB[tableName].length ? Math.max(...localStorageDB[tableName].map(i => i.id || 0)) + 1 : 1;
                        const newItem = { ...item, id };
                        localStorageDB[tableName].push(newItem);
                        localStorage.setItem(DB_NAME + '_' + tableName, JSON.stringify(localStorageDB[tableName]));
                        logger.warn(`[Fallback] Item adicionado em '${tableName}':`, newItem);
                        return id;
                    },
                    // Simula .put()
                    put: async (item) => {
                        const index = localStorageDB[tableName].findIndex(i => i.id === item.id);
                        let assignedId = item.id;
                        if (index > -1) {
                            localStorageDB[tableName][index] = { ...localStorageDB[tableName][index], ...item };
                        } else {
                            assignedId = localStorageDB[tableName].length ? Math.max(...localStorageDB[tableName].map(i => i.id || 0)) + 1 : 1;
                            localStorageDB[tableName].push({ ...item, id: assignedId });
                        }
                        localStorage.setItem(DB_NAME + '_' + tableName, JSON.stringify(localStorageDB[tableName]));
                        logger.warn(`[Fallback] Item atualizado/adicionado em '${tableName}':`, item);
                        return assignedId;
                    },
                    // Simula .get()
                    get: async (id) => {
                        const found = localStorageDB[tableName].find(item => item.id === id);
                        logger.warn(`[Fallback] Item obtido de '${tableName}' (ID: ${id}):`, found);
                        return found;
                    },
                    // Simula .where().equals()
                    where: (key) => ({
                        equals: (value) => {
                            const results = localStorageDB[tableName].filter(item => item[key] === value);
                            logger.warn(`[Fallback] Consulta em '${tableName}' (where ${key} = ${value}):`, results);
                            return { toArray: async () => results };
                        }
                        // Outros métodos Dexie.js como .startsWith(), .above(), etc. poderiam ser adicionados aqui se necessário
                    }),
                    // Simula .toArray()
                    toArray: async () => {
                        logger.warn(`[Fallback] Todos os itens de '${tableName}':`, localStorageDB[tableName]);
                        return localStorageDB[tableName];
                    },
                    // Simula .delete()
                    delete: async (id) => {
                        const initialLength = localStorageDB[tableName].length;
                        localStorageDB[tableName] = localStorageDB[tableName].filter(item => item.id !== id);
                        localStorage.setItem(DB_NAME + '_' + tableName, JSON.stringify(localStorageDB[tableName]));
                        logger.warn(`[Fallback] Item deletado de '${tableName}' (ID: ${id}). Deletados: ${initialLength - localStorageDB[tableName].length > 0 ? 'sim' : 'não'}.`);
                        return initialLength - localStorageDB[tableName].length; // Retorna 1 se deletado, 0 caso contrário
                    },
                    // Simula .count()
                    count: async () => {
                        return localStorageDB[tableName].length;
                    }
                };
            },
            isOpen: true, // Simula que o banco de dados está "aberto"
            verno: 'fallback' // Indica que está em modo fallback
        };
        logger.warn('🚧 DatabaseManager em modo fallback.');
    }

    /**
     * Retorna a instância do banco de dados (Dexie.js ou localStorage fallback).
     * @returns {Dexie | Object} A instância do banco de dados.
     */
    function getInstance() {
        if (!db) {
            logger.error('Database não inicializado. Chame Database.init() primeiro.');
            throw new Error('Database not initialized.');
        }
        return db;
    }

    /**
     * Verifica se o banco de dados está em modo fallback (usando localStorage).
     * @returns {boolean} True se estiver em modo fallback, false caso contrário.
     */
    function isFallback() {
        return isFallbackMode;
    }

    // Retorna a API pública do módulo
    return {
        init: init,
        getInstance: getInstance,
        isFallback: isFallback,
        schemas: schemas // Expõe os schemas para depuração ou informação
    };
})();