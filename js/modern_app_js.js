/**
 * RC Construções - Aplicação Principal (Revisado e Aprimorado)
 * Gerencia o ciclo de vida da aplicação, carregamento de módulos, roteamento e eventos globais.
 * Aprimorado para ser robusto, com melhor tratamento de erros, logs detalhados e gestão de dependências.
 */

(function() {
    'use strict';

    let logger; // Instância do SystemLogger para este módulo
    let eventHandler; // Instância do SystemEventHandler
    let isInitialized = false;

    // Mapeamento de rotas para IDs de módulos e caminhos de arquivo HTML
    const ROUTES = {
        'dashboard': { moduleId: 'dashboard_module', htmlPath: 'templates/dashboard.html' },
        'clients': { moduleId: 'clients_module', htmlPath: 'templates/clients.html' },
        'budgets': { moduleId: 'budgets_module', htmlPath: 'templates/budgets.html' },
        'contracts': { moduleId: 'contracts_module', htmlPath: 'templates/contracts.html' },
        'financial': { moduleId: 'financial_module', htmlPath: 'templates/financial.html' },
        'reports': { moduleId: 'reports_module', htmlPath: 'templates/reports.html' },
        'settings': { moduleId: 'settings_module', htmlPath: 'templates/settings.html' },
        'suppliers': { moduleId: 'suppliers_module', htmlPath: 'templates/suppliers.html' },
        'demo': { moduleId: 'demo_module', htmlPath: 'templates/demo.html' } // Adicione seu módulo demo se tiver um HTML
    };

    class ModernAppManager {
        constructor() {
            this.currentModule = null;
            this.loadedModules = new Map(); // Cache de módulos carregados
            this.routeHistory = [];
            this.initializationAttempts = 0;
            this.maxInitAttempts = 3;

            // Logger básico temporário até SystemLogger estar pronto
            this.logger = console; // Usamos console diretamente até que o SystemLogger esteja disponível

            console.log('🚀 ModernAppManager criado'); // Log inicial com console
        }

        /**
         * Espera por uma dependência global estar disponível.
         * @param {string} globalName - O nome da variável global a ser esperada.
         * @returns {Promise<any>} A instância da dependência.
         */
        async waitForGlobal(globalName) {
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
         * Tenta inicializar o ModernAppManager e suas dependências.
         * Usa um mecanismo de retentativas.
         */
        async attemptInitialization() {
            while (this.initializationAttempts < this.maxInitAttempts) {
                try {
                    await this.init();
                    return; // Sai se a inicialização for bem-sucedida
                } catch (error) {
                    this.initializationAttempts++;
                    this.logger.error(`Erro na tentativa ${this.initializationAttempts}/${this.maxInitAttempts} de inicialização do ModernAppManager: ${error.message}`);
                    if (this.initializationAttempts < this.maxInitAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * this.initializationAttempts)); // Delay progressivo
                    }
                }
            }
            this.logger.error('Falha ao inicializar ModernAppManager após múltiplas tentativas. A aplicação pode não funcionar corretamente.');
            // Exibir mensagem de erro crítica na UI
            this.displayCriticalError('Falha Crítica: Não foi possível inicializar a aplicação. Por favor, tente recarregar.');
        }

        /**
         * Inicializa o ModernAppManager e suas dependências.
         */
        async init() {
            if (isInitialized) {
                this.logger.warn('ModernAppManager já está inicializado. Ignorando.');
                return;
            }

            try {
                // Aguarda o SystemLogger estar pronto para usar o logger completo
                logger = await this.waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ModernApp'));
                eventHandler = await this.waitForGlobal('SystemEventHandler');

                this.logger.info('🚀 Inicializando RC Construções v5.1...');
                this.logger.info('⏳ Aguardando dependências essenciais...');

                // Garante que Database e Auth estejam disponíveis, se forem essenciais para rotas
                await Promise.all([
                    this.waitForGlobal('Database'),
                    this.waitForGlobal('AuthManager') // Autenticação
                    // Adicione outras dependências essenciais aqui
                ]);

                this.logger.success('✅ Dependências essenciais carregadas');
                this.logger.info('📡 Sistema de eventos criado'); // O eventHandler já foi aguardado
                this.logger.info('🧭 Sistema de roteamento configurado');

                this.setupGlobalEventListeners(); // Configura listeners de rede e hashchange
                
                this.logger.info('⚙️ Inicializando módulos básicos...');

                // Inicializa módulos básicos que são globais e necessários para navegação inicial
                // SecurityManager, ValidationManager, UtilsManager já são inicializados pelo init_system_js.js
                // O CloudSync ou AdvancedSync tbm.

                isInitialized = true;
                this.logger.success('✅ Aplicação inicializada com sucesso');
                this.logger.success('🎉 RC Construções está pronto para uso!');

                // Carrega o módulo inicial com base na URL ou padrão
                await this.loadInitialModule();

            } catch (error) {
                this.logger.error(`Erro na inicialização da aplicação: ${error.message}`);
                this.displayCriticalError(`Erro na inicialização da aplicação: ${error.message}`);
                throw error;
            }
        }

        /**
         * Configura listeners de eventos globais (ex: hashchange, online/offline).
         */
        setupGlobalEventListeners() {
            window.addEventListener('hashchange', this.handleHashChange.bind(this));
            // Listeners para online/offline são agora gerenciados pelo NotificationsModule
            // e também pelo AdvancedSync/CloudSync.
        }

        /**
         * Lida com a mudança de hash na URL para navegação.
         */
        handleHashChange() {
            const route = window.location.hash.slice(1);
            this.navigateTo(route || 'dashboard'); // Navega para dashboard se não houver hash
        }

        /**
         * Carrega o módulo inicial ao carregar a página pela primeira vez.
         */
        async loadInitialModule() {
            const initialRoute = window.location.hash.slice(1) || 'dashboard';
            this.logger.info(`🧭 Navegando para: ${initialRoute}`);
            await this.navigateTo(initialRoute);
        }

        /**
         * Navega para um módulo/página específico.
         * @param {string} routeName - O nome da rota (ex: 'dashboard', 'clients').
         */
        async navigateTo(routeName) {
            this.logger.info(`Navegando para rota: ${routeName}`);
            const routeConfig = ROUTES[routeName];

            if (!routeConfig) {
                this.logger.error(`Rota '${routeName}' não encontrada.`);
                this.displayCriticalError(`Página não encontrada: ${routeName}`);
                return;
            }

            // Destrói o módulo atual antes de carregar o próximo (se houver um)
            if (this.currentModule && typeof this.currentModule.destroy === 'function') {
                this.logger.debug(`Destruindo módulo anterior: ${this.currentModule.constructor.name}`);
                await this.currentModule.destroy().catch(e => this.logger.error('Erro ao destruir módulo anterior:', e));
            }

            // Tenta carregar o HTML da página primeiro
            const mainContent = document.getElementById('main-content');
            const pageContainer = mainContent ? mainContent.querySelector('.page-container') : null;
            if (!pageContainer) {
                this.logger.error('Elemento .page-container não encontrado para carregar conteúdo.');
                return;
            }

            try {
                this.logger.debug(`Carregando HTML para: ${routeConfig.htmlPath}`);
                const response = await fetch(routeConfig.htmlPath);
                if (!response.ok) {
                    throw new Error(`Não foi possível carregar ${routeConfig.htmlPath}: ${response.statusText}`);
                }
                const html = await response.text();
                pageContainer.innerHTML = html; // Injeta o HTML

                this.logger.debug(`HTML de ${routeName} carregado. Inicializando módulo.`);

                // Agora que o HTML está no DOM, podemos tentar carregar e inicializar o módulo JS
                const moduleInstance = await this.loadModule(routeConfig.moduleId);

                if (moduleInstance && typeof moduleInstance.init === 'function') {
                    this.logger.debug(`Inicializando módulo JS para ${routeName}...`);
                    await moduleInstance.init(); // Chama o método init do módulo JS
                } else if (moduleInstance) {
                    this.logger.debug(`Módulo JS para ${routeName} carregado, mas sem método 'init'.`);
                } else {
                    throw new Error(`Módulo '${routeConfig.moduleId}' não pode ser instanciado.`);
                }

                this.currentModule = moduleInstance;
                this.routeHistory.push(routeName);
                this.logger.success(`Navegação para '${routeName}' concluída com sucesso.`);
                eventHandler.emit('routeChanged', { routeName, module: moduleInstance });

            } catch (error) {
                this.logger.error(`❌ Erro na navegação para ${routeName}: ${error.message}`, error);
                this.displayCriticalError(`Erro ao carregar página '${routeName}': ${error.message}`);
                eventHandler.emit('navigationError', { routeName, error: error.message });
            }
        }

        /**
         * Carrega e inicializa um módulo JS se ele ainda não estiver carregado.
         * Ele tenta obter a instância global primeiro, assumindo que init_system_js.js a expôs.
         * @param {string} moduleId - O ID do módulo (conforme configurado em init_system_js.js).
         * @returns {Promise<Object|null>} A instância do módulo.
         */
        async loadModule(moduleId) {
            if (this.loadedModules.has(moduleId)) {
                this.logger.debug(`Módulo '${moduleId}' já carregado, reutilizando instância.`);
                return this.loadedModules.get(moduleId);
            }

            // Tenta obter a instância do módulo do escopo global (assumindo que init_system_js.js a expõe)
            // O init_system_js.js deve ter um config.modules.optional com o globalName
            // Para dashboard_module, o globalName é 'dashboardModule'
            const moduleConfig = window.rcConfig.modules.optional.find(m => m.id === moduleId);
            if (!moduleConfig || !moduleConfig.globalName) {
                this.logger.error(`Configuração do módulo '${moduleId}' ou globalName não encontrada.`);
                return null;
            }

            // Espera a variável global ser exposta pelo init_system_js.js
            try {
                const moduleInstance = await this.waitForGlobal(moduleConfig.globalName);
                if (moduleInstance) {
                    this.logger.debug(`Módulo '${moduleId}' encontrado globalmente como '${moduleConfig.globalName}'.`);
                    this.loadedModules.set(moduleId, moduleInstance);
                    // Não chamamos init aqui, pois ele é chamado na função navigateTo,
                    // garantindo que o DOM da página está pronto.
                    return moduleInstance;
                } else {
                    throw new Error(`Módulo global '${moduleConfig.globalName}' é nulo ou indefinido.`);
                }
            } catch (error) {
                this.logger.error(`❌ ${moduleConfig.globalName} não encontrado ou tipo inválido: ${error.message}`);
                // Se o módulo não for encontrado globalmente, pode ser um problema de carregamento no init_system_js.js
                return null;
            }
        }
        
        /**
         * Exibe uma mensagem de erro crítica na UI (fora do fluxo normal de notificação).
         * @param {string} message - A mensagem de erro.
         */
        displayCriticalError(message) {
            const errorElement = document.getElementById('system-critical-error-display'); // Certifique-se de ter este ID no seu HTML
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
                errorElement.style.backgroundColor = 'var(--color-error)';
                errorElement.style.color = 'white';
                errorElement.style.padding = '15px';
                errorElement.style.textAlign = 'center';
                errorElement.style.position = 'fixed';
                errorElement.style.top = '0';
                errorElement.style.width = '100%';
                errorElement.style.zIndex = '10000';
            } else {
                alert(`Erro Crítico: ${message}`); // Fallback para alerta nativo
            }
        }
        
        // --- Métodos de Conveniência/Debug ---
        getStatus() {
            return {
                initialized: isInitialized,
                currentRoute: window.location.hash.slice(1) || 'dashboard',
                currentModule: this.currentModule ? this.currentModule.constructor.name : 'Nenhum',
                loadedModulesCount: this.loadedModules.size,
                routeHistoryLength: this.routeHistory.length
            };
        }
        debug() {
            console.group('🚀 ModernAppManager - Debug');
            this.logger.info('Status completo:', this.getStatus());
            this.logger.info('Módulos carregados em cache:', Array.from(this.loadedModules.keys()));
            this.logger.info('Histórico de rotas:', this.routeHistory.slice(-5));
            console.groupEnd();
        }
    }

    // Instancia e expõe o ModernAppManager globalmente
    // O init_system_js.js se encarrega de chamar .init() para este módulo.
    // Usamos um truque aqui para que a instância seja criada, mas o init seja chamado depois
    // pelo init_system_js.js para garantir que todas as dependências estejam prontas.
    // A propriedade global 'ModernAppManager' será definida por init_system_js.js.
    window.ModernAppManager = new ModernAppManager();
    // A chamada 'attemptInitialization' será feita pelo init_system_js.js no momento certo.
})();