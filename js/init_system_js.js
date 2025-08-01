/**
 * RC Construções - Sistema de Inicialização (Revisado e Aprimorado)
 * Gerencia o carregamento de scripts, registro e inicialização de módulos core e opcionais.
 * Aprimorado para ser mais robusto, com melhor tratamento de erros, logs detalhados e gestão de dependências.
 * Resolvido problemas de redeclaração e temporização.
 */

(function() {
    'use strict';

    // =========================================================
    // Configurações e Utilitários Iniciais (antes de qualquer log)
    // =========================================================
    const startTime = performance.now();
    // Configuração central do sistema, pode ser carregada via JSON ou exposta por SettingsManager
    const appConfig = {
        version: '5.6.1-Aprimorado',
        debugMode: true, // true em desenvolvimento, false em produção
        maxScriptRetries: 3,
        coreModuleValidation: true,
        scriptBaseUrl: '/', // Base para carregar scripts (ajustado para o diretório raiz)
        // Definição dos módulos core e opcionais com seus caminhos e nomes globais esperados
        modules: {
            core: [
                { id: 'logger_app', path: 'js/core/logger.js', globalName: 'SystemLogger', isModule: false }, // Alterado para isModule: false
                { id: 'settings', path: 'js/core/settings.js', globalName: 'SettingsManager' },
                { id: 'database', path: 'js/core/database.js', globalName: 'Database' },
                { id: 'security', path: 'js/core/security.js', globalName: 'SecurityManager' },
                { id: 'validation', path: 'js/core/validation.js', globalName: 'ValidationManager' },
                { id: 'utils', path: 'js/core/utils.js', globalName: 'UtilsManager' },
                { id: 'auth', path: 'js/core/auth.js', globalName: 'AuthManager' },
                { id: 'data_versioning', path: 'js/core/data-versioning.js', globalName: 'DataVersioning' },
                { id: 'performance_monitor_core', path: 'js/core/performance-monitor.js', globalName: 'PerformanceMonitor', isModule: true }
            ],
            optional: [
                // Bibliotecas de terceiros (certifique-se de que os globalNames estão corretos)
                { id: 'dexie', path: 'lib/dexie.min.js', globalName: 'Dexie' },
                { id: 'bcrypt', path: 'lib/bcrypt.min.js', globalName: 'dcodeIO.bcrypt' }, // Ou 'bcrypt', dependendo do build
                { id: 'jspdf', path: 'lib/jspdf.umd.min.js', globalName: 'jspdf.js' }, // Ou 'window.jspdf.js'
                { id: 'papaparse', path: 'lib/papaparse.min.js', globalName: 'Papa' },
                { id: 'chartjs', path: 'lib/chart.js', globalName: 'Chart' },
                { id: 'sweetalert2', path: 'https://cdn.jsdelivr.net/npm/sweetalert2@11', globalName: 'Swal' },
                { id: 'web_vitals', path: 'lib/web-vitals.min.js', globalName: 'webVitals' }, // Se web-vitals expõe um objeto global

                // Módulos de aplicação
                { id: 'modern_app', path: 'js/modern_app_js.js', globalName: 'ModernAppManager' },
                { id: 'dashboard_enhancements', path: 'js/dashboard-enhancements.js', globalName: 'dashboardEnhancements' },
                { id: 'cloud_sync', path: 'js/core/cloud-sync.js', globalName: 'CloudSync' },
                { id: 'conflict_resolver', path: 'js/utils/conflict-resolver.js', globalName: 'ConflictResolver' },
                { id: 'error_handler', path: 'js/utils/error-handler.js', globalName: 'ErrorHandler' },
                { id: 'analytics', path: 'js/utils/analytics.js', globalName: 'AnalyticsModule' },
                // Módulos de dados (certifique-se que o globalName corresponde ao retornado pelo IIFE)
                { id: 'dashboard_module', path: 'js/modules/dashboard.js', globalName: 'dashboardModule' },
                { id: 'clients_module', path: 'js/modules/clients.js', globalName: 'ClientsModule' },
                { id: 'budgets_module', path: 'js/modules/budgets.js', globalName: 'BudgetsModule' },
                { id: 'contracts_module', path: 'js/modules/contracts.js', globalName: 'ContractsModule' },
                { id: 'financial_module', path: 'js/modules/financial.js', globalName: 'FinancialModule' },
                { id: 'reports_module', path: 'js/modules/reports.js', globalName: 'ReportsModule' },
                { id: 'suppliers_module', path: 'js/modules/suppliers.js', globalName: 'SuppliersModule' },
                { id: 'pdf_module', path: 'js/modules/pdf.js', globalName: 'PDFModule' },
                { id: 'demo_module', path: 'js/modules/demo.js', globalName: 'DemoModule' },
                // Adicione outros módulos opcionais aqui
            ]
        }
    };
    // Expõe a configuração do app globalmente para que outros módulos possam acessá-la
    window.rcConfig = appConfig;

    // Variável para armazenar a instância do logger globalmente (SystemLogger completo)
    let SystemLoggerInstance;

    // =========================================================
    // Logger Básico (para uso antes do logger completo estar pronto)
    // =========================================================
    function getBasicLogger() {
        if (SystemLoggerInstance) return SystemLoggerInstance; // Retorna o logger completo se já estiver pronto

        const log = (level, context, message, style = '') => {
            if (!appConfig.debugMode && level === 'DEBUG') return;
            console[level.toLowerCase()]?.(`%c${new Date().toISOString().substring(11, 19)} [${context}] %c${message}`, `color: #1a73e8; font-weight: bold;`, style);
        };
        // Métodos de log que espelham a API completa
        return {
            info: (context, message, data = null) => log('INFO', context, message, data),
            warn: (context, message, data = null) => log('WARN', context, message, data),
            error: (context, message, data = null) => log('ERROR', context, message, data),
            debug: (context, message, data = null) => log('DEBUG', context, message, data),
            success: (context, message, data = null) => log('INFO', context, message, data), // Success como INFO para o basic logger
        };
    }
    const basicLogger = getBasicLogger();
    basicLogger.info('InitSystem', 'Logger principal inicializado.');
    basicLogger.info('InitSystem', `🚀 Iniciando o sistema de inicialização RC Construções v${appConfig.version}...`);
    // BasicLogger não deve logar o objeto config completo aqui, mas o initSystem pode
    console.log(appConfig); // Exibe a config completa, é ok para debug inicial

    if (appConfig.debugMode) {
        basicLogger.debug('InitSystem', 'Modo de depuração ativo por padrão. Desative em produção.');
    }

    // =========================================================
    // Gerenciador de Módulos
    // =========================================================
    const ModuleManager = (function() {
        const registeredModules = new Map(); // Todos os módulos registrados
        const moduleInstances = new Map(); // Módulos que foram carregados e inicializados

        basicLogger.info('ModuleManager', 'ModuleManager inicializado.');

        /**
         * Registra um módulo na lista de módulos conhecidos pelo sistema.
         * @param {string} id - ID único do módulo.
         * @param {string} path - Caminho do arquivo do módulo.
         * @param {string} globalName - Nome da variável global que o módulo expõe.
         * @param {boolean} isCore - True se for um módulo core (obrigatório).
         * @param {boolean} isModule - True se for um módulo ES6 (import dinâmico).
         */
        function registerModule(id, path, globalName, isCore = false, isModule = false) {
            registeredModules.set(id, { id, path, globalName, isCore, isModule, status: 'registered', instance: null });
            basicLogger.debug('ModuleManager', `Módulo '${id}' registrado.`);
        }

        /**
         * Carrega e inicializa um único módulo.
         * Tenta obter a instância global primeiro para evitar recarregamento.
         * @param {Object} moduleConfig - Configurações do módulo (id, path, globalName, isModule).
         * @returns {Promise<any>} A instância inicializada do módulo.
         */
        async function processModule(moduleConfig) {
            const { id, path, globalName, isCore, isModule } = moduleConfig;
            let moduleInstance = null;
            let retries = 0;
            
            while (retries <= appConfig.maxScriptRetries) {
                try {
                    // Tenta obter a instância global primeiro
                    let globalRef = window;
                    if (globalName) {
                        const parts = globalName.split('.');
                        for (const part of parts) {
                            if (globalRef && typeof globalRef === 'object' && part in globalRef) {
                                globalRef = globalRef[part];
                            } else {
                                globalRef = undefined; // Não encontrado no caminho
                                break;
                            }
                        }
                    }

                    if (globalRef && globalRef !== window && typeof globalRef !== 'undefined') {
                        // Se a instância global já existe e é válida, e não é o objeto window em si
                        basicLogger.warn('ModuleManager', `Propriedade global '${globalName}' já existe. Reutilizando instância.`, 'color: #f7b42c; font-weight: bold;');
                        moduleInstance = globalRef;
                        // Se o módulo já foi carregado e exposto, apenas o registra como tal.
                        // Não chama init novamente aqui, pois init será chamado mais tarde se necessário.
                    } else if (isModule) {
                        // Se for um módulo ES6, use import()
                        const module = await import(`${appConfig.scriptBaseUrl}${path}?v=${Date.now()}`); // Adiciona timestamp para evitar cache
                        moduleInstance = module.default || module; // Assume default export ou o módulo completo
                        basicLogger.info('ScriptLoader', `✅ Módulo carregado: ${path} (ESM)`, 'color: #0c9d58; font-weight: bold;');
                    } else {
                        // Para scripts tradicionais (IIFE ou globais), carregue via script tag
                        await ScriptLoader.loadScript(`${appConfig.scriptBaseUrl}${path}`, id); // Caminho absoluto
                        // Após carregar, tente obter a referência global novamente
                        let tempGlobalRef = window;
                        if (globalName) {
                            const parts = globalName.split('.');
                            for (const part of parts) {
                                if (tempGlobalRef && typeof tempGlobalRef === 'object' && part in tempGlobalRef) {
                                    tempGlobalRef = tempGlobalRef[part];
                                } else {
                                    tempGlobalRef = undefined;
                                    break;
                                }
                            }
                        }
                        if (tempGlobalRef && tempGlobalRef !== window && typeof tempGlobalRef !== 'undefined') {
                            moduleInstance = tempGlobalRef;
                        } else if (isCore) { // Para módulos core que deveriam expor algo mas não o fizeram
                            throw new Error(`Módulo core '${id}' (${globalName}) não encontrado/definido no escopo global após carregamento.`);
                        }
                        basicLogger.info('ScriptLoader', `✅ Script carregado: ${path}`, 'color: #0c9d58; font-weight: bold;');
                    }

                    if (moduleInstance) {
                        // Armazena a instância do módulo carregado
                        moduleInstances.set(id, moduleInstance);
                        registeredModules.get(id).status = 'loaded';
                        registeredModules.get(id).instance = moduleInstance;

                        // Se o módulo tem um método 'init', chamamos ele mais tarde em initCore/initOptional.
                        return moduleInstance;
                    } else {
                        throw new Error(`Módulo '${id}' (${globalName}) não retornou uma instância válida.`);
                    }

                } catch (error) {
                    basicLogger.error('ModuleManager', `Erro ao carregar ou processar o módulo '${id}': ${error.message}`, 'color: #dc3545; font-weight: bold;');
                    retries++;
                    if (retries <= appConfig.maxScriptRetries) {
                        basicLogger.warn('ModuleManager', `Tentando novamente o carregamento do módulo '${id}' (Tentativa ${retries}/${appConfig.maxScriptRetries})...`, 'color: #f7b42c; font-weight: bold;');
                        await new Promise(resolve => setTimeout(resolve, 500 * retries)); // Delay incremental
                    } else {
                        basicLogger.error('ModuleManager', `Falha ao carregar o módulo '${id}' após ${appConfig.maxScriptRetries} tentativas.`, 'color: #dc3545; font-weight: bold;');
                        registeredModules.get(id).status = 'failed';
                        throw error; // Propaga o erro
                    }
                }
            }
        }

        /**
         * Inicializa os módulos core na ordem definida.
         */
        async function initializeCoreModules() {
            basicLogger.info('ModuleManager', 'Iniciando sequência de inicialização dos módulos Core...');
            const coreModuleInitStart = performance.now();
            basicLogger.debug('Performance', `Marca 'coreModuleInitStart' definida em: ${coreModuleInitStart.toFixed(2)} ms`, 'color: #7f8c8d; font-style: italic;');

            for (const moduleConfig of appConfig.modules.core) {
                try {
                    basicLogger.debug('ModuleManager', `Processando e inicializando módulo core: ${moduleConfig.id}`, 'color: #7f8c8d; font-style: italic;');
                    const instance = await processModule(moduleConfig); // Garante que o módulo foi carregado/recuperado
                    
                    // Aguarda a dependência de SystemLogger para poder usar o logger completo
                    if (moduleConfig.id === 'logger_app' && instance && typeof instance.init === 'function') {
                        // Inicializa o logger completo uma vez que ele mesmo está carregado
                        await instance.init(appConfig.debugMode, true);
                        SystemLoggerInstance = instance; // Atribui ao logger global
                        basicLogger.success('ModuleManager', `Módulo '${moduleConfig.id}' inicializado com sucesso.`, 'color: #0c9d58; font-weight: bold;');
                        continue; // Pula a inicialização genérica para o logger
                    }

                    // Se a instância já existe e foi carregada por outra forma, a usa
                    if (instance && typeof instance.init === 'function') {
                        const initStartTime = performance.now();
                        basicLogger.debug('Performance', `Marca 'init_${moduleConfig.id}_start' definida em: ${initStartTime.toFixed(2)} ms`, 'color: #7f8c8d; font-style: italic;');
                        await instance.init(); // Chama o método init do módulo
                        const initEndTime = performance.now();
                        basicLogger.info('Performance', `Medida 'init_${moduleConfig.id}_time' concluída: ${(initEndTime - initStartTime).toFixed(2)} ms`, 'color: #1a73e8; font-weight: bold;');
                    }
                    
                    registeredModules.get(moduleConfig.id).status = 'initialized';
                    basicLogger.success('ModuleManager', `Módulo '${moduleConfig.id}' inicializado com sucesso.`, 'color: #0c9d58; font-weight: bold;');

                } catch (error) {
                    basicLogger.error('ModuleManager', `Falha crítica na inicialização do módulo core '${moduleConfig.id}': ${error.message}`, 'color: #dc3545; font-weight: bold;');
                    registeredModules.get(moduleConfig.id).status = 'failed';
                    // Exibe erro crítico na tela para o usuário
                    displayCriticalError(`Erro Crítico na Inicialização: Falha ao carregar script ${moduleConfig.path}: ${error.message}. Por favor, recarregue a página.`);
                    throw error; // Interrompe a inicialização
                }
            }
            const coreModuleInitEnd = performance.now();
            basicLogger.info('Performance', `Todos os módulos Core inicializados em: ${(coreModuleInitEnd - coreModuleInitStart).toFixed(2)} ms`, 'color: #1a73e8; font-weight: bold;');
        }

        /**
         * Inicializa os módulos opcionais.
         */
        async function initializeOptionalModules() {
            basicLogger.info('ModuleManager', 'Iniciando sequência de inicialização dos módulos Opcionais...');
            const optionalModuleInitStart = performance.now();
            basicLogger.debug('Performance', `Marca 'optionalModuleInitStart' definida em: ${optionalModuleInitStart.toFixed(2)} ms`, 'color: #7f8c8d; font-style: italic;');

            for (const moduleConfig of appConfig.modules.optional) {
                try {
                    basicLogger.debug('ModuleManager', `Processando e inicializando módulo opcional: ${moduleConfig.id}`, 'color: #7f8c8d; font-style: italic;');
                    const instance = await processModule(moduleConfig);
                    if (instance && typeof instance.init === 'function') {
                        const initStartTime = performance.now();
                        basicLogger.debug('Performance', `Marca 'init_${moduleConfig.id}_start' definida em: ${initStartTime.toFixed(2)} ms`, 'color: #7f8c8d; font-style: italic;');
                        await instance.init();
                        const initEndTime = performance.now();
                        basicLogger.info('Performance', `Medida 'init_${moduleConfig.id}_time' concluída: ${(initEndTime - initStartTime).toFixed(2)} ms`, 'color: #1a73e8; font-weight: bold;');
                    }
                    registeredModules.get(moduleConfig.id).status = 'initialized';
                    basicLogger.success('ModuleManager', `Módulo '${moduleConfig.id}' inicializado com sucesso.`, 'color: #0c9d58; font-weight: bold;');
                } catch (error) {
                    basicLogger.error('ModuleManager', `Erro ao inicializar módulo opcional '${moduleConfig.id}': ${error.message}`, 'color: #dc3545; font-weight: bold;');
                    registeredModules.get(moduleConfig.id).status = 'failed';
                    // Não é um erro crítico, então não interrompe a inicialização dos outros módulos
                }
            }
            const optionalModuleInitEnd = performance.now();
            basicLogger.info('Performance', `Todos os módulos Opcionais inicializados em: ${(optionalModuleInitEnd - optionalModuleInitStart).toFixed(2)} ms`, 'color: #1a73e8; font-weight: bold;');
        }

        /**
         * Retorna a instância de um módulo carregado.
         * @param {string} id - ID do módulo.
         * @returns {any} Instância do módulo ou undefined.
         */
        function getModuleInstance(id) {
            return moduleInstances.get(id);
        }

        /**
         * Retorna o status de um módulo.
         * @param {string} id - ID do módulo.
         * @returns {string} Status do módulo ('registered', 'loaded', 'initialized', 'failed').
         */
        function getModuleStatus(id) {
            return registeredModules.has(id) ? registeredModules.get(id).status : 'not_found';
        }

        /**
         * Retorna todos os módulos registrados.
         * @returns {Map<string, Object>} Mapa de módulos registrados.
         */
        function getAllRegisteredModules() {
            return new Map(registeredModules); // Retorna uma cópia para evitar modificações externas
        }

        return {
            registerModule,
            processModule,
            initializeCoreModules,
            initializeOptionalModules,
            getModuleInstance,
            getModuleStatus,
            getAllRegisteredModules
        };
    })();

    // =========================================================
    // Carregador de Scripts (ScriptLoader)
    // =========================================================
    const ScriptLoader = (function() {
        const loadedScripts = new Set();

        basicLogger.info('ScriptLoader', 'ScriptLoader inicializado.');

        /**
         * Carrega um script dinamicamente.
         * @param {string} url - URL do script.
         * @param {string} id - ID para o script (para evitar carregamentos duplicados).
         * @returns {Promise<void>}
         */
        function loadScript(url, id) {
            return new Promise((resolve, reject) => {
                if (loadedScripts.has(id)) {
                    basicLogger.warn('ScriptLoader', `Script '${id}' (${url}) já carregado. Ignorando.`);
                    return resolve();
                }

                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.defer = true; // Adicionado defer para garantir ordem de execução após o HTML
                script.id = `script-${id}`;

                script.onload = () => {
                    loadedScripts.add(id);
                    basicLogger.debug('ScriptLoader', `Script '${id}' (${url}) carregado com sucesso.`);
                    resolve();
                };

                script.onerror = () => {
                    basicLogger.error('ScriptLoader', `Falha ao carregar script '${id}' (${url}).`);
                    reject(new Error(`Falha ao carregar script: ${url}`));
                };

                document.head.appendChild(script);
            });
        }

        return {
            loadScript
        };
    })();

    // =========================================================
    // Funções Globais de Inicialização
    // =========================================================

    /**
     * Exibe uma mensagem de erro crítica na tela.
     * @param {string} message - Mensagem de erro a ser exibida.
     */
    function displayCriticalError(message) {
        const errorDisplay = document.getElementById('system-critical-error-display');
        if (errorDisplay) {
            errorDisplay.style.display = 'block';
            errorDisplay.style.backgroundColor = '#dc3545';
            errorDisplay.style.color = 'white';
            errorDisplay.style.padding = '15px';
            errorDisplay.style.textAlign = 'center';
            errorDisplay.style.position = 'fixed';
            errorDisplay.style.top = '0';
            errorDisplay.style.left = '0';
            errorDisplay.style.width = '100%';
            errorDisplay.style.zIndex = '9999';
            errorDisplay.textContent = message;
        } else {
            console.error('Erro Crítico: ' + message);
            alert('Erro Crítico: ' + message + '\nPor favor, verifique o console para mais detalhes.');
        }
    }

    /**
     * Inicia o processo de inicialização do aplicativo.
     */
    async function startApplication() {
        try {
            // Primeiro, registra todos os módulos
            appConfig.modules.core.forEach(m => ModuleManager.registerModule(m.id, m.path, m.globalName, true, m.isModule));
            appConfig.modules.optional.forEach(m => ModuleManager.registerModule(m.id, m.path, m.globalName, false, m.isModule));

            // Inicializa módulos core (incluindo o logger completo)
            await ModuleManager.initializeCoreModules();

            // Agora que o SystemLogger está inicializado, podemos usá-lo
            const appLogger = SystemLoggerInstance.getAppLogger('Application');
            appLogger.info('Application', 'Módulos Core inicializados. Iniciando módulos Opcionais...');

            // Inicializa módulos opcionais
            await ModuleManager.initializeOptionalModules();

            appLogger.info('Application', 'Todos os módulos carregados e inicializados. Aplicação pronta!');
            const totalTime = performance.now() - startTime;
            appLogger.info('Performance', `Tempo total de inicialização: ${totalTime.toFixed(2)} ms`, 'color: #1a73e8; font-weight: bold;');

            // Exemplo de uso do ModernAppManager (se carregado)
            const ModernAppManager = ModuleManager.getModuleInstance('modern_app');
            if (ModernAppManager && typeof ModernAppManager.init === 'function') {
                appLogger.info('Application', 'ModernAppManager detectado. Inicializando roteamento...');
                ModernAppManager.init(); // Inicializa o roteador
            } else {
                appLogger.warn('Application', 'ModernAppManager não encontrado ou não inicializado. O roteamento de SPA pode não funcionar.');
            }

            // Exemplo de uso do SettingsManager (se carregado)
            const SettingsManager = ModuleManager.getModuleInstance('settings');
            if (SettingsManager && typeof SettingsManager.getSetting === 'function') {
                appLogger.info('Application', `Tema atual: ${SettingsManager.getSetting('theme')}`);
            }

            // Adiciona Service Worker
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js')
                        .then(registration => {
                            appLogger.success('ServiceWorker', 'Service Worker registrado com sucesso:', registration.scope);
                        })
                        .catch(error => {
                            appLogger.error('ServiceWorker', 'Falha no registro do Service Worker:', error);
                        });
                });
            }

        } catch (error) {
            console.error('Erro fatal na inicialização da aplicação:', error);
            displayCriticalError(`Erro fatal na inicialização da aplicação: ${error.message}. Consulte o console para detalhes.`);
        }
    }

    // Inicia a aplicação quando o DOM estiver completamente carregado
    document.addEventListener('DOMContentLoaded', startApplication);

    // Expõe o ModuleManager globalmente para debug ou acesso externo se necessário
    window.ModuleManager = ModuleManager;

})();


