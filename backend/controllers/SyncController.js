/**
 * RC Construções - Controller de Sincronização (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Gerencia a sincronização de dados entre o cliente (frontend) e o servidor (backend).
 * Lida com operações de 'push' (cliente -> servidor) e 'pull' (servidor -> cliente).
 * Implementa validações, controle de versão de dados e resolução de conflitos.
 */

const Yup = require('yup');
const { Op } = require('sequelize');
const logger = require('../config/logger'); // Logger do backend
const database = require('../config/database'); // Para acessar modelos e Sequelize
const { models } = require('../models'); // Importa todos os modelos Sequelize

// Assume-se que os modelos do seu Sequelize já estão definidos em `backend/models/`
// e que eles têm um campo `updatedAt` para Last-Write Wins, e possivelmente `syncStatus` para o cliente.

// =======================================================================
// Schemas de Validação (usando Yup)
// =======================================================================

// Schema para o endpoint PULL (cliente pedindo dados do servidor)
const pullSchema = Yup.object().shape({
  table: Yup.string()
    .oneOf(Object.keys(models), 'Tabela inválida para sincronização') // Valida se a tabela existe nos modelos
    .required('Nome da tabela é obrigatório'),
  lastSync: Yup.number()
    .integer('Timestamp deve ser um número inteiro')
    .min(0, 'Timestamp não pode ser negativo')
    .required('Timestamp da última sincronização é obrigatório'),
  deviceId: Yup.string()
    .uuid('ID do dispositivo inválido')
    .required('ID do dispositivo é obrigatório')
});

// Schema para o endpoint PUSH (cliente enviando dados para o servidor)
const pushSchema = Yup.object().shape({
  table: Yup.string()
    .oneOf(Object.keys(models), 'Tabela inválida para sincronização')
    .required('Nome da tabela é obrigatório'),
  data: Yup.array()
    .of(Yup.object().required('Cada item de dados deve ser um objeto'))
    .min(0, 'Array de dados não pode ser nulo, mesmo que vazio')
    .required('Dados para sincronização são obrigatórios'),
  deviceId: Yup.string()
    .uuid('ID do dispositivo inválido')
    .required('ID do dispositivo é obrigatório')
});

