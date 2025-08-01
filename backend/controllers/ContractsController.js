/**
 * RC Construções - Controller de Contratos (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Gerencia todas as operações CRUD (Create, Read, Update, Delete) relacionadas aos contratos.
 * Inclui validações robustas, paginação, busca, filtros, ordenação e gestão de status.
 */

const Yup = require('yup');
const { Op } = require('sequelize');
const Contract = require('../models/Contract');
const Client = require('../models/Client'); // Para incluir dados do cliente relacionado
const Budget = require('../models/Budget'); // Para incluir dados do orçamento relacionado
const logger = require('../config/logger');
const authConfig = require('../config/auth'); // Para acessar a lista de status de contrato

// =======================================================================
// Schemas de Validação (usando Yup)
// =======================================================================

// Schema base para criação/atualização de contrato
const contractBaseSchema = Yup.object().shape({
  clientId: Yup.number()
    .integer('ID do cliente deve ser um número inteiro')
    .positive('ID do cliente deve ser um número positivo')
    .required('ID do cliente é obrigatório'),
  budgetId: Yup.number()
    .integer('ID do orçamento deve ser um número inteiro')
    .positive('ID do orçamento deve ser um número positivo')
    .nullable(), // Orçamento pode ser nulo
  title: Yup.string()
    .min(5, 'Título do contrato deve ter pelo menos 5 caracteres')
    .max(200, 'Título do contrato não pode exceder 200 caracteres')
    .required('Título do contrato é obrigatório'),
  terms: Yup.string()
    .min(10, 'Termos e condições devem ter pelo menos 10 caracteres')
    .required('Termos e condições são obrigatórios'),
  value: Yup.number()
    .min(0, 'Valor total não pode ser negativo')
    .required('Valor total é obrigatório'),
  startDate: Yup.date() // - Valida como objeto Date
    .required('Data de início é obrigatória'),
  endDate: Yup.date() // - Valida como objeto Date
    .nullable()
    .min(Yup.ref('startDate'), 'Data de término não pode ser anterior à data de início'), //
  status: Yup.string()
    .oneOf(authConfig.defaultRoles.manager.permissions.map(p => {
      // Adaptação: Assumindo que os status do contrato não vêm diretamente das permissões,
      // mas sim de uma lista pré-definida em CONTRACTS_CONFIG do frontend.
      // Se tiver uma lista de status no backend, use-a.
      // Por enquanto, usaremos uma lista simples.
      const contractStatuses = ['Ativo', 'Concluído', 'Suspenso', 'Cancelado'];
      return contractStatuses;
    }).flat(), 'Status inválido') // Usa uma lista plana de todos os status possíveis
    .default('Ativo')
});

