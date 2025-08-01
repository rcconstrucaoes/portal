/**
 * RC Construções - Módulo de Importação e Exportação de Dados (Revisado e Aprimorado)
 * Permite importar dados de arquivos (CSV, JSON) para o banco de dados local
 * e exportar dados do banco de dados para arquivos (CSV, JSON).
 * Aprimorado para ser robusto, com tratamento de erros, e integração com módulos core.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let utilsManager; // Para download de CSV (PapaParse) e outras utilities
    let eventHandler;
    // Módulos de dados que podem ser importados/exportados (opcional, se precisarem de métodos específicos)
    let clientsModule;
    let budgetsModule;
    let contractsModule;
    let financialModule;
    let usersModule; // Se houver um módulo de usuários para importar/exportar

    const IMPORT_EXPORT_CONFIG = {
        supportedImportTypes: {
            'text/csv': 'csv',
            'application/json': 'json'
        },
        supportedExportTypes: ['csv', 'json'],
        // Mapeamento de tabelas para seus respectivos módulos (para adicionar dados)
        tableModules: {
            clients: null, // Será preenchido com clientsModule
            budgets: null,
            contracts: null,
            financial: null,
            users: null // Assumindo que users também é um módulo importável/exportável
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
     * Inicializa o Módulo de Importação e Exportação.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ImportExportModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            utilsManager = await waitForGlobal('UtilsManager');
            eventHandler = await waitForGlobal('SystemEventHandler');

            // Preenche a configuração com referências aos módulos de dados
            IMPORT_EXPORT_CONFIG.tableModules.clients = await waitForGlobal('ClientsModule').catch(() => null);
            IMPORT_EXPORT_CONFIG.tableModules.budgets = await waitForGlobal('BudgetsModule').catch(() => null);
            IMPORT_EXPORT_CONFIG.tableModules.contracts = await waitForGlobal('ContractsModule').catch(() => null);
            IMPORT_EXPORT_CONFIG.tableModules.financial = await waitForGlobal('FinancialModule').catch(() => null);
            IMPORT_EXPORT_CONFIG.tableModules.users = await waitForGlobal('AuthManager').catch(() => null); // Pode usar AuthManager para users

            logger.info('📥📤 Módulo de Importação/Exportação inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar ImportExportModule:', error);
            (logger || console).error('Falha na inicialização do ImportExportModule. Funcionalidades de import/export podem não estar disponíveis.');
        }
    }

    // --- FUNÇÕES DE IMPORTAÇÃO ---

    /**
     * Importa dados de um arquivo para uma tabela específica do banco de dados.
     * @param {File} file - O objeto File a ser importado.
     * @param {string} tableName - O nome da tabela de destino.
     * @returns {Promise<Object>} Resultado da importação { success: boolean, importedCount: number, errors: Array }.
     */
    async function importDataFromFile(file, tableName) {
        logger.info(`Iniciando importação do arquivo '${file.name}' para a tabela '${tableName}'.`);
        let importedCount = 0;
        const errors = [];

        if (!databaseInstance || databaseInstance.isFallback()) {
            errors.push('Banco de dados não disponível ou em modo fallback. Importação cancelada.');
            logger.error('Importação falhou: DB não disponível.');
            eventHandler.emit('import:error', { tableName, error: errors[0] });
            return { success: false, importedCount: 0, errors };
        }

        const fileType = file.type;
        const parserType = IMPORT_EXPORT_CONFIG.supportedImportTypes[fileType];

        if (!parserType) {
            errors.push(`Tipo de arquivo '${fileType}' não suportado para importação.`);
            logger.warn('Importação falhou: Tipo de arquivo não suportado.');
            eventHandler.emit('import:error', { tableName, error: errors[0] });
            return { success: false, importedCount: 0, errors };
        }

        try {
            const rawData = await readFileContent(file);
            let parsedData;

            if (parserType === 'csv') {
                const Papa = await waitForGlobal('Papa');
                if (!Papa || typeof Papa.parse !== 'function') {
                    throw new Error("Biblioteca PapaParse não carregada para CSV.");
                }
                const parseResult = Papa.parse(rawData, {
                    header: true, // Assume que a primeira linha é o cabeçalho
                    skipEmptyLines: true,
                    dynamicTyping: true // Tenta converter valores para tipos corretos (números, booleanos)
                });
                if (parseResult.errors.length > 0) {
                    throw new Error(`Erros de parseamento CSV: ${JSON.stringify(parseResult.errors)}`);
                }
                parsedData = parseResult.data;
            } else if (parserType === 'json') {
                parsedData = JSON.parse(rawData);
            }

            if (!Array.isArray(parsedData) || parsedData.length === 0) {
                throw new Error('Nenhum dado válido encontrado para importar ou formato de dados inválido.');
            }
            
            // Tenta obter o módulo de dados apropriado para a tabela
            const targetModule = IMPORT_EXPORT_CONFIG.tableModules[tableName];
            if (!targetModule || typeof targetModule.add !== 'function') {
                 logger.warn(`Módulo '${tableName}' não encontrado ou não tem método 'add'.`);
                 errors.push(`Módulo de destino '${tableName}' não pode adicionar dados.`);
                 return { success: false, importedCount: 0, errors };
            }

            // Importar os dados para o banco de dados local
            for (const record of parsedData) {
                // Adicione validação específica para cada tipo de registro se necessário
                // Ou o método 'add' do módulo já fará a validação
                // Remove ID para que o banco de dados gere um novo, a menos que você queira usar IDs de importação
                const recordToSave = { ...record };
                delete recordToSave.id; 
                delete recordToSave.syncStatus; // Remover status de sync de dados importados

                // Usar o método 'add' do módulo específico para validação e lógica de negócio
                const addedRecord = await targetModule.add(recordToSave);
                if (addedRecord) {
                    importedCount++;
                } else {
                    errors.push(`Falha ao importar registro: ${JSON.stringify(recordToSave)}`);
                }
            }

            if (importedCount > 0) {
                logger.success(`Importação concluída: ${importedCount} registros importados com sucesso para '${tableName}'.`);
                eventHandler.emit('import:success', { tableName, importedCount, totalRecords: parsedData.length });
                return { success: true, importedCount, errors };
            } else {
                errors.push('Nenhum registro foi importado.');
                logger.warn('Importação concluída, mas nenhum registro importado.');
                eventHandler.emit('import:completeWithWarnings', { tableName, importedCount, totalRecords: parsedData.length, errors });
                return { success: false, importedCount, errors };
            }

        } catch (error) {
            logger.error(`Erro durante o processo de importação para '${tableName}': ${error.message}`, error);
            errors.push(`Erro fatal na importação: ${error.message}`);
            eventHandler.emit('import:error', { tableName, error: errors[0] });
            return { success: false, importedCount, errors };
        }
    }

    /**
     * Lê o conteúdo de um arquivo.
     * @param {File} file - O objeto File.
     * @returns {Promise<string>} O conteúdo do arquivo como string.
     */
    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (event) => reject(new Error(`Erro ao ler o arquivo: ${event.target.error}`));
            reader.readAsText(file);
        });
    }

    // --- FUNÇÕES DE EXPORTAÇÃO ---

    /**
     * Exporta dados de uma tabela específica para um arquivo.
     * @param {string} tableName - O nome da tabela a ser exportada.
     * @param {string} format - O formato de exportação ('csv' ou 'json').
     * @returns {Promise<boolean>} True se a exportação foi bem-sucedida.
     */
    async function exportDataToFile(tableName, format) {
        logger.info(`Iniciando exportação da tabela '${tableName}' no formato '${format}'.`);

        if (!databaseInstance || databaseInstance.isFallback()) {
            logger.error('Exportação falhou: Banco de dados não disponível ou em modo fallback.');
            eventHandler.emit('export:error', { tableName, error: 'DB não disponível.' });
            return false;
        }
        if (!IMPORT_EXPORT_CONFIG.supportedExportTypes.includes(format)) {
            logger.warn(`Formato de exportação '${format}' não suportado.`);
            eventHandler.emit('export:error', { tableName, error: `Formato '${format}' não suportado.` });
            return false;
        }

        try {
            const data = await databaseInstance.table(tableName).toArray();
            if (data.length === 0) {
                logger.warn(`Tabela '${tableName}' está vazia. Nada para exportar.`);
                eventHandler.emit('export:completeWithWarnings', { tableName, message: 'Tabela vazia.' });
                return false;
            }

            const filename = `${tableName}_export_${utilsManager.formatDate(Date.now(), 'YYYYMMDD_HHmmss')}.${format}`;

            if (format === 'csv') {
                await utilsManager.downloadCSV(data, filename); // Usa o utilitário de download CSV
            } else if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            logger.success(`Dados da tabela '${tableName}' exportados com sucesso para '${filename}'.`);
            eventHandler.emit('export:success', { tableName, format, filename });
            return true;
        } catch (error) {
            logger.error(`Erro ao exportar dados da tabela '${tableName}': ${error.message}`, error);
            eventHandler.emit('export:error', { tableName, format, error: error.message });
            return false;
        }
    }

    /**
     * Exporta o banco de dados inteiro para um arquivo JSON, incluindo todas as tabelas.
     * @param {string} filename - O nome do arquivo a ser salvo (ex: 'rc_database_backup.json').
     * @returns {Promise<boolean>} True se o backup foi bem-sucedido.
     */
    async function exportFullDatabase(filename = 'rc_database_backup.json') {
        logger.info('Iniciando exportação completa do banco de dados para JSON.');
        if (!databaseInstance || databaseInstance.isFallback()) {
            logger.error('Backup de banco de dados falhou: DB não disponível ou em modo fallback.');
            eventHandler.emit('export:error', { tableName: 'all', error: 'DB não disponível.' });
            return false;
        }

        try {
            const fullData = {};
            const tableNames = Object.keys(databaseInstance.schemas[databaseInstance.verno]); // Obtém nomes das tabelas do schema atual
            
            for (const tableName of tableNames) {
                try {
                    fullData[tableName] = await databaseInstance.table(tableName).toArray();
                } catch (e) {
                    logger.warn(`Não foi possível exportar a tabela '${tableName}': ${e.message}. Continuando...`);
                    fullData[tableName] = []; // Adiciona uma array vazia se não puder exportar a tabela
                }
            }

            const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            logger.success(`Backup completo do banco de dados exportado com sucesso para '${filename}'.`);
            eventHandler.emit('export:fullDatabaseSuccess', { filename });
            return true;
        } catch (error) {
            logger.error(`Erro ao exportar banco de dados completo: ${error.message}`, error);
            eventHandler.emit('export:error', { tableName: 'all', error: error.message });
            return false;
        }
    }


    // Expõe a API pública do módulo
    return {
        init: init,
        importData: importDataFromFile, // Para importar para uma tabela específica
        exportData: exportDataToFile,   // Para exportar uma tabela específica
        exportFullDatabase: exportFullDatabase, // Para backup completo do DB
        config: IMPORT_EXPORT_CONFIG
    };
})();