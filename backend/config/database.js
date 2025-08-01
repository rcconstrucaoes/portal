/**
 * RC Construções - Configuração do Banco de Dados (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este arquivo configura a conexão com o banco de dados usando Sequelize.
 * As credenciais são carregadas de forma segura a partir de variáveis de ambiente,
 * garantindo diferentes configurações para ambientes de desenvolvimento, teste e produção.
 */

// Carrega as variáveis de ambiente do arquivo .env para process.env
require('dotenv').config();

// Define o ambiente atual. Padrão para 'development' se não for especificado.
const environment = process.env.NODE_ENV || 'development';

// Configurações específicas por ambiente
const configs = {
  development: {
    /**
     * Dialeto do Banco de Dados.
     * Define qual banco de dados você está usando.
     * Opções comuns: 'postgres', 'mysql', 'mariadb', 'sqlite', 'mssql'.
     */
    dialect: process.env.DB_DIALECT || 'postgres',

    /**
     * Host do Banco de Dados.
     * O endereço onde o servidor do banco de dados está rodando.
     * Para desenvolvimento local, geralmente é 'localhost' ou o nome do serviço Docker.
     */
    host: process.env.DB_HOST || 'localhost',

    /**
     * Porta do Banco de Dados.
     * A porta em que o servidor do banco de dados está escutando.
     */
    port: parseInt(process.env.DB_PORT || '5432', 10), // Converte para número

    /**
     * Usuário do Banco de Dados.
     */
    username: process.env.DB_USER || 'postgres',

    /**
     * Senha do Banco de Dados.
     */
    password: process.env.DB_PASSWORD || 'docker',

    /**
     * Nome do Banco de Dados.
     * O nome da database específica que a aplicação irá usar.
     */
    database: process.env.DB_NAME || 'rc_construcoes_dev',

    /**
     * Opções de Log do Sequelize.
     * Define se as queries SQL devem ser logadas no console.
     * Em desenvolvimento, 'true' é útil. Em produção, considere desabilitar ou usar um logger específico.
     */
    logging: console.log, // Loga queries SQL no console

    /**
     * Pool de Conexões.
     * Gerencia o número de conexões ativas com o banco de dados.
     * Max: número máximo de conexões no pool.
     * Min: número mínimo de conexões no pool.
     * Acquire: tempo máximo, em ms, que o pool tentará adquirir uma conexão antes de lançar um erro.
     * Idle: tempo máximo, em ms, que uma conexão pode ficar ociosa no pool antes de ser liberada.
     */
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },

    /**
     * Opções de SSL/TLS (se o banco de dados exigir conexão segura, como no Heroku, Render etc.).
     * Certifique-se de que 'sslmode=require' ou similar está incluído na sua URL de conexão
     * ou nas opções do dialeto, se aplicável.
     */
    dialectOptions: {
      ssl: {
        require: process.env.DB_SSL === 'true', // Ativa SSL se DB_SSL for 'true'
        rejectUnauthorized: false // Para ambientes de desenvolvimento/teste, pode ser false. Em produção, geralmente true.
      }
    }
  },

  test: {
    dialect: process.env.DB_DIALECT || 'postgres',
    host: process.env.DB_TEST_HOST || 'localhost',
    port: parseInt(process.env.DB_TEST_PORT || '5433', 10),
    username: process.env.DB_TEST_USER || 'testuser',
    password: process.env.DB_TEST_PASSWORD || 'testpassword',
    database: process.env.DB_TEST_NAME || 'rc_construcoes_test',
    logging: false, // Desabilitar logging em testes para um console mais limpo
    pool: {
      max: 2,
      min: 0,
      acquire: 10000,
      idle: 5000
    },
    dialectOptions: {
      ssl: {
        require: process.env.DB_TEST_SSL === 'true',
        rejectUnauthorized: false
      }
    }
  },

  production: {
    dialect: process.env.DB_DIALECT, // Obrigatório em produção
    host: process.env.DB_HOST,       // Obrigatório em produção
    port: parseInt(process.env.DB_PORT, 10),
    username: process.env.DB_USER,     // Obrigatório em produção
    password: process.env.DB_PASSWORD, // Obrigatório em produção
    database: process.env.DB_NAME,     // Obrigatório em produção
    logging: false, // Desabilitar logging detalhado em produção
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10), // Maior pool para produção
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      acquire: parseInt(process.env.DB_POOL_ACQUIRE || '60000', 10), // Maior tempo para adquirir
      idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10)
    },
    dialectOptions: {
      ssl: {
        require: process.env.DB_SSL === 'true', // SSL obrigatório em produção se DB_SSL for true
        // Em produção, rejectUnauthorized deve ser 'true' se você estiver usando certificados válidos.
        // Se usar certificados autoassinados ou de dev, pode ser 'false', mas não é recomendado.
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' // Padrão mais seguro
      }
    }
  }
};

