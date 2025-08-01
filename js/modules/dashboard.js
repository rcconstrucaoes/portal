/**
 * RC Construções - Módulo Dashboard (Revisado e Aprimorado)
 * Este arquivo contém a lógica principal para o carregamento, exibição e interação dos dados do dashboard.
 * Aprimorado para ser mais robusto, funcional e integrado com a nova estética,
 * corrigindo o problema de redeclaração de 'dashboardModule'.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let chartsModule; // Módulo Charts.js para criar e gerenciar gráficos
    let validationManager;
    let utilsManager;
    let eventHandler;
    let cloudSync; // Opcional, para sincronização de dados

    // Referências aos elementos do DOM do dashboard (serão obtidas dinamicamente após o carregamento do HTML)
    let startDateInput;
    let endDateInput;
    let applyDateFilterButton;
    let statsGrid;
    let recentActivitiesList;
    let quickSummaryList;

    let financialChartInstance;
    let clientsChartInstance;
    let budgetsChartInstance;

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
     * Inicializa o Módulo Dashboard.
     * Carrega as dependências e prepara o módulo.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('DashboardModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            chartsModule = await waitForGlobal('ChartsModule');
            validationManager = await waitForGlobal('ValidationManager');
            utilsManager = await waitForGlobal('UtilsManager');
            eventHandler = await waitForGlobal('SystemEventHandler');
            cloudSync = await waitForGlobal('CloudSync').catch(() => null); // CloudSync é opcional

            logger.info('📊 Módulo Dashboard inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar DashboardModule:', error);
            (logger || console).error('Falha na inicialização do DashboardModule. O dashboard pode não funcionar corretamente.');
        }
    }

    /**
     * Obtém as referências dos elementos do DOM do dashboard.
     * Esta função deve ser chamada APÓS o HTML do dashboard.html ser injetado no DOM.
     */
    function getDOMElements() {
        startDateInput = document.getElementById('start-date');
        endDateInput = document.getElementById('end-date');
        applyDateFilterButton = document.querySelector('.date-range-picker .btn');
        statsGrid = document.getElementById('stats-grid');
        recentActivitiesList = document.getElementById('recent-activities-list');
        quickSummaryList = document.getElementById('quick-summary-list');
    }

    /**
     * Mostra os placeholders de carregamento enquanto os dados são buscados.
     */
    function showLoadingPlaceholders() {
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="stat-card loading"><div class="stat-icon"><i class="fas fa-spinner fa-spin"></i></div><div class="stat-content"><div class="loading-placeholder large"></div><div class="loading-placeholder small"></div></div></div>
                <div class="stat-card loading"><div class="stat-icon"><i class="fas fa-spinner fa-spin"></i></div><div class="stat-content"><div class="loading-placeholder large"></div><div class="loading-placeholder small"></div></div></div>
                <div class="stat-card loading"><div class="stat-icon"><i class="fas fa-spinner fa-spin"></i></div><div class="stat-content"><div class="loading-placeholder large"></div><div class="loading-placeholder small"></div></div></div>
                <div class="stat-card loading"><div class="stat-icon"><i class="fas fa-spinner fa-spin"></i></div><div class="stat-content"><div class="loading-placeholder large"></div><div class="loading-placeholder small"></div></div></div>
            `;
        }
        if (recentActivitiesList) {
            recentActivitiesList.innerHTML = `
                <li class="loading-placeholder-item"><div class="loading-placeholder medium"></div></li>
                <li class="loading-placeholder-item"><div class="loading-placeholder medium"></div></li>
                <li class="loading-placeholder-item"><div class="loading-placeholder medium"></div></li>
                <li class="loading-placeholder-item"><div class="loading-placeholder medium"></div></li>
            `;
        }
        if (quickSummaryList) {
            quickSummaryList.innerHTML = `
                <div class="summary-item loading"><div class="loading-placeholder small"></div><div class="loading-placeholder small"></div></div>
                <div class="summary-item loading"><div class="loading-placeholder small"></div><div class="loading-placeholder small"></div></div>
                <div class="summary-item loading"><div class="loading-placeholder small"></div><div class="loading-placeholder small"></div></div>
            `;
        }
    }

    /**
     * Define as datas padrão nos inputs do filtro.
     */
    function setDefaultDates() {
        if (!startDateInput || !endDateInput) {
            logger.warn('Inputs de data não encontrados para definir datas padrão.');
            return;
        }
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        startDateInput.value = utilsManager.formatDate(thirtyDaysAgo, 'YYYY-MM-DD');
        endDateInput.value = utilsManager.formatDate(today, 'YYYY-MM-DD');
    }

    /**
     * Renderiza os cards de estatísticas no grid.
     * @param {Array<Object>} data - Os dados para os cards.
     */
    function renderStatCards(data) {
        if (!statsGrid) return;
        statsGrid.innerHTML = ''; // Limpa os placeholders
        data.forEach(stat => {
            const statCard = document.createElement('div');
            statCard.className = `stat-card ${stat.type}`;
            statCard.innerHTML = `
                <div class="stat-icon"><i class="${stat.icon}"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${stat.value}</div>
                    <div class="stat-label">${stat.label}</div>
                </div>
            `;
            statsGrid.appendChild(statCard);
        });
    }

    /**
     * Inicializa todos os gráficos do dashboard com dados simulados.
     */
    function initializeDashboardCharts() {
        if (!chartsModule) {
            logger.error('ChartsModule não está disponível. Não é possível inicializar gráficos.');
            return;
        }

        const financialChartCtx = document.getElementById('financialChart');
        const clientsChartCtx = document.getElementById('clientsChart');
        const budgetsChartCtx = document.getElementById('budgetsChart');

        // Dados de exemplo para os gráficos (cores alinhadas com as variáveis CSS)
        const financialChartData = {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'],
            datasets: [
                {
                    label: 'Receitas',
                    data: [12000, 14000, 13500, 17000, 15500, 18000, 21000],
                    borderColor: '#28a745', // --color-success
                    backgroundColor: 'rgba(40, 167, 69, 0.2)', // --color-success-light
                    fill: true,
                    tension: 0.4,
                },
                {
                    label: 'Despesas',
                    data: [9000, 8000, 9500, 11000, 10500, 12000, 14000],
                    borderColor: '#dc3545', // --color-error
                    backgroundColor: 'rgba(220, 53, 69, 0.15)', // --color-error-light
                    fill: true,
                    tension: 0.4,
                }
            ]
        };

        const clientsChartData = {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'],
            datasets: [{
                label: 'Novos Clientes',
                data: [15, 23, 18, 29, 24, 31, 27],
                backgroundColor: '#f58220', // --color-primary
                borderRadius: 4,
            }]
        };

        const budgetsChartData = {
            labels: ['Aprovados', 'Pendentes', 'Rejeitados'],
            datasets: [{
                label: 'Status',
                data: [58, 22, 7],
                backgroundColor: [
                    '#28a745', // --color-success
                    '#ffc107', // --color-warning
                    '#dc3545'  // --color-error
                ],
                hoverOffset: 8
            }]
        };

        // Opções específicas para cada gráfico, mesclando com as opções padrão do ChartsModule
        const financialChartOptions = chartsModule.defaultOptions; // Começa com as opções padrão
        financialChartOptions.scales.y.title.display = true;
        financialChartOptions.scales.y.title.text = 'R$';

        const clientsChartOptions = chartsModule.defaultOptions;
        clientsChartOptions.scales.y.title.display = true;
        clientsChartOptions.scales.y.title.text = 'Nº Clientes';
        clientsChartOptions.scales.y.ticks.precision = 0; // Para números inteiros

        const budgetsChartOptions = {
            ...chartsModule.defaultOptions, // Copia opções padrão
            plugins: {
                ...chartsModule.defaultOptions.plugins,
                legend: {
                    ...chartsModule.defaultOptions.plugins.legend,
                    position: 'right' // Legenda à direita para este gráfico
                },
                tooltip: {
                    ...chartsModule.defaultOptions.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed + '%'; // Mostra porcentagem
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {} // Desabilita escalas para Doughnut Chart
        };

        // Inicializa os gráficos usando o ChartsModule
        financialChartInstance = chartsModule.createChart(financialChartCtx, 'line', financialChartData, financialChartOptions);
        clientsChartInstance = chartsModule.createChart(clientsChartCtx, 'bar', clientsChartData, clientsChartOptions);
        budgetsChartInstance = chartsModule.createChart(budgetsChartCtx, 'doughnut', budgetsChartData, budgetsChartOptions);
    }

    /**
     * Renderiza as atividades recentes.
     * @param {Array<Object>} data - Os dados das atividades.
     */
    function renderRecentActivities(data) {
        if (!recentActivitiesList) return;
        recentActivitiesList.innerHTML = ''; // Limpa os placeholders
        data.forEach(activity => {
            const listItem = document.createElement('li');
            listItem.className = activity.type; // Adiciona classe para cor do ícone
            listItem.innerHTML = `
                <i class="activity-icon ${activity.icon}"></i>
                <span>${activity.text}</span>
            `;
            recentActivitiesList.appendChild(listItem);
        });
    }

    /**
     * Renderiza o resumo rápido.
     * @param {Array<Object>} data - Os dados do resumo.
     */
    function renderQuickSummary(data) {
        if (!quickSummaryList) return;
        quickSummaryList.innerHTML = ''; // Limpa os placeholders
        data.forEach(item => {
            const summaryItem = document.createElement('div');
            summaryItem.className = `summary-item ${item.type}`; // Adiciona classe para cor do valor
            summaryItem.innerHTML = `
                <div class="summary-label">${item.label}</div>
                <div class="summary-value">${item.value}</div>
            `;
            quickSummaryList.appendChild(summaryItem);
        });
    }

    /**
     * Função principal para carregar e exibir os dados do dashboard.
     * Esta função será chamada externamente pelo modern_app_js.js ou index.html
     * quando a página do dashboard for carregada/navegada.
     * @param {Object} [filters={}] - Filtros de dados (ex: { startDate, endDate }).
     */
    async function loadDashboardPage(filters = {}) {
        logger.info('Carregando dados do dashboard...', filters);
        getDOMElements(); // Garante que os elementos do DOM estão atualizados
        showLoadingPlaceholders(); // Mostra os placeholders antes de buscar dados

        try {
            // Define as datas padrão nos inputs
            setDefaultDates();

            // Simular uma chamada de API para obter dados do dashboard
            // No ambiente real, você faria algo como:
            // const stats = await fetchData('/api/dashboard/stats', filters);
            // const activities = await fetchData('/api/dashboard/activities', filters);
            // const summary = await fetchData('/api/dashboard/summary', filters);

            // Dados de exemplo (substitua por dados reais da sua API)
            const statsData = [
                { label: 'Total de Obras', value: '45', icon: 'fas fa-hard-hat', type: 'primary' },
                { label: 'Obras em Andamento', value: '12', icon: 'fas fa-building', type: 'info' },
                { label: 'Orçamentos Pendentes', value: '7', icon: 'fas fa-hourglass-half', type: 'warning' },
                { label: 'Faturamento Mês', value: utilsManager.formatCurrency(150000), icon: 'fas fa-dollar-sign', type: 'success' }
            ];

            const activitiesData = [
                { text: 'Novo cliente adicionado: João Silva', icon: 'fas fa-user-plus', type: 'success' },
                { text: 'Orçamento #1234 aprovado', icon: 'fas fa-check-circle', type: 'success' },
                { text: 'Despesa registrada: Aluguel de equipamentos', icon: 'fas fa-minus-circle', type: 'danger' },
                { text: 'Contrato #567 finalizado', icon: 'fas fa-file-contract', type: 'info' },
                { text: 'Agendamento de visita para obra XPTO', icon: 'fas fa-calendar-alt', type: 'primary' }
            ];

            const summaryData = [
                { label: 'Receitas (Mês)', value: utilsManager.formatCurrency(25000), type: 'positive' },
                { label: 'Despesas (Mês)', value: utilsManager.formatCurrency(10000), type: 'negative' },
                { label: 'Lucro Líquido', value: utilsManager.formatCurrency(15000), type: 'positive' },
                { label: 'Projetos Concluídos', value: '5', type: 'neutral' }
            ];

            // Simular o tempo de carregamento da API
            await new Promise(resolve => setTimeout(resolve, 1000));

            renderStatCards(statsData);
            renderRecentActivities(activitiesData);
            renderQuickSummary(summaryData);
            initializeDashboardCharts(); // Inicializa os gráficos após os dados serem "carregados"

            // Adiciona evento para o filtro de data
            if (applyDateFilterButton) {
                applyDateFilterButton.removeEventListener('click', handleDateFilterApply); // Evita múltiplos listeners
                applyDateFilterButton.addEventListener('click', handleDateFilterApply);
            }

        } catch (error) {
            logger.error('Erro ao carregar dados do dashboard:', error);
            eventHandler.emit('dashboard:loadError', { error: error.message });
            if (statsGrid) statsGrid.innerHTML = '<div class="error-message">Não foi possível carregar os dados do dashboard.</div>';
        }
    }

    /**
     * Manipulador de evento para o botão de aplicar filtro de data.
     */
    function handleDateFilterApply() {
        if (!startDateInput || !endDateInput) return;

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        if (!validationManager.validateDateFormat(startDate) || !validationManager.validateDateFormat(endDate)) {
            logger.warn('Datas do filtro inválidas. Por favor, insira datas válidas.');
            // Opcional: mostrar um alerta ao usuário
            if (typeof Swal !== 'undefined') {
                Swal.fire('Datas Inválidas', 'Por favor, selecione um período válido para o filtro.', 'warning');
            }
            return;
        }

        logger.info(`Aplicar filtro de data: ${startDate} a ${endDate}`);
        // Recarrega os dados do dashboard com as novas datas
        loadDashboardPage({ startDate, endDate });
    }

    // Retorna a API pública do módulo
    // NENHUMA ATRIBUIÇÃO DIRETA A 'window' AQUI PARA EVITAR CONFLITOS DE IDENTIFICADOR.
    // O InitSystem.js será responsável por expor este módulo globalmente.
    return {
        init: init,
        loadDashboardPage: loadDashboardPage // Função para carregar a página do dashboard
    };
})();