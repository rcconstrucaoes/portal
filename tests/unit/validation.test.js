/**
 * RC Construções - Testes Unitários
 * Módulo de Validação (ValidationManager)
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

// Importa o módulo ValidationManager real para teste
const ValidationManagerModule = require('../../js/core/validation');

describe('ValidationManager (Unit Tests)', () => {
  let validationManager; // A instância do ValidationManager

  // Usa fake timers para controlar chamadas assíncronas como setTimeout
  jest.useFakeTimers();

  beforeEach(async () => {
    // Resetar todos os mocks
    jest.clearAllMocks();

    // Re-inicializa o ValidationManager para cada teste
    validationManager = ValidationManagerModule;
    await validationManager.init(); // Garante que o módulo esteja inicializado
    jest.runAllTimers(); // Executa timers de waitForGlobal
  });

  afterEach(() => {
    jest.runOnlyPendingTimers(); // Garante que todos os timers pendentes sejam executados
    jest.clearAllTimers(); // Limpa todos os timers
  });

  describe('init()', () => {
    it('deve inicializar o ValidationManager e logar sucesso', async () => {
      // O init já foi chamado no beforeEach
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        '⚖️ Módulo de Validação inicializado.'
      );
      expect(mockSystemLogger.getAppLogger().success).toHaveBeenCalledWith(
        '✅ ValidationManager disponível globalmente'
      );
      expect(validationManager.isReady()).toBe(true);
    });

    it('deve logar um erro se SystemLogger não for encontrado', async () => {
      // Simula SystemLogger não disponível globalmente
      const originalSystemLogger = global.SystemLogger;
      global.SystemLogger = undefined;

      // Re-inicializa para testar o cenário de erro
      await validationManager.init();
      jest.runAllTimers();

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Falha ao obter SystemLogger no ValidationManager. Usando console fallback.')
      );
      expect(validationManager.isReady()).toBe(false); // Não deve estar pronto

      global.SystemLogger = originalSystemLogger; // Restaurar
    });
  });

  describe('validateEmail()', () => {
    it('deve retornar true para e-mails válidos', () => {
      expect(validationManager.validateEmail('test@example.com')).toBe(true);
      expect(validationManager.validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('deve retornar false para e-mails inválidos e logar um aviso', () => {
      expect(validationManager.validateEmail('invalid-email')).toBe(false);
      expect(validationManager.validateEmail('user@.com')).toBe(false);
      expect(validationManager.validateEmail(null)).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Validação de E-mail falhou:')
      );
    });
  });

  describe('validatePassword()', () => {
    it('deve retornar true para senhas válidas (complexas)', () => {
      expect(validationManager.validatePassword('SenhaForte123!')).toBe(true);
      expect(validationManager.validatePassword('ABCd123$')).toBe(true);
    });

    it('deve retornar false para senhas inválidas e logar um aviso', () => {
      expect(validationManager.validatePassword('curta')).toBe(false); // Muito curta
      expect(validationManager.validatePassword('semnumeroEespecial')).toBe(false);
      expect(validationManager.validatePassword('SEMNUMEROESPECIAL')).toBe(false);
      expect(validationManager.validatePassword('semmaiuscula123!')).toBe(false);
      expect(validationManager.validatePassword('SEM_MINUSCULA123!')).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Validação de Senha falhou: A senha não atende aos requisitos.')
      );
    });
  });

  describe('validateUsername()', () => {
    it('deve retornar true para nomes de usuário válidos', () => {
      expect(validationManager.validateUsername('username123')).toBe(true);
      expect(validationManager.validateUsername('user')).toBe(true); // Mínimo
      expect(validationManager.validateUsername('longusernamevalid123456')).toBe(true); // Máximo
    });

    it('deve retornar false para nomes de usuário inválidos e logar um aviso', () => {
      expect(validationManager.validateUsername('us')).toBe(false); // Muito curto
      expect(validationManager.validateUsername('user with spaces')).toBe(false); // Caracteres inválidos
      expect(validationManager.validateUsername('')).toBe(false); // Vazio
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Validação de Nome de Usuário falhou:')
      );
    });
  });

  describe('validateCPF()', () => {
    it('deve retornar true para CPFs válidos', () => {
      expect(validationManager.validateCPF('123.456.789-00')).toBe(true); // CPF válido real
      expect(validationManager.validateCPF('901.234.567-89')).toBe(true); // Outro válido
      expect(validationManager.validateCPF('12345678900')).toBe(true); // Apenas dígitos
    });

    it('deve retornar false para CPFs inválidos e logar um aviso', () => {
      expect(validationManager.validateCPF('111.111.111-11')).toBe(false); // Dígitos repetidos
      expect(validationManager.validateCPF('123.456.789-0X')).toBe(false); // Formato inválido
      expect(validationManager.validateCPF('123')).toBe(false); // Tamanho inválido
      expect(validationManager.validateCPF(null)).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Validação de CPF falhou:')
      );
    });
  });

  describe('validatePhone()', () => {
    it('deve retornar true para telefones válidos', () => {
      expect(validationManager.validatePhone('(11) 98765-4321')).toBe(true); // Celular
      expect(validationManager.validatePhone('(21) 1234-5678')).toBe(true); // Fixo
      expect(validationManager.validatePhone('11987654321')).toBe(true); // Apenas dígitos
    });

    it('deve retornar false para telefones inválidos e logar um aviso', () => {
      expect(validationManager.validatePhone('123')).toBe(false); // Curto
      expect(validationManager.validatePhone('(00) 00000-000')).toBe(false); // Formato ou dígitos inválidos
      expect(validationManager.validatePhone(null)).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Validação de Telefone falhou:')
      );
    });
  });

  describe('validateNumber()', () => {
    it('deve retornar true para números válidos', () => {
      expect(validationManager.validateNumber(123)).toBe(true);
      expect(validationManager.validateNumber(123.45)).toBe(true);
      expect(validationManager.validateNumber(0)).toBe(true);
      expect(validationManager.validateNumber(-10)).toBe(true);
    });

    it('deve retornar false para não-números e logar um aviso', () => {
      expect(validationManager.validateNumber('abc')).toBe(false);
      expect(validationManager.validateNumber(null)).toBe(false);
      expect(validationManager.validateNumber(undefined)).toBe(false);
      expect(validationManager.validateNumber(NaN)).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Validação de Número falhou:')
      );
    });
  });

  describe('validateNotEmpty()', () => {
    it('deve retornar true para strings não vazias', () => {
      expect(validationManager.validateNotEmpty('hello')).toBe(true);
      expect(validationManager.validateNotEmpty('   test   ')).toBe(true);
    });

    it('deve retornar false para strings vazias ou nulas e logar um aviso', () => {
      expect(validationManager.validateNotEmpty('')).toBe(false);
      expect(validationManager.validateNotEmpty('   ')).toBe(false);
      expect(validationManager.validateNotEmpty(null)).toBe(false);
      expect(validationManager.validateNotEmpty(undefined)).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Validação de String Vazia falhou:')
      );
    });
  });

  describe('validateDateFormat()', () => {
    it('deve retornar true para datas no formato YYYY-MM-DD', () => {
      expect(validationManager.validateDateFormat('2025-01-01')).toBe(true);
      expect(validationManager.validateDateFormat('2024-12-31')).toBe(true);
    });

    it('deve retornar false para datas com formato inválido ou inexistentes', () => {
      expect(validationManager.validateDateFormat('01/01/2025')).toBe(false); // Formato errado
      expect(validationManager.validateDateFormat('2025-13-01')).toBe(false); // Mês inválido
      expect(validationManager.validateDateFormat('invalid-date-string')).toBe(false);
      expect(validationManager.validateDateFormat(null)).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Validação de Formato de Data falhou:')
      );
    });
  });
});