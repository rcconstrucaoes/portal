/**
 * RC Construções - Testes Unitários
 * Módulo de Autenticação (AuthManager)
 * Versão 5.1 - Revisado e Aprimorado
 */

// Mocka as dependências globais que o AuthManager espera
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

const mockSettingsManager = {
  getSetting: jest.fn((key) => {
    if (key === 'rc_login_attempts') return '0'; // Padrão para tentativas de login
    return null;
  }),
  setSetting: jest.fn(),
};
global.SettingsManager = mockSettingsManager;

const mockSecurityManager = {
  hashPassword: jest.fn(async (password) => `hashed_${password}`),
  checkPassword: jest.fn(async (password, hash) => hash === `hashed_${password}`),
};
global.SecurityManager = mockSecurityManager;

const mockDatabaseInstance = {
  table: jest.fn(() => ({
    add: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    where: jest.fn(() => ({
      equals: jest.fn(() => ({
        first: jest.fn(() => null), // Retorna null por padrão para simular usuário não existente
      })),
    })),
  })),
  getInstance: jest.fn(() => mockDatabaseInstance),
};
global.Database = mockDatabaseInstance; // Mocka o Database globalmente

const mockValidationManager = {
  validateEmail: jest.fn((email) => email.includes('@') && email.includes('.')),
  validatePassword: jest.fn((password) => password.length >= 8),
  validateUsername: jest.fn((username) => username.length >= 3),
};
global.ValidationManager = mockValidationManager;

const mockSystemEventHandler = {
  on: jest.fn(),
  emit: jest.fn(),
};
global.SystemEventHandler = mockSystemEventHandler;

// Mocka SweetAlert2 (Swal) se ele for usado para exibir mensagens
const mockSwal = {
  fire: jest.fn(() => Promise.resolve({ isConfirmed: true })),
};
global.Swal = mockSwal;

// Importa o módulo AuthManager real para teste
const AuthManagerModule = require('../../js/core/auth'); // O IIFE retorna o módulo

