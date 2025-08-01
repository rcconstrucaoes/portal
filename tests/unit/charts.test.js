/**
 * RC Construções - Testes Unitários
 * Módulo de Gráficos (ChartsModule)
 * Versão 5.1 - Revisado e Aprimorado
 */

// Mocka a biblioteca Chart.js globalmente, pois ela é uma dependência visual
// Usaremos um mock mais sofisticado para simular a instância e seus métodos
const mockChartInstance = {
  destroy: jest.fn(),
  update: jest.fn(),
  data: {},
  options: {},
};

const mockChartConstructor = jest.fn().mockImplementation(() => mockChartInstance);

// Mocka Chart.js.getChart para que possa retornar instâncias existentes
const mockChartGetChart = jest.fn(() => null); // Retorna null por padrão (nenhuma instância)

// Mocka Chart.helpers.merge para garantir que a mesclagem de opções funcione
const mockChartHelpersMerge = jest.fn((...args) => Object.assign({}, ...args)); // Simples Object.assign

jest.mock('chart.js', () => ({
  Chart: mockChartConstructor,
  getChart: mockChartGetChart,
  helpers: {
    merge: mockChartHelpersMerge,
  },
}));

// Mocka o SystemLogger
const mockSystemLogger = {
  getAppLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
  })),
};
global.SystemLogger = mockSystemLogger;

// Mocka SystemEventHandler (se ChartsModule o usar para eventos)
const mockSystemEventHandler = {
  on: jest.fn(),
  emit: jest.fn(),
};
global.SystemEventHandler = mockSystemEventHandler;

// Mocka UtilsManager (se ChartsModule o usar para formatação)
const mockUtilsManager = {
  formatDate: jest.fn((date, format) => '2025-07-30'),
  formatCurrency: jest.fn((amount) => `R$ ${amount.toFixed(2).replace('.', ',')}`),
};
global.UtilsManager = mockUtilsManager;


// Importa o módulo Charts real para teste
const ChartsModule = require('../../js/core/charts');

