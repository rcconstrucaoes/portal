/**
 * RC Construções - Configuração do Logger (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este arquivo centraliza a configuração do sistema de logs para o backend.
 * Utiliza o Winston como biblioteca de logging e permite configurar diferentes
 * transportes (console, arquivo, etc.) e níveis de log por ambiente.
 */

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, align } = format;

// Define os níveis de log customizados e suas cores (para console)
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3, // Para requisições HTTP (se você quiser logá-las)
  verbose: 4,
  debug: 5,
  silly: 6
};

// Define as cores para os níveis de log (opcional)
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'white'
};

// Adiciona as cores ao Winston
// Winston.addColors(logColors); // Note: Esta função foi removida em versões recentes do Winston 3.x, use colorize() no formato.

// Formato de log personalizado
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  // Inclui metadados se existirem
  if (Object.keys(metadata).length) {
    // Garante que circular references não causem problemas ao stringify
    logMessage += ` ${JSON.stringify(metadata, getCircularReplacer(), 2)}`;
  }
  return logMessage;
});

// Helper para lidar com referências circulares em objetos (para JSON.stringify)
const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return; // Retorna undefined para remover a referência circular
      }
      seen.add(value);
    }
    return value;
  };
};

// Nível de log padrão para o ambiente atual
const environment = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || (environment === 'production' ? 'info' : 'debug'); // 'info' em prod, 'debug' em dev

// Cria a instância do logger
const logger = createLogger({
  levels: logLevels,
  level: logLevel, // Nível mínimo de log para todos os transportes
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // Errors devem sempre ter stack trace em desenvolvimento
    format.errors({ stack: true }),
    logFormat // Aplica nosso formato personalizado
  ),
  transports: [
    // Console Transport: para logar no console
    new transports.Console({
      level: 'debug', // Nível de log para o console (pode ser diferente do global)
      format: combine(
        colorize({ all: true }), // Aplica cores ao log no console
        align(), // Alinha o log para melhor legibilidade
        logFormat // Usa o mesmo formato para consistência
      )
    }),

    // File Transport: para logar em arquivos (útil em produção)
    new transports.File({
      filename: 'logs/error.log', // Log de erros (nível 'error' e acima)
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5, // Rotação de logs: 5 arquivos
      tailable: true // Permite 'tail -f' no arquivo
    }),
    new transports.File({
      filename: 'logs/combined.log', // Log combinado (nível definido pelo 'logger.level')
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })

    // Outros Transportes (ex: para serviços de monitoramento de logs como Sentry, ELK, Splunk)
    // new transports.Http({
    //   host: 'localhost',
    //   port: 3000,
    //   path: '/logs'
    // }),
    // new transports.MongoDB({
    //   db: process.env.MONGODB_URI,
    //   options: { useUnifiedTopology: true },
    //   collection: 'server_logs'
    // })
  ],
  // Exceções não tratadas (unhandled exceptions)
  exceptionHandlers: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        align(),
        logFormat
      )
    }),
    new transports.File({ filename: 'logs/exceptions.log' })
  ],
  // Rejeições de promessas não tratadas (unhandled promise rejections)
  rejectionHandlers: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        align(),
        logFormat
      )
    }),
    new transports.File({ filename: 'logs/rejections.log' })
  ],
  exitOnError: false // Não encerra o processo em caso de exceção. Gerenciar com PM2 ou Docker.
});

// Exemplo de como você pode usar o logger
// logger.info('Logger de backend inicializado.', { environment, logLevel });
// logger.debug('Este é um log de depuração em desenvolvimento.');
// logger.warn('Isso é um aviso, algo pode estar errado.');
// logger.error('Este é um erro crítico!', new Error('Algo muito ruim aconteceu.'));

// Se o ambiente não for de produção, adicione um console.debug para logs muito detalhados
if (environment !== 'production') {
  logger.debug('Modo de desenvolvimento/teste ativo para logging detalhado.');
}

module.exports = logger;