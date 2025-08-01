/**
 * RC Construções - Testes de Integração
 * Dashboard
 * Versão 5.1 - Revisado e Aprimorado
 */

// Importa e mocka o ambiente global do navegador para o Jest
// Isso é crucial para simular `window`, `document`, `fetch`, etc.
require('jest-localstorage-mock'); // Mocka localStorage e sessionStorage
require('whatwg-fetch'); // Polifill para fetch (se não usar node-fetch para testes de requisição)

// Mocka a biblioteca Chart.js globalmente, pois ela é uma dependência visual
jest.mock('chart.js', () => ({
  Chart: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
  })),
  // Mocka getChart se ele for usado para destruir instâncias
  getChart: jest.fn(() => ({ destroy: jest.fn() })),
  // Mocka Chart.helpers.merge se for usado diretamente
  helpers: {
    merge: jest.fn((...args) => Object.assign({}, ...args)),
  },
}));

// Mocks dos módulos core e de utilitários
const mockDatabase = require('../helpers/mock-database');
const mockAuth = require('../helpers/mock-auth');
const { resetAllMocks } = require('../helpers/test-utils');

// Mocka o SystemLogger para testes, pois ele é uma dependência global
const mockSystemLogger = {
  getAppLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
  })),
};
global.SystemLogger = mockSystemLogger; // Expõe o mock globalmente

// Mocka SystemEventHandler
const mockSystemEventHandler = {
  on: jest.fn(),
  emit: jest.fn(),
};
global.SystemEventHandler = mockSystemEventHandler; // Expõe o mock globalmente

// Mocka SettingsManager
const mockSettingsManager = {
  getSetting: jest.fn((key) => {
    if (key === 'deviceId') return 'test-device-id';
    return null;
  }),
  setSetting: jest.fn(),
};
global.SettingsManager = mockSettingsManager;

// Mocka NotificationsModule
const mockNotificationsModule = {
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  updateOnlineStatus: jest.fn(),
};
global.NotificationsModule = mockNotificationsModule;

// Importa os módulos que serão testados
const dashboardModule = require('../../js/modules/dashboard');
const dashboardEnhancements = require('../../js/dashboard-enhancements');
const chartsModule = require('../../js/core/charts');
const utilsModule = require('../../js/core/utils');
const validationModule = require('../../js/core/validation');

// Use fake timers para controlar chamadas assíncronas como setTimeout
jest.useFakeTimers();

