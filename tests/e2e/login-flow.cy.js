/**
 * RC Construções - Testes E2E
 * Fluxo de Login e Logout
 * Versão 5.1 - Revisado e Aprimorado
 */

describe('Fluxo de Login e Logout', () => {
  const adminUser = 'admin@rc-construcoes.com';
  const adminPassword = 'password123';
  const invalidUser = 'invalid@example.com';
  const wrongPassword = 'wrongpassword';

  beforeEach(() => {
    cy.visit('/login.html'); // Visita a página de login diretamente
  });

  afterEach(() => {
    cy.clearLocalStorage(); // Limpa o localStorage e sessionStorage após cada teste
    cy.reload(); // Recarrega a página para garantir um estado limpo
  });

  it('deve exibir o formulário de login', () => {
    cy.get('[data-testid="login-form"]').should('be.visible');
    cy.get('input[name="username"]').should('be.visible').and('have.attr', 'placeholder', 'E-mail ou Usuário'); // Verifica placeholder
    cy.get('input[name="password"]').should('be.visible').and('have.attr', 'placeholder', 'Senha');
    cy.get('[data-testid="login-button"]').should('be.visible').and('contain', 'Entrar');
    cy.get('[data-testid="forgot-password-link"]').should('be.visible');
    cy.get('[data-testid="register-link"]').should('be.visible');
  });

  it('deve fazer login com sucesso com credenciais válidas', () => {
    cy.get('input[name="username"]').type(adminUser);
    cy.get('input[name="password"]').type(adminPassword);
    cy.intercept('POST', '/api/auth/login').as('loginRequest'); // Intercepta a requisição de login

    cy.get('[data-testid="login-button"]').click();

    cy.wait('@loginRequest').its('response.statusCode').should('eq', 200); // Espera a requisição e verifica o status
    
    cy.url().should('include', '/#dashboard'); // Verifica redirecionamento para o dashboard
    cy.get('.sidebar-header').should('be.visible'); // Verifica se a UI do dashboard carregou
    cy.get('.nav-item.active').should('contain', 'Dashboard');
    
    // Verifica se o token está no armazenamento local (sessionStorage neste caso)
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('rc_auth_token')).to.not.be.null;
    });
  });

  it('deve exibir erro para credenciais inválidas', () => {
    cy.get('input[name="username"]').type(invalidUser);
    cy.get('input[name="password"]').type(wrongPassword);
    cy.intercept('POST', '/api/auth/login').as('loginRequest');

    cy.get('[data-testid="login-button"]').click();

    cy.wait('@loginRequest').its('response.statusCode').should('eq', 401); // Espera a requisição e verifica o status de erro
    
    // Verifica a mensagem de erro na UI (assumindo que a mensagem é exibida por NotificationsModule ou no próprio formulário)
    cy.get('.swal2-popup').should('be.visible').and('contain', 'Credenciais inválidas'); // SweetAlert2 para erro
    cy.get('.swal2-confirm').click(); // Clica para fechar o alerta
    cy.get('.swal2-popup').should('not.exist');
    
    cy.url().should('include', '/login.html'); // Permanece na página de login
  });

  it('deve lidar com muitas tentativas de login (rate limiting)', () => {
    // Tenta fazer login com credenciais inválidas múltiplas vezes para acionar o rate limit (5 tentativas por 5 min no backend/config/auth.js)
    for (let i = 0; i < 5; i++) { // Se o limite é 5, tentaremos 5 vezes
      cy.get('input[name="username"]').type(adminUser);
      cy.get('input[name="password"]').type(wrongPassword);
      cy.intercept('POST', '/api/auth/login').as(`loginAttempt${i}`);
      cy.get('[data-testid="login-button"]').click();
      cy.wait(`@loginAttempt${i}`).its('response.statusCode').should('eq', 401);
      
      // Limpa os campos para a próxima tentativa
      cy.get('input[name="username"]').clear();
      cy.get('input[name="password"]').clear();
    }
    
    // Na 6ª tentativa, deve receber o erro de rate limit
    cy.get('input[name="username"]').type(adminUser);
    cy.get('input[name="password"]').type(wrongPassword);
    cy.intercept('POST', '/api/auth/login').as('finalLoginAttempt');
    cy.get('[data-testid="login-button"]').click();
    
    cy.wait('@finalLoginAttempt').its('response.statusCode').should('eq', 429); // 429 Too Many Requests
    
    cy.get('.swal2-popup').should('be.visible').and('contain', 'Muitas tentativas de login'); // Verifica a mensagem de erro
    cy.get('.swal2-confirm').click();
  });

  it('deve redirecionar para a página solicitada após o login', () => {
    cy.visit('/#clients'); // Tenta visitar uma página protegida diretamente
    cy.url().should('include', '/login.html'); // Deve ser redirecionado para o login

    cy.get('input[name="username"]').type(adminUser);
    cy.get('input[name="password"]').type(adminPassword);
    cy.intercept('POST', '/api/auth/login').as('loginRequest');
    cy.get('[data-testid="login-button"]').click();

    cy.wait('@loginRequest');
    cy.url().should('include', '/#clients'); // Deve ser redirecionado de volta para a página de clientes
    cy.get('.page-container').should('contain', 'Clientes'); // Verifica o conteúdo da página
  });

  it('deve lidar com o logout corretamente', () => {
    // Primeiro, faça login
    cy.login(adminUser, adminPassword);
    cy.visit('/#dashboard');
    cy.url().should('include', '/#dashboard');

    // Clica no botão de logout na sidebar (assumindo data-page="logout" ou um data-testid)
    cy.get('.nav-item.logout-item').click();
    
    cy.intercept('POST', '/api/auth/logout').as('logoutRequest'); // Intercepta a requisição de logout (se houver)

    cy.url().should('include', '/login.html'); // Verifica redirecionamento para a página de login
    cy.wait('@logoutRequest').its('response.statusCode').should('eq', 200); // Verifica se a requisição foi bem-sucedida

    // Verifica se o token foi removido do armazenamento local
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem('rc_auth_token')).to.be.null;
    });

    // Tenta acessar uma página protegida para confirmar que está deslogado
    cy.visit('/#dashboard');
    cy.url().should('include', '/login.html'); // Deve ser redirecionado de volta para o login
  });
});