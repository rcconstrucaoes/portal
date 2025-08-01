/**
 * RC Construções - Servidor Principal (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este é o arquivo principal do servidor que inicializa e configura toda a aplicação.
 * Inclui configuração de middlewares, rotas, conexão com banco de dados,
 * monitoramento, segurança e tratamento de erros.
 */

// ==================== IMPORTS E CONFIGURAÇÕES INICIAIS ====================

// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

// Tratamento de erros assíncronos automaticamente (para Express)
require('express-async-errors'); // Garante que erros assíncronos em rotas sejam passados para o error middleware

// Imports principais
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Proteção de cabeçalhos HTTP
const compression = require('compression'); // Compressão de respostas HTTP
const cookieParser = require('cookie-parser');
const hpp = require('hpp'); // Proteção contra Parameter Pollution
// const mongoSanitize = require('express-mongo-sanitize'); // Para bancos de dados NoSQL (MongoDB)

const { createServer } = require('http');
const { Server } = require('socket.io');
const cluster = require('cluster');
const os = require('os');

// Imports de configurações e utilitários
const logger = require('./config/logger'); // Logger do backend
const databaseConnection = require('./database/connection'); // Conexão com o DB
const dbConfig = require('./config/database'); // Configuração do DB

// Imports de rotas
const authRoutes = require('./routes/auth'); //
const clientsRoutes = require('./routes/clients'); //
const budgetsRoutes = require('./routes/budgets'); //
const contractsRoutes = require('./routes/contracts'); //
const financialRoutes = require('./routes/financial'); //
const logsRoutes = require('./routes/logs'); //
const syncRoutes = require('./routes/sync'); //

// Imports de middlewares customizados
const { assignRequestId, requestLogger, errorLogger, performanceMetricsCollector } = require('./middleware/logger'); //
const { globalLimiter } = require('./middleware/rateLimiter'); //
const AuthController = require('./controllers/AuthController'); // Para o loginLimiter

// Variáveis de ambiente
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING === 'true';
const CLUSTER_WORKERS = parseInt(process.env.CLUSTER_WORKERS || os.cpus().length, 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // Permite todas as origens em dev, restrinja em prod
const TRUST_PROXY_COUNT = parseInt(process.env.TRUST_PROXY_COUNT || '1', 10); // Para Nginx/Load Balancers

// ==================== FUNÇÃO DE INICIALIZAÇÃO DO SERVIDOR ====================

async function startServer() {
  try {
    // Conecta ao banco de dados
    await databaseConnection.connectToDatabase();

    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: CORS_ORIGIN,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
      },
      // Configurações adicionais do Socket.IO (ex: path, transports)
    });

    // Configura o Express para confiar nos proxies (necessário para rate limit com Nginx/LB)
    app.set('trust proxy', TRUST_PROXY_COUNT);

    // ==================== MIDDLEWARES GLOBAIS ====================

    // CORS (Cross-Origin Resource Sharing)
    app.use(cors({
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-correlation-id', 'x-request-id'],
      credentials: true
    }));

    // Helmet: Protege o aplicativo definindo vários cabeçalhos HTTP
    app.use(helmet({
      contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false, // Desabilita em dev para compatibilidade
      crossOriginEmbedderPolicy: false, // Pode ser necessário desabilitar para alguns assets
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }));

    // Compressão de respostas HTTP
    app.use(compression());

    // Parser de cookies
    app.use(cookieParser());

    // HTTP Parameter Pollution (HPP) protection
    app.use(hpp());

    // Body Parsers para JSON e URL-encoded
    app.use(express.json({ limit: '10mb' })); // Limite de tamanho para JSON
    app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Para dados de formulário

    // Middleware de sanitização para dados não SQL (se aplicável, como mongoSanitize para MongoDB)
    // Se você não usa MongoDB, este middleware não é necessário.
    // app.use(mongoSanitize());

    // Middlewares de logging e performance customizados
    app.use(assignRequestId()); // Atribui IDs de requisição e correlação
    app.use(requestLogger()); // Loga requisições HTTP (usando Morgan customizado)
    app.use(performanceMetricsCollector()); // Coleta métricas de performance da requisição

    // Rate Limiting Global (para todas as rotas, incluindo as não autenticadas)
    app.use(globalLimiter()); //

    // ==================== ROTAS DA API ====================

    app.use('/api/auth', AuthController.applyLoginLimiter(), authRoutes); // Rota de autenticação com rate limiter de login
    app.use('/api/clients', clientsRoutes); //
    app.use('/api/budgets', budgetsRoutes); //
    app.use('/api/contracts', contractsRoutes); //
    app.use('/api/financial', financialRoutes); //
    app.use('/api/logs', logsRoutes); //
    app.use('/api/sync', syncRoutes); //

    // ==================== SERVIÇO DE ARQUIVOS ESTÁTICOS ====================
    // Apenas para servir arquivos de frontend em ambiente de desenvolvimento/teste
    // Em produção, um servidor web como Nginx ou S3 deve servir os arquivos estáticos.
    if (NODE_ENV !== 'production') {
      app.use(express.static('rc-construcoes-web'));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../../rc-construcoes-web/index.html'));
      });
    }

    // ==================== MIDDLEWARE DE TRATAMENTO DE ERROS ====================
    // Deve ser o ÚLTIMO middleware adicionado.
    app.use(errorLogger()); // Captura e loga erros


    // Inicia o servidor HTTP
    httpServer.listen(PORT, () => {
      logger.info(`Servidor (${NODE_ENV} mode) escutando na porta ${PORT}`);
      logger.info(`Para acessar o backend: http://localhost:${PORT}`);
      logger.info(`Conectado ao DB: ${dbConfig.dialect} em ${dbConfig.host}:${dbConfig.port}`);
    });

    // ==================== TRATAMENTO DE ENCERRAMENTO DO PROCESSO ====================
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Opcional: Encerrar o processo para evitar estado inconsistente
      // process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      // Encerra o processo de forma graciosa
      process.exit(1);
    });

    // Captura sinal de encerramento
    process.on('SIGTERM', () => {
      logger.info('SIGTERM recebido. Encerrando servidor...');
      httpServer.close(() => {
        logger.info('Servidor HTTP encerrado.');
        process.exit(0);
      });
    });

    return { app, server: httpServer, io };

  } catch (error) {
    logger.error('❌ Erro fatal ao iniciar servidor:', error);
    process.exit(1); // Encerra o processo se a inicialização falhar
  }
}

// ==================== CLUSTERING (OPCIONAL) ====================
// Para ambientes de produção para aproveitar múltiplos cores da CPU
if (ENABLE_CLUSTERING && cluster.isMaster && NODE_ENV === 'production') {
  logger.info(`🔄 Modo cluster ativado - ${CLUSTER_WORKERS} workers`);

  // Cria workers
  for (let i = 0; i < CLUSTER_WORKERS; i++) {
    cluster.fork();
  }

  // Monitora workers que morrem e os reinicia
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} morreu (${signal || code}). Reiniciando...`);
    cluster.fork(); // Reinicia um novo worker
  });

  cluster.on('online', (worker) => {
    logger.info(`Worker ${worker.process.pid} iniciado`);
  });

} else {
  // Se não estiver em modo cluster (dev, test ou worker secundário), inicia o servidor normalmente
  startServer().catch((error) => {
    logger.error('Falha crítica na inicialização no modo não-cluster:', error);
    process.exit(1);
  });
}