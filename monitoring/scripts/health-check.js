/**
 * RC Construções - Health Check Manager (Revisado e Aprimorado)
 * Monitora a saúde de endpoints de serviço através de requisições periódicas.
 * Registra status, latência e emite alertas em caso de falha.
 * Aprimorado para robustez, configuração dinâmica e integração com módulos core.
 */

(function() {
    'use strict';

    let logger; // Instância do SystemLogger
    let eventHandler; // Instância do SystemEventHandler
    let authManager; // Para obter contexto de usuário, se necessário (ex: para logs)
    let notificationsModule; // Para exibir notificações de alerta na UI

    const HEALTH_CHECK_CONFIG = {
        defaultInterval: 30 * 1000, // Intervalo padrão para checks (30 segundos)
        defaultTimeout: 5 * 1000,   // Timeout padrão para requisições (5 segundos)
        maxConsecutiveFailures: 3,  // Número de falhas consecutivas antes de marcar como DOWN
        metricsHistoryLimit: 100,   // Número de métricas de tempo de resposta a manter
        // Limiares de tempo de resposta (em ms)
        responseTimeThresholds: {
            warning: 1000, // Aviso se > 1s
            critical: 3000 // Crítico se > 3s
        }
        // Endpoint para reportar health checks ao backend, se houver
        // reportEndpoint: '/api/monitoring/health-report'
    };

    class HealthCheckManager {
        constructor() {
            this.endpoints = new Map(); // Map<name, {url, interval, timeout, timerId, consecutiveFailures, status, lastCheck, lastSuccess, lastFailure, metrics}>
            this.systemHealthStatus = 'unknown'; // 'healthy', 'degraded', 'unhealthy'
            this.isInitialized = false;
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
                        setTimeout(checkGlobal, 50); // Tenta novamente em 50ms
                    }
                };
                checkGlobal();
            });
        }

        /**
         * Inicializa o Health Check Manager.
         * @returns {Promise<void>}
         */
        async init() {
            if (this.isInitialized) {
                console.warn('HealthCheckManager já está inicializado. Ignorando.');
                return;
            }

            try {
                logger = await this.waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('HealthCheck'));
                eventHandler = await this.waitForGlobal('SystemEventHandler');
                authManager = await this.waitForGlobal('AuthManager').catch(() => null);
                notificationsModule = await this.waitForGlobal('NotificationsModule').catch(() => null);

                logger.info('💖 Health Check Manager inicializando...');

                // Adiciona endpoints padrão (pode ser carregado de uma configuração externa)
                this.addEndpoint({ name: 'Backend API', url: '/api/auth/me', interval: 15000, timeout: 5000 }); // Exemplo: um endpoint leve
                this.addEndpoint({ name: 'Frontend Asset', url: '/favicon.ico', interval: 10000, timeout: 3000 });

                logger.info('✅ Health Check Manager inicializado!');
                this.isInitialized = true;
            } catch (error) {
                console.error('Erro crítico ao inicializar Health Check Manager:', error);
                (logger || console).error('Falha na inicialização do Health Check Manager. O monitoramento de saúde pode não funcionar.');
            }
        }

        /**
         * Adiciona um endpoint para ser monitorado.
         * @param {Object} options - Configurações do endpoint.
         * @param {string} options.name - Nome único do endpoint (ex: 'Backend API').
         * @param {string} options.url - URL do endpoint a ser verificado.
         * @param {number} [options.interval] - Intervalo de verificação em ms (padrão: defaultInterval).
         * @param {number} [options.timeout] - Timeout da requisição em ms (padrão: defaultTimeout).
         * @param {string} [options.method='GET'] - Método HTTP para a requisição.
         * @param {Object} [options.headers={}] - Cabeçalhos adicionais para a requisição.
         */
        addEndpoint(options) {
            if (this.endpoints.has(options.name)) {
                logger.warn(`Endpoint '${options.name}' já existe. Ignorando adição.`);
                return;
            }

            const endpoint = {
                name: options.name,
                url: options.url,
                interval: options.interval || HEALTH_CHECK_CONFIG.defaultInterval,
                timeout: options.timeout || HEALTH_CHECK_CONFIG.defaultTimeout,
                method: options.method || 'GET',
                headers: options.headers || {},
                timerId: null,
                consecutiveFailures: 0,
                status: 'unknown', // 'up', 'down', 'degraded'
                lastCheck: null,
                lastSuccess: null,
                lastFailure: null,
                metrics: [] // Histórico de tempo de resposta e status
            };

            this.endpoints.set(endpoint.name, endpoint);
            this.startChecking(endpoint.name);
            logger.info(`Endpoint '${endpoint.name}' adicionado para monitoramento.`);
        }

        /**
         * Remove um endpoint do monitoramento.
         * @param {string} name - Nome do endpoint a ser removido.
         */
        removeEndpoint(name) {
            const endpoint = this.endpoints.get(name);
            if (endpoint) {
                clearInterval(endpoint.timerId);
                this.endpoints.delete(name);
                logger.info(`Endpoint '${name}' removido do monitoramento.`);
            } else {
                logger.warn(`Tentativa de remover endpoint '${name}' que não existe.`);
            }
        }

        /**
         * Inicia o processo de verificação periódica para um endpoint.
         * @param {string} name - Nome do endpoint.
         */
        startChecking(name) {
            const endpoint = this.endpoints.get(name);
            if (endpoint) {
                if (endpoint.timerId) {
                    clearInterval(endpoint.timerId);
                }
                endpoint.timerId = setInterval(() => this.checkEndpoint(name), endpoint.interval);
                // Executa a primeira verificação imediatamente
                this.checkEndpoint(name);
                logger.debug(`Verificação para '${name}' iniciada a cada ${endpoint.interval / 1000}s.`);
            }
        }

        /**
         * Realiza a verificação de saúde para um endpoint específico.
         * @param {string} name - Nome do endpoint.
         * @returns {Promise<void>}
         */
        async checkEndpoint(name) {
            const endpoint = this.endpoints.get(name);
            if (!endpoint) return;

            const startTime = Date.now();
            let newStatus = 'unknown';
            let errorMessage = '';

            try {
                // Adiciona token de autenticação se disponível
                if (authManager && authManager.isAuthenticated()) {
                    const token = authManager.getToken();
                    if (token) {
                        endpoint.headers['Authorization'] = `Bearer ${token}`;
                    }
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);

                const response = await fetch(endpoint.url, {
                    method: endpoint.method,
                    headers: endpoint.headers,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                const duration = Date.now() - startTime;
                const statusCode = response.status;

                endpoint.metrics.push({ timestamp: Date.now(), value: duration, status: statusCode });
                if (endpoint.metrics.length > HEALTH_CHECK_CONFIG.metricsHistoryLimit) {
                    endpoint.metrics.shift(); // Remove o mais antigo
                }

                if (response.ok) { // Status 2xx
                    newStatus = 'up';
                    endpoint.lastSuccess = Date.now();
                    endpoint.consecutiveFailures = 0;
                    logger.debug(`Health check para '${endpoint.name}' bem-sucedido. Status: ${statusCode}, Latência: ${duration}ms`);
                } else if (statusCode >= 400 && statusCode < 500) {
                    newStatus = 'degraded';
                    endpoint.consecutiveFailures++;
                    errorMessage = `Client error: ${statusCode}`;
                    logger.warn(`Health check para '${endpoint.name}' degradado. Status: ${statusCode}, Latência: ${duration}ms`);
                } else { // 5xx ou outros erros
                    newStatus = 'down';
                    endpoint.consecutiveFailures++;
                    errorMessage = `Server error: ${statusCode}`;
                    logger.error(`Health check para '${endpoint.name}' falhou. Status: ${statusCode}, Latência: ${duration}ms`);
                }

            } catch (error) {
                clearTimeout(timeoutId); // Limpa o timeout em caso de erro de rede/abort
                newStatus = 'down';
                endpoint.consecutiveFailures++;
                errorMessage = `Network error: ${error.message}`;
                if (error.name === 'AbortError') {
                    errorMessage = `Timeout: ${endpoint.timeout}ms excedido.`;
                    logger.error(`Health check para '${endpoint.name}' atingiu o timeout.`, errorMessage);
                } else {
                    logger.error(`Health check para '${endpoint.name}' falhou: ${error.message}`);
                }
            } finally {
                endpoint.lastCheck = Date.now();
                const oldStatus = endpoint.status;
                endpoint.status = newStatus;

                // Notifica apenas se o status mudou ou se é um erro crítico persistente
                if (oldStatus !== newStatus || (newStatus === 'down' && endpoint.consecutiveFailures >= HEALTH_CHECK_CONFIG.maxConsecutiveFailures)) {
                    this.notifyStatusChange(endpoint, errorMessage);
                }
                this.updateSystemHealth(); // Atualiza a saúde geral do sistema
            }
        }

        /**
         * Notifica sobre a mudança de status de um endpoint.
         * @param {Object} endpoint - O objeto do endpoint.
         * @param {string} [errorMessage=''] - Mensagem de erro adicional.
         */
        notifyStatusChange(endpoint, errorMessage = '') {
            logger.info(`Status de saúde do endpoint '${endpoint.name}' mudou para: ${endpoint.status.toUpperCase()}`);
            eventHandler.emit('endpointHealthChanged', {
                name: endpoint.name,
                status: endpoint.status,
                consecutiveFailures: endpoint.consecutiveFailures,
                message: errorMessage
            });

            // Exibir notificação visual para o usuário
            if (notificationsModule && (endpoint.status === 'down' || endpoint.status === 'degraded' || endpoint.consecutiveFailures >= HEALTH_CHECK_CONFIG.maxConsecutiveFailures)) {
                let alertMessage = `O serviço '${endpoint.name}' está ${endpoint.status}.`;
                if (errorMessage) alertMessage += ` Detalhes: ${errorMessage}`;
                
                if (endpoint.status === 'down' && endpoint.consecutiveFailures >= HEALTH_CHECK_CONFIG.maxConsecutiveFailures) {
                    notificationsModule.showError(`Serviço Indisponível: ${endpoint.name}`, alertMessage, { toast: false, duration: 0 }); // Alerta não-toast e persistente
                } else if (endpoint.status === 'degraded') {
                    notificationsModule.showWarning(`Serviço Degradado: ${endpoint.name}`, alertMessage, { toast: true });
                }
            }
        }

        /**
         * Atualiza o status de saúde geral do sistema.
         * Baseado no status de todos os endpoints monitorados.
         */
        updateSystemHealth() {
            let totalEndpoints = 0;
            let healthyEndpoints = 0;
            let degradedEndpoints = 0;
            let downEndpoints = 0;

            for (const endpoint of this.endpoints.values()) {
                totalEndpoints++;
                if (endpoint.status === 'up') {
                    healthyEndpoints++;
                } else if (endpoint.status === 'degraded') {
                    degradedEndpoints++;
                } else if (endpoint.status === 'down') {
                    downEndpoints++;
                }
            }

            let newSystemStatus = 'healthy';
            if (downEndpoints > 0) {
                newSystemStatus = 'unhealthy';
            } else if (degradedEndpoints > 0) {
                newSystemStatus = 'degraded';
            }

            if (this.systemHealthStatus !== newSystemStatus) {
                this.systemHealthStatus = newSystemStatus;
                logger.info(`Status de saúde do sistema: ${newSystemStatus.toUpperCase()}. (Up: ${healthyEndpoints}, Degraded: ${degradedEndpoints}, Down: ${downEndpoints})`);
                eventHandler.emit('systemHealthChanged', { status: newSystemStatus, details: { totalEndpoints, healthyEndpoints, degradedEndpoints, downEndpoints } });
            }
        }

        /**
         * Obtém o status de saúde geral do sistema.
         * @returns {string} 'healthy', 'degraded', 'unhealthy', 'unknown'.
         */
        getHealthStatus() {
            return this.systemHealthStatus;
        }

        /**
         * Obtém métricas detalhadas de um endpoint.
         * @param {string} name - Nome do endpoint.
         * @returns {Object|null} Métricas do endpoint ou null.
         */
        getEndpointMetrics(name) {
            const endpoint = this.endpoints.get(name);
            if (!endpoint) {
                logger.warn(`Métricas solicitadas para endpoint inexistente: ${name}`);
                return null;
            }
            // Retorna uma cópia para evitar modificações externas
            return { ...endpoint, metrics: [...endpoint.metrics] };
        }

        /**
         * Obtém todos os endpoints monitorados com seus status atuais.
         * @returns {Array<Object>} Lista de endpoints.
         */
        getAllEndpointsStatus() {
            return Array.from(this.endpoints.values()).map(ep => ({
                name: ep.name,
                url: ep.url,
                status: ep.status,
                lastCheck: ep.lastCheck,
                consecutiveFailures: ep.consecutiveFailures,
                lastLatency: ep.metrics.length > 0 ? ep.metrics[ep.metrics.length - 1].value : null
            }));
        }
    }

    // Expõe a instância do HealthCheckManager globalmente
    // O init_system_js.js se encarregará de chamar .init()
    window.HealthCheckManager = new HealthCheckManager();
})();