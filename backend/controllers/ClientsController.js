/**
 * RC Construções - Controller de Clientes (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Gerencia todas as operações CRUD (Create, Read, Update, Delete) relacionadas aos clientes.
 * Inclui validações robustas, paginação, busca, filtros, ordenação e auditoria.
 */

const Yup = require('yup');
const { Op } = require('sequelize'); //
const Client = require('../models/Client'); //
const Contract = require('../models/Contract'); // // Para relacionamentos e estatísticas
const logger = require('../config/logger'); // Logger do backend

// =======================================================================
// Schemas de Validação (usando Yup)
// =======================================================================

// Schema base para criação/atualização de cliente
const clientBaseSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Nome completo deve ter pelo menos 2 caracteres')
    .max(150, 'Nome completo não pode exceder 150 caracteres')
    .required('Nome completo é obrigatório'),
  email: Yup.string()
    .email('E-mail inválido')
    .required('E-mail é obrigatório'),
  phone: Yup.string()
    .matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Formato de telefone inválido (ex: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX)')
    .required('Telefone é obrigatório'),
  address: Yup.string()
    .max(255, 'Endereço não pode exceder 255 caracteres')
    .nullable(), // Endereço pode ser nulo
  cpf: Yup.string()
    .matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'Formato de CPF inválido (ex: XXX.XXX.XXX-XX)')
    .test('cpf-valid', 'CPF inválido', value => {
      // Implementar validação de dígitos verificadores do CPF (se não estiver no modelo)
      if (!value) return true; // Se não for obrigatório e for nulo, é válido.
      // Exemplo de validação simples: (uma validação mais robusta estaria em um helper)
      const cleaned = value.replace(/\D/g, '');
      return cleaned.length === 11 && !/^(\d)\1+$/.test(cleaned); // Basic check
    })
    .nullable(), // CPF pode ser nulo
  isActive: Yup.boolean()
    .default(true), // Padrão para true
  // Adicione outros campos como RG, data de nascimento, etc.
});

// Schema para listar clientes (parâmetros de query)
const clientListQuerySchema = Yup.object().shape({
  page: Yup.number().min(1).default(1), //
  limit: Yup.number().min(1).max(100).default(10), //
  search: Yup.string().default(''), //
  status: Yup.string().oneOf(['', 'active', 'inactive']).default(''), //
  sortBy: Yup.string().oneOf(['name', 'email', 'createdAt', 'updatedAt']).default('createdAt'), //
  sortOrder: Yup.string().oneOf(['ASC', 'DESC']).default('DESC'), //
});