// Schema para listar contratos (parâmetros de query)
const contractListQuerySchema = Yup.object().shape({
  page: Yup.number().min(1).default(1),
  limit: Yup.number().min(1).max(100).default(10),
  search: Yup.string().default(''),
  status: Yup.string()
    .oneOf(['', 'Ativo', 'Concluído', 'Suspenso', 'Cancelado'])
    .default(''),
  clientId: Yup.number().integer().positive().nullable(), // - Para filtrar por cliente
  sortBy: Yup.string().oneOf(['title', 'startDate', 'endDate', 'value', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: Yup.string().oneOf(['ASC', 'DESC']).default('DESC'),
  include: Yup.string().oneOf(['client', 'budget', 'all', '']).default('') // Para incluir relacionamentos
});

class ContractsController {
  /**
   * Lista todos os contratos com paginação, busca e filtros.
   * Rota: GET /contracts
   */
  async index(req, res) {
    try {
      const { page, limit, search, status, clientId, sortBy, sortOrder, include } = await contractListQuerySchema.validate(req.query);

      const offset = (page - 1) * limit;
      let whereClause = {};
      let includeClause = [];

      // Condição de busca (search)
      if (search) {
        whereClause[Op.or] = [{
          title: {
            [Op.iLike]: `%${search}%`
          }
        }, {
          terms: {
            [Op.iLike]: `%${search}%`
          }
        }];
      }

      // Condição de status
      if (status) {
        whereClause.status = status;
      }

      // Filtrar por cliente
      if (clientId) {
        whereClause.clientId = clientId;
      }

      // Incluir relacionamentos
      if (include === 'client' || include === 'all') {
        includeClause.push({
          model: Client,
          as: 'client', // Alias definido no modelo Contract.js
          attributes: ['id', 'name', 'email', 'phone'] // Campos a serem incluídos do cliente
        });
      }
      if (include === 'budget' || include === 'all') {
        includeClause.push({
          model: Budget,
          as: 'budget', // Alias definido no modelo Contract.js
          attributes: ['id', 'title', 'amount', 'status'] // Campos a serem incluídos do orçamento
        });
      }

      const { count, rows } = await Contract.findAndCountAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [
          [sortBy, sortOrder]
        ],
        include: includeClause,
        distinct: true // Garante que a contagem seja correta com joins
      });

      logger.info('Contratos listados com sucesso', {
        userId: req.user.id,
        page,
        limit,
        search,
        status,
        clientId,
        total: count
      });

      return res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          currentPage: page,
          perPage: limit,
          totalPages: Math.ceil(count / limit)
        }
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação dos parâmetros de listagem de contratos', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Parâmetros de query inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro ao listar contratos', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao listar contratos',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Obtém um contrato por ID.
   * Rota: GET /contracts/:id
   */
  async show(req, res) {
    try {
      const { id } = req.params;
      const { include } = req.query; // Para incluir relacionamentos na visualização única

      // Validação do ID
      if (!Yup.number().integer().positive().required().isValidSync(id)) {
        logger.warn('Requisição de contrato com ID inválido', { id, ip: req.ip });
        return res.status(400).json({
          error: 'ID do contrato inválido',
          code: 'INVALID_ID'
        });
      }

      let includeClause = [];
      if (include === 'client' || include === 'all') {
        includeClause.push({ model: Client, as: 'client', attributes: ['id', 'name', 'email'] });
      }
      if (include === 'budget' || include === 'all') {
        includeClause.push({ model: Budget, as: 'budget', attributes: ['id', 'title', 'amount'] });
      }

      const contract = await Contract.findByPk(id, { include: includeClause });

      if (!contract) {
        logger.warn('Contrato não encontrado', { contractId: id, userId: req.user?.id, ip: req.ip });
        return res.status(404).json({
          error: 'Contrato não encontrado',
          code: 'NOT_FOUND'
        });
      }

      logger.info('Contrato obtido por ID com sucesso', { contractId: id, userId: req.user.id, ip: req.ip });
      return res.json({
        success: true,
        data: contract
      });

    } catch (error) {
      logger.error('Erro ao obter contrato por ID', {
        error: error.message,
        stack: error.stack,
        contractId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao obter contrato',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Cria um novo contrato.
   * Rota: POST /contracts
   */
  async store(req, res) {
    try {
      const validatedData = await contractBaseSchema.validate(req.body, { abortEarly: false });

      // Opcional: Verificar se o clientId e budgetId (se fornecido) existem
      const clientExists = await Client.findByPk(validatedData.clientId);
      if (!clientExists) {
        logger.warn('Tentativa de criar contrato com cliente inexistente', { clientId: validatedData.clientId, userId: req.user.id, ip: req.ip });
        return res.status(400).json({ error: 'Cliente associado não encontrado', code: 'INVALID_CLIENT' });
      }
      if (validatedData.budgetId) {
        const budgetExists = await Budget.findByPk(validatedData.budgetId);
        if (!budgetExists) {
          logger.warn('Tentativa de criar contrato com orçamento inexistente', { budgetId: validatedData.budgetId, userId: req.user.id, ip: req.ip });
          return res.status(400).json({ error: 'Orçamento associado não encontrado', code: 'INVALID_BUDGET' });
        }
      }

      const newContract = await Contract.create(validatedData);

      logger.info('Contrato criado com sucesso', {
        contractId: newContract.id,
        clientId: newContract.clientId,
        budgetId: newContract.budgetId,
        userId: req.user.id,
        ip: req.ip
      });
      return res.status(201).json({
        success: true,
        message: 'Contrato criado com sucesso',
        data: newContract
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação ao criar contrato', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Dados do contrato inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro ao criar contrato', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao criar contrato',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Atualiza um contrato existente.
   * Rota: PUT /contracts/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;

      // Validação do ID
      if (!Yup.number().integer().positive().required().isValidSync(id)) {
        logger.warn('Requisição de atualização de contrato com ID inválido', { id, ip: req.ip });
        return res.status(400).json({
          error: 'ID do contrato inválido',
          code: 'INVALID_ID'
        });
      }

      // Validação dos dados do corpo da requisição (partial validation)
      const validatedData = await contractBaseSchema.partial().validate(req.body, { abortEarly: false });

      const contract = await Contract.findByPk(id);

      if (!contract) {
        logger.warn('Contrato não encontrado para atualização', { contractId: id, userId: req.user?.id, ip: req.ip });
        return res.status(404).json({
          error: 'Contrato não encontrado',
          code: 'NOT_FOUND'
        });
      }

      // Opcional: Verificar se o clientId e budgetId (se alterados) existem
      if (validatedData.clientId && validatedData.clientId !== contract.clientId) {
        const clientExists = await Client.findByPk(validatedData.clientId);
        if (!clientExists) {
          logger.warn('Tentativa de atualizar contrato para cliente inexistente', { contractId: id, newClientId: validatedData.clientId, userId: req.user.id, ip: req.ip });
          return res.status(400).json({ error: 'Novo cliente associado não encontrado', code: 'INVALID_CLIENT' });
        }
      }
      if (validatedData.budgetId && validatedData.budgetId !== contract.budgetId) {
        const budgetExists = await Budget.findByPk(validatedData.budgetId);
        if (!budgetExists) {
          logger.warn('Tentativa de atualizar contrato para orçamento inexistente', { contractId: id, newBudgetId: validatedData.budgetId, userId: req.user.id, ip: req.ip });
          return res.status(400).json({ error: 'Novo orçamento associado não encontrado', code: 'INVALID_BUDGET' });
        }
      }

      const updatedContract = await contract.update(validatedData);

      logger.info('Contrato atualizado com sucesso', {
        contractId: updatedContract.id,
        userId: req.user.id,
        ip: req.ip,
        changes: validatedData
      });
      return res.json({
        success: true,
        message: 'Contrato atualizado com sucesso',
        data: updatedContract
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação ao atualizar contrato', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Dados do contrato inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro ao atualizar contrato', {
        error: error.message,
        stack: error.stack,
        contractId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao atualizar contrato',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Exclui um contrato.
   * Rota: DELETE /contracts/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Validação do ID
      if (!Yup.number().integer().positive().required().isValidSync(id)) {
        logger.warn('Requisição de exclusão de contrato com ID inválido', { id, ip: req.ip });
        return res.status(400).json({
          error: 'ID do contrato inválido',
          code: 'INVALID_ID'
        });
      }

      const contract = await Contract.findByPk(id);

      if (!contract) {
        logger.warn('Contrato não encontrado para exclusão', { contractId: id, userId: req.user?.id, ip: req.ip });
        return res.status(404).json({
          error: 'Contrato não encontrado',
          code: 'NOT_FOUND'
        });
      }

      await contract.destroy();

      logger.info('Contrato excluído com sucesso', {
        contractId: id,
        userId: req.user.id,
        ip: req.ip
      });
      return res.json({
        success: true,
        message: 'Contrato excluído com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao excluir contrato', {
        error: error.message,
        stack: error.stack,
        contractId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao excluir contrato',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Obtém estatísticas de contratos.
   * Rota: GET /contracts/stats
   */
  async getStats(req, res) {
    try {
      const totalContracts = await Contract.count();
      const activeContracts = await Contract.count({ where: { status: 'Ativo' } });
      const completedContracts = await Contract.count({ where: { status: 'Concluído' } });
      const suspendedContracts = await Contract.count({ where: { status: 'Suspenso' } });
      const cancelledContracts = await Contract.count({ where: { status: 'Cancelado' } });

      // Exemplo: Valor total dos contratos ativos
      const totalActiveValue = await Contract.sum('value', { where: { status: 'Ativo' } });
      const totalCompletedValue = await Contract.sum('value', { where: { status: 'Concluído' } });

      const stats = {
        total: totalContracts,
        active: activeContracts,
        completed: completedContracts,
        suspended: suspendedContracts,
        cancelled: cancelledContracts,
        totalActiveValue: totalActiveValue || 0,
        totalCompletedValue: totalCompletedValue || 0,
        averageContractValue: totalContracts > 0 ? (await Contract.sum('value') || 0) / totalContracts : 0,
        completionRate: totalContracts > 0 ? parseFloat(((completedContracts / totalContracts) * 100).toFixed(2)) : 0
      };

      logger.info('Estatísticas de contratos consultadas com sucesso', {
        userId: req.user.id,
        stats,
        ip: req.ip
      });

      return res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Erro ao obter estatísticas de contratos', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao obter estatísticas de contratos',
        code: 'SERVER_ERROR'
      });
    }
  }
}

module.exports = new ContractsController();