/**
 * RC Construções - Dashboard Enhancements (Revisado e Aprimorado)
 * Este arquivo contém lógicas JavaScript para aprimoramentos visuais e interativos no dashboard.
 * Inclui gerenciamento de data, carregamento de dados simulado e animações.
 * Corrigido para garantir que as operações no DOM ocorram APÓS a renderização do HTML dinâmico.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let utilsManager; // Para formatação de datas
    let eventHandler; // Para listeners de eventos globais
    let isInitialized = false;

    // Elementos do DOM (serão preenchidos por setupDashboardElements)
    let startDateInput;
    let endDateInput;
    let applyDateFilterButton;
    let statsGrid; // Usado para animação e placeholders
    let offlineNotificationElement;

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
     * Inicializa o módulo Dashboard Enhancements.
     * Esta função será chamada uma vez na inicialização geral do sistema.
     */
    async function init() {
        if (isInitialized) {
            console.warn('DashboardEnhancements já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('DashboardEnhancements'));
            utilsManager = await waitForGlobal('UtilsManager');
            eventHandler = await waitForGlobal('SystemEventHandler');

            logger.info('✨ Módulo Dashboard Enhancements inicializado.');

            // Setup da notificação offline é feito aqui uma vez
            offlineNotificationElement = document.getElementById('offline-notification');
            if (offlineNotificationElement) {
                window.addEventListener('online', updateOnlineStatus);
                window.addEventListener('offline', updateOnlineStatus);
                updateOnlineStatus(); // Define o status inicial
            } else {
                logger.warn('Elemento de notificação offline (#offline-notification) não encontrado no DOM.');
            }

            isInitialized = true;
        } catch (error) {
            console.error('Erro crítico ao inicializar Dashboard Enhancements:', error);
            (logger || console).error('Falha na inicialização do Dashboard Enhancements. Animações e funcionalidades adicionais podem não estar disponíveis.');
            isInitialized = false;
        }
    }

    /**
     * Configura os elementos do DOM e listeners APÓS o HTML do dashboard ter sido carregado.
     * Esta função é o ponto de entrada principal para a UI do dashboard e será chamada pelo index.html.
     */
    function setupDashboardElements() {
        if (!isInitialized) {
            logger.error('Dashboard Enhancements não inicializado. Não é possível configurar elementos do dashboard.');
            return;
        }

        logger.info('Configurando elementos e eventos do dashboard...');

        // Obtém as referências dos elementos do DOM
        startDateInput = document.getElementById('start-date');
        endDateInput = document.getElementById('end-date');
        applyDateFilterButton = document.querySelector('.date-range-picker .btn');
        statsGrid = document.getElementById('stats-grid');
        
        // Garante que os inputs de data existam antes de manipulá-los
        if (startDateInput && endDateInput) {
            setDefaultDates(); // Define as datas padrão
        } else {
            logger.warn('Inputs de data (start-date, end-date) não encontrados no dashboard.');
        }

        // Adiciona evento para o botão de aplicar filtro de data
        if (applyDateFilterButton) {
            // Remove listener anterior para evitar duplicação se a página for recarregada via AJAX
            applyDateFilterButton.removeEventListener('click', handleDateFilterApply); 
            applyDateFilterButton.addEventListener('click', handleDateFilterApply);
        } else {
            logger.warn('Botão de aplicar filtro de data não encontrado no dashboard.');
        }

        // Inicia as animações dos cards de estatísticas
        if (statsGrid) {
            // Um pequeno delay para garantir que os dados estejam visíveis e o layout estável
            setTimeout(animateStatCards, 500); 
        } else {
            logger.warn('Grid de estatísticas (#stats-grid) não encontrado para animações.');
        }
    }

    /**
     * Define as datas padrão nos inputs do filtro (últimos 30 dias).
     */
    function setDefaultDates() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // UtilsManager para formatação segura
        startDateInput.value = utilsManager.formatDate(thirtyDaysAgo, 'YYYY-MM-DD');
        endDateInput.value = utilsManager.formatDate(today, 'YYYY-MM-DD');
        logger.debug(`Datas padrão definidas: ${startDateInput.value} a ${endDateInput.value}`);
    }

    /**
     * Manipulador de evento para o botão de aplicar filtro de data.
     */
    function handleDateFilterApply() {
        if (!startDateInput || !endDateInput) {
            logger.error('Inputs de data ausentes para aplicar filtro.');
            return;
        }

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        // Validação básica do formato de data
        if (!utilsManager.formatDate(startDate, 'YYYY-MM-DD') || !utilsManager.formatDate(endDate, 'YYYY-MM-DD')) {
            logger.warn('Datas do filtro inválidas. Por favor, insira datas válidas.');
            // Exibe um alerta visual para o usuário
            if (window.NotificationsModule && typeof window.NotificationsModule.showWarning === 'function') {
                window.NotificationsModule.showWarning('Datas Inválidas', 'Por favor, selecione um período válido para o filtro.');
            }
            return;
        }
        
        logger.info(`Filtro de data aplicado: ${startDate} a ${endDate}`);
        // Dispara um evento ou chama diretamente a função de carregamento de dados do dashboard
        // A função loadDashboardPage é do módulo dashboard.js
        if (window.dashboardModule && typeof window.dashboardModule.loadDashboardPage === 'function') {
            window.dashboardModule.loadDashboardPage({ startDate, endDate }); // Passa as datas como parâmetro
        } else {
            logger.error('Módulo Dashboard (dashboardModule) não disponível para recarregar dados.');
            if (window.NotificationsModule) {
                window.NotificationsModule.showError('Erro', 'Não foi possível carregar os dados do dashboard. Módulo ausente.');
            }
        }
    }

    /**
     * Anima os valores dos cards de estatísticas.
     */
    function animateStatCards() {
        const statValues = document.querySelectorAll('#stats-grid .stat-value');
        if (statValues.length === 0) {
            logger.debug('Nenhum card de estatística encontrado para animar.');
            return;
        }

        statValues.forEach((element, index) => {
            const originalText = element.textContent;
            // Define o texto inicial como '0' ou 'R$ 0' para a animação
            element.textContent = originalText.includes('R$') ? 'R$ 0,00' : '0'; 
            
            // Pequeno delay para animação sequencial
            setTimeout(() => {
                let targetValue;
                let formatter;

                if (originalText.includes('R$')) {
                    // Remove "R$", pontos e troca vírgula por ponto para parseFloat
                    targetValue = parseFloat(originalText.replace('R$', '').replace(/\./g, '').replace(',', '.'));
                    formatter = (val) => utilsManager.formatCurrency(val); // Usa formatador do Utils
                } else {
                    targetValue = parseInt(originalText);
                    formatter = (val) => Math.round(val).toString();
                }

                if (!isNaN(targetValue)) {
                    animateNumber(element, 0, targetValue, 1500, formatter); // Duração da animação 1.5s
                } else {
                    logger.warn(`Valor do card '${originalText}' não pôde ser animado (não numérico).`);
                    element.textContent = originalText; // Restaura o texto original
                }
            }, index * 200); // 200ms de delay entre cada card
        });
        logger.info('Animação dos cards de estatísticas iniciada.');
    }

    /**
     * Anima um número de um valor inicial para um final.
     * @param {HTMLElement} element - O elemento HTML onde o número será exibido.
     * @param {number} start - O valor inicial da animação.
     * @param {number} end - O valor final da animação.
     * @param {number} duration - Duração da animação em milissegundos.
     * @param {Function} formatter - Função para formatar o número durante a animação (ex: adicionar 'R$').
     */
    function animateNumber(element, start, end, duration, formatter) {
        const startTime = performance.now();
        
        function update() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Função de easing (easeOutQuart) para uma animação mais suave
            const easeOut = 1 - Math.pow(1 - progress, 4); 
            const current = start + (end - start) * easeOut;
            
            element.textContent = formatter(current);
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
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
        offlineNotificationElement.style.display = isOnline ? 'none' : 'flex'; // 'flex' para ícone/texto
        offlineNotificationElement.classList.toggle('show', !isOnline); // Para a animação CSS

        if (isOnline) {
            logger.info('Status de rede: Online. Notificação offline escondida.');
        } else {
            logger.warn('Status de rede: Offline. Notificação offline visível.');
        }
    }

    // Expõe a API pública do módulo
    // A função init será chamada uma vez pelo init_system_js.js
    // A função setupDashboardElements será chamada pelo index.html / ModernAppManager
    window.dashboardEnhancements = {
        init: init, // Ponto de entrada para a inicialização do módulo (uma vez)
        setupDashboardElements: setupDashboardElements // Ponto de entrada para configurar a UI do dashboard (após HTML carregado)
    };
})();