describe('AuthManager (Unit Tests)', () => {
  let authManager; // A instância do AuthManager

  // Configurações mockadas para AuthManager (para corresponder ao authConfig do backend)
  const MOCK_AUTH_CONFIG = {
    maxLoginAttempts: 3,
    sessionTimeout: 10000, // 10 segundos para teste
    tokenKey: 'rc_auth_token',
    userKey: 'rc_current_user',
    loginAttemptsKey: 'rc_login_attempts',
    backendEndpoints: {
      login: '/api/auth/login',
      register: '/api/auth/register',
    },
    storageType: 'sessionStorage',
    secret: 'test-secret', // Para jwt.sign/verify
    expiresIn: '1h',
    defaultRoles: {
      admin: { name: 'Administrador', permissions: ['system.admin'] },
      user: { name: 'Usuário Padrão', permissions: ['dashboard.view'] },
    },
    availablePermissions: ['system.admin', 'dashboard.view'],
  };

  // Mocka jwt (json-web-token)
  const mockJwt = {
    sign: jest.fn(() => 'mock-jwt-token'),
    verify: jest.fn(() => ({ id: 1, role: 'user' })),
    decode: jest.fn(() => ({ exp: Date.now() / 1000 + 3600 })), // Expira em 1h
  };
  jest.mock('jsonwebtoken', () => mockJwt); // Mocka a importação de jsonwebtoken

  beforeEach(async () => {
    // Resetar estado do localStorage/sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // Resetar mocks
    jest.clearAllMocks();
    mockSettingsManager.getSetting.mockClear();
    mockSettingsManager.setSetting.mockClear();
    mockSecurityManager.hashPassword.mockClear();
    mockSecurityManager.checkPassword.mockClear();
    mockDatabaseInstance.table.mockClear();
    mockValidationManager.validateEmail.mockClear();
    mockValidationManager.validatePassword.mockClear();
    mockValidationManager.validateUsername.mockClear();
    mockSystemEventHandler.on.mockClear();
    mockSystemEventHandler.emit.mockClear();
    mockSwal.fire.mockClear();

    // Para cada teste, re-inicializa o AuthManager.
    // É importante garantir que init() seja chamado com um estado limpo.
    authManager = AuthManagerModule; // Obtém a instância do IIFE

    // Sobrescreve a config interna do AuthManager com a mockada para controle no teste
    // Isso é feito porque a config é um const dentro do IIFE. Em um ambiente real,
    // a config viria do authConfig.js via require.
    Object.assign(authManager.config, MOCK_AUTH_CONFIG);

    // Init do AuthManager (chama o init real que está dentro do IIFE)
    await authManager.init();
  });

  describe('init()', () => {
    it('deve inicializar o AuthManager e carregar a sessão se houver', async () => {
      // Simula uma sessão salva
      sessionStorage.setItem(
        MOCK_AUTH_CONFIG.userKey,
        JSON.stringify({ id: 1, username: 'testuser' })
      );
      sessionStorage.setItem(MOCK_AUTH_CONFIG.tokenKey, 'test-token');

      // Re-inicializa para simular carregamento de sessão
      await authManager.init(); // O init já chama loadSession

      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getCurrentUser()).toEqual({ id: 1, username: 'testuser' });
      expect(mockSystemLogger.getAppLogger().info).toHaveBeenCalledWith(
        'Sessão carregada para o usuário: testuser'
      );
    });
  });

  describe('login()', () => {
    it('deve fazer login com sucesso com credenciais válidas', async () => {
      // Mock da resposta do fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: 1, username: 'admin', email: 'admin@rc.com', role: 'admin', permissions: ['system.admin'] },
          token: 'mock_jwt_admin_token'
        }),
      });

      // Mocka a busca de usuário no DB para o login
      mockDatabaseInstance.table().where().equals().first.mockResolvedValueOnce({
        id: 1,
        username: 'admin',
        email: 'admin@rc.com',
        passwordHash: 'hashed_password123',
        isActive: true,
        role: 'admin',
        permissions: ['system.admin'],
      });
      mockSecurityManager.checkPassword.mockResolvedValueOnce(true); // Senha correta

      const success = await authManager.login('admin@rc.com', 'password123');

      expect(success).toBe(true);
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getCurrentUser().username).toEqual('admin');
      expect(sessionStorage.getItem(MOCK_AUTH_CONFIG.tokenKey)).toEqual('mock_jwt_admin_token');
      expect(mockSystemLogger.getAppLogger().success).toHaveBeenCalledWith('Usuário admin@rc.com logado com sucesso!');
      expect(mockSystemEventHandler.emit).toHaveBeenCalledWith('userLoggedIn', expect.any(Object));
    });

    it('deve retornar false e logar erro para credenciais inválidas', async () => {
      // Mock da resposta do fetch para falha (401)
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' }),
      });

      // Mocka a busca de usuário no DB para o login
      mockDatabaseInstance.table().where().equals().first.mockResolvedValueOnce({ // Usuário existe para falha de senha
        id: 1, username: 'admin', email: 'admin@rc.com', passwordHash: 'wrong_hash', isActive: true,
      });
      mockSecurityManager.checkPassword.mockResolvedValueOnce(false); // Senha incorreta

      const success = await authManager.login('admin@rc.com', 'wrong_password');

      expect(success).toBe(false);
      expect(authManager.isAuthenticated()).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Login falhou para admin@rc.com: Credenciais inválidas.')
      );
      expect(mockSystemEventHandler.emit).toHaveBeenCalledWith('loginFailed', expect.any(Object));
    });

    it('deve bloquear o login após exceder o número de tentativas', async () => {
      // Simula tentativas de login falhas
      mockSettingsManager.getSetting.mockReturnValueOnce('2'); // Já teve 2 tentativas
      mockSettingsManager.getSetting.mockReturnValueOnce('3'); // Na 3a, atinge o limite
      
      // Simula falha de login para atingir o limite
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Credenciais inválidas' }),
      });
      
      // Realiza login inválido 3 vezes para exceder o limite de 3 tentativas
      await authManager.login('test@test.com', 'wrong'); // 1a falha
      await authManager.login('test@test.com', 'wrong'); // 2a falha
      await authManager.login('test@test.com', 'wrong'); // 3a falha (limite)

      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Login bloqueado para test@test.com: Excedeu o número máximo de tentativas.')
      );
      expect(mockSwal.fire).toHaveBeenCalledTimes(1); // SweetAlert de bloqueio
    });
  });

  describe('register()', () => {
    const newUserData = {
      name: 'Novo Usuário',
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'NewPassword123!',
      role: 'user',
    };

    it('deve registrar um novo usuário com sucesso', async () => {
      // Mock de fetch para sucesso no registro
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: 2, ...newUserData, passwordHash: 'hashed_NewPassword123!' },
        }),
      });

      // Mock para verificar se usuário já existe (retorna null = não existe)
      mockDatabaseInstance.table().where().equals().first.mockResolvedValueOnce(null);

      const success = await authManager.register(newUserData);

      expect(success).toBe(true);
      expect(mockSystemLogger.getAppLogger().success).toHaveBeenCalledWith(
        expect.stringContaining('Usuário newuser registrado com sucesso')
      );
      expect(mockSecurityManager.hashPassword).toHaveBeenCalledWith(newUserData.password);
      expect(mockSystemEventHandler.emit).toHaveBeenCalledWith('userRegistered', expect.any(Object));
    });

    it('deve retornar false e logar erro para dados de registro inválidos', async () => {
      const invalidUserData = { ...newUserData, email: 'invalid-email' }; // Email inválido

      const success = await authManager.register(invalidUserData);

      expect(success).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        'Registro falhou: Dados de usuário inválidos.'
      );
      expect(mockSystemEventHandler.emit).toHaveBeenCalledWith('registrationFailed', expect.any(Object));
    });

    it('deve retornar false para email ou username já existente', async () => {
      // Mocka que o usuário já existe
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: 'E-mail ou nome de usuário já cadastrado', code: 'DUPLICATE_USER' }),
      });
      mockDatabaseInstance.table().where().equals().first.mockResolvedValueOnce({
        id: 1, email: newUserData.email
      });

      const success = await authManager.register(newUserData);

      expect(success).toBe(false);
      expect(mockSystemLogger.getAppLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('Registro falhou para newuser@example.com: E-mail ou nome de usuário já cadastrado')
      );
    });
  });

  describe('logout()', () => {
    it('deve deslogar o usuário e limpar a sessão', async () => {
      // Simula um usuário logado antes do logout
      authManager.login('admin@rc.com', 'password123'); // Assume que isso preenche currentUser e token
      authManager.currentToken = 'fake-token'; // Garante que há um token para limpar

      await authManager.logout();

      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getCurrentUser()).toBeNull();
      expect(sessionStorage.getItem(MOCK_AUTH_CONFIG.tokenKey)).toBeNull();
      expect(mockSystemLogger.getAppLogger().success).toHaveBeenCalledWith(
        'Usuário deslogado com sucesso!'
      );
      expect(mockSystemEventHandler.emit).toHaveBeenCalledWith('userLoggedOut', expect.any(Object));
    });
  });

  describe('isAuthenticated()', () => {
    it('deve retornar true se o usuário estiver autenticado', async () => {
      authManager.currentUser = { id: 1 };
      authManager.currentToken = 'valid-token';
      mockJwt.verify.mockReturnValueOnce({ id: 1, exp: Date.now() / 1000 + 1000 }); // Token válido

      expect(authManager.isAuthenticated()).toBe(true);
    });

    it('deve retornar false se não houver token', () => {
      authManager.currentUser = { id: 1 };
      authManager.currentToken = null;

      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('deve retornar false se o token for inválido ou expirado', () => {
      authManager.currentUser = { id: 1 };
      authManager.currentToken = 'invalid-token';
      mockJwt.verify.mockImplementationOnce(() => {
        throw new Error('Token inválido');
      });

      expect(authManager.isAuthenticated()).toBe(false);
      expect(mockSystemLogger.getAppLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao validar token: Token inválido')
      );
    });
  });

  describe('getCurrentUser()', () => {
    it('deve retornar o objeto do usuário atual', () => {
      const user = { id: 1, username: 'testuser' };
      authManager.currentUser = user;
      expect(authManager.getCurrentUser()).toEqual(user);
    });

    it('deve retornar null se não houver usuário logado', () => {
      authManager.currentUser = null;
      expect(authManager.getCurrentUser()).toBeNull();
    });
  });
});