/**
 * RC Construções - Alert Manager (Revisado e Aprimorado)
 * Gerencia a criação, status, notificação e histórico de alertas no sistema de monitoramento.
 * Integrado com WebSockets para alertas em tempo real e com SystemLogger para auditoria.
 */

(function() {
    'use strict';

    let logger; // Instância do SystemLogger
    let eventHandler; // Instância do SystemEventHandler
    let authManager; // Para obter o usuário atual
    let notificationsModule; // Para exibir alertas na UI

    const ALERT_CONFIG = {
        maxAlertsHistory: 1000, // Máximo de alertas para manter em memória
        cleanupInterval: 60 * 60 * 1000, // Limpa alertas expirados a cada hora
        websocketEndpoint: 'ws://localhost:3000/alerts', // Endpoint WebSocket para receber alertas
        reconnectDelay: 2000, // Atraso para tentar reconectar WebSocket
        notificationTimeout: 5000 // Duração da notificação de alerta na UI
    };

    // Estados possíveis de um alerta
    const ALERT_STATUS = {
        ACTIVE: 'active',      // Alerta está ativo e não resolvido
        RESOLVED: 'resolved',  // Alerta foi resolvido
        ACKNOWLEDGED: 'acknowledged', // Alerta foi visto/reconhecido
        SILENCED: 'silenced'   // Alerta foi silenciado por um período
    };

    // Níveis de severidade
    const SEVERITY_LEVELS = {
        CRITICAL: 'critical',
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low',
        INFO: 'info'
    };

    class AlertManager {
        constructor() {
            this.alerts = new Map(); // Mapa para armazenar alertas por ID
            this.subscribers = new Set(); // Funções de callback para notificar
            this.ws = null; // Instância do WebSocket
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
                        setTimeout(checkGlobal, 50);
                    }
                };
                checkGlobal();
            });
        }

        /**
         * Inicializa o Alert Manager.
         * Carrega dependências e configura listeners.
         * @returns {Promise<void>}
         */
        async init() {
            if (this.isInitialized) {
                console.warn('AlertManager já está inicializado. Ignorando.');
                return;
            }

            try {
                logger = await this.waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('AlertManager'));
                eventHandler = await this.waitForGlobal('SystemEventHandler');
                authManager = await this.waitForGlobal('AuthManager').catch(() => null);
                notificationsModule = await this.waitForGlobal('NotificationsModule').catch(() => null);

                logger.info('🔔 Alert Manager inicializando...');

                this.initializeWebSocket();
                this.startCleanupInterval();
                
                logger.info('✅ Alert Manager inicializado!');
                this.isInitialized = true;
            } catch (error) {
                console.error('Erro crítico ao inicializar Alert Manager:', error);
                (logger || console).error('Falha na inicialização do Alert Manager. Alertas podem não ser processados.');
            }
        }

        /**
         * Inicializa a conexão WebSocket para receber alertas em tempo real.
         */
        initializeWebSocket() {
            if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
                logger.debug('WebSocket já está conectado ou conectando.');
                return;
            }

            // Usar wss:// em produção
            const wsUrl = window.location.protocol === 'https:' ? 
                          ALERT_CONFIG.websocketEndpoint.replace('ws:', 'wss:') : 
                          ALERT_CONFIG.websocketEndpoint;

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                logger.info('WebSocket conectado ao servidor de alertas.');
                this.requestInitialAlerts(); // Solicita alertas iniciais ao conectar
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    logger.error(`Erro ao parsear mensagem WebSocket: ${error.message}`, event.data);
                }
            };

            this.ws.onerror = (error) => {
                logger.error('Erro no WebSocket de alertas:', error);
            };

            this.ws.onclose = (event) => {
                logger.warn(`WebSocket de alertas fechado (Código: ${event.code}, Razão: ${event.reason}). Tentando reconectar...`);
                // Tenta reconectar após um atraso
                setTimeout(() => this.initializeWebSocket(), ALERT_CONFIG.reconnectDelay);
            };
        }

        /**
         * Solicita alertas iniciais do servidor WebSocket ao conectar.
         * Assume que o servidor tem uma forma de enviar um "snapshot" de alertas ativos.
         */
        requestInitialAlerts() {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const token = authManager ? authManager.getToken() : null;
                this.ws.send(JSON.stringify({ type: 'REQUEST_ALERTS', token: token, lastSync: Date.now() }));
                logger.debug('Solicitado alertas iniciais via WebSocket.');
            }
        }

        /**
         * Lida com mensagens recebidas via WebSocket.
         * @param {Object} message - Objeto da mensagem recebida.
         */
        handleWebSocketMessage(message) {
            switch (message.type) {
                case 'NEW_ALERT':
                    this.createAlert(message.alert);
                    break;
                case 'UPDATE_ALERT':
                    this.updateAlert(message.alert);
                    break;
                case 'RESOLVE_ALERT':
                    this.resolveAlert(message.alertId);
                    break;
                case 'INITIAL_ALERTS':
                    logger.info(`Recebidos ${message.alerts.length} alertas iniciais.`);
                    message.alerts.forEach(alert => this.createAlert(alert, true)); // 'true' para não notificar cada um
                    break;
                default:
                    logger.debug('Tipo de mensagem WebSocket desconhecido:', message.type, message);
            }
        }

        /**
         * Cria um novo alerta e o adiciona ao gerenciador.
         * @param {Object} alertData - Dados do alerta (id, severity, type, message, details, createdAt).
         * @param {boolean} [silent=false] - Se true, não exibe notificação visual.
         * @returns {Object} O alerta criado.
         */
        createAlert(alertData, silent = false) {
            const newAlert = {
                id: alertData.id || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                severity: alertData.severity || SEVERITY_LEVELS.INFO,
                type: alertData.type || 'system',
                message: alertData.message || 'Alerta sem mensagem.',
                details: alertData.details || {},
                status: ALERT_STATUS.ACTIVE,
                createdAt: alertData.createdAt || Date.now(),
                updatedAt: Date.now(),
                acknowledgedBy: null,
                resolvedAt: null
            };

            this.alerts.set(newAlert.id, newAlert);
            logger.info(`Novo alerta criado: ${newAlert.message}`, newAlert);
            this.notifySubscribers('created', newAlert);

            if (!silent && notificationsModule) {
                notificationsModule.showError(
                    `ALERTA: ${newAlert.severity.toUpperCase()} - ${newAlert.type.toUpperCase()}`,
                    newAlert.message,
                    { icon: this.getIconForSeverity(newAlert.severity), toast: true, duration: ALERT_CONFIG.notificationTimeout }
                );
            }
            return newAlert;
        }

        /**
         * Atualiza um alerta existente.
         * @param {Object} updatedAlertData - Dados atualizados do alerta (requer id).
         * @returns {Object|null} O alerta atualizado, ou null se não encontrado.
         */
        updateAlert(updatedAlertData) {
            const existingAlert = this.alerts.get(updatedAlertData.id);
            if (!existingAlert) {
                logger.warn(`Tentativa de atualizar alerta inexistente (ID: ${updatedAlertData.id}).`);
                return null;
            }

            Object.assign(existingAlert, { ...updatedAlertData, updatedAt: Date.now() });
            this.alerts.set(existingAlert.id, existingAlert);
            logger.info(`Alerta atualizado (ID: ${existingAlert.id}): ${existingAlert.message}`, existingAlert);
            this.notifySubscribers('updated', existingAlert);
            return existingAlert;
        }

        /**
         * Marca um alerta como reconhecido.
         * @param {string} alertId - ID do alerta.
         * @param {string} [acknowledgedBy] - Usuário que reconheceu (obtido do AuthManager).
         * @returns {Object|null} O alerta atualizado.
         */
        acknowledgeAlert(alertId, acknowledgedBy = this.getCurrentUser().username || 'Desconhecido') {
            const alert = this.alerts.get(alertId);
            if (alert && alert.status === ALERT_STATUS.ACTIVE) {
                alert.status = ALERT_STATUS.ACKNOWLEDGED;
                alert.acknowledgedBy = acknowledgedBy;
                alert.updatedAt = Date.now();
                this.alerts.set(alertId, alert);
                logger.info(`Alerta ${alertId} reconhecido por ${acknowledgedBy}.`, alert);
                this.notifySubscribers('acknowledged', alert);
                return alert;
            }
            logger.warn(`Alerta ${alertId} não encontrado ou já processado para reconhecimento.`);
            return null;
        }

        /**
         * Marca um alerta como resolvido.
         * @param {string} alertId - ID do alerta.
         * @returns {Object|null} O alerta resolvido.
         */
        resolveAlert(alertId) {
            const alert = this.alerts.get(alertId);
            if (alert && alert.status !== ALERT_STATUS.RESOLVED) {
                alert.status = ALERT_STATUS.RESOLVED;
                alert.resolvedAt = Date.now();
                alert.updatedAt = Date.now();
                this.alerts.set(alertId, alert);
                logger.info(`Alerta ${alertId} resolvido.`, alert);
                this.notifySubscribers('resolved', alert);
                return alert;
            }
            logger.warn(`Alerta ${alertId} não encontrado ou já resolvido.`);
            return null;
        }

        /**
         * Obtém todos os alertas ativos (não resolvidos).
         * @returns {Array<Object>} Lista de alertas ativos.
         */
        getActiveAlerts() {
            return Array.from(this.alerts.values()).filter(alert => alert.status === ALERT_STATUS.ACTIVE);
        }

        /**
         * Obtém estatísticas de alertas.
         * @returns {Object} Estatísticas por status e severidade.
         */
        getAlertStats() {
            const stats = {
                total: this.alerts.size,
                active: 0,
                resolved: 0,
                acknowledged: 0,
                bySeverity: {},
                byType: {}
            };

            for (const alert of this.alerts.values()) {
                stats[alert.status]++;
                
                stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
                stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
            }
            logger.debug('Estatísticas de alertas:', stats);
            return stats;
        }

        /**
         * Inscreve uma função para ser notificada sobre mudanças nos alertas.
         * @param {Function} callback - Função a ser chamada (action, alertObject).
         * @returns {Function} Função para desinscrever.
         */
        subscribe(callback) {
            this.subscribers.add(callback);
            logger.debug('Novo inscrito para alertas. Total:', this.subscribers.size);
            return () => {
                this.subscribers.delete(callback);
                logger.debug('Inscrito removido para alertas. Total:', this.subscribers.size);
            };
        }

        /**
         * Notifica todos os inscritos.
         * @param {string} action - Tipo de ação ('created', 'updated', 'resolved', 'acknowledged').
         * @param {Object} alertObject - O objeto de alerta.
         */
        notifySubscribers(action, alertObject) {
            this.subscribers.forEach(callback => {
                try {
                    callback(action, alertObject);
                } catch (error) {
                    logger.error(`Erro ao notificar inscrito sobre alerta ${alertObject.id}: ${error.message}`);
                }
            });
        }

        /**
         * Inicia o intervalo de limpeza de alertas antigos.
         */
        startCleanupInterval() {
            setInterval(() => {
                const now = Date.now();
                // Remove alertas resolvidos que estão muito antigos (ex: mais de 1 dia)
                for (const [id, alert] of this.alerts.entries()) {
                    if (alert.status === ALERT_STATUS.RESOLVED && (now - alert.resolvedAt > ALERT_CONFIG.cleanupInterval)) {
                        this.alerts.delete(id);
                        logger.debug(`Alerta resolvido antigo (${id}) removido do histórico.`);
                    }
                }
                logger.debug(`Limpeza de histórico de alertas executada. Total de alertas: ${this.alerts.size}.`);
            }, ALERT_CONFIG.cleanupInterval);
        }

        /**
         * Obtém o usuário atual logado (se AuthManager estiver disponível).
         * @returns {Object|null} Objeto do usuário ou null.
         */
        getCurrentUser() {
            if (authManager && authManager.isAuthenticated()) {
                return authManager.getCurrentUser();
            }
            return null; // ou um objeto de usuário anônimo
        }

        /**
         * Retorna o ícone apropriado para cada severidade.
         */
        getIconForSeverity(severity) {
            switch (severity) {
                case SEVERITY_LEVELS.CRITICAL: return 'fas fa-exclamation-circle';
                case SEVERITY_LEVELS.HIGH: return 'fas fa-exclamation-triangle';
                case SEVERITY_LEVELS.MEDIUM: return 'fas fa-exclamation';
                case SEVERITY_LEVELS.LOW: return 'fas fa-info-circle';
                case SEVERITY_LEVELS.INFO: return 'fas fa-bell';
                default: return 'fas fa-question-circle';
            }
        }
    }

    // Expõe a instância do AlertManager globalmente
    // O init_system_js.js se encarregará de chamar .init()
    window.AlertManager = new AlertManager();
})();