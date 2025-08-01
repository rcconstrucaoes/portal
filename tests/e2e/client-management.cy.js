/**
 * RC Construções - Testes E2E
 * Gerenciamento de Clientes
 * Versão 5.1 - Revisado e Aprimorado
 */

describe('Gerenciamento de Clientes', () => {
  const adminUser = 'admin@rc-construcoes.com';
  const adminPassword = 'password123';

  // Antes de cada teste, faça login e navegue para a página de clientes
  beforeEach(() => {
    cy.login(adminUser, adminPassword);
    cy.visit('/#clients'); // Navega para a rota de clientes
    cy.url().should('include', '/clients');
    cy.get('.page-container').should('be.visible');
  });

  // Limpa o estado após cada teste (opcional, dependendo de como você gerencia o DB)
  afterEach(() => {
    cy.clearLocalStorage();
    cy.reload();
  });

  it('deve exibir a lista de clientes', () => {
    cy.get('[data-page="clients"]').should('have.class', 'active'); // Garante que a sidebar está ativa
    cy.get('.dashboard-header h3').should('contain', 'Clientes'); // Verifica o título da página

    // Verifica se a tabela de clientes ou um container de lista está visível e contém itens
    cy.get('.table-container').should('be.visible');
    cy.get('.table tbody tr').should('have.length.at.least', 1); // Garante que há pelo menos 1 cliente
  });

  it('deve permitir criar um novo cliente', () => {
    cy.get('[data-testid="add-client-button"]').click(); // Clica no botão de adicionar cliente
    cy.get('.modal-content').should('be.visible'); // Assumindo que um modal se abre para o formulário

    // Preenche o formulário de novo cliente
    cy.get('input[name="name"]').type('Novo Cliente Teste S/A');
    cy.get('input[name="email"]').type('novo.teste@example.com');
    cy.get('input[name="phone"]').type('(99) 98765-4321');
    cy.get('input[name="address"]').type('Rua Nova, 123 - Centro');
    cy.get('input[name="cpf"]').type('123.456.789-01'); // Preenche com CPF válido

    cy.intercept('POST', '/api/clients').as('createClient'); // Intercepta a requisição POST

    cy.get('[data-testid="submit-client-button"]').click(); // Clica em salvar

    cy.wait('@createClient').its('response.statusCode').should('eq', 201); // Espera a requisição e verifica o status
    
    // Verifica a notificação de sucesso (assumindo SweetAlert2)
    cy.get('.swal2-success').should('be.visible'); // Verifica se uma notificação de sucesso aparece
    cy.get('.modal-content').should('not.be.visible'); // Verifica se o modal foi fechado

    // Verifica se o novo cliente aparece na lista (pode exigir recarregar ou aguardar a UI)
    cy.get('.table tbody').should('contain', 'Novo Cliente Teste S/A');
    cy.get('.table tbody').should('contain', 'novo.teste@example.com');
  });

  it('deve permitir visualizar os detalhes de um cliente', () => {
    // Clica no primeiro cliente da lista para ver os detalhes (assumindo que a linha inteira é clicável)
    cy.get('.table tbody tr').first().click();

    cy.get('.modal-content').should('be.visible'); // Verifica se o modal de detalhes é visível
    cy.get('.modal-header h2').should('contain', 'Detalhes do Cliente');
    cy.get('[data-testid="client-detail-name"]').should('not.be.empty'); // Verifica se o nome do cliente é exibido
    cy.get('[data-testid="client-detail-email"]').should('contain', '@'); // Verifica se o email é exibido
    
    cy.get('.modal-close').click(); // Fecha o modal
    cy.get('.modal-content').should('not.be.visible');
  });

  it('deve permitir editar um cliente existente', () => {
    // Clica no botão de editar do primeiro cliente (assumindo que há um botão de editar por linha)
    cy.get('.table tbody tr').first().find('[data-testid="edit-client-button"]').click();
    cy.get('.modal-content').should('be.visible');

    // Altera o nome e o telefone
    cy.get('input[name="name"]').clear().type('Cliente Editado S.A.');
    cy.get('input[name="phone"]').clear().type('(88) 87654-3210');

    cy.intercept('PUT', '/api/clients/*').as('updateClient'); // Intercepta a requisição PUT

    cy.get('[data-testid="submit-client-button"]').click(); // Clica em salvar

    cy.wait('@updateClient').its('response.statusCode').should('eq', 200);
    
    cy.get('.swal2-success').should('be.visible');
    cy.get('.modal-content').should('not.be.visible');

    // Verifica se as alterações são refletidas na lista
    cy.get('.table tbody').should('contain', 'Cliente Editado S.A.');
    cy.get('.table tbody').should('contain', '(88) 87654-3210');
  });

  it('deve permitir excluir um cliente', () => {
    cy.intercept('DELETE', '/api/clients/*').as('deleteClient'); // Intercepta a requisição DELETE

    // Clica no botão de excluir do primeiro cliente
    cy.get('.table tbody tr').first().find('[data-testid="delete-client-button"]').click();

    // Confirma a exclusão (assumindo SweetAlert2)
    cy.get('.swal2-popup').should('be.visible');
    cy.contains('.swal2-confirm', 'Sim, excluir!').click();

    cy.wait('@deleteClient').its('response.statusCode').should('eq', 200);
    
    cy.get('.swal2-success').should('be.visible');
    cy.get('.swal2-popup').should('not.exist'); // Garante que o SweetAlert desapareceu

    // Verifica se o cliente foi removido da lista (pode exigir aguardar a UI ou verificar contagem)
    cy.get('.table tbody tr').should('have.length.lt', 10); // Assume que inicialmente havia 10 clientes de demo
  });

  it('deve permitir buscar clientes pelo nome ou email', () => {
    // Cria um cliente com um nome único para busca
    cy.get('[data-testid="add-client-button"]').click();
    cy.get('.modal-content').should('be.visible');
    cy.get('input[name="name"]').type('Cliente Busca Única');
    cy.get('input[name="email"]').type('busca.unica@example.com');
    cy.get('input[name="phone"]').type('(11) 11111-1111');
    cy.get('[data-testid="submit-client-button"]').click();
    cy.get('.swal2-success').should('be.visible');
    cy.get('.modal-content').should('not.be.visible');

    // Espera a lista ser atualizada
    cy.wait(500); // Pequena espera para renderização da UI

    // Digita o termo de busca na barra de pesquisa
    cy.get('[data-testid="search-input"]').type('Busca Única');
    cy.get('[data-testid="apply-search-button"]').click(); // Clica no botão de busca, se houver

    // Verifica se apenas o cliente buscado é exibido
    cy.get('.table tbody tr').should('have.length', 1);
    cy.get('.table tbody tr').should('contain', 'Cliente Busca Única');

    // Limpa a busca para ver todos novamente
    cy.get('[data-testid="search-input"]').clear();
    cy.get('[data-testid="apply-search-button"]').click();
    cy.get('.table tbody tr').should('have.length.at.least', 2); // Deve ter pelo menos o de demo e o que criamos
  });
});