class ClientsController {
  /**
   * Lista todos os clientes com paginação, busca e filtros.
   * Rota: GET /clients
   */
  async index(req, res) {
    try {
      const { page, limit, search, status, sortBy, sortOrder } = await clientListQuerySchema.validate(req.query); //

      const offset = (page - 1) * limit; //
      let whereClause = {}; //

      // Condição de busca (search)
      if (search) {
        whereClause[Op.or] = [{
          name: {
            [Op.iLike]: `%${search}%`
          }
        }, {
          email: {
            [Op.iLike]: `%${search}%`
          }
        }, {
          phone: {
            [Op.iLike]: `%${search}%`
          }
        }];
      }

      // Condição de status
      if (status === 'active') {
        whereClause.isActive = true;
      } else if (status === 'inactive') {
        whereClause.isActive = false;
      }

      const { count, rows } = await Client.findAndCountAll({ //
        where: whereClause, //
        limit: limit, //
        offset: offset, //
        order: [
          [sortBy, sortOrder]
        ], //
        distinct: true // Garante que a contagem seja correta com joins
      });

      logger.info('Clientes listados com sucesso', {
        userId: req.user.id,
        page,
        limit,
        search,
        status,
        sortBy,
        sortOrder,
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
        logger.warn('Falha na validação dos parâmetros de listagem de clientes', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Parâmetros de query inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro ao listar clientes', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao listar clientes',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Obtém um cliente por ID.
   * Rota: GET /clients/:id
   */
  async show(req, res) {
    try {
      const { id } = req.params;

      // Validação do ID
      if (!Yup.number().integer().positive().required().isValidSync(id)) {
        logger.warn('Requisição de cliente com ID inválido', { id, ip: req.ip });
        return res.status(400).json({
          error: 'ID do cliente inválido',
          code: 'INVALID_ID'
        });
      }

      const client = await Client.findByPk(id); //

      if (!client) {
        logger.warn('Cliente não encontrado', { clientId: id, userId: req.user?.id, ip: req.ip });
        return res.status(404).json({
          error: 'Cliente não encontrado',
          code: 'NOT_FOUND'
        });
      }

      logger.info('Cliente obtido por ID com sucesso', { clientId: id, userId: req.user.id, ip: req.ip });
      return res.json({
        success: true,
        data: client
      });

    } catch (error) {
      logger.error('Erro ao obter cliente por ID', {
        error: error.message,
        stack: error.stack,
        clientId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao obter cliente',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Cria um novo cliente.
   * Rota: POST /clients
   */
  async store(req, res) {
    try {
      const validatedData = await clientBaseSchema.validate(req.body, { abortEarly: false });

      // Verifica se já existe um cliente com o mesmo e-mail ou CPF
      const existingClient = await Client.findOne({
        where: {
          [Op.or]: [
            { email: validatedData.email },
            ...(validatedData.cpf ? [{ cpf: validatedData.cpf }] : []) // Inclui CPF na verificação se fornecido
          ]
        }
      });

      if (existingClient) {
        logger.warn('Tentativa de criar cliente com email ou CPF já existente', {
          email: validatedData.email,
          cpf: validatedData.cpf,
          userId: req.user.id,
          ip: req.ip
        });
        return res.status(409).json({
          error: 'Cliente com este e-mail ou CPF já existe',
          code: 'DUPLICATE_CLIENT'
        });
      }

      const newClient = await Client.create(validatedData); //

      logger.info('Cliente criado com sucesso', {
        clientId: newClient.id,
        userId: req.user.id,
        ip: req.ip
      });
      return res.status(201).json({
        success: true,
        message: 'Cliente criado com sucesso',
        data: newClient
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação ao criar cliente', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Dados do cliente inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro ao criar cliente', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao criar cliente',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Atualiza um cliente existente.
   * Rota: PUT /clients/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;

      // Validação do ID
      if (!Yup.number().integer().positive().required().isValidSync(id)) {
        logger.warn('Requisição de atualização de cliente com ID inválido', { id, ip: req.ip });
        return res.status(400).json({
          error: 'ID do cliente inválido',
          code: 'INVALID_ID'
        });
      }

      // Validação dos dados do corpo da requisição (partial validation)
      const validatedData = await clientBaseSchema.partial().validate(req.body, { abortEarly: false }); // Permite campos parciais

      const client = await Client.findByPk(id); //

      if (!client) {
        logger.warn('Cliente não encontrado para atualização', { clientId: id, userId: req.user?.id, ip: req.ip });
        return res.status(404).json({
          error: 'Cliente não encontrado',
          code: 'NOT_FOUND'
        });
      }

      // Verifica duplicidade de e-mail ou CPF, se esses campos forem alterados
      if (validatedData.email && validatedData.email !== client.email) {
        const existingByEmail = await Client.findOne({ where: { email: validatedData.email } });
        if (existingByEmail && existingByEmail.id !== client.id) {
          logger.warn('Tentativa de atualizar cliente para um email já existente', {
            clientId: client.id,
            newEmail: validatedData.email,
            userId: req.user.id,
            ip: req.ip
          });
          return res.status(409).json({
            error: 'Este e-mail já está sendo usado por outro cliente',
            code: 'DUPLICATE_EMAIL'
          });
        }
      }
      if (validatedData.cpf && validatedData.cpf !== client.cpf) {
        const existingByCpf = await Client.findOne({ where: { cpf: validatedData.cpf } });
        if (existingByCpf && existingByCpf.id !== client.id) {
          logger.warn('Tentativa de atualizar cliente para um CPF já existente', {
            clientId: client.id,
            newCpf: validatedData.cpf,
            userId: req.user.id,
            ip: req.ip
          });
          return res.status(409).json({
            error: 'Este CPF já está sendo usado por outro cliente',
            code: 'DUPLICATE_CPF'
          });
        }
      }

      const updatedClient = await client.update(validatedData); //

      logger.info('Cliente atualizado com sucesso', {
        clientId: updatedClient.id,
        userId: req.user.id,
        ip: req.ip,
        changes: validatedData
      });
      return res.json({
        success: true,
        message: 'Cliente atualizado com sucesso',
        data: updatedClient
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação ao atualizar cliente', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Dados do cliente inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro ao atualizar cliente', {
        error: error.message,
        stack: error.stack,
        clientId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao atualizar cliente',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Exclui um cliente.
   * Rota: DELETE /clients/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Validação do ID
      if (!Yup.number().integer().positive().required().isValidSync(id)) {
        logger.warn('Requisição de exclusão de cliente com ID inválido', { id, ip: req.ip });
        return res.status(400).json({
          error: 'ID do cliente inválido',
          code: 'INVALID_ID'
        });
      }

      const client = await Client.findByPk(id); //

      if (!client) {
        logger.warn('Cliente não encontrado para exclusão', { clientId: id, userId: req.user?.id, ip: req.ip });
        return res.status(404).json({
          error: 'Cliente não encontrado',
          code: 'NOT_FOUND'
        });
      }

      await client.destroy(); //

      logger.info('Cliente excluído com sucesso', {
        clientId: id,
        userId: req.user.id,
        ip: req.ip
      });
      return res.json({
        success: true,
        message: 'Cliente excluído com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao excluir cliente', {
        error: error.message,
        stack: error.stack,
        clientId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao excluir cliente',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Obtém estatísticas de clientes.
   * Rota: GET /clients/stats
   */
  async getStats(req, res) {
    try {
      const [
        totalClients, //
        activeClients, //
        inactiveClients, //
        clientsWithContracts, //
        clientsThisMonth //
      ] = await Promise.all([
        Client.count(), //
        Client.count({ where: { isActive: true } }), //
        Client.count({ where: { isActive: false } }), //
        Client.count({ //
          include: [{ //
            model: Contract, //
            as: 'contracts', //
            required: true // // Clientes que TÊM contratos
          }]
        }),
        Client.count({ //
          where: { //
            createdAt: { //
              [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // // Clientes criados no mês atual
            }
          }
        })
      ]);

      const stats = {
        total: totalClients, //
        active: activeClients, //
        inactive: inactiveClients, //
        withContracts: clientsWithContracts, //
        withoutContracts: activeClients - clientsWithContracts, // Clientes ativos sem contratos
        newThisMonth: clientsThisMonth, //
        activityRate: totalClients > 0 ? parseFloat(((activeClients / totalClients) * 100).toFixed(2)) : 0 // Taxa de clientes ativos
      };

      logger.info('Estatísticas de clientes consultadas com sucesso', {
        userId: req.user.id,
        stats, //
        ip: req.ip
      });

      return res.json({
        success: true, //
        data: stats //
      });

    } catch (error) {
      logger.error('Erro ao obter estatísticas de clientes', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id, //
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao obter estatísticas de clientes', //
        code: 'SERVER_ERROR'
      });
    }
  }
}

module.exports = new ClientsController();