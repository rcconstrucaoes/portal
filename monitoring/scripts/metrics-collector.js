/**
 * RC Construções - Módulo de Coleta de Métricas (Revisado e Aprimorado)
 * Coleta métricas de desempenho no lado do cliente e interações do usuário.
 * Integra-se com o SystemLogger e pode enviar métricas para o backend.
 * Projetado para ser robusto, configurável e eficiente.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let eventHandler; // Para emitir eventos de métricas
    let isInitialized = false;

    const METRICS_COLLECTOR_CONFIG = {
        enabled: true, // Se a coleta de métricas está ativa
        sendInterval: 15 * 1000, // Envia métricas em lote a cada 15 segundos
        maxMetricsBuffer: 50, // Número máximo de métricas a bufferizar antes de enviar
        // metricsEndpoint: '/api/metrics/collect', // Endpoint do backend para enviar métricas
        // Coleta automática de eventos do DOM (cliques, mudanças de input)
        autoTrackDOMEvents: false,
        // Ignora certos eventos ou elementos (para evitar ruído)
        ignoredElements: ['password', 'credit-card-input'],
        ignoredEvents: ['mousemove', 'scroll']
    };

    const metricsBuffer = []; // Buffer para armazenar métricas antes do envio

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
     * Inicializa o Módulo de Coleta de Métricas.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('MetricsCollector já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('MetricsCollector'));
            eventHandler = await waitForGlobal('SystemEventHandler');

            logger.info('📈 Módulo de Coleta de Métricas inicializando...');

            if (METRICS_COLLECTOR_CONFIG.enabled) {
                this.startSendingMetrics();
                this.setupPerformanceObservers(); // Configura observadores de performance (navegador)
                if (METRICS_COLLECTOR_CONFIG.autoTrackDOMEvents) {
                    this.setupDOMEventTracking();
                }
            } else {
                logger.warn('Módulo de Coleta de Métricas desabilitado pela configuração.');
            }
            
            logger.info('✅ Módulo de Coleta de Métricas inicializado!');
            this.isInitialized = true;
        } catch (error) {
            console.error('Erro crítico ao inicializar MetricsCollector:', error);
            (logger || console).error('Falha na inicialização do MetricsCollector. A coleta de métricas pode não estar funcionando.');
            METRICS_COLLECTOR_CONFIG.enabled = false; // Desabilita se falhar
        }
    }

    /**
     * Adiciona uma métrica ao buffer de coleta.
     * @param {Object} metric - Objeto da métrica (name, value, type, etc.).
     */
    function addMetricToBuffer(metric) {
        if (!METRICS_COLLECTOR_CONFIG.enabled) return;

        const metricEntry = {
            timestamp: new Date().toISOString(),
            name: metric.name,
            value: metric.value,
            type: metric.type || 'custom', // 'custom', 'performance_api', 'dom_event'
            details: metric.details || {}
        };

        metricsBuffer.push(metricEntry);

        if (metricsBuffer.length >= METRICS_COLLECTOR_CONFIG.maxMetricsBuffer) {
            this.sendBufferedMetrics(); // Envia imediatamente se o buffer estiver cheio
        }
        logger.debug('Métrica adicionada ao buffer:', metricEntry);
    }

    /**
     * Inicia o envio periódico de métricas em lote.
     */
    function startSendingMetrics() {
        if (this.sendIntervalId) {
            clearInterval(this.sendIntervalId);
        }
        this.sendIntervalId = setInterval(() => this.sendBufferedMetrics(), METRICS_COLLECTOR_CONFIG.sendInterval);
        logger.info(`Envio de métricas iniciado a cada ${METRICS_COLLECTOR_CONFIG.sendInterval / 1000} segundos.`);
        // Envia imediatamente quaisquer métricas que já estejam no buffer
        this.sendBufferedMetrics();
    }

    /**
     * Para o envio periódico de métricas.
     */
    function stopSendingMetrics() {
        if (this.sendIntervalId) {
            clearInterval(this.sendIntervalId);
            this.sendIntervalId = null;
            logger.info('Envio de métricas parado.');
        }
    }

    /**
     * Envia as métricas armazenadas no buffer para o backend de análise.
     * Limpa o buffer após o envio bem-sucedido.
     */
    async function sendBufferedMetrics() {
        if (!METRICS_COLLECTOR_CONFIG.enabled || metricsBuffer.length === 0 || !METRICS_COLLECTOR_CONFIG.metricsEndpoint || !navigator.onLine) {
            if (metricsBuffer.length > 0) {
                logger.debug(`Não foi possível enviar métricas: ${!METRICS_COLLECTOR_CONFIG.enabled ? 'Coleta desabilitada. ' : ''}${!METRICS_COLLECTOR_CONFIG.metricsEndpoint ? 'Endpoint não configurado. ' : ''}${!navigator.onLine ? 'Offline.' : ''}`);
            }
            return;
        }

        const metricsToSend = [...metricsBuffer];
        metricsBuffer.length = 0; // Limpa o buffer imediatamente

        try {
            const response = await fetch(METRICS_COLLECTOR_CONFIG.metricsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: (window.SettingsManager && window.SettingsManager.getSetting('deviceId')) || 'anonymous',
                    userId: (window.AuthManager && window.AuthManager.isAuthenticated() && window.AuthManager.getCurrentUser()?.id) || 'guest',
                    metrics: metricsToSend
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            logger.success(`Enviadas ${metricsToSend.length} métricas para o backend.`);
        } catch (error) {
            logger.error(`Falha ao enviar métricas para o backend: ${error.message}. Métricas podem ser perdidas.`, metricsToSend);
            // Opcional: Adicionar de volta ao buffer ou salvar em localStorage para re-tentar
        }
    }

    /**
     * Configura observadores para métricas de performance do navegador (Performance API).
     */
    function setupPerformanceObservers() {
        if (typeof PerformanceObserver === 'undefined') {
            logger.warn('PerformanceObserver API não suportada neste navegador.');
            return;
        }

        try {
            // Observa entradas de performance (paint, navigation, resource, longtask)
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (METRICS_COLLECTOR_CONFIG.ignoredEvents.includes(entry.name)) return;
                    
                    this.addMetricToBuffer({
                        name: entry.name,
                        value: entry.duration || entry.startTime,
                        type: 'performance_api',
                        details: {
                            entryType: entry.entryType,
                            startTime: entry.startTime,
                            duration: entry.duration,
                            ...entry.toJSON() // Inclui todos os detalhes da entrada
                        }
                    });
                });
            });

            // Tipos de entradas para observar
            observer.observe({ entryTypes: ['paint', 'navigation', 'resource', 'longtask', 'element'] });
            logger.debug('Performance Observers configurados.');
        } catch (error) {
            logger.error(`Erro ao configurar Performance Observers: ${error.message}`);
        }
    }

    /**
     * Configura o rastreamento automático de eventos DOM (cliques, mudanças de input).
     */
    function setupDOMEventTracking() {
        const eventsToTrack = ['click', 'change', 'submit', 'focus', 'blur'];

        eventsToTrack.forEach(eventType => {
            document.addEventListener(eventType, (event) => {
                const target = event.target;
                const tagName = target.tagName;
                const id = target.id;
                const className = target.className;
                const name = target.name;
                const type = target.type;

                // Ignora elementos sensíveis ou eventos específicos
                if (METRICS_COLLECTOR_CONFIG.ignoredElements.some(ignored => (id && id.includes(ignored)) || (name && name.includes(ignored)) || (type && type.includes(ignored)))) {
                    logger.debug(`Evento DOM '${eventType}' ignorado para elemento sensível.`);
                    return;
                }
                if (METRICS_COLLECTOR_CONFIG.ignoredEvents.includes(eventType)) {
                    return;
                }

                // Cria um ID de elemento único para logs
                const elementId = id || name || className.split(' ')[0] || tagName;

                this.addMetricToBuffer({
                    name: `dom_event_${eventType}`,
                    value: 1, // Contagem
                    type: 'dom_event',
                    details: {
                        element: elementId,
                        tagName: tagName,
                        inputType: type,
                        valueLength: (type === 'text' || type === 'password') ? (target.value?.length || 0) : undefined,
                        path: window.location.pathname
                    }
                });
            }, { capture: true }); // Captura para pegar o evento no estágio inicial
        });
        logger.debug('Rastreamento de eventos DOM configurado.');
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        // Para adicionar métricas customizadas diretamente
        recordMetric: function(name, value, type = 'custom', details = {}) {
            this.addMetricToBuffer({ name, value, type, details });
        },
        start: function() { this.startSendingMetrics(); },
        stop: function() { this.stopSendingMetrics(); },
        sendNow: function() { this.sendBufferedMetrics(); },
        updateConfig: function(newConfig) {
            Object.assign(METRICS_COLLECTOR_CONFIG, newConfig);
            logger.info('Configuração do MetricsCollector atualizada:', METRICS_COLLECTOR_CONFIG);
            if (METRICS_COLLECTOR_CONFIG.enabled) {
                this.startSendingMetrics();
            } else {
                this.stopSendingMetrics();
            }
        },
        getBufferedMetrics: () => [...metricsBuffer] // Para depuração
    };
})();