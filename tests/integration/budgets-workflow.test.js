/**
 * RC Construções - Testes de Integração
 * Fluxo de Trabalho de Orçamentos
 * Versão 5.1 - Revisado e Aprimorado
 */

const request = require('supertest');
const express = require('express');

// Mocks do banco de dados e autenticação
const mockDatabase = require('../helpers/mock-database');
const mockAuth = require('../helpers/mock-auth');
const { resetAllMocks } = require('../helpers/test-utils');

// O controlador e as rotas de orçamento que serão testados
const BudgetsController = require('../../backend/controllers/BudgetsController');
const budgetRoutes = require('../../backend/routes/budgets');

// O logger do backend (mockado para não escrever em arquivos durante o teste)
const logger = require('../../backend/config/logger');
logger.transports.forEach(t => (t.silent = true)); // Silencia os logs durante os testes
logger.exceptions.forEach(t => (t.silent = true)); // Silencia exceções
logger.rejections.forEach(t => (t.silent = true)); // Silencia rejeições

describe('Fluxo de Trabalho de Orçamentos (Integração)', () => {
  let app;
  let adminUser;
  let managerUser;

  // Antes de todos os testes, configura o Express e as rotas
  beforeAll(() => {
    // Configura um aplicativo Express mínimo para testar as rotas
    app = express();
    app.use(express.json()); // Habilita o parsing de JSON
    // Mock do middleware de autenticação para simular um usuário logado
    app.use((req, res, next) => {
      // Para testes, simulamos req.user. Ajuste conforme as permissões necessárias
      req.user = managerUser; // Usuário gerente por padrão
      next();
    });
    // Aplica as rotas de orçamento
    app.use('/api/budgets', budgetRoutes);
  });

  // Antes de cada teste, reseta os mocks e popula os dados iniciais
  beforeEach(async () => {
    resetAllMocks(); // Limpa e repopula o DB mockado e reseta a autenticação
    // Obter usuários mockados para simular o req.user
    adminUser = mockDatabase.models.User.findByPk(1); // O admin do fixture
    managerUser = mockDatabase.models.User.findByPk(2); // O gerente do fixture
    // Definir o req.user do middleware para o gerente padrão
    app._router.stack.forEach(layer => {
      if (layer.handle === app.boundDispatch) { // Encontra o middleware que estamos adicionando
        layer.handle = (req, res, next) => {
          req.user = managerUser;
          next();
        };
      }
    });
  });

  // Depois de todos os testes, pode fazer alguma limpeza final se necessário
  afterAll(() => {
    // Restaurar o logger se necessário
    logger.transports.forEach(t => (t.silent = false));
    logger.exceptions.forEach(t => (t.silent = false));
    logger.rejections.forEach(t => (t.silent = false));
  });

  it('GET /api/budgets deve listar orçamentos com sucesso', async () => {
    const res = await request(app).get('/api/budgets');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('GET /api/budgets/:id deve retornar um orçamento específico', async () => {
    const budgetId = mockDatabase.data.budgets[0].id; // Pega o ID do primeiro orçamento mockado
    const res = await request(app).get(`/api/budgets/${budgetId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', budgetId);
    expect(res.body.data).toHaveProperty('title', mockDatabase.data.budgets[0].title);
  });

  it('GET /api/budgets/:id deve retornar 404 se o orçamento não for encontrado', async () => {
    const nonExistentId = 99999;
    const res = await request(app).get(`/api/budgets/${nonExistentId}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual('Orçamento não encontrado');
    expect(res.body.code).toEqual('NOT_FOUND');
  });

  it('POST /api/budgets deve criar um novo orçamento com sucesso', async () => {
    const newBudget = {
      clientId: mockDatabase.data.clients[0].id, // Usa um cliente existente
      title: 'Novo Orçamento de Teste de Integração',
      description: 'Descrição do novo orçamento para testes.',
      amount: 12345.67,
      status: 'Pendente'
    };

    const res = await request(app)
      .post('/api/budgets')
      .send(newBudget);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Orçamento criado com sucesso');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('title', newBudget.title);

    // Verifica se o orçamento foi realmente adicionado ao mock DB
    const addedBudget = await mockDatabase.models.Budget.findByPk(res.body.data.id);
    expect(addedBudget).not.toBeNull();
    expect(addedBudget.title).toEqual(newBudget.title);
  });

  it('POST /api/budgets deve retornar 400 para dados inválidos', async () => {
    const invalidBudget = {
      clientId: 1,
      title: 'Curto', // Título muito curto
      description: '',
      amount: -100, // Valor negativo
      status: 'Inexistente' // Status inválido
    };

    const res = await request(app)
      .post('/api/budgets')
      .send(invalidBudget);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual('Dados do orçamento inválidos');
    expect(res.body.messages).toBeInstanceOf(Array);
    expect(res.body.messages.length).toBeGreaterThan(0);
    expect(res.body.code).toEqual('VALIDATION_ERROR');
  });

  it('PUT /api/budgets/:id deve atualizar um orçamento com sucesso', async () => {
    const budgetToUpdate = mockDatabase.data.budgets[0];
    const updates = {
      title: 'Orçamento Atualizado',
      amount: 50000.00,
      status: 'Aprovado'
    };

    const res = await request(app)
      .put(`/api/budgets/${budgetToUpdate.id}`)
      .send(updates);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Orçamento atualizado com sucesso');
    expect(res.body.data).toHaveProperty('id', budgetToUpdate.id);
    expect(res.body.data).toHaveProperty('title', updates.title);
    expect(res.body.data).toHaveProperty('status', updates.status);

    // Verifica se o orçamento foi realmente atualizado no mock DB
    const updatedBudget = await mockDatabase.models.Budget.findByPk(budgetToUpdate.id);
    expect(updatedBudget).toHaveProperty('title', updates.title);
    expect(updatedBudget).toHaveProperty('amount', updates.amount);
    expect(updatedBudget).toHaveProperty('status', updates.status);
  });

  it('PATCH /api/budgets/:id/status deve alterar o status do orçamento com sucesso', async () => {
    const budgetId = mockDatabase.data.budgets[0].id; // Pega o ID do primeiro orçamento
    const newStatus = 'Rejeitado';

    const res = await request(app)
      .patch(`/api/budgets/${budgetId}/status`)
      .send({ status: newStatus });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Orçamento atualizado com sucesso'); // Mensagem do update genérico
    expect(res.body.data).toHaveProperty('id', budgetId);
    expect(res.body.data).toHaveProperty('status', newStatus);

    // Verifica se o status foi atualizado no mock DB
    const updatedBudget = await mockDatabase.models.Budget.findByPk(budgetId);
    expect(updatedBudget).toHaveProperty('status', newStatus);
  });


  it('DELETE /api/budgets/:id deve excluir um orçamento com sucesso', async () => {
    const budgetToDeleteId = mockDatabase.data.budgets[0].id;
    const initialCount = mockDatabase.data.budgets.length;

    const res = await request(app)
      .delete(`/api/budgets/${budgetToDeleteId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Orçamento excluído com sucesso');

    // Verifica se o orçamento foi realmente removido do mock DB
    const deletedBudget = await mockDatabase.models.Budget.findByPk(budgetToDeleteId);
    expect(deletedBudget).toBeNull();
    expect(mockDatabase.data.budgets.length).toEqual(initialCount - 1);
  });

  it('GET /api/budgets/stats deve retornar estatísticas de orçamentos', async () => {
    const res = await request(app).get('/api/budgets/stats');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(res.body.data).toHaveProperty('pending');
    expect(res.body.data).toHaveProperty('approved');
    expect(res.body.data).toHaveProperty('rejected');
    expect(res.body.data).toHaveProperty('cancelled');
    expect(res.body.data).toHaveProperty('totalValue');
  });
});