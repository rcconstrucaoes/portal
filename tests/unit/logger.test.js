/**
 * RC Construções - Testes Unitários
 * Módulo de Logging (SystemLogger)
 * Versão 5.1 - Revisado e Aprimorado
 */

// Mocka o console para espiar as chamadas
const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
global.console = mockConsole;

// Mocka o Database para simular IndexedDB
const mockDatabaseInstance = {
  table: jest.fn(() => ({
    add: jest.fn(),
    where: jest.fn(() => ({
      below: jest.fn(() => ({
        toArray: jest.fn(() => []), // Por padrão, nenhum log antigo para limpeza
      })),
    })),
    bulkDelete: jest.fn(),
  })),
  getInstance: jest.fn(() => mockDatabaseInstance),
  isFallback: jest.fn(() => false), // Por padrão, não está em modo fallback
};
global.Database = mockDatabaseInstance;

// Mocka o SettingsManager
const mockSettingsManager = {
  getSetting: jest.fn(() => null), // Por padrão, nenhuma configuração salva
  setSetting: jest.fn(),
};
global.SettingsManager = mockSettingsManager;

// Mocka PerformanceMonitor
const mockPerformanceMonitor = {
  // Apenas mockamos a existência, não os métodos, a menos que sejam chamados diretamente pelo logger
};
global.PerformanceMonitor = mockPerformanceMonitor;


// Importa o módulo SystemLogger real para teste
const SystemLoggerModule = require('../../js/core/logger');

