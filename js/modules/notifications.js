/**
 * RC Construções - Módulo de Notificações (Revisado e Aprimorado)
 * Gerencia a exibição de mensagens de feedback ao usuário (sucesso, erro, aviso, info).
 * Pode integrar-se com bibliotecas de terceiros (SweetAlert2) para notificações mais ricas
 * e gerenciar notificações de status (offline).
 * Aprimorado para robustez, flexibilidade e integração com o SystemLogger.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let isInitialized = false;
    let swalAvailable = false; // Flag para verificar se SweetAlert2 está disponível

    const NOTIFICATION_CONFIG = {
        defaultToastDuration: 3000, // Duração padrão para toasts em milissegundos
        position: 'bottom-end', // Posição padrão para toasts (ex: 'top-end', 'bottom-start')
        // Configurações para a notificação de offline na UI (elemento HTML)
        offlineNotificationId: 'offline-notification',
        offlineIconClass: 'fas fa-wifi-slash',
        offlineMessage: 'Você está offline. Algumas funcionalidades podem estar limitadas.'
    };

    let offlineNotificationElement; // Referência ao elemento da notificação offline

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
     * Inicializa o Módulo de Notificações.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('NotificationsModule já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('NotificationsModule'));
            
            // Verifica se SweetAlert2 está disponível
            try {
                const Swal = await Promise.race([
                    waitForGlobal('Swal'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('SweetAlert2 timeout')), 1000))
                ]);
                if (Swal && typeof Swal.fire === 'function') {
                    swalAvailable = true;
                    logger.info('SweetAlert2 detectado e disponível para notificações ricas.');
                }
            } catch (e) {
                logger.warn(`SweetAlert2 não disponível para notificações ricas: ${e.message}. Usando notificações padrão.`);
                swalAvailable = false;
            }

            // Obtém a referência para o elemento da notificação offline
            offlineNotificationElement = document.getElementById(NOTIFICATION_CONFIG.offlineNotificationId);
            if (offlineNotificationElement) {
                // Adiciona o ícone e a mensagem padrão, se ainda não existirem
                if (!offlineNotificationElement.querySelector('i')) {
                    const icon = document.createElement('i');
                    icon.className = NOTIFICATION_CONFIG.offlineIconClass;
                    offlineNotificationElement.prepend(icon);
                }
                if (!offlineNotificationElement.querySelector('span')) {
                    const span = document.createElement('span');
                    span.textContent = NOTIFICATION_CONFIG.offlineMessage;
                    offlineNotificationElement.append(span);
                }
            } else {
                logger.warn(`Elemento de notificação offline com ID '${NOTIFICATION_CONFIG.offlineNotificationId}' não encontrado no DOM.`);
            }

            // Configura listeners para status de rede
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
            updateOnlineStatus(); // Chama uma vez para definir o status inicial

            logger.info('🔔 Módulo de Notificações inicializado.');
            isInitialized = true;
        } catch (error) {
            console.error('Erro crítico ao inicializar NotificationsModule:', error);
            (logger || console).error('Falha na inicialização do NotificationsModule. Notificações podem não funcionar.');
            isInitialized = false;
        }
    }

    /**
     * Exibe uma notificação de sucesso.
     * @param {string} title - Título da notificação.
     * @param {string} message - Mensagem da notificação.
     * @param {Object} [options={}] - Opções adicionais (ex: duration para toasts).
     */
    function showSuccess(title, message, options = {}) {
        logger.info(`Notificação de Sucesso: ${title} - ${message}`, options);
        if (swalAvailable) {
            Swal.fire({
                title: title,
                text: message,
                icon: 'success',
                toast: options.toast || true,
                position: options.position || NOTIFICATION_CONFIG.position,
                timer: options.duration || NOTIFICATION_CONFIG.defaultToastDuration,
                timerProgressBar: true,
                showConfirmButton: false,
                ...options // Sobrescreve com opções customizadas
            });
        } else {
            // Fallback para notificação simples ou log
            showFallbackNotification(title, message, 'success', options.duration);
        }
    }

    /**
     * Exibe uma notificação de erro.
     * @param {string} title - Título da notificação.
     * @param {string} message - Mensagem da notificação.
     * @param {Object} [options={}] - Opções adicionais.
     */
    function showError(title, message, options = {}) {
        logger.error(`Notificação de Erro: ${title} - ${message}`, options);
        if (swalAvailable) {
            Swal.fire({
                title: title,
                text: message,
                icon: 'error',
                toast: options.toast || true,
                position: options.position || NOTIFICATION_CONFIG.position,
                timer: options.toast ? (options.duration || NOTIFICATION_CONFIG.defaultToastDuration * 2) : undefined, // Erros duram mais
                timerProgressBar: options.toast || false,
                showConfirmButton: options.toast ? false : true, // Botão de confirmação para erros não-toast
                ...options
            });
        } else {
            showFallbackNotification(title, message, 'error', options.duration);
        }
    }

    /**
     * Exibe uma notificação de aviso.
     * @param {string} title - Título da notificação.
     * @param {string} message - Mensagem da notificação.
     * @param {Object} [options={}] - Opções adicionais.
     */
    function showWarning(title, message, options = {}) {
        logger.warn(`Notificação de Aviso: ${title} - ${message}`, options);
        if (swalAvailable) {
            Swal.fire({
                title: title,
                text: message,
                icon: 'warning',
                toast: options.toast || true,
                position: options.position || NOTIFICATION_CONFIG.position,
                timer: options.duration || NOTIFICATION_CONFIG.defaultToastDuration,
                timerProgressBar: true,
                showConfirmButton: false,
                ...options
            });
        } else {
            showFallbackNotification(title, message, 'warning', options.duration);
        }
    }

    /**
     * Exibe uma notificação de informação.
     * @param {string} title - Título da notificação.
     * @param {string} message - Mensagem da notificação.
     * @param {Object} [options={}] - Opções adicionais.
     */
    function showInfo(title, message, options = {}) {
        logger.info(`Notificação de Informação: ${title} - ${message}`, options);
        if (swalAvailable) {
            Swal.fire({
                title: title,
                text: message,
                icon: 'info',
                toast: options.toast || true,
                position: options.position || NOTIFICATION_CONFIG.position,
                timer: options.duration || NOTIFICATION_CONFIG.defaultToastDuration,
                timerProgressBar: true,
                showConfirmButton: false,
                ...options
            });
        } else {
            showFallbackNotification(title, message, 'info', options.duration);
        }
    }

    /**
     * Função de fallback para exibir notificações se SweetAlert2 não estiver disponível.
     * Basicamente, loga no console e pode adicionar/remover uma div simples.
     * @param {string} title - Título.
     * @param {string} message - Mensagem.
     * @param {string} type - Tipo (success, error, warning, info).
     * @param {number} duration - Duração em ms.
     */
    function showFallbackNotification(title, message, type, duration = 3000) {
        console.log(`[${type.toUpperCase()} Notification] ${title}: ${message}`);
        // Implemente uma lógica de DOM simples aqui se quiser uma UI fallback.
        // Por exemplo, criar/mostrar um div flutuante com a classe 'notification type'.
        let fallbackDiv = document.getElementById('fallback-notification-div');
        if (!fallbackDiv) {
            fallbackDiv = document.createElement('div');
            fallbackDiv.id = 'fallback-notification-div';
            fallbackDiv.className = 'notification fallback-notification'; // Adicione estilos em components.css ou modern_main_css.css
            document.body.appendChild(fallbackDiv);
        }
        fallbackDiv.textContent = `${title}: ${message}`;
        fallbackDiv.className = `notification fallback-notification ${type} show`;
        
        setTimeout(() => {
            fallbackDiv.classList.remove('show');
            // fallbackDiv.remove(); // Opcional: remover do DOM
        }, duration);
    }

    /**
     * Atualiza o status da notificação offline na UI.
     */
    function updateOnlineStatus() {
        if (!offlineNotificationElement) {
            logger.warn('Elemento de notificação offline não encontrado para atualização.');
            return;
        }

        const isOnline = navigator.onLine;
        offlineNotificationElement.style.display = isOnline ? 'none' : 'flex'; // Usar flex para ícone/texto
        offlineNotificationElement.classList.toggle('show', !isOnline); // Adiciona/remove 'show' para animação

        if (isOnline) {
            logger.info('Status de rede: Online. Notificação offline escondida.');
        } else {
            logger.warn('Status de rede: Offline. Notificação offline visível.');
        }
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        showSuccess: showSuccess,
        showError: showError,
        showWarning: showWarning,
        showInfo: showInfo,
        updateOnlineStatus: updateOnlineStatus, // Para ser chamado externamente se necessário
        config: NOTIFICATION_CONFIG // Expõe a configuração
    };
})();