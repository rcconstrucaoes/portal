/**
 * RC Construções - Testes Unitários
 * Módulo de Segurança (SecurityManager)
 * Versão 5.1 - Revisado e Aprimorado
 */

// Mocka a biblioteca bcrypt.js
const mockBcrypt = {
  genSaltSync: jest.fn(() => 'mockSalt'),
  hashSync: jest.fn((password, salt) => `hashed_${password}_${salt}`),
  compareSync: jest.fn((password, hash) => hash === `hashed_${password}_mockSalt`),
  // Adicione mock para hash (assíncrono) se o seu código usa hash assíncrono
};
global.dcodeIO = { bcrypt: mockBcrypt }; // Simula a exposição global de bcrypt.js

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

// Mocka AuthManager (se SecurityManager o usar)
const mockAuthManager = {
  // Mocka métodos se eles forem chamados diretamente por SecurityManager
};
global.AuthManager = mockAuthManager;


// Importa o módulo SecurityManager real para teste
const SecurityManagerModule = require('../../js/core/security');

describe('SecurityManager (Unit Tests)', () => {
  let securityManager; // A instância do SecurityManager

  // Usa fake timers para controlar chamadas assíncronas como setTimeout
  jest.useFakeTimers();

  beforeEach(async () => {
    // Resetar todos os mocks
    jest.clearAllMocks();

    // Re-inicializa o SecurityManager para cada teste
    securityManager = SecurityManagerModule;
    await securityManager.init(); // Garante que o módulo esteja inicializado
    jest.runAllTimers(); // Executa timers de waitForGlobal
  });

  afterEach(() => {
    jest.runOnlyPendingTimers(); // Garante que todos os timers pendentes sejam executados
    jest.clearAllTimers(); // Limpa todos os timers
  });

  describe('init()', () => {
    it('deve inicializar o SecurityManager e logar sucesso', async () => {
      // O init já foi chamado no beforeEach
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        '🔐 SecurityManager criado, aguardando inicialização...'
      );
      expect(mockBcrypt.genSaltSync).toHaveBeenCalledTimes(1); // Chamado no self-test
      expect(mockBcrypt.hashSync).toHaveBeenCalledTimes(1); // Chamado no self-test
      expect(mockBcrypt.compareSync).toHaveBeenCalledTimes(1); // Chamado no self-test
      expect(mockSystemLogger.getAppLogger().success).toHaveBeenCalledWith(
        '✅ SecurityManager inicializado com sucesso'
      );
    });

    it('deve logar um erro se bcrypt.js não for encontrado', async () => {
      // Simula bcrypt.js não disponível globalmente
      const originalBcrypt = global.dcodeIO.bcrypt;
      global.dcodeIO.bcrypt = undefined;

      // Re-inicializa para testar o cenário de erro
      await securityManager.init();
      jest.runAllTimers();

      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        'Erro crítico ao inicializar SecurityManager:',
        expect.any(Error)
      );
      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Falha na inicialização do SecurityManager: bcrypt.js não encontrado ou não funcional.')
      );

      global.dcodeIO.bcrypt = originalBcrypt; // Restaurar
    });

    it('deve logar um erro se o auto-teste falhar', async () => {
      mockBcrypt.compareSync.mockReturnValueOnce(false); // Força a falha no auto-teste

      // Re-inicializa
      await securityManager.init();
      jest.runAllTimers();

      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Auto-teste do SecurityManager falhou.'),
        expect.any(Error)
      );
      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Falha na inicialização do SecurityManager: Auto-teste do SecurityManager falhou.')
      );
    });
  });

  describe('hashPassword()', () => {
    it('deve gerar um hash para a senha fornecida', async () => {
      const password = 'mySecurePassword';
      const hash = await securityManager.hashPassword(password);

      expect(mockBcrypt.genSaltSync).toHaveBeenCalledTimes(2); // Uma no init, outra aqui
      expect(mockBcrypt.hashSync).toHaveBeenCalledTimes(2); // Uma no init, outra aqui
      expect(hash).toEqual(`hashed_${password}_mockSalt`);
      expect(mockSystemLogger.getAppLogger().error).not.toHaveBeenCalled();
    });

    it('deve retornar null e logar erro se a senha for nula ou vazia', async () => {
      const hash = await securityManager.hashPassword(null);

      expect(hash).toBeNull();
      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao gerar hash da senha:')
      );
    });
  });

  describe('checkPassword()', () => {
    it('deve retornar true para senha correta e hash correspondente', async () => {
      const password = 'mySecurePassword';
      const hash = 'hashed_mySecurePassword_mockSalt';
      const isMatch = await securityManager.checkPassword(password, hash);

      expect(mockBcrypt.compareSync).toHaveBeenCalledTimes(2); // Uma no init, outra aqui
      expect(mockBcrypt.compareSync).toHaveBeenCalledWith(password, hash);
      expect(isMatch).toBe(true);
      expect(mockSystemLogger.getAppLogger().error).not.toHaveBeenCalled();
    });

    it('deve retornar false para senha incorreta', async () => {
      const password = 'wrongPassword';
      const hash = 'hashed_mySecurePassword_mockSalt';
      // Mockamos mockBcrypt.compareSync para retornar false quando as senhas não combinam
      mockBcrypt.compareSync.mockImplementationOnce(() => false); 

      const isMatch = await securityManager.checkPassword(password, hash);

      expect(mockBcrypt.compareSync).toHaveBeenCalledWith(password, hash);
      expect(isMatch).toBe(false);
      expect(mockSystemLogger.getAppLogger().error).not.toHaveBeenCalled();
    });
  });

  describe('encryptData() e decryptData()', () => {
    // Estas são funções placeholder, testamos o que elas fazem atualmente
    it('deve "criptografar" dados (btoa) e "descriptografar" (atob) corretamente', () => {
      const data = 'some sensitive data';
      const key = 'mySecretKey';

      const encrypted = securityManager.encryptData(data, key);
      expect(encrypted).not.toEqual(data); // Deve ser diferente do original
      expect(typeof encrypted).toBe('string');

      const decrypted = securityManager.decryptData(encrypted, key);
      expect(decrypted).toEqual(data);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        'Função encryptData é um placeholder e não implementa criptografia forte.'
      );
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        'Função decryptData é um placeholder e não implementa descriptografia forte.'
      );
    });

    it('deve retornar os dados originais se a chave de descriptografia estiver incorreta', () => {
      const data = 'some sensitive data';
      const key = 'mySecretKey';
      const wrongKey = 'wrongKey';

      const encrypted = securityManager.encryptData(data, key);
      const decrypted = securityManager.decryptData(encrypted, wrongKey);

      expect(decrypted).toEqual(encrypted); // Deve retornar o criptografado se a chave estiver errada
    });
  });
});