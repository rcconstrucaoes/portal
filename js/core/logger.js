/**
 * RC Construções - Logger System (Revisado e Aprimorado)
 * Módulo central para o gerenciamento de logs no aplicativo.
 * Suporta múltiplos níveis de log (INFO, WARN, ERROR, DEBUG, SUCCESS)
 * e diferentes saídas (console, IndexedDB, etc.).
 * Aprimorado para robustez, configuração dinâmica e tratamento de erros de saída.
 */

(function() {
    'use strict';

    // Níveis de Log padronizados (do mais baixo ao mais alto)
    const LOG_LEVELS = {
        DEBUG: 0,
        INFO: 1,
        SUCCESS: 2, // Nível adicional para logs de sucesso
        WARN: 3,
        ERROR: 4
    };

    // Estilos de console para diferentes níveis de log
    const LOG_STYLES = {
        DEBUG: 'color: #7f8c8d; font-style: italic;',
        INFO: 'color: #1a73e8; font-weight: bold;',
        SUCCESS: 'color: #0c9d58; font-weight: bold;',
        WARN: 'color: #f7b42c; font-weight: bold;',
        ERROR: 'color: #dc3545; font-weight: bold;'
    };

    // Variáveis que serão preenchidas após a inicialização
    let databaseInstance = null;
    let settingsManager = null;
    let performanceMonitor = null; // Para logs relacionados a performance
    let isInitialized = false;

    // Configurações padrão do logger
    const DEFAULT_LOGGER_CONFIG = {
        minLogLevel: LOG_LEVELS.DEBUG, // Nível mínimo de log a ser exibido/salvo
        outputs: ['console', 'indexeddb'], // Saídas de log ativas
        contextFilters: [], // Array de strings de contextos para filtrar (ex: ['AuthManager'])
        logRetentionDays: 7, // Quantos dias de logs reter no IndexedDB
        bufferSize: 100 // Número máximo de logs para manter em buffer antes de tentar salvar
    };
    let currentConfig = { ...DEFAULT_LOGGER_CONFIG };
    let logBuffer = []; // Buffer temporário para logs antes de serem processados

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
     * Classe para um logger de contexto específico (ex: SystemLogger.getAppLogger('AuthManager')).
     */
    class AppLogger {
        constructor(context) {
            this.context = context;
        }

        log(level, message, data = null, style = '') {
            SystemLogger.log(level, this.context, message, data, style);
        }

        debug(message, data = null) {
            this.log(LOG_LEVELS.DEBUG, message, data, LOG_STYLES.DEBUG);
        }

        info(message, data = null) {
            this.log(LOG_LEVELS.INFO, message, data, LOG_STYLES.INFO);
        }

        success(message, data = null) {
            this.log(LOG_LEVELS.SUCCESS, message, data, LOG_STYLES.SUCCESS);
        }

        warn(message, data = null) {
            this.log(LOG_LEVELS.WARN, message, data, LOG_STYLES.WARN);
        }

        error(message, data = null) {
            this.log(LOG_LEVELS.ERROR, message, data, LOG_STYLES.ERROR);
        }
    }

    /**
     * Módulo principal SystemLogger.
     */
    const SystemLogger = (() => {

        /**
         * Inicializa o SystemLogger e carrega configurações.
         * @param {boolean} debugMode - Se o modo de depuração está ativo.
         * @param {boolean} loadSettings - Se deve carregar configurações salvas.
         */
        async function init(debugMode = false, loadSettings = true) {
            if (isInitialized) {
                console.warn('SystemLogger já está inicializado. Ignorando.');
                return;
            }
            console.log('SystemLogger inicializando...'); // Log básico antes do logger completo

            try {
                // Aguarda dependências, mas com timeout para não bloquear o logger
                try {
                    databaseInstance = await Promise.race([
                        waitForGlobal('Database').then(db => db.getInstance()),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 2000))
                    ]);
                } catch (e) {
                    console.warn(`[Logger] Database não disponível para logs persistentes: ${e.message}`);
                    currentConfig.outputs = currentConfig.outputs.filter(output => output !== 'indexeddb');
                }

                try {
                    settingsManager = await Promise.race([
                        waitForGlobal('SettingsManager'),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('SettingsManager timeout')), 1000))
                    ]);
                    if (loadSettings && settingsManager) {
                        const savedConfig = await settingsManager.getSetting('loggerConfig');
                        if (savedConfig) {
                            currentConfig = { ...currentConfig, ...savedConfig };
                            console.info('Logger: Configurações carregadas do SettingsManager.', currentConfig);
                        }
                    }
                } catch (e) {
                    console.warn(`[Logger] SettingsManager não disponível para configurações: ${e.message}`);
                }

                try {
                    performanceMonitor = await Promise.race([
                        waitForGlobal('PerformanceMonitor'),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('PerformanceMonitor timeout')), 1000))
                    ]);
                } catch (e) {
                    console.warn(`[Logger] PerformanceMonitor não disponível para Web Vitals: ${e.message}`);
                }


                currentConfig.minLogLevel = debugMode ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
                
                // Processa logs do buffer que foram gerados antes da inicialização completa
                if (logBuffer.length > 0) {
                    console.info(`[Logger] Processando ${logBuffer.length} logs em buffer.`);
                    logBuffer.forEach(logEntry => processLogEntry(logEntry, true)); // Processa, mas não adiciona ao buffer novamente
                    logBuffer = []; // Limpa o buffer após o processamento
                }

                if (currentConfig.outputs.includes('indexeddb')) {
                    // Limpar logs antigos no IndexedDB
                    cleanOldLogs();
                }

                isInitialized = true;
                console.log('📊 AppLogger - Status');
                console.log(`Contexto: Global`);
                console.log(`Nível de Log: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentConfig.minLogLevel)}`);
                console.log(`Outputs Ativos: ${currentConfig.outputs.join(', ')}`);
                console.log(`Filtros Ativos: ${currentConfig.contextFilters.length}`);
                console.log(`Logs em Buffer: ${logBuffer.length}`); // Será 0 se processado
                console.log('Relatório:', getLogReport()); // Exibe o relatório de log inicial
            } catch (error) {
                console.error('Erro ao inicializar SystemLogger:', error);
            }
        }

        /**
         * Registra um log no sistema.
         * @param {string} level - Nível do log (DEBUG, INFO, WARN, ERROR, SUCCESS).
         * @param {string} context - Contexto do log (e.g., 'AuthManager', 'Database').
         * @param {string} message - Mensagem do log.
         * @param {any} [data=null] - Dados adicionais para o log.
         * @param {string} [style=''] - Estilo CSS para o console (uso interno).
         */
        function log(level, context, message, data = null, style = '') {
            const levelValue = typeof level === 'string' ? LOG_LEVELS[level.toUpperCase()] : level;

            // Filtro por nível e contexto
            if (levelValue < currentConfig.minLogLevel ||
                (currentConfig.contextFilters.length > 0 && !currentConfig.contextFilters.includes(context))) {
                return;
            }

            const timestamp = new Date();
            const logEntry = {
                timestamp: timestamp.toISOString(),
                level: Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === levelValue) || 'UNKNOWN',
                context: context,
                message: message,
                data: data ? JSON.stringify(data) : null, // Stringify para IndexedDB/localStorage
                style: style // Apenas para console
            };

            if (!isInitialized) {
                logBuffer.push(logEntry);
                if (logBuffer.length > currentConfig.bufferSize) {
                    logBuffer.shift(); // Remove o log mais antigo se o buffer estiver cheio
                }
                // Ainda loga no console para ver logs antes da inicialização completa
                sendToConsole(logEntry);
            } else {
                processLogEntry(logEntry);
            }
        }

        /**
         * Processa uma entrada de log, enviando para as saídas configuradas.
         * @param {object} logEntry - O objeto de log.
         * @param {boolean} fromBuffer - Indica se o log vem do buffer inicial.
         */
        async function processLogEntry(logEntry, fromBuffer = false) {
            if (currentConfig.outputs.includes('console')) {
                sendToConsole(logEntry);
            }
            if (currentConfig.outputs.includes('indexeddb') && databaseInstance && !databaseInstance.isFallback()) {
                await sendToIndexedDB(logEntry);
            }
            // Outras saídas futuras (ex: servidor, arquivo)
            // if (currentConfig.outputs.includes('server')) {
            //     sendToServer(logEntry);
            // }
            // if (currentConfig.outputs.includes('file')) {
            //     sendToFile(logEntry);
            // }
        }

        /**
         * Envia um log para o console do navegador.
         * @param {object} logEntry - O objeto de log.
         */
        function sendToConsole(logEntry) {
            const levelMethod = logEntry.level.toLowerCase();
            const consoleMethod = console[levelMethod] || console.log; // Usa console.log como fallback
            
            try {
                const prefix = `%c${logEntry.timestamp.substring(11, 19)} [${logEntry.context}]`;
                const message = logEntry.message;
                const style = logEntry.style || LOG_STYLES[logEntry.level.toUpperCase()] || '';

                if (logEntry.data) {
                    try {
                        const parsedData = JSON.parse(logEntry.data);
                        consoleMethod(prefix, style, message, parsedData);
                    } catch (e) {
                        consoleMethod(prefix, style, message, logEntry.data); // Se o JSON for inválido, loga como string
                    }
                } else {
                    consoleMethod(prefix, style, message);
                }
            } catch (e) {
                console.error(`Erro ao logar no console: ${e.message}`, logEntry);
            }
        }

        /**
         * Envia um log para o IndexedDB.
         * @param {object} logEntry - O objeto de log.
         */
        async function sendToIndexedDB(logEntry) {
            if (!databaseInstance || databaseInstance.isFallback()) {
                console.warn('Logger: IndexedDB não disponível ou em modo fallback. Não foi possível salvar o log.', logEntry);
                return;
            }
            try {
                // Assegura que a tabela 'logs' existe no seu schema do IndexedDB (Database.js)
                // Se não existir, adicione-a no schema das versões.
                await databaseInstance.table('logs').add({
                    timestamp: logEntry.timestamp,
                    level: logEntry.level,
                    context: logEntry.context,
                    message: logEntry.message,
                    data: logEntry.data
                });
            } catch (e) {
                // Evita loops infinitos de erro se o IndexedDB estiver realmente falhando
                console.error('Erro ao salvar log no IndexedDB:', e);
            }
        }

        /**
         * Limpa logs antigos do IndexedDB.
         */
        async function cleanOldLogs() {
            if (!databaseInstance || databaseInstance.isFallback()) return;

            const cutoff = new Date(Date.now() - currentConfig.logRetentionDays * 24 * 60 * 60 * 1000).toISOString();
            try {
                const oldLogs = await databaseInstance.table('logs').where('timestamp').below(cutoff).toArray();
                if (oldLogs.length > 0) {
                    await databaseInstance.table('logs').bulkDelete(oldLogs.map(log => log.id)); // Assumindo que logs têm 'id'
                    logger.info(`Limpeza de logs: ${oldLogs.length} logs antigos removidos do IndexedDB.`);
                }
            } catch (e) {
                logger.error('Erro ao limpar logs antigos do IndexedDB:', e);
            }
        }

        /**
         * Retorna um logger de contexto específico.
         * @param {string} context - O contexto do logger (ex: 'AuthManager').
         * @returns {AppLogger}
         */
        function getAppLogger(context) {
            return new AppLogger(context);
        }

        /**
         * Obtém um relatório básico de logs (útil para depuração).
         * @returns {Object} Relatório de status do logger.
         */
        function getLogReport() {
            const report = {
                totalLogsInBuffer: logBuffer.length,
                config: currentConfig,
                outputsStatus: {},
                lastLogEntries: logBuffer.slice(-5) // Últimos 5 logs em buffer
            };

            // Status das saídas
            report.outputs.console = true; // Console sempre ativo se não houver erro
            report.outputs.indexeddb = databaseInstance && !databaseInstance.isFallback();
            // Adicione outras saídas aqui

            return report;
        }

        /**
         * Atualiza as configurações do logger em tempo de execução.
         * @param {object} newConfig - Novas configurações a serem aplicadas.
         * @returns {Promise<void>}
         */
        async function updateConfig(newConfig) {
            currentConfig = { ...currentConfig, ...newConfig };
            if (settingsManager) {
                await settingsManager.setSetting('loggerConfig', currentConfig);
                logger.info('Configurações do Logger atualizadas e salvas.', currentConfig);
            } else {
                console.warn('Logger: SettingsManager não disponível para salvar novas configurações.');
            }
            if (currentConfig.outputs.includes('indexeddb') && databaseInstance && !databaseInstance.isFallback()) {
                 cleanOldLogs(); // Limpa logs com base na nova retenção
            }
        }

        return {
            init: init,
            log: log,
            getAppLogger: getAppLogger,
            getLogReport: getLogReport,
            updateConfig: updateConfig
        };
    })();

    // Expõe o SystemLogger globalmente
    window.SystemLogger = SystemLogger;
})();
