/**
 * RC Construções - Testes de Integração
 * Operações CRUD de Clientes
 * Versão 5.1 - Revisado e Aprimorado
 */

const request = require('supertest');
const express = require('express');

// Mocks do banco de dados e autenticação
const mockDatabase = require('../helpers/mock-database');
const mockAuth = require('../helpers/mock-auth');
const { resetAllMocks } = require('../helpers/test-utils');

// O controlador e as rotas de cliente que serão testados
const ClientsController = require('../../backend/controllers/ClientsController');
const clientRoutes = require('../../backend/routes/clients');

// O logger do backend (mockado para não escrever em arquivos durante o teste)
const logger = require('../../backend/config/logger');
logger.transports.forEach(t => (t.silent = true)); // Silencia os logs durante os testes
logger.exceptions.forEach(t => (t.silent = true)); // Silencia exceções
logger.rejections.forEach(t => (t.silent = true)); // Silencia rejeições

describe('Operações CRUD de Clientes (Integração)', () => {
  let app;
  let adminUser; // Usuário administrador mockado
  let regularUser; // Usuário comum mockado

  // Antes de todos os testes, configura o Express e as rotas
  beforeAll(() => {
    app = express();
    app.use(express.json()); // Habilita o parsing de JSON
    // Mock do middleware de autenticação e autorização
    app.use((req, res, next) => {
      // Por padrão, simula o usuário admin logado para a maioria dos testes
      req.user = adminUser;
      // Simula o middleware authorize para permitir acesso
      req.user.permissions.push('clients.view', 'clients.create', 'clients.edit', 'clients.delete');
      next();
    });
    // Aplica as rotas de cliente
    app.use('/api/clients', clientRoutes);
  });

  // Antes de cada teste, reseta os mocks e popula os dados iniciais
  beforeEach(async () => {
    resetAllMocks(); // Limpa e repopula o DB mockado e reseta a autenticação
    adminUser = mockDatabase.models.User.findByPk(1); // O admin do fixture
    regularUser = mockDatabase.models.User.findByPk(3); // O usuário comum do fixture
    // Assegura que o req.user no middleware mockado seja o admin para os testes
    app._router.stack.forEach(layer => {
        if (layer.handle === app.boundDispatch) {
            layer.handle = (req, res, next) => {
                req.user = adminUser;
                req.user.permissions.push('clients.view', 'clients.create', 'clients.edit', 'clients.delete'); // Garante permissões para este teste
                next();
            };
        }
    });
  });

  // Depois de todos os testes, pode fazer alguma limpeza final se necessário
  afterAll(() => {
    logger.transports.forEach(t => (t.silent = false));
    logger.exceptions.forEach(t => (t.silent = false));
    logger.rejections.forEach(t => (t.silent = false));
  });

  it('GET /api/clients deve listar clientes com sucesso', async () => {
    const res = await request(app).get('/api/clients');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('GET /api/clients/:id deve retornar um cliente específico', async () => {
    const clientId = mockDatabase.data.clients[0].id; // Pega o ID do primeiro cliente mockado
    const res = await request(app).get(`/api/clients/${clientId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', clientId);
    expect(res.body.data).toHaveProperty('name', mockDatabase.data.clients[0].name);
  });

  it('GET /api/clients/:id deve retornar 404 se o cliente não for encontrado', async () => {
    const nonExistentId = 99999;
    const res = await request(app).get(`/api/clients/${nonExistentId}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual('Cliente não encontrado');
    expect(res.body.code).toEqual('NOT_FOUND');
  });

  it('POST /api/clients deve criar um novo cliente com sucesso', async () => {
    const newClient = {
      name: 'Novo Cliente Teste',
      email: 'novo.cliente@test.com',
      phone: '(99) 99999-8888',
      address: 'Rua de Teste, 123',
      cpf: '000.000.000-00', // CPF válido de teste
      isActive: true
    };

    const res = await request(app)
      .post('/api/clients')
      .send(newClient);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Cliente criado com sucesso');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('name', newClient.name);

    // Verifica se o cliente foi realmente adicionado ao mock DB
    const addedClient = await mockDatabase.models.Client.findByPk(res.body.data.id);
    expect(addedClient).not.toBeNull();
    expect(addedClient.name).toEqual(newClient.name);
  });

  it('POST /api/clients deve retornar 400 para dados inválidos', async () => {
    const invalidClient = {
      name: 'Curto', // Nome muito curto
      email: 'invalid-email', // E-mail inválido
      phone: '123', // Telefone inválido
      cpf: '123', // CPF inválido
    };

    const res = await request(app)
      .post('/api/clients')
      .send(invalidClient);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual('Dados do cliente inválidos');
    expect(res.body.messages).toBeInstanceOf(Array);
    expect(res.body.messages.length).toBeGreaterThan(0);
    expect(res.body.code).toEqual('VALIDATION_ERROR');
  });

  it('POST /api/clients deve retornar 409 para email duplicado', async () => {
    const existingClient = mockDatabase.data.clients[0]; // Cliente já existe na fixture
    const duplicateClient = {
      name: 'Cliente Duplicado',
      email: existingClient.email, // Email duplicado
      phone: '(11) 99999-1111',
      address: 'Algum lugar',
      cpf: '999.999.999-99'
    };

    const res = await request(app)
      .post('/api/clients')
      .send(duplicateClient);

    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual('Cliente com este e-mail ou CPF já existe');
    expect(res.body.code).toEqual('DUPLICATE_CLIENT');
  });

  it('PUT /api/clients/:id deve atualizar um cliente com sucesso', async () => {
    const clientToUpdate = mockDatabase.data.clients[0];
    const updates = {
      name: 'Nome Atualizado',
      phone: '(99) 11111-2222',
      isActive: false
    };

    const res = await request(app)
      .put(`/api/clients/${clientToUpdate.id}`)
      .send(updates);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Cliente atualizado com sucesso');
    expect(res.body.data).toHaveProperty('id', clientToUpdate.id);
    expect(res.body.data).toHaveProperty('name', updates.name);
    expect(res.body.data).toHaveProperty('isActive', updates.isActive);

    // Verifica se o cliente foi realmente atualizado no mock DB
    const updatedClient = await mockDatabase.models.Client.findByPk(clientToUpdate.id);
    expect(updatedClient).toHaveProperty('name', updates.name);
    expect(updatedClient).toHaveProperty('phone', updates.phone);
    expect(updatedClient).toHaveProperty('isActive', updates.isActive);
  });

  it('PUT /api/clients/:id deve retornar 409 se atualizar para email duplicado', async () => {
    const client1 = mockDatabase.data.clients[0];
    const client2 = mockDatabase.data.clients[1]; // Cliente diferente
    const updates = { email: client1.email }; // Tenta atualizar com email já existente

    const res = await request(app)
      .put(`/api/clients/${client2.id}`)
      .send(updates);

    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual('Este e-mail já está sendo usado por outro cliente');
    expect(res.body.code).toEqual('DUPLICATE_EMAIL');
  });

  it('DELETE /api/clients/:id deve excluir um cliente com sucesso', async () => {
    const clientToDeleteId = mockDatabase.data.clients[0].id;
    const initialCount = mockDatabase.data.clients.length;

    const res = await request(app)
      .delete(`/api/clients/${clientToDeleteId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual('Cliente excluído com sucesso');

    // Verifica se o cliente foi realmente removido do mock DB
    const deletedClient = await mockDatabase.models.Client.findByPk(clientToDeleteId);
    expect(deletedClient).toBeNull();
    expect(mockDatabase.data.clients.length).toEqual(initialCount - 1);
  });

  it('GET /api/clients/stats deve retornar estatísticas de clientes', async () => {
    const res = await request(app).get('/api/clients/stats');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(res.body.data).toHaveProperty('active');
    expect(res.body.data).toHaveProperty('inactive');
    expect(res.body.data).toHaveProperty('withContracts');
    expect(res.body.data).toHaveProperty('withoutContracts');
    expect(res.body.data).toHaveProperty('newThisMonth');
    expect(res.body.data).toHaveProperty('activityRate');
  });
});