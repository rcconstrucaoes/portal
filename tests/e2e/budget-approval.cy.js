/**
 * RC Construções - Testes E2E
 * Fluxo de Aprovação de Orçamentos
 * Versão 5.1 - Revisado e Aprimorado
 */

describe('Fluxo de Aprovação de Orçamentos', () => {
  const managerUser = 'manager@rc-construcoes.com';
  const managerPassword = 'password123';
  const regularUser = 'user@rc-construcoes.com';
  const regularPassword = 'password123';
  const adminUser = 'admin@rc-construcoes.com';
  const adminPassword = 'password123';

  // Antes de cada teste, faça login e navegue para a página de orçamentos
  beforeEach(() => {
    cy.login(managerUser, managerPassword); // Login como gerente para a maioria dos testes
    cy.visit('/#budgets'); // Navega para a rota de orçamentos
    cy.url().should('include', '/budgets'); // Garante que a URL está correta
    cy.get('.page-container').should('be.visible'); // Garante que o container da página está visível
  });

  // Limpa o estado após cada teste (opcional, dependendo de como você gerencia o DB)
  afterEach(() => {
    // Para ambientes de teste Cypress, é comum resetar o estado do DB via API ou fixture
    cy.clearLocalStorage();
    cy.reload(); // Recarrega a página para limpar o estado do JS/DOM
  });

  it('deve exibir a lista de orçamentos pendentes', () => {
    cy.get('[data-page="budgets"]').should('have.class', 'active'); // Garante que a sidebar está ativa
    cy.get('.dashboard-header h3').should('contain', 'Orçamentos'); // Verifica o título da página

    // Verifica se a lista de orçamentos (assumindo que há um container para ela) está visível
    cy.get('.table-container').should('be.visible'); // Ou um ID/classe mais específico para a lista de orçamentos
    cy.get('.table tbody tr').should('have.length.at.least', 1); // Garante que há pelo menos 1 orçamento
    cy.get('.table tbody tr').first().should('contain', 'Pendente'); // Verifica se há um orçamento pendente
  });

  it('deve permitir visualizar os detalhes de um orçamento', () => {
    // Clica no primeiro orçamento da lista (assumindo que o primeiro é clicável ou tem um botão de 'Ver Detalhes')
    cy.get('.table tbody tr').first().click(); 
    // Ou, se houver um botão específico: cy.get('[data-testid="view-budget-1"]').click();

    // Verifica se o modal ou página de detalhes do orçamento é exibido
    cy.get('.modal-content').should('be.visible'); // Assumindo que os detalhes abrem em um modal
    cy.get('.modal-header h2').should('contain', 'Detalhes do Orçamento');
    cy.get('.modal-body').should('contain', 'Status: Pendente');
    cy.get('.modal-close').click(); // Fecha o modal
    cy.get('.modal-content').should('not.be.visible'); // Verifica se o modal foi fechado
  });

  it('deve permitir aprovar um orçamento por um gerente', () => {
    // Intercepta a requisição de atualização para simular a resposta do backend
    cy.intercept('PUT', '/api/budgets/*').as('updateBudget');

    cy.get('.table tbody tr').first().find('[data-action="view-details"]').click(); // Clica para ver detalhes
    cy.get('.modal-content').should('be.visible');

    // Clica no botão de aprovar (ajuste o seletor conforme seu HTML)
    cy.get('[data-action="approve-budget"]').should('be.visible').click();

    // Verifica a confirmação (assumindo que usa SweetAlert2)
    cy.get('.swal2-popup').should('be.visible');
    cy.contains('.swal2-confirm', 'Sim, Aprovar!').click();

    // Espera a requisição PUT ser concluída e verifica a resposta
    cy.wait('@updateBudget').its('response.statusCode').should('eq', 200);

    // Verifica se a notificação de sucesso é exibida
    cy.get('.swal2-popup').should('not.exist'); // SweetAlert de confirmação desaparece
    cy.get('.swal2-success').should('be.visible'); // SweetAlert de sucesso aparece (toast ou alerta)

    // Verifica se o status do orçamento foi atualizado na lista (pode exigir recarregar a lista ou aguardar a UI atualizar)
    cy.get('.modal-close').click(); // Fecha o modal
    cy.get('.table tbody tr').first().should('contain', 'Aprovado'); // Verifica o status atualizado
    
    // Opcional: Verificar logs ou estado do DB se tiver acesso via Cypress tasks
  });

  it('deve permitir rejeitar um orçamento por um gerente', () => {
    cy.intercept('PUT', '/api/budgets/*').as('updateBudget');

    cy.get('.table tbody tr').eq(1).find('[data-action="view-details"]').click(); // Pega o segundo orçamento
    cy.get('.modal-content').should('be.visible');

    cy.get('[data-action="reject-budget"]').should('be.visible').click(); // Clica para rejeitar

    cy.get('.swal2-popup').should('be.visible');
    cy.contains('.swal2-confirm', 'Sim, Rejeitar').click();

    cy.wait('@updateBudget').its('response.statusCode').should('eq', 200);

    cy.get('.swal2-success').should('be.visible');
    cy.get('.modal-close').click();
    cy.get('.table tbody tr').eq(1).should('contain', 'Rejeitado');
  });

  it('não deve permitir que um usuário comum aprove ou rejeite orçamentos', () => {
    cy.logout(); // Desloga do gerente
    cy.login(regularUser, regularPassword); // Loga como usuário comum
    cy.visit('/#budgets');

    cy.get('.table tbody tr').first().click(); // Abre detalhes do orçamento
    cy.get('.modal-content').should('be.visible');

    // Verifica se os botões de aprovar/rejeitar NÃO estão visíveis ou estão desabilitados
    cy.get('[data-action="approve-budget"]').should('not.exist'); // Ou .should('be.disabled')
    cy.get('[data-action="reject-budget"]').should('not.exist'); // Ou .should('be.disabled')
    
    cy.get('.modal-close').click();
  });

  it('deve permitir anexar um arquivo a um orçamento', () => {
    cy.intercept('POST', '/api/budgets/*/attachments').as('uploadAttachment'); // Intercepta a rota de upload

    cy.get('.table tbody tr').first().click(); // Abre detalhes
    cy.get('.modal-content').should('be.visible');

    // Clica no botão de adicionar anexo (se existir) ou abre a seção de anexos
    cy.get('[data-testid="add-attachment-button"]').click(); // Exemplo de seletor
    cy.get('[data-testid="attachment-upload-area"]').should('be.visible'); // Verifica se a área de upload aparece

    // Anexa um arquivo de fixture
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-document.pdf'); // Anexa um arquivo PDF de exemplo
    cy.get('[data-testid="attachment-description-input"]').type('Documento de referência');
    cy.get('[data-testid="upload-attachment-submit"]').click();

    cy.wait('@uploadAttachment').its('response.statusCode').should('eq', 200);

    // Verifica se o anexo aparece na lista
    cy.get('[data-testid="attachments-list"]').should('contain', 'test-document.pdf');
    cy.get('[data-testid="attachment-status-uploaded"]').should('be.visible');
    
    cy.get('.modal-close').click();
  });

  it('deve calcular e exibir os totais do orçamento corretamente nos detalhes', () => {
    cy.get('.table tbody tr').first().click(); // Abre detalhes do orçamento
    cy.get('.modal-content').should('be.visible');

    // Assumindo que você tem elementos com IDs/data-testids para subtotal, impostos e total
    cy.get('[data-testid="budget-subtotal"]').should('be.visible').invoke('text').then((text) => {
      expect(parseFloat(text.replace('R$', '').replace('.', '').replace(',', '.'))).to.be.gt(0);
    });
    cy.get('[data-testid="budget-taxes"]').should('be.visible').invoke('text').then((text) => {
      expect(parseFloat(text.replace('R$', '').replace('.', '').replace(',', '.'))).to.be.gte(0);
    });
    cy.get('[data-testid="budget-total"]').should('be.visible').invoke('text').then((text) => {
      expect(parseFloat(text.replace('R$', '').replace('.', '').replace(',', '.'))).to.be.gt(0);
    });
    
    cy.get('.modal-close').click();
  });
});