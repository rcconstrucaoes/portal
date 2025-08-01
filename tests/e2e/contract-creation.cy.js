/**
 * RC Construções - Testes E2E
 * Fluxo de Criação de Contratos
 * Versão 5.1 - Revisado e Aprimorado
 */

describe('Fluxo de Criação de Contratos', () => {
  const managerUser = 'manager@rc-construcoes.com';
  const managerPassword = 'password123';

  // Dados de teste para um novo contrato
  const newContractData = {
    title: 'Contrato de Construção - Residencial Alpha',
    terms: 'Este contrato abrange a construção de uma residência unifamiliar, incluindo fundação, alvenaria, cobertura, instalações elétricas e hidráulicas, acabamentos e pintura, conforme projeto arquitetônico anexo.',
    value: '500000.00',
    startDate: '2025-08-01',
    endDate: '2026-02-01'
  };

  beforeEach(() => {
    cy.login(managerUser, managerPassword);
    cy.visit('/#contracts'); // Navega para a rota de contratos
    cy.url().should('include', '/contracts');
    cy.get('.page-container').should('be.visible');
  });

  afterEach(() => {
    cy.clearLocalStorage();
    cy.reload();
  });

  it('deve permitir criar um novo contrato com sucesso', () => {
    cy.get('[data-testid="add-contract-button"]').click(); // Clica no botão para adicionar novo contrato
    cy.get('.modal-content').should('be.visible'); // Assumindo que um modal se abre para o formulário

    // Seleciona um cliente (assumindo que há clientes de demo)
    cy.get('[data-testid="client-select"]').click(); // Abre o dropdown/modal de seleção de cliente
    cy.get('[data-testid="client-option"]').first().click(); // Seleciona o primeiro cliente

    // Preenche os detalhes do contrato
    cy.get('input[name="title"]').type(newContractData.title);
    cy.get('textarea[name="terms"]').type(newContractData.terms);
    cy.get('input[name="value"]').type(newContractData.value);
    cy.get('input[name="startDate"]').type(newContractData.startDate);
    cy.get('input[name="endDate"]').type(newContractData.endDate);

    cy.intercept('POST', '/api/contracts').as('createContract'); // Intercepta a requisição POST

    cy.get('[data-testid="submit-contract-button"]').click(); // Clica para salvar o contrato

    cy.wait('@createContract').its('response.statusCode').should('eq', 201); // Espera a requisição e verifica o status

    // Verifica notificação de sucesso
    cy.get('.swal2-success').should('be.visible');
    cy.get('.modal-content').should('not.be.visible'); // Verifica se o modal foi fechado

    // Verifica se o novo contrato aparece na lista (pode exigir recarregar ou aguardar a UI)
    cy.get('.table tbody').should('contain', newContractData.title);
  });

  it('deve permitir criar um novo contrato a partir de um orçamento aprovado', () => {
    // Primeiro, navegue para a página de orçamentos e aprove um (ou use uma fixture)
    // Para simplificar, assumiremos que um orçamento aprovado já existe e seu ID é conhecido ou fácil de selecionar.
    // Ou, podemos aprovar um aqui para o teste:
    cy.visit('/#budgets');
    cy.get('.table tbody tr').first().find('[data-action="view-details"]').click();
    cy.get('[data-action="approve-budget"]').should('be.visible').click();
    cy.get('.swal2-confirm').click(); // Confirma aprovação
    cy.wait(500); // Espera notificação e modal fechar
    cy.get('.modal-close').click(); // Fecha o modal de detalhes

    cy.visit('/#contracts'); // Volta para contratos

    cy.get('[data-testid="add-contract-button"]').click();
    cy.get('.modal-content').should('be.visible');

    cy.get('[data-testid="client-select"]').click();
    cy.get('[data-testid="client-option"]').first().click();

    // Seleciona um orçamento aprovado
    cy.get('[data-testid="budget-reference-select"]').click(); // Abre o seletor de orçamento
    cy.get('[data-testid="budget-reference-option-approved"]').first().click(); // Seleciona um orçamento aprovado

    // Opcional: Verifica se campos como 'value' ou 'title' foram pré-preenchidos a partir do orçamento
    cy.get('input[name="title"]').should('not.be.empty');
    cy.get('input[name="value"]').should('not.have.value', '0.00');

    // Preenche os campos restantes se não foram pre-preenchidos ou são obrigatórios
    cy.get('textarea[name="terms"]').type('Termos específicos do orçamento aprovado.');
    cy.get('input[name="startDate"]').type('2025-09-01');
    cy.get('input[name="endDate"]').type('2026-03-01');

    cy.intercept('POST', '/api/contracts').as('createContractFromBudget');
    cy.get('[data-testid="submit-contract-button"]').click();

    cy.wait('@createContractFromBudget').its('response.statusCode').should('eq', 201);
    cy.get('.swal2-success').should('be.visible');
  });

  it('deve exibir erros de validação ao criar contrato com dados inválidos', () => {
    cy.get('[data-testid="add-contract-button"]').click();
    cy.get('.modal-content').should('be.visible');

    // Tenta submeter o formulário vazio ou com dados insuficientes
    cy.get('[data-testid="submit-contract-button"]').click();

    // Verifica se as mensagens de erro de validação são exibidas para campos obrigatórios
    cy.get('[data-testid="validation-error-message"]').should('be.visible');
    cy.get('[data-testid="validation-error-message"]').should('contain', 'ID do cliente é obrigatório.');
    cy.get('[data-testid="validation-error-message"]').should('contain', 'Título do contrato é obrigatório.');
    // ... e assim por diante para outros campos

    // Preenche alguns campos, mas com dados inválidos (ex: data de término anterior à de início)
    cy.get('[data-testid="client-select"]').click();
    cy.get('[data-testid="client-option"]').first().click();
    cy.get('input[name="title"]').type('Contrato Inválido');
    cy.get('textarea[name="terms"]').type('Termos');
    cy.get('input[name="value"]').type('1000.00');
    cy.get('input[name="startDate"]').type('2025-08-01');
    cy.get('input[name="endDate"]').type('2025-07-01'); // Data inválida

    cy.get('[data-testid="submit-contract-button"]').click();

    cy.get('.swal2-error').should('be.visible'); // SweetAlert de erro ou notificação
    cy.get('.swal2-popup').should('contain', 'A data de término não pode ser anterior à data de início.');
    cy.get('.modal-close').click(); // Fecha o modal
  });

  it('deve permitir salvar um contrato como rascunho', () => {
    cy.get('[data-testid="add-contract-button"]').click();
    cy.get('.modal-content').should('be.visible');

    // Preenche apenas os campos mínimos para um rascunho (se houver essa regra)
    cy.get('[data-testid="client-select"]').click();
    cy.get('[data-testid="client-option"]').first().click();
    cy.get('input[name="title"]').type('Rascunho de Contrato Teste');

    cy.intercept('POST', '/api/contracts').as('saveDraft');
    cy.get('[data-testid="save-draft-button"]').click(); // Clica no botão de salvar como rascunho

    cy.wait('@saveDraft').its('response.statusCode').should('eq', 201); // Assumindo 201 para rascunho
    cy.get('.swal2-success').should('be.visible');
    cy.get('.modal-content').should('not.be.visible');

    // Verifica se o rascunho aparece na lista com o status correto
    cy.get('.table tbody').should('contain', 'Rascunho de Contrato Teste');
    cy.get('.table tbody').should('contain', 'Rascunho'); // Ou o status que você usa para rascunho
  });

  it('deve permitir pré-visualizar o contrato antes de salvar', () => {
    cy.get('[data-testid="add-contract-button"]').click();
    cy.get('.modal-content').should('be.visible');

    // Preenche alguns campos para a pré-visualização
    cy.get('[data-testid="client-select"]').click();
    cy.get('[data-testid="client-option"]').first().click();
    cy.get('input[name="title"]').type('Contrato para Pré-visualização');
    cy.get('textarea[name="terms"]').type('Termos de teste para pré-visualização.');
    cy.get('input[name="value"]').type('10000.00');
    cy.get('input[name="startDate"]').type('2025-08-01');

    cy.get('[data-testid="preview-contract-button"]').click(); // Clica no botão de pré-visualização

    // Verifica se o modal/seção de pré-visualização é exibido
    cy.get('[data-testid="contract-preview-modal"]').should('be.visible');
    cy.get('[data-testid="contract-preview-title"]').should('contain', 'Contrato para Pré-visualização');
    cy.get('[data-testid="contract-preview-terms"]').should('contain', 'Termos de teste para pré-visualização.');

    cy.get('[data-testid="close-preview-button"]').click(); // Fecha a pré-visualização
    cy.get('[data-testid="contract-preview-modal"]').should('not.be.visible');
  });
});