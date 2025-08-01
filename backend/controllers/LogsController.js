/**
 * RC Construções - Controller de Logs (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Gerencia a visualização e filtragem de logs de auditoria e sistema do backend.
 * Permite buscar, filtrar por nível/contexto, paginar e ordenar entradas de log.
 * **Assumes que logs são persistidos em um banco de dados através de um modelo Sequelize.**
 */

const Yup = require('yup');
const { Op } = require('sequelize');
const Log = require('../models/Log'); // Assumindo que você tem um modelo Sequelize para Logs
const logger = require('../config/logger'); // Logger do backend

// =======================================================================
// Schemas de Validação (usando Yup)
// =======================================================================

// Schema para listar logs (parâmetros de query)
const logListQuerySchema = Yup.object().shape({
  page: Yup.number().min(1).default(1),
  limit: Yup.number().min(1).max(100).default(10),
  search: Yup.string().default(''), // Busca por mensagem, contexto, etc.
  level: Yup.string()
    .oneOf(['', 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']) // Corresponde aos níveis do Winston
    .default(''),
  context: Yup.string().default(''), // Para filtrar por contexto específico (ex: 'AuthController')
  startDate: Yup.date().nullable(), // Logs a partir desta data
  endDate: Yup.date().nullable(), // Logs até esta data
  sortBy: Yup.string().oneOf(['timestamp', 'level', 'context']).default('timestamp'),
  sortOrder: Yup.string().oneOf(['ASC', 'DESC']).default('DESC'),
});

class LogsController {
  /**
   * Lista logs com paginação, busca e filtros.
   * Rota: GET /logs
   * Requer permissão 'logs.view'.
   */
  async index(req, res) {
    try {
      const { page, limit, search, level, context, startDate, endDate, sortBy, sortOrder } = await logListQuerySchema.validate(req.query);

      const offset = (page - 1) * limit;
      let whereClause = {};

      // Filtrar por nível de log
      if (level) {
        whereClause.level = level;
      }

      // Filtrar por contexto
      if (context) {
        whereClause.context = context;
      }

      // Filtrar por período de data
      if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) {
          whereClause.timestamp[Op.gte] = startDate;
        }
        if (endDate) {
          whereClause.timestamp[Op.lte] = endDate;
        }
      }

      // Condição de busca (search) - procura na mensagem ou em dados JSON stringificados
      if (search) {
        whereClause[Op.or] = [{
          message: {
            [Op.iLike]: `%${search}%`
          }
        }, {
          context: {
            [Op.iLike]: `%${search}%`
          }
        },
        // Se 'data' for JSON stringificado, pode-se tentar buscar nele (exige DB suportando JSON operations)
        // ou desabilitar para simplicidade se não for crucial.
        // {
        //   data: { [Op.iLike]: `%${search}%` }
        // }
      ];
      }

      const { count, rows } = await Log.findAndCountAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [
          [sortBy, sortOrder]
        ],
        distinct: true // Garante que a contagem seja correta
      });

      logger.info('Logs consultados com sucesso', {
        userId: req.user.id,
        page,
        limit,
        level,
        context,
        search,
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
        logger.warn('Falha na validação dos parâmetros de listagem de logs', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Parâmetros de query inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro ao listar logs', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao listar logs',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Obtém um log específico por ID.
   * Rota: GET /logs/:id
   * Requer permissão 'logs.view'.
   */
  async show(req, res) {
    try {
      const { id } = req.params;

      if (!Yup.number().integer().positive().required().isValidSync(id)) {
        logger.warn('Requisição de log com ID inválido', { id, ip: req.ip });
        return res.status(400).json({
          error: 'ID do log inválido',
          code: 'INVALID_ID'
        });
      }

      const logEntry = await Log.findByPk(id);

      if (!logEntry) {
        logger.warn('Log não encontrado', { logId: id, userId: req.user?.id, ip: req.ip });
        return res.status(404).json({
          error: 'Log não encontrado',
          code: 'NOT_FOUND'
        });
      }

      logger.info('Log obtido por ID com sucesso', { logId: id, userId: req.user.id, ip: req.ip });
      return res.json({
        success: true,
        data: logEntry
      });

    } catch (error) {
      logger.error('Erro ao obter log por ID', {
        error: error.message,
        stack: error.stack,
        logId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao obter log',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Obtém estatísticas de logs (ex: contagem por nível, por contexto).
   * Rota: GET /logs/stats
   * Requer permissão 'logs.view'.
   */
  async getStats(req, res) {
    try {
      const totalLogs = await Log.count();
      const logsByLevel = await Log.findAll({
        attributes: ['level', [Log.sequelize.fn('COUNT', Log.sequelize.col('level')), 'count']],
        group: ['level'],
        raw: true
      });
      const logsByContext = await Log.findAll({
        attributes: ['context', [Log.sequelize.fn('COUNT', Log.sequelize.col('context')), 'count']],
        group: ['context'],
        raw: true
      });

      const stats = {
        total: totalLogs,
        byLevel: logsByLevel.reduce((acc, item) => ({ ...acc, [item.level]: parseInt(item.count, 10) }), {}),
        byContext: logsByContext.reduce((acc, item) => ({ ...acc, [item.context]: parseInt(item.count, 10) }), {}),
        last24Hours: await Log.count({
          where: {
            timestamp: {
              [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        })
      };

      logger.info('Estatísticas de logs consultadas com sucesso', {
        userId: req.user.id,
        ip: req.ip
      });

      return res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Erro ao obter estatísticas de logs', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao obter estatísticas de logs',
        code: 'SERVER_ERROR'
      });
    }
  }
}

module.exports = new LogsController();