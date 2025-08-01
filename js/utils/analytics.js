/**
 * RC Construções - Módulo de Análise (Analytics)
 * Coleta e envia dados de uso e interação do aplicativo para fins de análise.
 * Inclui rastreamento de eventos, visualizações de página e métricas de engajamento.
 * Projetado para ser robusto, configurável e integrado com o SystemLogger.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let eventHandler; // Para emitir eventos relacionados a analytics
    let isInitialized = false;

    const ANALYTICS_CONFIG = {
        enabled: true, // Se a coleta de dados está ativa
        debugMode: false, // Se deve logar dados de analytics no console para depuração
        samplingRate: 1.0, // Taxa de amostragem (1.0 = 100% dos eventos)
        sendInterval: 10 * 1000, // Intervalo para enviar dados em lote (10 segundos)
        // analyticsEndpoint: '/api/analytics/track', // Endpoint do backend para enviar dados
        bufferSize: 20, // Número máximo de eventos para armazenar em buffer antes de enviar
        // Device ID e User ID serão obtidos de outros módulos (AuthManager, SettingsManager)
        deviceId: null,
        userId: null // ID do usuário logado, se houver
    };

    const eventBuffer = []; // Buffer para armazenar eventos antes do envio em lote
    let sendIntervalId = null;

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
     * Inicializa o Módulo de Análise.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('AnalyticsModule já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('AnalyticsModule'));
            eventHandler = await waitForGlobal('SystemEventHandler');
            
            // Tenta obter o Device ID e User ID de outros módulos
            const settingsManager = await waitForGlobal('SettingsManager').catch(() => null);
            const authManager = await waitForGlobal('AuthManager').catch(() => null);

            if (settingsManager) {
                ANALYTICS_CONFIG.deviceId = settingsManager.getSetting('deviceId') || generateAnonymousId();
            } else {
                ANALYTICS_CONFIG.deviceId = generateAnonymousId();
                logger.warn('SettingsManager não disponível, gerando ID anônimo para Analytics.');
            }

            if (authManager && authManager.isAuthenticated()) {
                ANALYTICS_CONFIG.userId = authManager.getCurrentUser()?.id || 'anonymous';
            }

            logger.info('📊 Módulo de Análise inicializado.');
            if (ANALYTICS_CONFIG.enabled) {
                startSendingEvents(); // Inicia o envio periódico de eventos
                setupRouteChangeTracking(); // Configura o rastreamento de mudanças de rota
            } else {
                logger.warn('Módulo de Análise desabilitado pela configuração.');
            }
            isInitialized = true;
        } catch (error) {
            console.error('Erro crítico ao inicializar AnalyticsModule:', error);
            (logger || console).error('Falha na inicialização do AnalyticsModule. A coleta de dados pode não estar funcionando.');
            ANALYTICS_CONFIG.enabled = false; // Desabilita se falhar na inicialização
        }
    }

    /**
     * Gera um ID anônimo para o dispositivo, caso não haja um Device ID no Settings.
     * @returns {string} UUID v4.
     */
    function generateAnonymousId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback para ambientes sem crypto.randomUUID
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Configura o rastreamento automático de mudanças de rota (page views).
     */
    function setupRouteChangeTracking() {
        if (eventHandler) {
            eventHandler.on('routeChanged', (data) => {
                trackPageView(data.routeName, data.module ? data.module.constructor.name : 'Unknown');
            });
            logger.debug('Rastreamento de mudanças de rota configurado.');
        } else {
            logger.warn('SystemEventHandler não disponível para rastrear mudanças de rota.');
        }
    }

    /**
     * Inicia o envio periódico de eventos em lote.
     */
    function startSendingEvents() {
        if (sendIntervalId) {
            clearInterval(sendIntervalId);
        }
        sendIntervalId = setInterval(sendBufferedEvents, ANALYTICS_CONFIG.sendInterval);
        logger.info(`Envio de eventos de Analytics iniciado a cada ${ANALYTICS_CONFIG.sendInterval / 1000} segundos.`);
        // Tenta enviar imediatamente qualquer evento que possa já estar no buffer
        sendBufferedEvents();
    }

    /**
     * Para o envio periódico de eventos.
     */
    function stopSendingEvents() {
        if (sendIntervalId) {
            clearInterval(sendIntervalId);
            sendIntervalId = null;
            logger.info('Envio de eventos de Analytics parado.');
        }
    }

    /**
     * Envia os eventos armazenados no buffer para o backend de análise.
     * Limpa o buffer após o envio bem-sucedido.
     */
    async function sendBufferedEvents() {
        if (!ANALYTICS_CONFIG.enabled || eventBuffer.length === 0 || !navigator.onLine) {
            if (eventBuffer.length > 0) {
                logger.debug(`Não foi possível enviar eventos: ${ANALYTICS_CONFIG.enabled ? '' : 'Analytics desabilitado. '}${!navigator.onLine ? 'Offline.' : ''}`);
            }
            return;
        }

        // Se não houver endpoint, apenas loga e limpa o buffer em modo debug
        if (!ANALYTICS_CONFIG.analyticsEndpoint) {
            if (ANALYTICS_CONFIG.debugMode) {
                logger.debug('Endpoint de Analytics não configurado. Eventos apenas logados:', eventBuffer);
            }
            eventBuffer.length = 0; // Limpa o buffer se não houver para onde enviar
            return;
        }

        const eventsToSend = [...eventBuffer];
        eventBuffer.length = 0; // Limpa o buffer imediatamente para novas coletas

        try {
            const response = await fetch(ANALYTICS_CONFIG.analyticsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: ANALYTICS_CONFIG.deviceId,
                    userId: ANALYTICS_CONFIG.userId,
                    events: eventsToSend
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            logger.success(`Enviados ${eventsToSend.length} eventos de Analytics.`);
        } catch (error) {
            logger.error(`Falha ao enviar eventos de Analytics: ${error.message}. Eventos podem ser perdidos.`, eventsToSend);
            // Opcional: Adicionar de volta ao buffer ou salvar em localStorage para re-tentar
        }
    }

    /**
     * Adiciona um evento ao buffer de coleta.
     * @param {string} eventName - Nome do evento (ex: 'button_click', 'form_submit').
     * @param {Object} [eventData={}] - Dados adicionais do evento.
     */
    function addEventToBuffer(eventName, eventData = {}) {
        if (!ANALYTICS_CONFIG.enabled) return;

        // Amostragem
        if (Math.random() > ANALYTICS_CONFIG.samplingRate) {
            logger.debug(`Evento '${eventName}' ignorado devido à amostragem.`);
            return;
        }

        const event = {
            name: eventName,
            timestamp: new Date().toISOString(),
            data: eventData,
            url: window.location.href,
            path: window.location.pathname
        };

        if (ANALYTICS_CONFIG.debugMode) {
            logger.debug('Evento de Analytics capturado:', event);
        }

        eventBuffer.push(event);

        if (eventBuffer.length >= ANALYTICS_CONFIG.bufferSize) {
            sendBufferedEvents(); // Envia imediatamente se o buffer estiver cheio
        }
    }

    /**
     * Rastreia um evento customizado no aplicativo.
     * @param {string} eventName - O nome do evento a ser rastreado (ex: 'login_success', 'item_added').
     * @param {Object} [properties={}] - Propriedades adicionais do evento (ex: { itemId: 123, category: 'products' }).
     */
    function trackEvent(eventName, properties = {}) {
        addEventToBuffer(eventName, properties);
    }

    /**
     * Rastreia uma visualização de página.
     * @param {string} pageName - O nome da página (ex: 'Dashboard', 'ClientsList').
     * @param {string} [moduleName] - O nome do módulo associado à página (ex: 'DashboardModule').
     * @param {Object} [properties={}] - Propriedades adicionais da visualização de página.
     */
    function trackPageView(pageName, moduleName = 'Unknown', properties = {}) {
        trackEvent('page_view', { page: pageName, module: moduleName, ...properties });
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        trackEvent: trackEvent,
        trackPageView: trackPageView,
        // Métodos de controle para depuração ou configuração em tempo de execução
        start: startSendingEvents,
        stop: stopSendingEvents,
        sendNow: sendBufferedEvents,
        updateConfig: (newConfig) => {
            Object.assign(ANALYTICS_CONFIG, newConfig);
            logger.info('Configuração de Analytics atualizada:', ANALYTICS_CONFIG);
            if (ANALYTICS_CONFIG.enabled) {
                startSendingEvents();
            } else {
                stopSendingEvents();
            }
        },
        getBufferedEvents: () => [...eventBuffer] // Retorna uma cópia do buffer para depuração
    };
})();