describe('SystemLogger (Unit Tests)', () => {
  let systemLogger; // A instância do SystemLogger

  // Usa fake timers para controlar chamadas assíncronas como setTimeout/setInterval
  jest.useFakeTimers();

  beforeEach(async () => {
    // Resetar todos os mocks
    jest.clearAllMocks();
    
    // Re-inicializa o SystemLogger para cada teste
    systemLogger = SystemLoggerModule;
    // O init() do SystemLogger será chamado explicitamente nos testes para controlar o fluxo
  });

  afterEach(() => {
    jest.runOnlyPendingTimers(); // Garante que todos os timers pendentes sejam executados
    jest.clearAllTimers(); // Limpa todos os timers
  });

  describe('init()', () => {
    it('deve inicializar o logger e carregar configurações padrão', async () => {
      await systemLogger.init(); // Inicializa em modo debug padrão
      jest.runAllTimers(); // Executa timers de waitForGlobal

      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        '📊 Módulo de Logging inicializando...'
      );
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        'SystemLogger: Configurações carregadas do SettingsManager.', expect.any(Object)
      );
      expect(systemLogger.getLogReport().config.minLogLevel).toBe(0); // DEBUG = 0
      expect(systemLogger.getLogReport().config.outputs).toEqual(['console', 'indexeddb']);
      expect(systemLogger.getLogReport().outputsStatus.indexeddb).toBe(true); // IndexedDB deve estar ativo
    });

    it('deve desabilitar indexeddb output se Database não estiver disponível', async () => {
      // Simula que Database não é resolvido por waitForGlobal (timeout)
      global.Database = undefined; 
      
      await systemLogger.init();
      jest.runAllTimers();

      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Database não disponível para logs persistentes:')
      );
      expect(systemLogger.getLogReport().config.outputs).toEqual(['console']); // IndexedDB removido
      expect(systemLogger.getLogReport().outputsStatus.indexeddb).toBe(false);
      global.Database = mockDatabaseInstance; // Restaurar
    });

    it('deve carregar configurações salvas do SettingsManager', async () => {
      const savedConfig = {
        minLogLevel: 3, // WARN
        outputs: ['console'],
        contextFilters: ['AuthManager'],
      };
      mockSettingsManager.getSetting.mockResolvedValueOnce(savedConfig);

      await systemLogger.init(false, true); // init(debugMode=false, loadSettings=true)
      jest.runAllTimers();

      expect(systemLogger.getLogReport().config.minLogLevel).toBe(3); // WARN = 3
      expect(systemLogger.getLogReport().config.outputs).toEqual(['console']);
      expect(systemLogger.getLogReport().config.contextFilters).toEqual(['AuthManager']);
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        'Logger: Configurações carregadas do SettingsManager.', savedConfig
      );
    });
  });

  describe('log() e getAppLogger()', () => {
    beforeEach(async () => {
      await systemLogger.init();
      jest.runAllTimers();
      // Limpa os mocks de console novamente após o init global
      mockConsole.log.mockClear();
      mockConsole.info.mockClear();
      mockConsole.warn.mockClear();
      mockConsole.error.mockClear();
      mockConsole.debug.mockClear();
    });

    it('deve logar uma mensagem INFO no console e no IndexedDB', async () => {
      const appLogger = systemLogger.getAppLogger('TestContext');
      appLogger.info('This is an info message', { data: 1 });

      jest.runAllTimers(); // Processa a entrada de log

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        expect.stringContaining('color: #1a73e8;'),
        'This is an info message',
        { data: 1 }
      );
      expect(mockDatabaseInstance.table().add).toHaveBeenCalledTimes(1);
      expect(mockDatabaseInstance.table().add).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'INFO',
          context: 'TestContext',
          message: 'This is an info message',
          data: '{"data":1}'
        })
      );
    });

    it('deve logar uma mensagem DEBUG apenas em modo debug', async () => {
      // Já está em modo debug por padrão no beforeEach
      const appLogger = systemLogger.getAppLogger('TestContext');
      appLogger.debug('This is a debug message');

      jest.runAllTimers();

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      expect(mockDatabaseInstance.table().add).toHaveBeenCalledTimes(1); // DEBUG também é salvo no DB
    });

    it('não deve logar mensagens DEBUG se minLogLevel for maior', async () => {
      await systemLogger.updateConfig({ minLogLevel: 1 }); // INFO = 1
      jest.runAllTimers(); // Executa o timer do updateConfig
      mockConsole.debug.mockClear(); // Limpa logs do updateConfig

      const appLogger = systemLogger.getAppLogger('TestContext');
      appLogger.debug('This is a debug message');

      jest.runAllTimers();

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockDatabaseInstance.table().add).not.toHaveBeenCalled();
    });

    it('deve filtrar logs por contexto', async () => {
      await systemLogger.updateConfig({ contextFilters: ['FilteredContext'] });
      jest.runAllTimers();
      mockConsole.info.mockClear(); // Limpa logs do updateConfig

      const appLogger1 = systemLogger.getAppLogger('FilteredContext');
      const appLogger2 = systemLogger.getAppLogger('OtherContext');

      appLogger1.info('Message from filtered context');
      appLogger2.info('Message from other context');

      jest.runAllTimers();

      expect(mockConsole.info).toHaveBeenCalledTimes(1); // Apenas um log
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[FilteredContext]'),
        expect.any(String),
        'Message from filtered context'
      );
      expect(mockDatabaseInstance.table().add).toHaveBeenCalledTimes(1);
    });

    it('deve logar mensagens de ERRO no console.error e no IndexedDB', async () => {
      const appLogger = systemLogger.getAppLogger('ErrorTest');
      appLogger.error('This is an error', new Error('Test Error Stack'));

      jest.runAllTimers();

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorTest]'),
        expect.stringContaining('color: #dc3545;'),
        'This is an error',
        expect.any(Error) // O objeto Error é passado
      );
      expect(mockDatabaseInstance.table().add).toHaveBeenCalledTimes(1);
      expect(mockDatabaseInstance.table().add).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'ERROR',
          message: 'This is an error',
          data: expect.stringContaining('Test Error Stack') // Stack trace deve estar no data
        })
      );
    });
  });

  describe('Buffer e Inicialização tardia', () => {
    it('deve armazenar logs em buffer antes da inicialização completa e processá-los depois', async () => {
      // Não chame init() no beforeEach para este teste
      systemLogger = SystemLoggerModule; // Zera a instância e não inicializa

      const appLogger = systemLogger.getAppLogger('PreInit');
      appLogger.info('Log message before init');
      appLogger.debug('Debug message before init');

      // Devem ir para o console e para o buffer
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      expect(systemLogger.getLogReport().totalLogsInBuffer).toBe(2);

      // Agora inicializa o logger (processa o buffer)
      await systemLogger.init();
      jest.runAllTimers();

      // Após init, o buffer deve ser esvaziado
      expect(systemLogger.getLogReport().totalLogsInBuffer).toBe(0);
      // As chamadas para o banco de dados devem ocorrer agora
      expect(mockDatabaseInstance.table().add).toHaveBeenCalledTimes(2); // Para os 2 logs em buffer
    });
  });

  describe('Limpeza de logs antigos', () => {
    beforeEach(async () => {
      await systemLogger.init();
      jest.runAllTimers();
      mockDatabaseInstance.table().add.mockClear(); // Limpa logs de inicialização
    });

    it('deve remover logs mais antigos que o período de retenção', async () => {
      // Simula que há 3 logs antigos que devem ser removidos
      const oldLogs = [
        { id: 1, timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() }, // 8 dias atrás
        { id: 2, timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 3, timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
      ];
      mockDatabaseInstance.table().where().below().toArray.mockResolvedValueOnce(oldLogs);

      // Avança o timer do intervalo de limpeza (a cada 1 hora)
      jest.advanceTimersByTime(60 * 60 * 1000 + 100); // Avança mais que o intervalo

      expect(mockDatabaseInstance.table().where).toHaveBeenCalledWith('timestamp');
      expect(mockDatabaseInstance.table().where().below).toHaveBeenCalled();
      expect(mockDatabaseInstance.table().bulkDelete).toHaveBeenCalledWith([1, 2, 3]);
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        'Limpeza de logs: 3 logs antigos removidos do IndexedDB.'
      );
    });

    it('não deve tentar limpar logs se o IndexedDB estiver em modo fallback', async () => {
        mockDatabaseInstance.isFallback.mockReturnValueOnce(true); // Simula fallback
        
        jest.advanceTimersByTime(60 * 60 * 1000 + 100);

        expect(mockDatabaseInstance.table().where).not.toHaveBeenCalled();
        expect(mockDatabaseInstance.table().bulkDelete).not.toHaveBeenCalled();
    });
  });

  describe('updateConfig()', () => {
    beforeEach(async () => {
      await systemLogger.init();
      jest.runAllTimers();
      mockSettingsManager.setSetting.mockClear();
    });

    it('deve atualizar as configurações e salvá-las no SettingsManager', async () => {
      const newConfig = {
        minLogLevel: 4, // ERROR
        outputs: ['console'],
      };
      await systemLogger.updateConfig(newConfig);
      jest.runAllTimers(); // Executa o timer para salvar settings

      expect(systemLogger.getLogReport().config.minLogLevel).toBe(4);
      expect(systemLogger.getLogReport().config.outputs).toEqual(['console']);
      expect(mockSettingsManager.setSetting).toHaveBeenCalledWith('loggerConfig', expect.objectContaining(newConfig));
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        'Configurações do Logger atualizadas e salvas.', expect.any(Object)
      );
    });
  });
});