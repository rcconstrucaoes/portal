/**
 * RC Construções - Testes de Integração
 * Fluxo de Trabalho de Contratos
 * Versão 5.1 - Revisado e Aprimorado
 */

const request = require('supertest');
const express = require('express');

// Mocks do banco de dados e autenticação
const mockDatabase = require('../helpers/mock-database');
const mockAuth = require('../helpers/mock-auth');
const { resetAllMocks } = require('../helpers/test-utils');

// O controlador e as rotas de contrato que serão testados
const ContractsController = require('../../backend/controllers/ContractsController');
const contractRoutes = require('../../backend/routes/contracts');

// O logger do backend (mockado para não escrever em arquivos durante o teste)
const logger = require('../../backend/config/logger');
logger.transports.forEach(t => (t.silent = true)); // Silencia os logs durante os testes
logger.exceptions.forEach(t => (t.silent = true)); // Silencia exceções
logger.rejections.forEach(t => (t.silent = true)); // Silencia rejeições

describe('Fluxo de Trabalho de Contratos (Integração)', () => {
  let app;
  let adminUser; // Usuário administrador mockado
  let managerUser; // Usuário gerente mockado
  let mockClient;
  let mockBudgetApproved;

  // Antes de todos os testes, configura o Express e as rotas
  beforeAll(() => {
    app = express();
    app.use(express.json()); // Habilita o parsing de JSON
    // Mock do middleware de autenticação e autorização
    app.use((req, res, next) => {
      req.user = managerUser; // Gerente por padrão
      // Adicione permissões necessárias para o gerente para os testes
      req.user.permissions.push('contracts.view', 'contracts.create', 'contracts.edit', 'contracts.delete');
      next();
    });
    // Aplica as rotas de contrato
    app.use('/api/contracts', contractRoutes);
  });

  // Antes de cada teste, reseta os mocks e popula os dados iniciais
  beforeEach(async () => {
    resetAllMocks(); // Limpa e repopula o DB mockado e reseta a autenticação
    adminUser = mockDatabase.models.User.findByPk(1); // O admin do fixture
    managerUser = mockDatabase.models.User.findByPk(2); // O gerente do fixture

    // Garante que o req.user no middleware mockado seja o gerente para os testes
    app._router.stack.forEach(layer => {
        if (layer.handle === app.boundDispatch) {
            layer.handle = (req, res, next) => {
                req.user = managerUser;
                // Garante que o gerente tenha permissões para contratos
                req.user.permissions.push('contracts.view', 'contracts.create', 'contracts.edit', 'contracts.delete');
                next();
            };
        }
    });

    // Pega um cliente e um orçamento aprovado dos dados mockados para usar nos testes
    mockClient = mockDatabase.data.clients[0];
    mockBudgetApproved = mockDatabase.data.budgets.find(b => b.status === 'Aprovado');
  });

  // Depois de todos os testes, pode fazer alguma limpeza final se necessário
  afterAll(() => {
    logger.transports.forEach(t => (t.silent = false));
    logger.exceptions.forEach(t => (t.silent = false));
    logger.rejections.forEach(t => (t.silent = false));
  });

  it('GET /api/contracts deve listar contratos com sucesso', async () => {
    const res = await request(app).get('/api/contracts');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('GET /api/contracts/:id deve retornar um contrato específico', async () => {
    const contractId = mockDatabase.data.contracts[0].id; // Pega o ID do primeiro contrato mockado
    const res = await request(app).get(`/api/contracts/${contractId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', contractId);
    expect(res.body.data).toHaveProperty('title', mockDatabase.data.contracts[0].title);
  });

  it('GET /api/contracts/:id deve retornar 404 se o contrato não for encontrado', async () => {
    const nonExistentId = 99999;
    const res = await request(app).get(`/api/contracts/${nonExistentId}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual('Contrato não encontrado');
    expect(res.body.code).toEqual('NOT_FOUND');
  });

  it('POST /api/contracts deve criar um novo contrato com sucesso (com orçamento)', async () => {
    const newContract = {
      clientId: mockClient.id,
      budgetId: mockBudgetApproved.id,
      title: 'Novo Contrato de Teste de Integração',
      terms: 'Termos de teste para o novo contrato. Este é um teste.',
      value: 123456.78,
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-12-31T00:00:00.000Z',
      status: 'Ativo'
    };

    const res = await request(app)
      .post('/api/contracts')
      .send(newContract);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Contrato criado com sucesso');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('title', newContract.title);

    // Verifica se o contrato foi realmente adicionado ao mock DB
    const addedContract = await mockDatabase.models.Contract.findByPk(res.body.data.id);
    expect(addedContract).not.toBeNull();
    expect(addedContract.title).toEqual(newContract.title);
  });

  it('POST /api/contracts deve criar um novo contrato com sucesso (sem orçamento)', async () => {
    const newContract = {
      clientId: mockClient.id,
      budgetId: null, // Sem orçamento associado
      title: 'Contrato de Serviço Direto',
      terms: 'Termos de serviço direto.',
      value: 15000.00,
      startDate: '2025-03-15T00:00:00.000Z',
      status: 'Ativo'
    };

    const res = await request(app)
      .post('/api/contracts')
      .send(newContract);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('title', newContract.title);
    expect(res.body.data).toHaveProperty('budgetId', null);
  });

  it('POST /api/contracts deve retornar 400 para dados inválidos', async () => {
    const invalidContract = {
      clientId: 99999, // Cliente inexistente
      title: 'Curto', // Título muito curto
      terms: 'abc', // Termos muito curtos
      value: -100, // Valor negativo
      startDate: 'data-invalida', // Data inválida
      endDate: '2024-01-01T00:00:00.000Z', // Anterior ao start
      status: 'Inexistente'
    };

    const res = await request(app)
      .post('/api/contracts')
      .send(invalidContract);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual('Dados do contrato inválidos');
    expect(res.body.messages).toBeInstanceOf(Array);
    expect(res.body.messages.length).toBeGreaterThan(0);
    expect(res.body.code).toEqual('VALIDATION_ERROR');
  });

  it('PUT /api/contracts/:id deve atualizar um contrato com sucesso', async () => {
    const contractToUpdate = mockDatabase.data.contracts[0];
    const updates = {
      title: 'Contrato Atualizado (Integração)',
      value: 260000.00,
      status: 'Concluído'
    };

    const res = await request(app)
      .put(`/api/contracts/${contractToUpdate.id}`)
      .send(updates);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Contrato atualizado com sucesso');
    expect(res.body.data).toHaveProperty('id', contractToUpdate.id);
    expect(res.body.data).toHaveProperty('title', updates.title);
    expect(res.body.data).toHaveProperty('status', updates.status);

    // Verifica se o contrato foi realmente atualizado no mock DB
    const updatedContract = await mockDatabase.models.Contract.findByPk(contractToUpdate.id);
    expect(updatedContract).toHaveProperty('title', updates.title);
    expect(updatedContract).toHaveProperty('value', updates.value);
    expect(updatedContract).toHaveProperty('status', updates.status);
  });

  it('DELETE /api/contracts/:id deve excluir um contrato com sucesso', async () => {
    const contractToDeleteId = mockDatabase.data.contracts[0].id;
    const initialCount = mockDatabase.data.contracts.length;

    const res = await request(app)
      .delete(`/api/contracts/${contractToDeleteId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Contrato excluído com sucesso');

    // Verifica se o contrato foi realmente removido do mock DB
    const deletedContract = await mockDatabase.models.Contract.findByPk(contractToDeleteId);
    expect(deletedContract).toBeNull();
    expect(mockDatabase.data.contracts.length).toEqual(initialCount - 1);
  });

  it('GET /api/contracts/stats deve retornar estatísticas de contratos', async () => {
    const res = await request(app).get('/api/contracts/stats');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(res.body.data).toHaveProperty('active');
    expect(res.body.data).toHaveProperty('completed');
    expect(res.body.data).toHaveProperty('suspended');
    expect(res.body.data).toHaveProperty('cancelled');
    expect(res.body.data).toHaveProperty('totalActiveValue');
    expect(res.body.data).toHaveProperty('totalCompletedValue');
    expect(res.body.data).toHaveProperty('averageContractValue');
    expect(res.body.data).toHaveProperty('completionRate');
  });
});