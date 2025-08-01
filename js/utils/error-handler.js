/**
 * RC Construções - Módulo de Tratamento de Erros (Revisado e Aprimorado)
 * Centraliza a captura e o tratamento de erros em toda a aplicação.
 * Garante que erros não tratados sejam registrados e, opcionalmente, reportados.
 * Aprimorado para robustez, flexibilidade e integração com o SystemLogger e NotificationsModule.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let notificationsModule; // Para exibir notificações de erro ao usuário
    let authManager; // Para obter o ID do usuário/sessão ao reportar erros
    let isInitialized = false;

    const ERROR_HANDLER_CONFIG = {
        sendErrorsToBackend: true, // Se deve enviar erros para um endpoint de backend
        errorReportEndpoint: '/api/errors/report', // Endpoint para relatar erros
        showUserFacingErrors: true, // Se deve mostrar notificações de erro ao usuário
        defaultErrorMessage: 'Um erro inesperado ocorreu. Por favor, tente novamente.',
        // Tipos de erro que podem ser ignorados no log ou no relatório
        ignoredErrors: ['ResizeObserver loop limit exceeded', 'Failed to execute \'send\' on \'XMLHttpRequest\': Failed to load \'chrome-extension'],
        debounceReportDelay: 1000 // Delay para debounced reporting (evitar spam de erros)
    };

    const reportedErrors = new Map(); // Para controlar erros já reportados recentemente
    let debounceTimeoutId = null;

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
     * Inicializa o Módulo de Tratamento de Erros.
     * Configura listeners globais para erros não tratados e rejeições de promessas.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('ErrorHandler já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ErrorHandler'));
            notificationsModule = await waitForGlobal('NotificationsModule').catch(() => null);
            authManager = await waitForGlobal('AuthManager').catch(() => null);

            // Captura erros globais não tratados
            window.onerror = (message, source, lineno, colno, error) => {
                const errorObj = error || new Error(message);
                handleError(errorObj, {
                    type: 'Global Uncaught Error',
                    message, source, lineno, colno
                });
                return true; // Retorna true para suprimir o log de erro padrão do navegador
            };

            // Captura rejeições de promessas não tratadas
            window.onunhandledrejection = (event) => {
                let error = event.reason;
                if (!(error instanceof Error)) {
                    error = new Error(String(error)); // Converte para Error object
                }
                handleError(error, {
                    type: 'Unhandled Promise Rejection',
                    promise: event.promise,
                    message: event.reason ? event.reason.message || String(event.reason) : 'Unknown reason'
                });
                // Não chame preventDefault() aqui para que o navegador ainda possa logar a rejeição,
                // a menos que você queira controlá-lo completamente.
            };

            logger.info('🚨 Módulo de Tratamento de Erros inicializado. Captura de erros globais ativada.');
            isInitialized = true;
        } catch (error) {
            console.error('Erro crítico ao inicializar ErrorHandler:', error);
            (logger || console).error('Falha na inicialização do ErrorHandler. Erros podem não ser tratados adequadamente.');
            isInitialized = false;
        }
    }

    /**
     * Lida com um erro, registrando-o e, opcionalmente, exibindo-o ao usuário e reportando ao backend.
     * @param {Error} error - O objeto Error real.
     * @param {Object} [context={}] - Informações adicionais sobre o erro (ex: tipo, onde ocorreu).
     */
    function handleError(error, context = {}) {
        if (!isInitialized) {
            console.error('ErrorHandler não inicializado. Logando erro diretamente:', error, context);
            return;
        }

        // Ignora erros específicos
        if (ERROR_HANDLER_CONFIG.ignoredErrors.some(ignored => error.message.includes(ignored))) {
            logger.debug('Erro ignorado (na whitelist):', error.message);
            return;
        }

        const timestamp = new Date().toISOString();
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            name: error.name,
            timestamp: timestamp,
            userAgent: navigator.userAgent,
            url: window.location.href,
            context: context.type || 'Application Error',
            details: context // Inclui o objeto de contexto completo
        };

        // Adiciona informações do usuário se disponível
        if (authManager && authManager.isAuthenticated()) {
            const user = authManager.getCurrentUser();
            errorInfo.userId = user ? user.id : 'unknown';
            errorInfo.username = user ? user.username : 'anonymous';
        }

        // Loga o erro com o logger central
        logger.error(`[${errorInfo.context}] ${errorInfo.message}`, errorInfo);

        // Exibe notificação de erro ao usuário
        if (ERROR_HANDLER_CONFIG.showUserFacingErrors && notificationsModule) {
            notificationsModule.showError('Erro no Sistema', ERROR_HANDLER_CONFIG.defaultErrorMessage, {
                toast: true, // Geralmente um toast é suficiente para erros não-críticos
                duration: 5000 // Duração um pouco maior
            });
        }

        // Reporta o erro ao backend (com debounce para evitar spam)
        if (ERROR_HANDLER_CONFIG.sendErrorsToBackend) {
            clearTimeout(debounceTimeoutId);
            debounceTimeoutId = setTimeout(() => {
                sendErrorToBackend(errorInfo).catch(e => logger.error('Falha ao enviar relatório de erro para o backend:', e));
                reportedErrors.set(errorInfo.message + errorInfo.stack, Date.now()); // Marca como reportado
            }, ERROR_HANDLER_CONFIG.debounceReportDelay);
        }
    }

    /**
     * Envia os detalhes do erro para um endpoint de backend.
     * @param {Object} errorDetails - Objeto com os detalhes do erro.
     * @returns {Promise<void>}
     */
    async function sendErrorToBackend(errorDetails) {
        if (!ERROR_HANDLER_CONFIG.errorReportEndpoint) {
            logger.warn('Endpoint de relatório de erro não configurado. Não é possível enviar.');
            return;
        }

        try {
            const response = await fetch(ERROR_HANDLER_CONFIG.errorReportEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Adicione token de autenticação aqui se necessário
                    // 'Authorization': `Bearer ${authManager.getToken()}`
                },
                body: JSON.stringify(errorDetails)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            logger.success('Relatório de erro enviado para o backend com sucesso.');
        } catch (error) {
            logger.error(`Falha ao enviar relatório de erro para o backend: ${error.message}`);
        }
    }

    /**
     * Força um erro de teste para verificar a funcionalidade do ErrorHandler.
     */
    function testErrorHandler() {
        logger.warn('Executando teste do ErrorHandler...');
        try {
            // Simula um erro síncrono
            throw new Error('Este é um erro de teste síncrono do ErrorHandler.');
        } catch (e) {
            handleError(e, { type: 'Test Error', source: 'testErrorHandler' });
        }

        // Simula um erro assíncrono (promessa rejeitada)
        Promise.reject('Este é um erro de teste de promessa rejeitada!').catch(() => { /* captura para evitar unhandled */ });
        
        // Simula um erro em setTimeout
        setTimeout(() => {
            throw new Error('Este é um erro de teste em setTimeout!');
        }, 100);
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        handleError: handleError, // Método para outros módulos chamarem para lidar com erros específicos
        testErrorHandler: testErrorHandler, // Para fins de depuração
        updateConfig: (newConfig) => {
            Object.assign(ERROR_HANDLER_CONFIG, newConfig);
            logger.info('Configuração do ErrorHandler atualizada:', ERROR_HANDLER_CONFIG);
        }
    };
})();