// Seleciona a configuração do ambiente atual
const config = configs[environment];

// Validação de configuração em ambiente de produção
if (environment === 'production') {
  const requiredEnvVars = ['DB_DIALECT', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT'];
  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.error(`ERRO: Variáveis de ambiente obrigatórias ausentes para o ambiente de produção: ${missingVars.join(', ')}`);
    process.exit(1); // Encerra o processo se variáveis críticas estiverem faltando
  }

  // Se SSL está habilitado, verificar se rejectUnauthorized é seguro
  if (process.env.DB_SSL === 'true' && config.dialectOptions.ssl.rejectUnauthorized === false) {
    console.warn('AVISO DE SEGURANÇA: Em produção, DB_SSL está ativado, mas rejectUnauthorized é "false". Isso pode tornar sua conexão vulnerável a ataques man-in-the-middle se você não estiver usando certificados CA confiáveis.');
  }
}

// Configurações de Modelos (globais para todos os modelos Sequelize)
const modelConfig = {
  freezeTableName: true, // Impede o Sequelize de pluralizar nomes de tabelas
  timestamps: true,      // Adiciona createdAt e updatedAt automaticamente
  underscored: true      // Usa snake_case para nomes de colunas gerados (ex: created_at)
};

// Configurações de Migração e Seeds (Sequelize CLI)
const cliConfig = {
  /**
   * Tabela de Migrações.
   * Onde o Sequelize armazena o histórico de migrações aplicadas.
   */
  migrationStorageTableName: 'sequelize_meta',
  /**
   * Caminho para os arquivos de migração.
   */
  migrationsPath: './database/migrations', // Caminho relativo ao diretório raiz do backend
  /**
   * Caminho para os arquivos de seed.
   */
  seedersPath: './database/seeders' // Caminho relativo ao diretório raiz do backend
};

// Mescla as configurações do ambiente com as configurações de modelo e CLI
module.exports = {
  ...config,
  define: modelConfig,
  migrationStorageTableName: cliConfig.migrationStorageTableName,
  migrationsPath: cliConfig.migrationsPath,
  seedersPath: cliConfig.seedersPath,
  cli: { // Configuração para o CLI do Sequelize
    migrationsPath: cliConfig.migrationsPath,
    seedersPath: cliConfig.seedersPath
  },

  // Exporta o ambiente atual para fácil acesso
  environment: environment,

  /**
   * Schemas do banco de dados para a aplicação.
   * Não são configurados diretamente aqui, mas são referenciados pelos modelos.
   * As permissões e roles de auth.js são mais para a lógica de aplicação/middleware.
   */
  schemas: {
    // Definir as tabelas aqui é redundante, pois os modelos Sequelize já as definem.
    // Esta seção pode ser removida se não houver um uso específico no backend para isso.
    // Exemplo: users, clients, budgets, contracts, financial, suppliers, logs, metrics.
  },

  /**
   * Configurações de backup de banco de dados.
   * Podem ser lidas do .env ou ter padrões para desenvolvimento.
   */
  backup: {
    enabled: process.env.DB_BACKUP_ENABLED === 'true' || false,
    schedule: process.env.DB_BACKUP_SCHEDULE || '0 2 * * *', // Cron string: '0 2 * * *' (todo dia às 2h da manhã)
    retentionDays: parseInt(process.env.DB_BACKUP_RETENTION_DAYS || '30', 10), // 30 dias de retenção
    outputDir: process.env.DB_BACKUP_OUTPUT_DIR || './backups' // Diretório de saída para backups
  },

  /**
   * Configurações para Redis (se usado para cache, filas, etc.)
   */
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB || '0', 10)
  }
};