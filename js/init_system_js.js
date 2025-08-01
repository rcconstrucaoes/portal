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
        scriptBaseUrl: './', // Base para carregar scripts (ajustado para o diretório raiz)
        // Definição dos módulos core e opcionais com seus caminhos e nomes globais esperados
        modules: {
            core: [
                { id: 'settings', path: 'js/core/settings.js', globalName: 'SettingsManager' },
                { id: 'database', path: 'js/core/database.js', globalName: 'Database' },
                { id: 'security', path: 'js/core/security.js', globalName: 'SecurityManager' },
                { id: 'validation', path: 'js/core/validation.js', globalName: 'ValidationManager' },
                { id: 'utils', path: 'js/core/utils.js', globalName: 'UtilsManager' },
                { id: 'auth', path: 'js/core/auth.js', globalName: 'AuthManager' },
                { id: 'data_versioning', path: 'js/core/data-versioning.js', globalName: 'DataVersioning' },
                // Adicione SystemLogger e PerformanceMonitor como core, mas com isModule: true
                { id: 'logger_app', path: 'js/core/logger.js', globalName: 'SystemLogger', isModule: true },
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
            info: (context, message, style = '') => log('INFO', context, message, style),
            warn: (context, message, style = '') => log('WARN', context, message, style),
            error: (context, message, style = '') => log('ERROR', context, message, style),
            debug: (context, message, style = '') => log('DEBUG', context, message, style),
            success: (context, message, style = '') => log('INFO', context, message, style), // Success como INFO para o basic logger
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
                        await ScriptLoader.loadScript(path, id);
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
                    throw error; // Interrompe o sistema
                }
            }
            const coreModuleInitEnd = performance.now();
            basicLogger.debug('Performance', `Marca 'coreModuleInitEnd' definida em: ${coreModuleInitEnd.toFixed(2)} ms`, 'color: #7f8c8d; font-style: italic;');
            basicLogger.info('Performance', `Medida 'coreModuleInitTime' concluída: ${(coreModuleInitEnd - coreModuleInitStart).toFixed(2)} ms`, 'color: #1a73e8; font-weight: bold;');
            basicLogger.success('ModuleManager', '✅ Todos os módulos Core foram inicializados com sucesso.');
        }

        /**
         * Inicializa os módulos opcionais em paralelo.
         */
        async function initializeOptionalModules() {
            basicLogger.info('ScriptLoader', 'Carregando scripts opcionais em paralelo...');
            const loadPromises = appConfig.modules.optional.map(moduleConfig => processModule(moduleConfig).then(instance => {
                // Se o módulo opcional tem um init, chame-o aqui, pois eles podem ter dependências de core
                if (instance && typeof instance.init === 'function' && registeredModules.get(moduleConfig.id).status !== 'initialized') {
                    basicLogger.debug('ModuleManager', `Inicializando módulo opcional: ${moduleConfig.id}`);
                    return instance.init().then(() => {
                        registeredModules.get(moduleConfig.id).status = 'initialized';
                        basicLogger.success('ModuleManager', `Módulo opcional '${moduleConfig.id}' inicializado.`, 'color: #0c9d58; font-weight: bold;');
                        return instance;
                    }).catch(e => {
                        basicLogger.error('ModuleManager', `Erro ao inicializar módulo opcional '${moduleConfig.id}': ${e.message}`, 'color: #dc3545; font-weight: bold;');
                        return null; // Retorna null para não parar o Promise.all
                    });
                }
                return instance;
            }).catch(e => {
                basicLogger.warn('ModuleManager', `Módulo opcional '${moduleConfig.id}' não pode ser carregado/inicializado: ${e.message}.`, 'color: #f7b42c; font-weight: bold;');
                return null; // Retorna null para não parar o Promise.all
            }));
            await Promise.all(loadPromises);
            basicLogger.success('ScriptLoader', 'Todos os scripts opcionais foram processados (carregados ou ignorados).', 'color: #0c9d58; font-weight: bold;');
        }

        // Registra todos os módulos no início
        appConfig.modules.core.forEach(m => registerModule(m.id, m.path, m.globalName, true, m.isModule));
        appConfig.modules.optional.forEach(m => registerModule(m.id, m.path, m.globalName, false, m.isModule));

        return {
            initCore: initializeCoreModules,
            initOptional: initializeOptionalModules,
            getModule: (id) => moduleInstances.get(id) || registeredModules.get(id)?.instance, // Tenta obter instância carregada ou registrada
            getAllModules: () => registeredModules,
        };
    })();

    // =========================================================
    // Gerenciador de Scripts (simples e robusto)
    // =========================================================
    const ScriptLoader = (function() {
        const loadedScripts = new Set();
        basicLogger.info('ScriptLoader', 'ScriptLoader inicializado.');

        /**
         * Carrega um script dinamicamente e retorna uma Promessa que resolve quando o script é carregado.
         * Adiciona um timestamp para evitar cache durante o desenvolvimento.
         * @param {string} src - O caminho do script relativo a `appConfig.scriptBaseUrl`.
         * @param {string} id - Um ID único para o script (útil para depuração e para evitar duplicação).
         * @returns {Promise<void>} Uma Promessa que resolve quando o script é carregado ou rejeita se houver erro.
         */
        function loadScript(src, id) {
            return new Promise((resolve, reject) => {
                // Se já tentamos carregar este script, resolve imediatamente
                if (loadedScripts.has(src)) {
                    basicLogger.debug('ScriptLoader', `Script já carregado, ignorando nova inclusão: ${src}`);
                    return resolve();
                }

                const script = document.createElement('script');
                script.src = `${appConfig.scriptBaseUrl}${src}?v=${Date.now()}`; // Adiciona timestamp para cache busting
                script.defer = true; // Carrega em paralelo e executa na ordem do DOM
                script.id = `script-${id}`; // ID para facilitar a depuração

                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout ao carregar script: ${src}`));
                }, 10000); // 10 segundos de timeout

                script.onload = () => {
                    clearTimeout(timeout);
                    loadedScripts.add(src); // Registra como carregado
                    basicLogger.info('ScriptLoader', `✅ Script carregado: ${src}`, 'color: #0c9d58; font-weight: bold;');
                    resolve();
                };

                script.onerror = (e) => {
                    clearTimeout(timeout);
                    basicLogger.error('ScriptLoader', `Erro ao carregar script: ${src}`, e);
                    reject(new Error(`Falha ao carregar script ${src}: ${e.message || 'erro desconhecido'}`));
                };

                document.head.appendChild(script);
            });
        }

        return {
            loadScript: loadScript,
            getLoadedScripts: () => Array.from(loadedScripts)
        };
    })();

    // =========================================================
    // Event Handler (apenas uma casca, o módulo real é SystemEventHandler)
    // =========================================================
    const SystemEventHandler = (function() {
        const events = new Map();
        basicLogger.info('EventHandler', 'SystemEventHandler inicializado.');

        function on(eventName, callback) {
            if (!events.has(eventName)) {
                events.set(eventName, []);
            }
            events.get(eventName).push(callback);
        }

        function emit(eventName, data) {
            if (events.has(eventName)) {
                events.get(eventName).forEach(callback => {
                    try {
                        callback(data);
                    } catch (e) {
                        basicLogger.error('EventHandler', `Erro ao executar callback para o evento '${eventName}': ${e.message}`, e);
                    }
                });
            }
            basicLogger.debug('EventHandler', `Evento '${eventName}' disparado.`, 'color: #7f8c8d; font-style: italic;');
        }

        return { on, emit };
    })();
    // Expõe SystemEventHandler globalmente para acesso precoce, se necessário
    window.SystemEventHandler = SystemEventHandler;


    // =========================================================
    // Início da Inicialização do Sistema
    // =========================================================
    async function initSystem() {
        const initStartTime = performance.now();
        basicLogger.debug('Performance', `Marca 'systemInitStart' definida em: ${initStartTime.toFixed(2)} ms`);

        try {
            // Carrega e inicializa módulos core em ordem, incluindo SystemLogger e PerformanceMonitor
            await ModuleManager.initCore();
            
            // Depois que o SystemLogger completo estiver inicializado, o basicLogger será substituído
            // E PerformanceMonitor também estará disponível para logs detalhados
            const performanceMonitor = ModuleManager.getModule('performance_monitor_core');

            // Carrega e inicializa módulos opcionais em paralelo
            await ModuleManager.initOptional();
            const optionalScriptsLoadedTime = performance.now();
            performanceMonitor.debug('Performance', `Marca 'optionalScriptsLoaded' definida em: ${optionalScriptsLoadedTime.toFixed(2)} ms`);
            performanceMonitor.info('Performance', `Medida 'optionalScriptLoadTime' concluída: ${(optionalScriptsLoadedTime - performanceMonitor.getMark('requiredScriptsLoaded')).toFixed(2)} ms`);
            
            // Inicializa o ModernAppManager, que gerencia a navegação da UI
            const modernAppManager = ModuleManager.getModule('modern_app');
            if (modernAppManager && typeof modernAppManager.attemptInitialization === 'function') {
                await modernAppManager.attemptInitialization(); // Inicia a aplicação real
            } else {
                throw new Error('ModernAppManager não foi carregado ou não tem método attemptInitialization.');
            }

            const totalInitializationTime = performance.now() - initStartTime;
            performanceMonitor.info('Performance', `Medida 'totalInitializationTime' concluída: ${totalInitializationTime.toFixed(2)} ms`);
            SystemLoggerInstance.info('InitSystem', `⏱️ Tempo total de inicialização do sistema: ${totalInitializationTime.toFixed(2)} ms`);
            SystemLoggerInstance.success('InitSystem', `🎉 Sistema totalmente carregado e pronto para uso!`);
            SystemEventHandler.emit('rcSystemReady', { version: appConfig.version, initTime: totalInitializationTime, status: 'success' });

        } catch (error) {
            basicLogger.error('InitSystem', `Falha crítica durante a inicialização do sistema: ${error.message}`, error);
            // Tenta usar o ErrorHandler se ele foi carregado
            const errorHandler = ModuleManager.getModule('error_handler');
            if (errorHandler && typeof errorHandler.handleError === 'function') {
                errorHandler.handleError(error, { type: 'SystemInitFatal', source: 'initSystem' });
            } else {
                // Fallback para exibir erro crítico na UI se o ErrorHandler não estiver pronto
                const criticalErrorElementId = appConfig.criticalErrorElementId || 'system-critical-error-display';
                const errorDisplay = document.getElementById(criticalErrorElementId);
                if (errorDisplay) {
                    errorDisplay.textContent = `Erro Crítico na Inicialização: ${error.message}. Por favor, recarregue a página.`;
                    errorDisplay.style.display = 'block';
                    errorDisplay.style.backgroundColor = '#dc3545';
                    errorDisplay.style.color = 'white';
                    errorDisplay.style.padding = '15px';
                    errorDisplay.style.textAlign = 'center';
                    errorDisplay.style.position = 'fixed';
                    errorDisplay.style.top = '0';
                    errorDisplay.style.width = '100%';
                    errorDisplay.style.zIndex = '10000';
                } else {
                    alert(`Erro Crítico na Inicialização: ${error.message}. Por favor, recarregue a página.`);
                }
            }
            SystemEventHandler.emit('rcSystemError', { message: error.message, status: 'failed' });
            // Não faça nada mais aqui para evitar mascarar o erro original
        }
    }

    // Inicia o processo de inicialização quando o DOM estiver completamente carregado.
    document.addEventListener('DOMContentLoaded', initSystem);
})();