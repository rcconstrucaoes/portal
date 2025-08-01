/**
 * RC Construções - Testes E2E
 * Navegação do Dashboard
 * Versão 5.1 - Revisado e Aprimorado
 */

describe('Navegação do Dashboard', () => {
  const adminUser = 'admin@rc-construcoes.com';
  const adminPassword = 'password123';

  beforeEach(() => {
    cy.login(adminUser, adminPassword);
    cy.visit('/'); // Visita a raiz, que deve carregar o dashboard por padrão
    cy.url().should('include', '/#dashboard'); // Verifica se a URL reflete a navegação para o dashboard
    cy.get('.app-container').should('be.visible'); // Garante que o container principal está visível
  });

  afterEach(() => {
    cy.clearLocalStorage();
    cy.reload();
  });

  it('deve exibir os componentes principais do dashboard (cabeçalho, sidebar, conteúdo)', () => {
    // Verifica o cabeçalho
    cy.get('.sidebar-header').should('be.visible');
    cy.get('.nav-logo img').should('be.visible'); // Verifica a logo

    // Verifica a sidebar de navegação
    cy.get('.nav-menu').should('be.visible');
    cy.get('.nav-list .nav-item').should('have.length.at.least', 5); // Pelo menos 5 itens de navegação
    cy.get('.nav-item.active').should('contain', 'Dashboard'); // Verifica se Dashboard está ativo

    // Verifica a área de conteúdo principal
    cy.get('#main-content').should('be.visible');
    cy.get('.page-dashboard').should('be.visible'); // Garante que o conteúdo do dashboard foi carregado
  });

  it('deve permitir navegar para a página de clientes via sidebar', () => {
    cy.get('.nav-item[data-page="clients"]').click();
    cy.url().should('include', '/#clients');
    cy.get('.page-container').should('contain', 'Clientes'); // Verifica se o título da página mudou
    cy.get('.nav-item[data-page="clients"]').should('have.class', 'active'); // Verifica se o item da sidebar está ativo
  });

  it('deve permitir navegar para a página de orçamentos via sidebar', () => {
    cy.get('.nav-item[data-page="budgets"]').click();
    cy.url().should('include', '/#budgets');
    cy.get('.page-container').should('contain', 'Orçamentos');
    cy.get('.nav-item[data-page="budgets"]').should('have.class', 'active');
  });

  it('deve permitir navegar para a página de contratos via sidebar', () => {
    cy.get('.nav-item[data-page="contracts"]').click();
    cy.url().should('include', '/#contracts');
    cy.get('.page-container').should('contain', 'Contratos');
    cy.get('.nav-item[data-page="contracts"]').should('have.class', 'active');
  });

  it('deve permitir navegar para a página financeira via sidebar', () => {
    cy.get('.nav-item[data-page="financial"]').click();
    cy.url().should('include', '/#financial');
    cy.get('.page-container').should('contain', 'Financeiro');
    cy.get('.nav-item[data-page="financial"]').should('have.class', 'active');
  });

  it('deve exibir as atividades recentes no dashboard', () => {
    cy.visit('/#dashboard'); // Garante que estamos no dashboard
    cy.get('.recent-activities').should('be.visible');
    cy.get('.recent-activities h4').should('contain', 'Atividades Recentes');
    cy.get('#recent-activities-list li').should('have.length.at.least', 1); // Garante que há atividades
  });

  it('deve permitir filtrar dados do dashboard por período', () => {
    cy.visit('/#dashboard'); // Garante que estamos no dashboard
    cy.get('.date-range-picker').should('be.visible');
    cy.get('#start-date').should('have.value'); // Verifica que a data inicial está preenchida
    cy.get('#end-date').should('have.value'); // Verifica que a data final está preenchida

    // Altera a data de início (exemplo: para o primeiro dia do ano atual)
    cy.get('#start-date').type('2025-01-01');
    cy.get('#end-date').type('2025-01-31');
    cy.get('.date-range-picker .btn').click(); // Clica no botão 'Aplicar'

    // Assumindo que a UI reflete o filtro aplicado, ou que os gráficos são recarregados
    cy.get('.chart-container').should('be.visible'); // Verifica se os gráficos ainda estão lá
    // Opcional: verificar dados específicos que seriam afetados pelo filtro
  });

  it('deve exibir o comportamento responsivo da sidebar em telas menores', () => {
    cy.viewport('iphone-x'); // Simula um dispositivo móvel
    cy.wait(500); // Aguarda a transição CSS

    // Verifica se a sidebar está colapsada (apenas ícones visíveis)
    cy.get('.sidebar').should('have.css', 'width', '80px');
    cy.get('.sidebar .nav-item span').each(($span) => {
        cy.wrap($span).should('not.be.visible'); // Textos devem estar invisíveis
    });

    // Se houver um botão de menu/expansão em mobile, clique nele
    // cy.get('[data-testid="mobile-menu-toggle"]').click(); // Exemplo
    // cy.get('.sidebar').should('not.have.css', 'width', '80px'); // Deve expandir
    // cy.get('.sidebar .nav-item span').first().should('be.visible'); // Texto deve ficar visível

    cy.viewport('macbook-15'); // Volta para o desktop
    cy.wait(500);
    cy.get('.sidebar').should('have.css', 'width', '250px'); // Deve estar expandida
    cy.get('.sidebar .nav-item span').first().should('be.visible');
  });

  it('deve permitir o logout do usuário', () => {
    cy.get('.nav-item.logout-item').click(); // Clica no item de logout na sidebar

    // Intercepta a requisição de logout (se houver)
    cy.intercept('POST', '/api/auth/logout').as('logoutRequest');

    // Assumindo que o logout redireciona para a página de login
    cy.url().should('include', '/login.html'); // Ou a URL da sua página de login
    cy.wait('@logoutRequest').its('response.statusCode').should('eq', 200); // Verifica se a requisição foi bem-sucedida

    // Verifica se o usuário não está mais autenticado (tentando acessar uma rota protegida)
    cy.visit('/#dashboard');
    cy.url().should('include', '/login.html'); // Deve redirecionar de volta para o login
  });
});