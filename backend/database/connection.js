/**
 * RC Construções - Conexão do Banco de Dados (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este arquivo estabelece a conexão com o banco de dados usando Sequelize.
 * Ele carrega e inicializa todos os modelos definidos no diretório 'models',
 * configura associações entre eles e integra o sistema de logs.
 */

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const dbConfig = require('../config/database'); // Importa a configuração do banco de dados
const logger = require('../config/logger'); // Importa o logger do backend

// Inicializa a instância do Sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: (msg) => logger.debug(`[DB Query]: ${msg}`), // Integra o logger com as queries do Sequelize
    pool: dbConfig.pool,
    define: dbConfig.define, // Aplica configurações globais de modelo
    dialectOptions: dbConfig.dialectOptions, // Opções específicas do dialeto (ex: SSL)
    // Desabilita mensagens de operador depreciado, se não forem estritamente necessárias para depuração
    operatorsAliases: false,
    // Define a hora para o fuso horário correto
    timezone: '-03:00' // Exemplo para o fuso horário de Brasília. Ajuste conforme necessário.
  }
);

// Objeto para armazenar os modelos carregados
const models = {};

/**
 * Carrega todos os modelos Sequelize do diretório 'backend/models'.
 * Para cada arquivo de modelo, ele o importa e o inicializa com a instância Sequelize.
 */
function loadModels() {
  const modelsDir = path.join(__dirname, '../models'); // Caminho para o diretório de modelos

  fs.readdirSync(modelsDir)
    .filter(file => {
      // Filtra apenas arquivos .js que não sejam index.js e que não comecem com '.'
      return (file.indexOf('.') !== 0) && (file.slice(-3) === '.js') && (file !== 'index.js');
    })
    .forEach(file => {
      const model = require(path.join(modelsDir, file))(sequelize, Sequelize.DataTypes);
      models[model.name] = model; // Armazena o modelo no objeto 'models'
      logger.debug(`[DB] Modelo '${model.name}' carregado.`);
    });

  // Configura as associações entre os modelos após todos terem sido carregados
  Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
      models[modelName].associate(models);
      logger.debug(`[DB] Associações para '${modelName}' configuradas.`);
    }
  });

  logger.info(`[DB] Todos os ${Object.keys(models).length} modelos Sequelize carregados e associados.`);
}

/**
 * Testa a conexão com o banco de dados.
 * @returns {Promise<void>}
 */
async function connectToDatabase() {
  try {
    loadModels(); // Carrega os modelos antes de sincronizar (se auto-sync estiver habilitado)
    await sequelize.authenticate();
    logger.info('[DB] Conexão com o banco de dados estabelecida com sucesso!');

    // Sincroniza os modelos com o banco de dados (cria tabelas se não existirem).
    // Apenas em desenvolvimento. Em produção, use migrações (Sequelize CLI).
    if (dbConfig.environment === 'development') {
        // 'alter: true' tenta fazer alterações não destrutivas no esquema,
        // mas em desenvolvimento pode ser 'force: true' para recriar tudo.
        // Cuidado com 'force: true' em ambientes com dados.
        await sequelize.sync({ alter: true });
        logger.info('[DB] Modelos sincronizados com o banco de dados (development mode).');
    }

  } catch (error) {
    logger.error('[DB] Não foi possível conectar ao banco de dados:', error);
    // Em produção, você pode querer encerrar o processo se a conexão falhar
    if (dbConfig.environment === 'production') {
      logger.error('[DB] Erro FATAL: Conexão com o banco de dados em produção falhou. Encerrando o processo.');
      process.exit(1);
    }
    throw error; // Relança o erro para que a aplicação possa lidar com ele
  }
}

// Exporta a instância do Sequelize e os modelos carregados
module.exports = {
  sequelize, // A instância do Sequelize
  ...models, // Todos os modelos carregados
  connectToDatabase // Função para iniciar a conexão
};