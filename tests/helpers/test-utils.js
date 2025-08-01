/**
 * RC Construções - Utilitários para Testes (Revisado e Aprimorado)
 * Fornece funções auxiliares e comandos Cypress customizados para simplificar a escrita de testes.
 * Inclui login programático, manipulação de dados de teste e helpers de espera/validação.
 */

// Importa os mocks de autenticação e banco de dados
const mockAuth = require('./mock-auth');
const mockDatabase = require('./mock-database');

// =======================================================================
// Configurações Globais de Teste
// =======================================================================
const TEST_CONFIG = {
  baseUrl: 'http://localhost:8080', // URL base do seu frontend em testes E2E
  apiBaseUrl: 'http://localhost:3000/api', // URL base da sua API backend em testes
  loginPage: '/login.html', // Caminho para a página de login
  dashboardPage: '/#dashboard' // Caminho para o dashboard após login
};

// =======================================================================
// Funções Utilitárias para Ambientes de Teste (Node.js/Backend/Jest)
// =======================================================================

/**
 * Retorna uma instância do banco de dados mockado para testes de integração/unitários.
 * @returns {MockDatabase}
 */
function getMockDatabase() {
  return mockDatabase;
}

/**
 * Retorna uma instância do mock de autenticação para testes.
 * @returns {MockAuthManager}
 */
function getMockAuthManager() {
  return mockAuth;
}

/**
 * Reseta o estado de todos os mocks (banco de dados, autenticação).
 * Deve ser chamado em `beforeEach` ou `afterEach` em testes de integração/unitários.
 */
function resetAllMocks() {
  console.log('--- Test Utils: Resetando todos os mocks ---');
  mockDatabase.resetData();
  mockAuth.reset();
}

/**
 * Popula o banco de dados mockado com dados de fixture.
 * @param {string[]} tables - Nomes das tabelas a serem populadas (ex: ['users', 'clients']).
 */
async function populateMockDatabase(tables) {
  console.log('--- Test Utils: Populando banco de dados mockado ---');
  mockDatabase.resetData(); // Começa com um estado limpo
  for (const table of tables) {
    if (mockDatabase.data[table]) {
      console.log(`Populating table: ${table}`);
      // As fixtures já estão carregadas no mockDatabase.data, então não precisamos adicioná-las novamente.
      // Apenas garantir que estejam lá se foram resetadas.
    } else {
      console.warn(`Tabela '${table}' não encontrada nas fixtures para população.`);
    }
  }
}

// =======================================================================
// Comandos Customizados do Cypress (para Testes E2E)
// =======================================================================

if (typeof Cypress !== 'undefined') {
  /**
   * Comando Cypress para login programático na aplicação.
   * Simula o fluxo de login ou, idealmente, define um token JWT no localStorage/sessionStorage.
   * @param {string} username - Usuário para login.
   * @param {string} password - Senha para login.
   */
  Cypress.Commands.add('login', (username, password) => {
    cy.session([username, password], () => {
      cy.visit(TEST_CONFIG.loginPage);
      cy.get('input[name="username"]').type(username);
      cy.get('input[name="password"]').type(password);
      cy.intercept('POST', `${TEST_CONFIG.apiBaseUrl}/auth/login`).as('loginRequest');
      cy.get('[data-testid="login-button"]').click();
      cy.wait('@loginRequest').its('response.statusCode').should('eq', 200);
      cy.url().should('include', TEST_CONFIG.dashboardPage);
      cy.log(`Cypress: Logged in as ${username}`);
    }, {
      // Configurações de sessão para Cypress para evitar login repetido em cada teste
      cacheAcrossSpecs: true,
      validate() {
        // Valida se o usuário ainda está logado
        cy.window().then((win) => {
          return win.sessionStorage.getItem('rc_auth_token');
        }).should('not.be.null');
      }
    });
  });

  /**
   * Comando Cypress para logout programático.
   */
  Cypress.Commands.add('logout', () => {
    cy.visit(TEST_CONFIG.dashboardPage); // Assegura que estamos em uma página onde o logout é possível
    cy.get('.nav-item.logout-item').should('be.visible').click(); // Clica no botão de logout
    cy.intercept('POST', `${TEST_CONFIG.apiBaseUrl}/auth/logout`).as('logoutRequest');
    cy.wait('@logoutRequest');
    cy.url().should('include', TEST_CONFIG.loginPage);
    cy.log('Cypress: Logged out');
    cy.clearLocalStorage(); // Limpa o armazenamento local/sessão
    cy.clearCookies(); // Limpa cookies
  });
  
  /**
   * Comando Cypress para esperar por uma notificação SweetAlert2.
   * @param {string} type - Tipo de alerta ('success', 'error', 'warning', 'info').
   * @param {string} messagePart - Parte da mensagem esperada no alerta.
   */
  Cypress.Commands.add('expectAlert', (type, messagePart) => {
    cy.get(`.swal2-popup.swal2-${type}`).should('be.visible');
    cy.get(`.swal2-popup.swal2-${type}`).should('contain', messagePart);
    cy.get(`.swal2-${type} .swal2-confirm`).click(); // Clica para fechar o alerta
    cy.get(`.swal2-popup.swal2-${type}`).should('not.exist');
  });

  /**
   * Comando Cypress para esperar por uma requisição específica.
   * @param {string} alias - O alias da requisição (ex: '@createClient').
   * @param {number} statusCode - O código de status HTTP esperado.
   */
  Cypress.Commands.add('waitAndValidateRequest', (alias, statusCode) => {
    cy.wait(alias).its('response.statusCode').should('eq', statusCode);
  });
}

// =======================================================================
// Exporta utilitários para uso em Jest (Unitários/Integração)
// =======================================================================
module.exports = {
  getMockDatabase,
  getMockAuthManager,
  resetAllMocks,
  populateMockDatabase,
  TEST_CONFIG
};