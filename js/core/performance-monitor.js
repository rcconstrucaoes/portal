/**
 * RC Construções - Performance Monitor (Revisado e Aprimorado)
 * Módulo para monitorar e registrar métricas de desempenho do aplicativo,
 * incluindo Web Vitals e marcas de performance personalizadas.
 * Aprimorado para robustez, integração com SystemLogger e tratamento de dados.
 */

(function() {
    'use strict';

    let logger;
    let eventHandler; // Para emitir eventos de performance
    let isInitialized = false;

    const PERFORMANCE_CONFIG = {
        sendInterval: 30 * 1000, // Envia métricas a cada 30 segundos (ou no unload)
        maxMetricsBuffer: 50, // Número máximo de métricas a bufferizar antes de enviar
        enableWebVitals: true, // Habilitar coleta de Web Vitals
        webVitalsThresholds: { // Limites para alertar sobre Web Vitals (em ms ou outros)
            LCP: 2500, // Largest Contentful Paint (bom: <2.5s)
            FID: 100,  // First Input Delay (bom: <100ms)
            CLS: 0.1,  // Cumulative Layout Shift (bom: <0.1)
            TTFB: 800, // Time to First Byte (bom: <0.8s)
            FCP: 1800  // First Contentful Paint (bom: <1.8s)
        },
        // Endpoint para enviar métricas para o backend, se houver
        // metricsEndpoint: '/api/performance/metrics'
    };

    const performanceMetricsBuffer = []; // Buffer para armazenar métricas antes de enviar
    const performanceMarks = new Map(); // Para armazenar marcas de performance (ex: 'loadStart', 'dataFetchEnd')

    // Variáveis para armazenar as funções de Web Vitals (carregadas dinamicamente)
    let getLCP, getFID, getCLS, getTTFB, getFCP;

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
     * Inicializa o Performance Monitor.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('PerformanceMonitor já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('Performance'));
            eventHandler = await waitForGlobal('SystemEventHandler');

            logger.info('📊 PerformanceMonitor inicializado.');

            if (PERFORMANCE_CONFIG.enableWebVitals) {
                await setupWebVitals();
            }

            // Inicia o envio periódico de métricas, se configurado
            // if (PERFORMANCE_CONFIG.metricsEndpoint) {
            //     setInterval(sendMetricsToServer, PERFORMANCE_CONFIG.sendInterval);
            //     window.addEventListener('beforeunload', sendMetricsToServer); // Tenta enviar antes de fechar
            // }

            isInitialized = true;
        } catch (error) {
            console.error('Erro crítico ao inicializar Performance Monitor:', error);
            (logger || console).error('Falha na inicialização do Performance Monitor. Monitoramento de performance desabilitado.');
        }
    }

    /**
     * Configura a coleta de métricas Web Vitals.
     * Tenta carregar a biblioteca 'web-vitals' (assumindo que está em lib/web-vitals.min.js).
     * @returns {Promise<void>}
     */
    async function setupWebVitals() {
        if (typeof getCLS === 'undefined' || typeof getFID === 'undefined' || typeof getLCP === 'undefined') {
            try {
                // Tenta carregar web-vitals.min.js se não estiver já no escopo global
                // Assuming web-vitals.min.js exposes functions globally or has a specific structure
                // If it's loaded as a simple script, functions might be directly available
                // If loaded via ModuleManager, ensure it exposes its parts or the whole module.
                if (typeof webVitals === 'undefined') { // Check if the global object exists
                    // Fallback to dynamic script loading if not already present
                    // This part might need adjustment based on how web-vitals.min.js exports
                    await loadScript('lib/web-vitals.min.js', 'web-vitals-lib');
                }
                
                // Assuming web-vitals.min.js exposes functions directly like this:
                getLCP = window.webVitals?.getLCP || window.getLCP;
                getFID = window.webVitals?.getFID || window.getFID;
                getCLS = window.webVitals?.getCLS || window.getCLS;
                getTTFB = window.webVitals?.getTTFB || window.getTTFB;
                getFCP = window.webVitals?.getFCP || window.getFCP;

                if (!getLCP || !getFID || !getCLS) {
                    throw new Error('Funções Web Vitals não encontradas após carregamento.');
                }
                logger.info('Web Vitals API carregada e funções disponíveis.');

            } catch (error) {
                logger.warn(`Web Vitals não disponível para coleta: ${error.message}`);
                PERFORMANCE_CONFIG.enableWebVitals = false;
                return;
            }
        }

        getCLS(metric => recordMetric(metric));
        getFID(metric => recordMetric(metric));
        getLCP(metric => recordMetric(metric));
        getTTFB(metric => recordMetric(metric));
        getFCP(metric => recordMetric(metric));
        
        logger.info('Coleta de Web Vitals configurada.');
    }

    /**
     * Helper para carregar scripts dinamicamente (se não for via ModuleManager/ScriptLoader principal).
     * @param {string} src - URL do script.
     * @param {string} id - ID do script.
     * @returns {Promise<void>}
     */
    function loadScript(src, id) {
        return new Promise((resolve, reject) => {
            if (document.getElementById(id)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Registra uma métrica de performance.
     * @param {Object} metric - Objeto de métrica (pode ser de Web Vitals ou customizada).
     */
    function recordMetric(metric) {
        // Ignora métricas Web Vitals que não atendem ao limite para reduzir ruído,
        // mas loga as críticas como erro/aviso.
        if (PERFORMANCE_CONFIG.enableWebVitals && metric.name in PERFORMANCE_CONFIG.webVitalsThresholds) {
            const threshold = PERFORMANCE_CONFIG.webVitalsThresholds[metric.name];
            let isCritical = false;
            let logMethod = logger.info;

            if (metric.name === 'CLS') {
                if (metric.value > threshold) { // CLS: quanto menor, melhor
                    isCritical = true;
                    logMethod = logger.warn;
                }
            } else {
                if (metric.value > threshold) { // LCP, FID, TTFB, FCP: quanto menor, melhor
                    isCritical = true;
                    logMethod = logger.warn;
                }
            }

            if (isCritical) {
                logMethod(`Métrica crítica: ${metric.name}`, { value: metric.value, id: metric.id, attribution: metric.attribution || 'unknown' });
            } else {
                logger.debug(`Métrica: ${metric.name}`, { value: metric.value, id: metric.id });
            }
        } else {
            // Log de métricas customizadas
            logger.info(`Métrica Customizada: ${metric.name}`, { value: metric.value, ...metric });
        }
        
        // Adiciona ao buffer para envio posterior
        performanceMetricsBuffer.push({
            timestamp: new Date().toISOString(),
            name: metric.name,
            value: metric.value,
            id: metric.id,
            rating: metric.rating || null, // 'good', 'needs-improvement', 'poor'
            delta: metric.delta || null, // Apenas para CLS, FID
            context: metric.context || 'web-vitals'
        });

        // Se o buffer atingir o limite, tenta enviar
        // if (performanceMetricsBuffer.length >= PERFORMANCE_CONFIG.maxMetricsBuffer) {
        //     sendMetricsToServer();
        // }
    }

    /**
     * Define uma marca de performance.
     * @param {string} name - Nome da marca.
     * @returns {number} Timestamp da marca.
     */
    function setMark(name) {
        const timestamp = performance.now();
        performanceMarks.set(name, timestamp);
        logger.debug(`Marca '${name}' definida em: ${timestamp.toFixed(2)} ms`);
        return timestamp;
    }

    /**
     * Mede a duração entre duas marcas ou desde uma marca até agora.
     * @param {string} measureName - Nome da medida.
     * @param {string} startMark - Nome da marca de início.
     * @param {string} [endMark] - Nome da marca de fim (opcional, se não, mede até agora).
     * @returns {number|null} Duração da medida em ms ou null se as marcas não existirem.
     */
    function measure(measureName, startMark, endMark) {
        const start = performanceMarks.get(startMark);
        if (typeof start === 'undefined') {
            logger.error(`Marca de início '${startMark}' não encontrada para medida '${measureName}'.`);
            return null;
        }

        let end;
        if (endMark) {
            end = performanceMarks.get(endMark);
            if (typeof end === 'undefined') {
                logger.error(`Marca de fim '${endMark}' não encontrada para medida '${measureName}'.`);
                return null;
            }
        } else {
            end = performance.now(); // Mede até o momento atual
        }

        const duration = end - start;
        logger.info(`Medida '${measureName}' concluída: ${duration.toFixed(2)} ms`);
        recordMetric({ name: measureName, value: duration, context: 'custom-measure' });
        return duration;
    }

    /**
     * Envia as métricas coletadas para um endpoint de backend.
     * Limpa o buffer após o envio bem-sucedido.
     * @returns {Promise<void>}
     */
    async function sendMetricsToServer() {
        if (performanceMetricsBuffer.length === 0 || !PERFORMANCE_CONFIG.metricsEndpoint) {
            logger.debug('Nenhuma métrica para enviar ou endpoint não configurado.');
            return;
        }

        // Cria uma cópia do buffer e limpa o original imediatamente
        const metricsToSend = [...performanceMetricsBuffer];
        performanceMetricsBuffer.length = 0; // Esvazia o buffer

        try {
            const response = await fetch(PERFORMANCE_CONFIG.metricsEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Adicione aqui token de autenticação se necessário (ex: authManager.getToken())
                },
                body: JSON.stringify({ deviceId: PERFORMANCE_CONFIG.deviceId || 'unknown', metrics: metricsToSend })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            logger.success(`Enviadas ${metricsToSend.length} métricas de performance para o servidor.`);
        } catch (error) {
            logger.error(`Falha ao enviar métricas para o servidor: ${error.message}. Métricas podem ser perdidas.`);
            // Opcional: Adicionar métricas de volta ao buffer ou salvar em localStorage para re-tentar
        }
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        setMark: setMark,
        measure: measure,
        recordMetric: recordMetric, // Para registrar métricas customizadas diretamente
        sendMetricsNow: sendMetricsToServer, // Força o envio imediato
        getBufferedMetrics: () => [...performanceMetricsBuffer], // Para depuração
        getMarks: () => new Map(performanceMarks), // Para depuração
        config: PERFORMANCE_CONFIG // Expor configurações para ajuste ou leitura
    };
})();