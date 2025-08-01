/**
 * RC Construções - Testes Unitários
 * Módulo de Utilitários (UtilsManager)
 * Versão 5.1 - Revisado e Aprimorado
 */

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

// Mocka PapaParse
const mockPapaParse = {
  unparse: jest.fn((data) => {
    // Simula uma saída CSV simples para teste
    if (data && data.length > 0) {
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).join(',')).join('\n');
      return `${headers}\n${rows}`;
    }
    return '';
  }),
  parse: jest.fn(), // Se o UtilsManager tivesse um método de importação CSV
};
global.Papa = mockPapaParse;

// Mocka o localStorage globalmente para testes de localStorage helpers
const localStorageMock = {
  _data: {},
  setItem: jest.fn(function(key, value) { this._data[key] = value; }),
  getItem: jest.fn(function(key) { return this._data[key] || null; }),
  clear: jest.fn(function() { this._data = {}; }),
  removeItem: jest.fn(function(key) { delete this._data[key]; }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });


// Importa o módulo UtilsManager real para teste
const UtilsManagerModule = require('../../js/core/utils');

describe('UtilsManager (Unit Tests)', () => {
  let utilsManager; // A instância do UtilsManager

  // Usa fake timers para controlar chamadas assíncronas como setTimeout
  jest.useFakeTimers();

  beforeEach(async () => {
    // Resetar todos os mocks
    jest.clearAllMocks();
    localStorageMock.clear(); // Limpa o mock do localStorage

    // Re-inicializa o UtilsManager para cada teste
    utilsManager = UtilsManagerModule;
    await utilsManager.init(); // Garante que o módulo esteja inicializado
    jest.runAllTimers(); // Executa timers de waitForGlobal
  });

  afterEach(() => {
    jest.runOnlyPendingTimers(); // Garante que todos os timers pendentes sejam executados
    jest.clearAllTimers(); // Limpa todos os timers
  });

  describe('init()', () => {
    it('deve inicializar o UtilsManager e logar sucesso', async () => {
      // O init já foi chamado no beforeEach
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        '🛠️ Módulo de Utilitários inicializado.'
      );
      expect(utilsManager.isReady()).toBe(true);
    });

    it('deve logar um erro se SystemLogger não for encontrado', async () => {
      // Simula SystemLogger não disponível globalmente
      const originalSystemLogger = global.SystemLogger;
      global.SystemLogger = undefined;

      // Re-inicializa para testar o cenário de erro
      await utilsManager.init();
      jest.runAllTimers();

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Falha ao obter SystemLogger no UtilsManager. Usando console fallback.')
      );
      expect(utilsManager.isReady()).toBe(false); // Não deve estar pronto
      global.SystemLogger = originalSystemLogger; // Restaurar
    });
  });

  describe('Formatação (formatCPF, formatPhone, formatCurrency, formatDate, capitalizeFirstLetter)', () => {
    it('formatCPF deve formatar um CPF válido', () => {
      expect(utilsManager.formatCPF('12345678901')).toBe('123.456.789-01');
      expect(utilsManager.formatCPF('123.456.789-01')).toBe('123.456.789-01');
    });

    it('formatCPF deve retornar o original ou vazio para CPF inválido', () => {
      expect(utilsManager.formatCPF('123')).toBe('123'); // Curto
      expect(utilsManager.formatCPF(null)).toBe(''); // Nulo
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('formatCPF: Entrada inválida.')
      );
    });

    it('formatPhone deve formatar telefones válidos', () => {
      expect(utilsManager.formatPhone('11987654321')).toBe('(11) 98765-4321');
      expect(utilsManager.formatPhone('1187654321')).toBe('(11) 8765-4321');
    });

    it('formatPhone deve retornar o original ou vazio para telefone inválido', () => {
      expect(utilsManager.formatPhone('123')).toBe('123'); // Curto
      expect(utilsManager.formatPhone(null)).toBe(''); // Nulo
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('formatPhone: Entrada inválida.')
      );
    });

    it('formatCurrency deve formatar valores monetários corretamente', () => {
      expect(utilsManager.formatCurrency(1234.56, 'BRL', 'pt-BR')).toBe('R$ 1.234,56');
      expect(utilsManager.formatCurrency(100, 'USD', 'en-US')).toBe('$100.00');
    });

    it('formatCurrency deve retornar formato padrão ou logar erro para valores inválidos', () => {
      expect(utilsManager.formatCurrency(NaN)).toBe('R$ 0,00'); // Ou outro formato padrão para NaN
      expect(utilsManager.formatCurrency('abc')).toBe('R$ 0,00');
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('formatCurrency: Entrada inválida.')
      );
    });

    it('formatDate deve formatar datas corretamente', () => {
      const date = new Date('2025-07-30T10:00:00Z');
      expect(utilsManager.formatDate(date, 'YYYY-MM-DD')).toBe('2025-07-30');
      expect(utilsManager.formatDate(date, 'DD/MM/YYYY HH:mm')).toBe('30/07/2025 10:00');
    });

    it('formatDate deve retornar "Data Inválida" para entrada inválida', () => {
      expect(utilsManager.formatDate('invalid-date')).toBe('Data Inválida');
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('formatDate: Entrada de data inválida.')
      );
    });

    it('capitalizeFirstLetter deve capitalizar a primeira letra', () => {
      expect(utilsManager.capitalizeFirstLetter('teste')).toBe('Teste');
      expect(utilsManager.capitalizeFirstLetter('olá mundo')).toBe('Olá mundo');
      expect(utilsManager.capitalizeFirstLetter('')).toBe('');
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('capitalizeFirstLetter: Entrada inválida.')
      );
    });
  });

  describe('generateUniqueId()', () => {
    it('deve gerar IDs únicos válidos (UUID v4)', () => {
      const id1 = utilsManager.generateUniqueId();
      const id2 = utilsManager.generateUniqueId();
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(id1).not.toEqual(id2); // Deve ser único
    });
  });

  describe('throttle() e debounce()', () => {
    let mockFn;

    beforeEach(() => {
      mockFn = jest.fn();
    });

    it('throttle deve limitar a execução da função', () => {
      const throttledFn = utilsManager.throttle(mockFn, 100);

      throttledFn();
      throttledFn(); // Esta chamada deve ser ignorada
      throttledFn(); // Esta chamada também

      expect(mockFn).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(50); // Passa 100ms total
      throttledFn(); // Agora deve ser chamada novamente
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('debounce deve atrasar a execução da função', () => {
      const debouncedFn = utilsManager.debounce(mockFn, 100);

      debouncedFn();
      debouncedFn(); // Reinicia o timer
      debouncedFn(); // Reinicia o timer novamente

      expect(mockFn).not.toHaveBeenCalled(); // Ainda não deve ter sido chamada
      jest.advanceTimersByTime(99);
      expect(mockFn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1); // Passa 100ms total
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('LocalStorage Helpers (getLocalStorageItem, setLocalStorageItem)', () => {
    it('setLocalStorageItem deve salvar um item no localStorage', () => {
      const data = { key: 'value', num: 123 };
      utilsManager.setLocalStorageItem('testKey', data);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', JSON.stringify(data));
      expect(localStorageMock._data['testKey']).toEqual(JSON.stringify(data));
    });

    it('getLocalStorageItem deve recuperar um item do localStorage', () => {
      const data = { key: 'value', num: 123 };
      localStorageMock.setItem('testKey', JSON.stringify(data));

      const retrievedData = utilsManager.getLocalStorageItem('testKey');
      expect(retrievedData).toEqual(data);
    });

    it('getLocalStorageItem deve retornar null se o item não existir', () => {
      const retrievedData = utilsManager.getLocalStorageItem('nonExistentKey');
      expect(retrievedData).toBeNull();
    });

    it('getLocalStorageItem deve logar erro se o JSON for inválido', () => {
      localStorageMock.setItem('invalidJson', '{"key": "value"'); // JSON inválido
      const retrievedData = utilsManager.getLocalStorageItem('invalidJson');

      expect(retrievedData).toBeNull();
      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao obter item \'invalidJson\' do LocalStorage:')
      );
    });
  });

  describe('downloadCSV()', () => {
    // Mocka document.createElement, document.body.appendChild, click, removeChild
    let appendChildSpy;
    let removeChildSpy;
    let clickSpy;
    let createObjectURLSpy;
    let revokeObjectURLSpy;

    beforeEach(() => {
      appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
      removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());
      clickSpy = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
          return {
            href: '',
            setAttribute: jest.fn(),
            click: clickSpy,
            download: '',
          };
        }
        return originalCreateElement(tagName); // Usa o original para outros elementos
      });
      createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url');
      revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(jest.fn());
    });

    afterEach(() => {
      jest.restoreAllMocks(); // Restaura todos os espiões e mocks
    });


    it('deve baixar um arquivo CSV com dados válidos', async () => {
      const data = [{ name: 'Test', value: 1 }, { name: 'Another', value: 2 }];
      const filename = 'test.csv';

      await utilsManager.downloadCSV(data, filename);
      jest.runAllTimers(); // Executa timers do waitForGlobal para PapaParse

      expect(mockPapaParse.unparse).toHaveBeenCalledTimes(1);
      expect(mockPapaParse.unparse).toHaveBeenCalledWith(data);
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        `Arquivo CSV '${filename}' gerado e download iniciado.`
      );
    });

    it('deve logar um aviso se nenhum dado for fornecido para downloadCSV', async () => {
      await utilsManager.downloadCSV([]);
      jest.runAllTimers();

      expect(mockPapaParse.unparse).not.toHaveBeenCalled();
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        'downloadCSV: Nenhum dado fornecido para exportar como CSV.'
      );
    });

    it('deve logar um erro se PapaParse não estiver disponível', async () => {
      const originalPapa = global.Papa;
      global.Papa = undefined; // Simula PapaParse não disponível

      await utilsManager.downloadCSV([{ a: 1 }]);
      jest.runAllTimers();

      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao gerar e baixar CSV: A biblioteca PapaParse não está carregada ou funcional.')
      );

      global.Papa = originalPapa; // Restaurar
    });
  });
});