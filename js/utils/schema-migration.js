/**
 * RC Construções - Módulo de Migração de Esquema (Revisado e Aprimorado)
 * Gerencia migrações complexas de esquema e dados para o IndexedDB usando Dexie.js.
 * Complementa o DataVersioning ao focar nas transformações estruturais e de dados entre versões.
 * Projetado para ser robusto, configurável e integrado com o SystemLogger.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let databaseInstance; // A instância do Dexie.js
    let isInitialized = false;

    // Defina as migrações de esquema e dados aqui.
    // Cada objeto de migração deve ter:
    // - version: A versão para a qual esta migração se destina.
    // - description: Uma breve descrição da migração.
    // - apply: Uma função assíncrona que recebe a transação do Dexie (tx)
    //          e opcionalmente as instâncias do banco de dados antigo e novo.
    //          Esta função deve conter a lógica para migrar o esquema (se não for `stores` simples)
    //          e transformar os dados de versões anteriores.
    const MIGRATION_DEFINITIONS = [
        // Exemplo de Migração da Versão 1 para a 2:
        {
            version: 2,
            description: 'Adição de campos *permissions em users e *tags em budgets, e nova tabela invoices.',
            apply: async (tx) => {
                logger.info('Executando migração de dados e esquema para v2.');

                // Exemplo 1: Adicionar um novo índice a uma tabela existente (Dexie já faz isso com .stores())
                // Mas se precisar de lógica para dados existentes:
                // await tx.table('users').toCollection().modify(user => {
                //     if (!user.permissions) {
                //         user.permissions = ['default_user_role'];
                //     }
                // });
                // logger.debug('Campo "permissions" em "users" atualizado.');

                // Exemplo 2: Adicionar uma nova tabela (Se invoices não existia na v1)
                // tx.db.version(2).stores({
                //     invoices: '++id, clientId, contractId, totalAmount, issueDate, dueDate, status, createdAt, updatedAt'
                // });
                // logger.debug('Nova tabela "invoices" criada (se ainda não definida no db.version).');

                // Exemplo 3: Transformar dados (renomear campo, combinar campos)
                // await tx.table('clients').toCollection().modify(client => {
                //     if (client.oldAddressFormat) {
                //         client.address = client.oldAddressFormat.street + ', ' + client.oldAddressFormat.city;
                //         delete client.oldAddressFormat;
                //     }
                // });
                // logger.debug('Dados de "clients" transformados (ex: formato de endereço).');

                // Garante que o schema da versão 2 seja aplicado, se já não foi feito pelo Database.js
                // Isso é redundante se Database.js já tem db.version(2).stores(),
                // mas mostra onde a lógica de migração de dados iria.
            }
        },
        // Exemplo de Migração da Versão 2 para a 3 (futura):
        // {
        //     version: 3,
        //     description: 'Adição de campo "lastLogin" em users e migração de tipo de dado.',
        //     apply: async (tx) => {
        //         logger.info('Executando migração de dados para v3.');
        //         await tx.table('users').toCollection().modify(user => {
        //             if (typeof user.lastLogin === 'string') {
        //                 user.lastLogin = new Date(user.lastLogin).getTime(); // Converte string para timestamp
        //             }
        //             if (user.lastLogin === undefined) {
        //                 user.lastLogin = null;
        //             }
        //         });
        //     }
        // }
    ];

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
     * Inicializa o Módulo de Migração de Esquema.
     * Registra as funções de migração no Dexie.js.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('SchemaMigrationManager já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('SchemaMigration'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());

            // A lógica de `db.version().stores()` e `db.version().upgrade()`
            // deve ser tratada aqui ou no `Database.js`.
            // Se o `Database.js` já define `db.version().stores()`,
            // este módulo pode focar apenas na lógica `upgrade` mais complexa.

            // Garante que as migrações sejam aplicadas quando necessário
            registerMigrations();
            
            logger.info('🔄 Módulo de Migração de Esquema inicializado.');
            isInitialized = true;
        } catch (error) {
            console.error('Erro crítico ao inicializar SchemaMigrationManager:', error);
            (logger || console).error('Falha na inicialização do SchemaMigrationManager. Migrações de DB podem não ocorrer.');
            isInitialized = false;
        }
    }

    /**
     * Registra todas as migrações definidas no Dexie.js.
     * As migrações são aplicadas sequencialmente pelo Dexie quando o DB é aberto
     * e a versão do DB local é menor que a versão da migração.
     */
    function registerMigrations() {
        if (!databaseInstance) {
            logger.error('DatabaseInstance não disponível. Não é possível registrar migrações.');
            return;
        }

        MIGRATION_DEFINITIONS.forEach(migration => {
            // Define o schema da nova versão (se houver mudanças no schema)
            // É importante que Database.js já tenha as definições base de `db.version().stores()`.
            // Este `upgrade` é para TRANSFORMAÇÃO DE DADOS.
            databaseInstance.version(migration.version).upgrade(async (tx) => {
                logger.info(`Iniciando execução da migração de dados para a versão ${migration.version}: ${migration.description}`);
                try {
                    await migration.apply(tx); // Passa a transação do Dexie para a função de migração
                    logger.success(`Migração para a versão ${migration.version} concluída com sucesso.`);
                } catch (error) {
                    logger.error(`Falha na migração de dados para a versão ${migration.version}: ${error.message}`);
                    throw error; // Propaga o erro para o Dexie, que irá reverter a transação
                }
            });
            logger.debug(`Migração v${migration.version} registrada: "${migration.description}"`);
        });
        logger.info(`Total de ${MIGRATION_DEFINITIONS.length} migrações registradas.`);
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        // Você pode adicionar métodos para forçar migrações específicas para depuração,
        // mas o Dexie.js geralmente gerencia isso automaticamente ao abrir o DB.
    };
})();