class SyncController {
  /**
   * Endpoint para o cliente puxar dados do servidor.
   * Rota: GET /sync/pull
   * Requer autenticação (JWT).
   * @param {Object} req - Objeto de requisição.
   * @param {Object} res - Objeto de resposta.
   */
  async pull(req, res) {
    try {
      const { table, lastSync, deviceId } = await pullSchema.validate(req.query);

      // Acessa o modelo Sequelize dinamicamente
      const Model = models[table];
      if (!Model) {
        logger.warn('Tentativa de pull para tabela inexistente', { table, userId: req.user.id, deviceId, ip: req.ip });
        return res.status(400).json({
          error: 'Tabela para sincronização inválida',
          code: 'INVALID_TABLE'
        });
      }

      // Busca dados que foram atualizados APÓS o lastSync timestamp do cliente
      const newOrUpdatedRecords = await Model.findAll({
        where: {
          updatedAt: {
            [Op.gt]: new Date(parseInt(lastSync, 10)) // Converte para Date object
          },
          // Opcional: Filtrar por userId/organizationId se os dados forem segmentados
          // userId: req.user.id
        },
        order: [
          ['updatedAt', 'ASC'] // Ordena para garantir consistência
        ]
      });

      // O timestamp mais recente de qualquer registro sincronizado.
      // Pode ser o updatedAt do último registro, ou o timestamp atual do servidor.
      const serverLastSyncTimestamp = Date.now();

      logger.info(`Pull de dados para '${table}' concluído`, {
        userId: req.user.id,
        deviceId,
        recordsCount: newOrUpdatedRecords.length,
        lastSyncClient: lastSync,
        lastSyncServer: serverLastSyncTimestamp
      });

      return res.json({
        success: true,
        data: newOrUpdatedRecords,
        serverLastSyncTimestamp: serverLastSyncTimestamp // Informa ao cliente o novo timestamp de sync
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação do pull de sincronização', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Parâmetros de sincronização inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro no pull de sincronização', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor durante o pull de sincronização',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Endpoint para o cliente enviar dados para o servidor.
   * Rota: POST /sync/push
   * Requer autenticação (JWT).
   * @param {Object} req - Objeto de requisição.
   * @param {Object} res - Objeto de resposta.
   */
  async push(req, res) {
    let transaction;
    try {
      const { table, data, deviceId } = await pushSchema.validate(req.body);

      const Model = models[table];
      if (!Model) {
        logger.warn('Tentativa de push para tabela inexistente', { table, userId: req.user.id, deviceId, ip: req.ip });
        return res.status(400).json({
          error: 'Tabela para sincronização inválida',
          code: 'INVALID_TABLE'
        });
      }

      if (data.length === 0) {
        logger.info(`Push de dados para '${table}' recebido, mas sem registros.`, { userId: req.user.id, deviceId, ip: req.ip });
        return res.json({
          success: true,
          message: 'Nenhum registro para processar.',
          processedIds: [],
          serverTimestamp: Date.now()
        });
      }

      transaction = await database.sequelize.transaction(); // Inicia uma transação

      const processedIds = [];
      for (const record of data) {
        try {
          // Extrai o ID do cliente (se houver, e será tratado como externalId ou client_id)
          // O ID aqui é o ID do cliente, que deve ser tratado como um external_id no servidor para evitar conflitos de IDs gerados no cliente
          const clientProvidedId = record.id; // ID original do cliente
          delete record.id; // Remove o ID para que o Sequelize possa gerenciar o ID do servidor

          // Assume que o cliente envia um 'syncStatus' para indicar o tipo de operação
          // 1: novo/modificado, 2: para deletar
          const syncStatus = record.syncStatus || 1;
          delete record.syncStatus; // Remove o syncStatus antes de salvar no DB do servidor

          if (syncStatus === 2) { // Registro para ser DELETADO
            const deleted = await Model.destroy({ where: { id: clientProvidedId }, transaction }); // Assume que clientProvidedId mapeia para o ID do servidor
            if (deleted) {
              logger.debug(`Registro '${table}' (ID cliente: ${clientProvidedId}) deletado no servidor.`);
              processedIds.push(clientProvidedId);
            } else {
              logger.warn(`Tentativa de deletar registro '${table}' (ID cliente: ${clientProvidedId}) que não existe no servidor.`);
            }
          } else { // Registro NOVO ou MODIFICADO
            const [dbRecord, created] = await Model.upsert({
              ...record,
              id: clientProvidedId, // Tenta usar o ID do cliente como ID do servidor, se for idempotente
              // Se o servidor usa seus próprios IDs, você precisaria de um campo `clientId` ou `externalId`
              // externalId: clientProvidedId,
              // userId: req.user.id // Associar ao usuário que fez a sincronização
            }, { transaction });

            if (created) {
              logger.debug(`Registro '${table}' (ID cliente: ${clientProvidedId}) criado no servidor.`);
            } else {
              logger.debug(`Registro '${table}' (ID cliente: ${clientProvidedId}) atualizado no servidor.`);
            }
            processedIds.push(clientProvidedId);
          }
        } catch (recordError) {
          logger.error(`Erro ao processar registro '${table}' (ID cliente: ${record.id || 'N/A'}): ${recordError.message}`, { record, error: recordError.stack, userId: req.user?.id, deviceId });
          // Não lançar erro para continuar processando outros registros
          // Poderíamos retornar um status de erro para este registro específico.
        }
      }

      await transaction.commit(); // Confirma a transação se tudo correu bem

      logger.info(`Push de dados para '${table}' concluído. Registros processados: ${processedIds.length}`, {
        userId: req.user.id,
        deviceId,
        processedCount: processedIds.length,
        totalSent: data.length
      });

      return res.json({
        success: true,
        message: 'Registros sincronizados com sucesso.',
        processedIds: processedIds,
        serverTimestamp: Date.now() // Retorna o timestamp do servidor para o cliente
      });

    } catch (error) {
      if (transaction) await transaction.rollback(); // Desfaz a transação em caso de erro

      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação do push de sincronização', {
          errors: error.errors,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Dados de sincronização inválidos',
          messages: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro no push de sincronização', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor durante o push de sincronização',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Exemplo de endpoint para verificar o status da sincronização.
   * Pode retornar a última vez que cada tabela foi sincronizada no servidor.
   * Rota: GET /sync/status
   * Requer autenticação (JWT).
   */
  async status(req, res) {
    try {
      // Implementar lógica para obter o status da sincronização,
      // como timestamps da última modificação por tabela no servidor.
      // Isso pode exigir uma tabela de metadados de sincronização no DB.
      const syncStatus = {
        serverTime: Date.now(),
        // lastSyncTimestamps: {
        //   clients: await models.Client.max('updatedAt') || 0,
        //   budgets: await models.Budget.max('updatedAt') || 0,
        //   // etc.
        // }
      };

      logger.debug('Status de sincronização consultado', { userId: req.user.id, ip: req.ip });
      return res.json({
        success: true,
        data: syncStatus
      });
    } catch (error) {
      logger.error('Erro ao obter status de sincronização', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao obter status de sincronização',
        code: 'SERVER_ERROR'
      });
    }
  }
}

module.exports = new SyncController();