/**
 * RC Construções - Mock de Autenticação para Testes (Revisado e Aprimorado)
 * Fornece um mock para o módulo de autenticação (AuthManager) para uso em testes.
 * Simula login, logout, e verificação de usuário/token.
 */

// Importa os dados de usuários de teste (fixtures)
// Assumindo que Cypress/Jest lida com a importação de fixtures
const mockUsers = require('../fixtures/users.json'); //
const MOCK_TOKEN_PREFIX = 'mock_jwt_token_for_user_'; // Prefixo para tokens mockados

class MockAuthManager {
  constructor() {
    this.currentUser = null;
    this.currentToken = null;
    console.log('--- MockAuthManager: Inicializado para testes ---');
  }

  /**
   * Simula o login de um usuário.
   * Encontra o usuário nos mocks e simula a geração de um token.
   * @param {string} username - Nome de usuário ou e-mail.
   * @param {string} password - Senha (não verificada em mock).
   * @returns {Promise<boolean>} True se o login mockado for bem-sucedido.
   */
  async login(username, password) {
    console.log(`MockAuthManager: Tentando login para: ${username}`);
    // Encontra o usuário mockado
    const user = mockUsers.find(
      (u) => u.username === username || u.email === username
    );

    // Simula a verificação de senha e status (muito simplificado para mock)
    // Em um mock mais complexo, você poderia até comparar o hash.
    if (user && user.isActive) {
      this.currentUser = { ...user }; // Cria uma cópia para evitar mutação direta do fixture
      // Simula um token simples
      this.currentToken = MOCK_TOKEN_PREFIX + user.id;
      console.log(`MockAuthManager: Login bem-sucedido para: ${username}`);
      return true;
    }

    console.log(`MockAuthManager: Login falhou para: ${username} (usuário não encontrado ou inativo)`);
    this.currentUser = null;
    this.currentToken = null;
    return false;
  }

  /**
   * Simula o logout.
   */
  async logout() {
    console.log('MockAuthManager: Realizando logout...');
    this.currentUser = null;
    this.currentToken = null;
    console.log('MockAuthManager: Logout concluído.');
  }

  /**
   * Verifica se há um usuário logado.
   * @returns {boolean} True se um usuário estiver logado.
   */
  isAuthenticated() {
    return this.currentUser !== null && this.currentToken !== null;
  }

  /**
   * Retorna os dados do usuário logado.
   * @returns {Object|null} Dados do usuário ou null.
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Retorna o token mockado.
   * @returns {string|null} Token mockado ou null.
   */
  getToken() {
    return this.currentToken;
  }

  /**
   * Limpa o estado do mock entre os testes.
   */
  reset() {
    this.currentUser = null;
    this.currentToken = null;
    console.log('MockAuthManager: Estado resetado.');
  }
}

// Exporta uma instância do MockAuthManager
module.exports = new MockAuthManager();