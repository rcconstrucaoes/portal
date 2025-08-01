/**
 * RC Construções - Testes Unitários
 * Módulo de Banco de Dados (Database)
 * Versão 5.1 - Revisado e Aprimorado
 */

// Mocka a biblioteca Dexie.js globalmente
const mockDexieInstance = {
  version: jest.fn().mockReturnThis(), // Permite encadeamento .version().stores()
  stores: jest.fn().mockReturnThis(), // Permite encadeamento
  open: jest.fn(),
  on: jest.fn(), // Mocka o método .on()
  table: jest.fn(() => ({
    add: jest.fn(),
    get: jest.fn(),
    toArray: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    where: jest.fn(() => ({ equals: jest.fn(() => ({ toArray: jest.fn() })) })),
    filter: jest.fn(() => ({ toArray: jest.fn() })),
    bulkPut: jest.fn(),
    clear: jest.fn(),
    count: jest.fn()
  })),
  isOpen: jest.fn(() => true),
  close: jest.fn(),
  verno: 2 // Versão mockada do DB
};
// Simula o construtor global do Dexie
const MockDexie = jest.fn(() => mockDexieInstance);
global.Dexie = MockDexie;

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

// Importa o módulo Database real para teste
const DatabaseModule = require('../../js/core/database');

describe('Database (Unit Tests)', () => {
  let database; // A instância do módulo Database

  // Usa fake timers para controlar setTimeout (em waitForGlobal)
  jest.useFakeTimers();

  beforeEach(async () => {
    // Resetar todos os mocks
    jest.clearAllMocks();
    localStorage.clear(); // Limpa localStorage para testes de fallback

    // Re-inicializa o módulo Database para cada teste
    database = DatabaseModule;
    // Não chame init aqui, ele será chamado nos testes para controlar o fluxo
  });

  afterEach(() => {
    // Restaurar o Dexie e o logger para o estado original (se necessário para outros testes)
    jest.runOnlyPendingTimers(); // Garante que todos os timers pendentes sejam executados
    jest.clearAllTimers();
  });

  describe('init() - IndexedDB Success Scenario', () => {
    it('deve inicializar o banco de dados com sucesso e definir os schemas', async () => {
      mockDexieInstance.open.mockResolvedValueOnce(); // Simula open com sucesso

      await database.init();
      jest.runAllTimers(); // Executa timers de waitForGlobal

      expect(MockDexie).toHaveBeenCalledTimes(1);
      expect(MockDexie).toHaveBeenCalledWith('RC_Construcoes_DB');
      
      expect(mockDexieInstance.version).toHaveBeenCalledTimes(2);
      expect(mockDexieInstance.version).toHaveBeenCalledWith(1);
      expect(mockDexieInstance.version).toHaveBeenCalledWith(2);
      
      expect(mockDexieInstance.stores).toHaveBeenCalledTimes(2); // Duas chamadas para .version().stores()
      expect(mockDexieInstance.stores.mock.calls[0][0]).toHaveProperty('users'); // Schema da v1
      expect(mockDexieInstance.stores.mock.calls[1][0]).toHaveProperty('users'); // Schema da v2

      expect(mockDexieInstance.on).toHaveBeenCalledWith('versionchange', expect.any(Function));
      expect(mockDexieInstance.open).toHaveBeenCalledTimes(1);
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        '📊 Database: RC_Construcoes_DB versão: 2'
      );
      expect(database.isFallback()).toBe(false);
    });

    it('deve logar um erro e ativar fallback se Dexie.js não for encontrado', async () => {
      const originalDexie = global.Dexie;
      global.Dexie = undefined; // Simula Dexie.js não disponível

      await database.init();
      jest.runAllTimers(); // Executa timers de waitForGlobal

      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        '❌ Erro ao inicializar DatabaseManager com IndexedDB:',
        expect.any(Error)
      );
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        '🚧 Inicializando modo fallback (localStorage).'
      );
      expect(database.isFallback()).toBe(true);

      global.Dexie = originalDexie; // Restaurar Dexie
    });
  });

  describe('init() - Fallback Scenario', () => {
    it('deve ativar o modo fallback se a conexão com IndexedDB falhar', async () => {
      mockDexieInstance.open.mockRejectedValueOnce(new Error('IndexedDB connection failed')); // Simula falha

      await database.init();
      jest.runAllTimers(); // Executa timers de waitForGlobal

      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        '❌ Erro ao inicializar DatabaseManager com IndexedDB:',
        expect.any(Error)
      );
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        '🚧 Inicializando modo fallback (localStorage).'
      );
      expect(database.isFallback()).toBe(true);
    });

    it('o modo fallback deve carregar dados existentes do localStorage', async () => {
      const mockClientsData = [{ id: 1, name: 'Fallback Client' }];
      localStorage.setItem('RC_Construcoes_DB_clients', JSON.stringify(mockClientsData));

      mockDexieInstance.open.mockRejectedValueOnce(new Error('IndexedDB failed'));
      await database.init();
      jest.runAllTimers();

      const dbInstance = database.getInstance();
      const clients = await dbInstance.table('clients').toArray();
      expect(clients).toEqual(mockClientsData);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        "🚧 DatabaseManager em modo fallback."
      );
    });
  });

  describe('getInstance()', () => {
    it('deve retornar a instância do DB após inicialização bem-sucedida', async () => {
      mockDexieInstance.open.mockResolvedValueOnce();
      await database.init();
      jest.runAllTimers();

      const instance = database.getInstance();
      expect(instance).toBe(mockDexieInstance);
      expect(database.isFallback()).toBe(false);
    });

    it('deve retornar a instância do DB em modo fallback', async () => {
      mockDexieInstance.open.mockRejectedValueOnce(new Error('Failed'));
      await database.init();
      jest.runAllTimers();

      const instance = database.getInstance();
      expect(instance).not.toBe(mockDexieInstance); // Não é a instância Dexie real
      expect(instance.verno).toEqual('fallback');
      expect(database.isFallback()).toBe(true);
    });

    it('deve lançar um erro se o DB não foi inicializado', () => {
      expect(() => database.getInstance()).toThrow('Database not initialized.');
    });
  });

  describe('Fallback Mode Operations', () => {
    let fallbackDb;

    beforeEach(async () => {
      mockDexieInstance.open.mockRejectedValueOnce(new Error('Force fallback'));
      await database.init();
      jest.runAllTimers();
      fallbackDb = database.getInstance();
    });

    it('table().add() deve adicionar um item no localStorage e retornar um ID', async () => {
      const newItem = { name: 'Test Item' };
      const id = await fallbackDb.table('testTable').add(newItem);

      expect(id).toBe(1);
      const storedData = JSON.parse(localStorage.getItem('RC_Construcoes_DB_testTable'));
      expect(storedData).toHaveLength(1);
      expect(storedData[0]).toHaveProperty('id', 1);
      expect(storedData[0]).toHaveProperty('name', 'Test Item');
    });

    it('table().get() deve retornar um item por ID', async () => {
      await fallbackDb.table('testTable').add({ id: 1, name: 'Item 1' });
      const item = await fallbackDb.table('testTable').get(1);

      expect(item).toHaveProperty('id', 1);
      expect(item).toHaveProperty('name', 'Item 1');
    });

    it('table().toArray() deve retornar todos os itens da tabela', async () => {
      await fallbackDb.table('testTable').add({ name: 'Item A' });
      await fallbackDb.table('testTable').add({ name: 'Item B' });
      const items = await fallbackDb.table('testTable').toArray();

      expect(items).toHaveLength(2);
      expect(items[0]).toHaveProperty('name', 'Item A');
    });

    it('table().update() deve atualizar um item existente', async () => {
      await fallbackDb.table('testTable').add({ id: 1, name: 'Original' });
      const result = await fallbackDb.table('testTable').update(1, { name: 'Updated' });

      expect(result).toBe(1); // Retorna o ID atualizado ou 1 para sucesso
      const updatedItem = await fallbackDb.table('testTable').get(1);
      expect(updatedItem).toHaveProperty('name', 'Updated');
    });

    it('table().delete() deve remover um item', async () => {
      await fallbackDb.table('testTable').add({ id: 1, name: 'Item to delete' });
      const result = await fallbackDb.table('testTable').delete(1);

      expect(result).toBe(1); // Retorna 1 se deletou
      const deletedItem = await fallbackDb.table('testTable').get(1);
      expect(deletedItem).toBeUndefined();
    });

    it('table().where().equals() deve filtrar itens', async () => {
      await fallbackDb.table('filterTable').add({ id: 1, type: 'A' });
      await fallbackDb.table('filterTable').add({ id: 2, type: 'B' });
      await fallbackDb.table('filterTable').add({ id: 3, type: 'A' });

      const results = await fallbackDb.table('filterTable').where('type').equals('A').toArray();
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id', 1);
      expect(results[1]).toHaveProperty('id', 3);
    });
    
    it('table().bulkPut() deve adicionar ou atualizar múltiplos itens', async () => {
        await fallbackDb.table('bulkTable').add({ id: 1, value: 'old' });
        const items = [
            { id: 1, value: 'new' }, // Atualizar
            { id: 2, value: 'added' } // Adicionar
        ];
        await fallbackDb.table('bulkTable').bulkPut(items);

        const allItems = await fallbackDb.table('bulkTable').toArray();
        expect(allItems).toHaveLength(2);
        expect(allItems.find(item => item.id === 1)).toHaveProperty('value', 'new');
        expect(allItems.find(item => item.id === 2)).toHaveProperty('value', 'added');
    });

    it('table().clear() deve limpar a tabela', async () => {
        await fallbackDb.table('clearTable').add({ id: 1, value: 'test' });
        expect(await fallbackDb.table('clearTable').toArray()).toHaveLength(1);
        await fallbackDb.table('clearTable').clear();
        expect(await fallbackDb.table('clearTable').toArray()).toHaveLength(0);
    });
  });
});