describe('Dashboard (Integração)', () => {
  let container; // Elemento DOM simulado para renderizar o dashboard

  // Antes de todos os testes, inicializa os módulos uma vez para pegar suas referências
  beforeAll(async () => {
    // Inicializa os módulos core que o dashboard depende
    // Estes init's são importantes para que o logger, etc., estejam "prontos"
    await utilsModule.init();
    await validationModule.init();
    await chartsModule.init();
    await dashboardModule.init();
    await dashboardEnhancements.init();

    // Cria um container DOM para renderizar o HTML do dashboard
    container = document.createElement('div');
    container.id = 'app-root'; // Um ID para o container principal
    document.body.appendChild(container);
  });

  // Antes de cada teste, limpa o DOM e reseta os mocks de dados
  beforeEach(async () => {
    resetAllMocks(); // Reseta os dados do DB mockado
    // Limpa o conteúdo do container para cada teste
    container.innerHTML = '';
    // Mocka o fetch para simular o carregamento de templates HTML
    global.fetch = jest.fn((url) => {
      if (url.includes('templates/dashboard.html')) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(`
            <div id="page-dashboard" class="page-dashboard">
              <div class="dashboard-header">
                <h3>Dashboard Principal</h3>
                <div class="date-range-picker">
                  <span>Período:</span>
                  <input type="date" id="start-date">
                  <span>até</span>
                  <input type="date" id="end-date">
                  <button class="btn btn-sm btn-primary">Aplicar</button>
                </div>
              </div>
              <div class="stats-grid" id="stats-grid"></div>
              <div class="charts-grid">
                <div class="chart-container large">
                  <div class="chart-header"><h4>Visão Geral Financeira</h4></div>
                  <canvas id="financialChart"></canvas>
                </div>
                <div class="chart-container medium">
                  <div class="chart-header"><h4>Novos Clientes</h4></div>
                  <canvas id="clientsChart"></canvas>
                </div>
                <div class="chart-container medium">
                  <div class="chart-header"><h4>Orçamentos Aprovados</h4></div>
                  <canvas id="budgetsChart"></canvas>
                </div>
              </div>
              <div class="dashboard-bottom-grid">
                <div class="recent-activities">
                  <h4>Atividades Recentes</h4>
                  <ul id="recent-activities-list"></ul>
                </div>
                <div class="quick-summary">
                  <h4>Resumo Rápido</h4>
                  <div class="summary-items-list" id="quick-summary-list"></div>
                </div>
              </div>
            </div>
          `),
        });
      }
      return Promise.reject(new Error('URL de template não mockada'));
    });
  });

  // Depois de todos os testes
  afterAll(() => {
    document.body.removeChild(container);
    jest.restoreAllMocks(); // Restaura todos os mocks do Jest
    jest.useRealTimers(); // Volta a usar timers reais
  });

  it('deve carregar e renderizar os componentes do dashboard corretamente', async () => {
    // Simula a função loadContent do index.html que carrega o HTML
    container.innerHTML = await (await fetch('templates/dashboard.html')).text();
    
    // Chama setupDashboardElements para configurar a UI
    dashboardEnhancements.setupDashboardElements();
    // Chama loadDashboardPage para carregar os dados
    await dashboardModule.loadDashboardPage();

    // Avança os timers para permitir que setTimeout e Promises resolvam
    jest.runAllTimers();
    await Promise.resolve(); // Resolva quaisquer microtarefas pendentes

    // Verifica se os elementos principais estão no DOM e visíveis
    expect(document.getElementById('page-dashboard')).toBeInTheDocument();
    expect(document.querySelector('.dashboard-header h3')).toHaveTextContent('Dashboard Principal');
    expect(document.getElementById('stats-grid')).toBeInTheDocument();
    expect(document.getElementById('financialChart')).toBeInTheDocument();
    expect(document.getElementById('recent-activities-list')).toBeInTheDocument();
    expect(document.getElementById('quick-summary-list')).toBeInTheDocument();

    // Verifica se os stat cards foram renderizados (assumindo 4 cards de exemplo)
    expect(document.querySelectorAll('#stats-grid .stat-card')).toHaveLength(4);
    expect(document.querySelectorAll('#stats-grid .stat-card')[0]).toHaveTextContent('Total de Obras45');

    // Verifica se os gráficos foram inicializados
    expect(chartsModule.createChart).toHaveBeenCalledTimes(3); // 3 gráficos
    expect(Chart.Chart).toHaveBeenCalledTimes(3); // A instância Chart.js deve ter sido chamada 3 vezes
  });

  it('deve animar os valores dos stat cards ao carregar', async () => {
    // Renderiza o dashboard
    container.innerHTML = await (await fetch('templates/dashboard.html')).text();
    dashboardEnhancements.setupDashboardElements();
    await dashboardModule.loadDashboardPage();
    jest.runAllTimers(); // Avança todos os timers, incluindo os da animação

    // Verifica se os valores foram animados para os valores finais
    const totalObrasCard = document.querySelectorAll('#stats-grid .stat-card')[0];
    expect(totalObrasCard.querySelector('.stat-value')).toHaveTextContent('45');

    const faturamentoCard = document.querySelectorAll('#stats-grid .stat-card')[3];
    expect(faturamentoCard.querySelector('.stat-value')).toHaveTextContent('R$ 150.000,00'); // Ou o formato exato esperado
  });

  it('deve filtrar dados do dashboard ao aplicar o filtro de data', async () => {
    // Renderiza o dashboard
    container.innerHTML = await (await fetch('templates/dashboard.html')).text();
    dashboardEnhancements.setupDashboardElements();
    await dashboardModule.loadDashboardPage();
    jest.runAllTimers(); // Carrega os dados iniciais

    // Mocka loadDashboardPage para simular a chamada com filtros
    const loadDashboardPageSpy = jest.spyOn(dashboardModule, 'loadDashboardPage');

    // Preenche e clica no botão de filtro
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const applyButton = document.querySelector('.date-range-picker .btn');

    // Garante que os inputs existam
    expect(startDateInput).toBeInTheDocument();
    expect(endDateInput).toBeInTheDocument();
    expect(applyButton).toBeInTheDocument();

    startDateInput.value = '2025-01-01';
    endDateInput.value = '2025-01-31';
    applyButton.click();

    jest.runAllTimers(); // Avança timers de debounce/setTimeout

    // Verifica se loadDashboardPage foi chamado com os filtros corretos
    expect(loadDashboardPageSpy).toHaveBeenCalledWith({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    loadDashboardPageSpy.mockRestore(); // Restaura o spy
  });

  it('deve exibir placeholders de carregamento antes de renderizar os dados reais', async () => {
    // Não avança os timers ainda
    container.innerHTML = await (await fetch('templates/dashboard.html')).text();
    dashboardEnhancements.setupDashboardElements();
    dashboardModule.loadDashboardPage(); // Não await aqui para testar o estado de carregamento

    // Verifica se os placeholders estão visíveis
    expect(document.querySelectorAll('#stats-grid .stat-card.loading')).toHaveLength(4);
    expect(document.querySelectorAll('#recent-activities-list .loading-placeholder-item')).toHaveLength(4); // assuming 4 placeholders
    expect(document.querySelectorAll('#quick-summary-list .summary-item.loading')).toHaveLength(3); // assuming 3 placeholders

    // Avança os timers para carregar os dados reais
    jest.runAllTimers();
    await Promise.resolve(); // Para resolver Promises internas

    // Verifica se os placeholders desapareceram e os dados reais apareceram
    expect(document.querySelectorAll('#stats-grid .stat-card.loading')).toHaveLength(0);
    expect(document.querySelectorAll('#stats-grid .stat-card')).toHaveLength(4); // Os dados reais
  });

  it('deve exibir notificações de erro se as datas do filtro forem inválidas', async () => {
    container.innerHTML = await (await fetch('templates/dashboard.html')).text();
    dashboardEnhancements.setupDashboardElements();
    await dashboardModule.loadDashboardPage();
    jest.runAllTimers();

    // Preenche com datas inválidas
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const applyButton = document.querySelector('.date-range-picker .btn');

    startDateInput.value = 'invalid-date';
    endDateInput.value = '2025-01-01'; // Apenas uma inválida já deve ser suficiente
    applyButton.click();

    jest.runAllTimers(); // Avança timers

    // Verifica se o showWarning do NotificationsModule foi chamado
    expect(mockNotificationsModule.showWarning).toHaveBeenCalledTimes(1);
    expect(mockNotificationsModule.showWarning).toHaveBeenCalledWith(
      'Datas Inválidas',
      'Por favor, selecione um período válido para o filtro.'
    );
  });
});