describe('ChartsModule (Unit Tests)', () => {
  let chartsInstance; // A instância do ChartsModule

  // Mock de um elemento canvas HTML
  let mockCanvasElement;
  let mockCanvasContext;

  beforeEach(async () => {
    // Resetar todos os mocks
    jest.clearAllMocks();

    // Resetar mocks da Chart.js
    mockChartConstructor.mockClear();
    mockChartGetChart.mockClear();
    mockChartHelpersMerge.mockClear();
    mockChartInstance.destroy.mockClear();
    mockChartInstance.update.mockClear();

    // Criar um mock de elemento canvas
    mockCanvasContext = {
      // Mocka o método getContext
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      canvas: {}, // Simula a propriedade canvas do contexto
    };
    mockCanvasElement = {
      getContext: jest.fn(() => mockCanvasContext),
      // Mock de propriedades e métodos que Chart.js acessa
      width: 100,
      height: 100,
      clientWidth: 100,
      clientHeight: 100,
      style: {},
      id: 'testChartCanvas', // Adiciona um ID para logs
    };

    // Inicializa o ChartsModule para cada teste
    chartsInstance = ChartsModule;
    await chartsInstance.init();
  });

  describe('init()', () => {
    it('deve inicializar o ChartsModule e logar sucesso', async () => {
      // O init já foi chamado no beforeEach
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        '📊 Charts Module inicializado e Chart.js disponível.'
      );
    });

    it('deve logar um erro se Chart.js não for encontrado', async () => {
      // Simula Chart.js não disponível globalmente
      const originalChart = global.Chart;
      global.Chart = undefined;

      // Re-inicializa para testar o cenário de erro
      await chartsInstance.init();

      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        'Erro crítico ao inicializar Charts Module:',
        expect.any(Error)
      );
      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        'Falha na inicialização do Charts Module. Gráficos podem não funcionar.'
      );

      global.Chart = originalChart; // Restaurar
    });
  });

  describe('createChart()', () => {
    const testChartData = {
      labels: ['A', 'B'],
      datasets: [{ label: 'Data', data: [10, 20] }],
    };

    it('deve criar um novo gráfico com sucesso', () => {
      const chart = chartsInstance.createChart(mockCanvasElement, 'bar', testChartData);

      expect(chart).toBe(mockChartInstance); // Deve retornar a instância mockada
      expect(mockChartConstructor).toHaveBeenCalledTimes(1);
      expect(mockChartConstructor).toHaveBeenCalledWith(
        mockCanvasContext,
        expect.objectContaining({
          type: 'bar',
          data: testChartData,
          options: expect.any(Object), // Opções serão mescladas
        })
      );
      expect(mockSystemLogger.getAppLogger().success).toHaveBeenCalledWith(
        "Gráfico 'bar' criado com sucesso no canvas 'testChartCanvas'."
      );
    });

    it('deve mesclar opções customizadas com as opções padrão', () => {
      const customOptions = {
        plugins: { legend: { position: 'left' } },
        scales: { x: { display: false } },
      };
      chartsInstance.createChart(mockCanvasElement, 'line', testChartData, customOptions);

      expect(mockChartHelpersMerge).toHaveBeenCalledTimes(1); // Merge é chamado uma vez
      // Verifica se as opções passadas para o construtor do Chart.js contêm a mesclagem
      const passedOptions = mockChartConstructor.mock.calls[0][1].options;
      expect(passedOptions.plugins.legend.position).toEqual('left');
      expect(passedOptions.scales.x.display).toEqual(false);
      expect(passedOptions.animation.duration).toEqual(1000); // Da defaultOptions
    });

    it('deve destruir uma instância de gráfico existente antes de criar uma nova', () => {
      // Simula uma instância Chart.js já anexada ao canvas
      mockChartGetChart.mockReturnValueOnce(mockChartInstance);

      chartsInstance.createChart(mockCanvasElement, 'line', testChartData);

      expect(mockChartGetChart).toHaveBeenCalledWith(mockCanvasElement);
      expect(mockChartInstance.destroy).toHaveBeenCalledTimes(1); // A instância antiga deve ser destruída
      expect(mockChartConstructor).toHaveBeenCalledTimes(1); // Uma nova deve ser criada
    });

    it('deve retornar null e logar erro se o canvas for inválido', () => {
      const chart = chartsInstance.createChart(null, 'bar', testChartData);

      expect(chart).toBeNull();
      expect(mockChartConstructor).not.toHaveBeenCalled();
      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        'Elemento canvas inválido para criar gráfico.'
      );
    });

    it('deve retornar null e logar erro se Chart.js não estiver disponível', () => {
      const originalChart = global.Chart;
      global.Chart = undefined; // Simula Chart.js não disponível

      const chart = chartsInstance.createChart(mockCanvasElement, 'bar', testChartData);

      expect(chart).toBeNull();
      expect(mockChartConstructor).not.toHaveBeenCalled();
      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        'Chart.js não está carregado. Não é possível criar gráfico.'
      );

      global.Chart = originalChart; // Restaurar
    });
  });

  describe('updateChartData()', () => {
    const newChartData = {
      labels: ['C', 'D'],
      datasets: [{ label: 'New Data', data: [30, 40] }],
    };

    it('deve atualizar os dados de um gráfico existente e chamar update()', () => {
      // Simula que mockChartInstance já é um gráfico válido
      const success = chartsInstance.updateChartData(mockChartInstance, newChartData);

      expect(success).toBe(true);
      expect(mockChartInstance.data).toEqual(newChartData); // Dados devem ser atualizados
      expect(mockChartInstance.update).toHaveBeenCalledTimes(1); // update() deve ser chamado
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith('Dados do gráfico atualizados com sucesso.');
    });

    it('deve retornar false e logar erro se a instância do gráfico for inválida', () => {
      const success = chartsInstance.updateChartData(null, newChartData);

      expect(success).toBe(false);
      expect(mockChartInstance.update).not.toHaveBeenCalled();
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        'Instância de gráfico ou novos dados inválidos para atualização.'
      );
    });

    it('deve retornar false e logar erro se os novos dados forem inválidos', () => {
      const success = chartsInstance.updateChartData(mockChartInstance, null);

      expect(success).toBe(false);
      expect(mockChartInstance.update).not.toHaveBeenCalled();
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        'Instância de gráfico ou novos dados inválidos para atualização.'
      );
    });

    it('deve logar um erro se a atualização do Chart.js falhar', () => {
        // Simula que o método update da instância do Chart.js lança um erro
        mockChartInstance.update.mockImplementationOnce(() => { throw new Error('Chart.js update failed'); });

        const success = chartsInstance.updateChartData(mockChartInstance, newChartData);

        expect(success).toBe(false);
        expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
            'Erro ao atualizar dados do gráfico: Chart.js update failed'
        );
    });
  });

  describe('defaultOptions', () => {
    it('deve expor as opções padrão do gráfico', () => {
      expect(chartsInstance.defaultOptions).toBeDefined();
      expect(chartsInstance.defaultOptions.responsive).toBe(true);
      expect(chartsInstance.defaultOptions.plugins.legend.position).toEqual('top');
    });
  });
});