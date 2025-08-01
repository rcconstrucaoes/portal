# Documentação da API de Logging
## RC Construções v5.1

### Visão Geral

O sistema RC Construções implementa um sistema completo de logging com **Winston** para o backend e logging estruturado para auditoria e monitoramento. O sistema suporta rotação automática de arquivos, diferentes níveis de log e visualização através de API protegida.

---

## 📝 Configuração do Sistema de Logs

### Winston Configuration

O sistema utiliza Winston com as seguintes características:

#### Níveis de Log
```javascript
const levels = {
  error: 0,    // Erros críticos
  warn: 1,     // Avisos importantes
  info: 2,     // Informações gerais
  http: 3,     // Requisições HTTP
  debug: 4     // Depuração (apenas desenvolvimento)
};
```

#### Cores para Console (Desenvolvimento)
```javascript
const colors = {
  error: 'red',
  warn: 'yellow', 
  info: 'green',
  http: 'magenta',
  debug: 'white'
};
```

---

## 🔧 Transports e Armazenamento

### Console Transport
```javascript
// Desenvolvimento - Formato colorizado
new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} [${info.level}]: ${info.message}`
    )
  )
});
```

### File Transports (Produção)

#### Logs Gerais
```javascript
new DailyRotateFile({
  level: 'info',
  format: fileFormat,
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});
```

#### Logs de Erro
```javascript
new DailyRotateFile({
  level: 'error',
  format: fileFormat,
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d'
});
```

---

## 🌐 Endpoints da API de Logs

### Base URL
```
Production: https://api.rc-construcoes.com
Development: http://localhost:3001
```

### 📋 Listar Arquivos de Log

**GET** `/api/logs`

Lista todos os arquivos de log disponíveis no servidor.

#### Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Permissões Requeridas
- **Role**: `admin` ou permissão `logs_view`
- **Nota**: Endpoint restrito a administradores

#### Response (200 OK)
```json
[
  "application-2024-01-15.log",
  "application-2024-01-14.log",
  "error-2024-01-15.log",
  "error-2024-01-14.log"
]
```

#### Error Responses
```json
// 401 - Não autorizado
{
  "error": "Token de acesso obrigatório."
}

// 403 - Sem permissão
{
  "error": "Acesso negado. Permissão insuficiente."
}

// 500 - Erro interno
{
  "error": "Ocorreu um erro interno ao buscar os logs."
}
```

---

### 📄 Visualizar Arquivo de Log

**GET** `/api/logs/:filename`

Visualiza o conteúdo de um arquivo de log específico.

#### Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Parameters
- **filename** (string): Nome do arquivo de log (ex: `application-2024-01-15.log`)

#### Validações de Segurança
- Filename não pode conter `..` (path traversal protection)
- Deve terminar com `.log`
- Apenas arquivos do diretório de logs são acessíveis

#### Response (200 OK) - Formato JSON
```json
[
  {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "level": "info",
    "message": "Sistema iniciado com sucesso",
    "meta": {
      "service": "rc-construcoes-api",
      "version": "5.1"
    }
  },
  {
    "timestamp": "2024-01-15T10:31:15.123Z",
    "level": "http",
    "message": "POST /api/auth/login 200 45ms",
    "meta": {
      "method": "POST",
      "url": "/api/auth/login",
      "status": 200,
      "responseTime": 45
    }
  }
]
```

#### Response (200 OK) - Formato Texto
```
Content-Type: text/plain

2024-01-15 10:30:00:000 [info]: Sistema iniciado com sucesso
2024-01-15 10:31:15:123 [http]: POST /api/auth/login 200 45ms
2024-01-15 10:32:00:456 [warn]: Cache Redis não disponível, usando fallback
```

#### Error Responses
```json
// 400 - Nome inválido
{
  "error": "Nome de arquivo de log inválido."
}

// 404 - Arquivo não encontrado
{
  "error": "Arquivo de log não encontrado."
}

// 500 - Erro interno
{
  "error": "Ocorreu um erro interno ao ler o log."
}
```

---

## 📊 Estrutura dos Arquivos de Log

### Logs de Aplicação (`application-YYYY-MM-DD.log`)

#### Formato JSON (Produção)
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Login realizado com sucesso",
  "userId": "admin-001",
  "userName": "Administrador",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "meta": {
    "action": "auth.login",
    "duration": 145,
    "success": true
  }
}
```

#### Categorias de Logs
- **Authentication**: Login, logout, token validation
- **Database**: Conexões, queries, migrations
- **API**: Requisições HTTP, responses, errors
- **Business Logic**: Operações de clientes, contratos, orçamentos
- **System**: Inicialização, configurações, health checks

### Logs de Erro (`error-YYYY-MM-DD.log`)

```json
{
  "timestamp": "2024-01-15T10:35:30.789Z",
  "level": "error",
  "message": "Falha na conexão com o banco de dados",
  "stack": "Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect...",
  "meta": {
    "service": "database",
    "host": "localhost",
    "port": 5432,
    "retryAttempt": 3
  }
}
```

---

## 🔍 Sistema de Logs do Frontend

### Security Logs (Logs de Segurança)

O frontend registra atividades de segurança no IndexedDB local:

```javascript
// Estrutura do log de atividade
const logEntry = {
  id: 'log-1642248600000-abc123',
  action: 'login_success',
  details: 'Login realizado: Administrador',
  userId: 'admin-001',
  userName: 'Administrador',
  timestamp: '2024-01-15T10:30:00.000Z'
};
```

#### Tipos de Atividades Registradas
- **login_success**: Login bem-sucedido
- **login_failed**: Tentativa de login falhada
- **logout**: Logout do usuário
- **session_expired**: Sessão expirada
- **permission_denied**: Acesso negado
- **data_sync**: Sincronização de dados
- **export_data**: Exportação de dados
- **import_data**: Importação de dados

### Console Logs (Desenvolvimento)

```javascript
// Exemplos de logs no console
console.log('🔐 Inicializando autenticação...');
console.log('✅ Sistema de autenticação inicializado');
console.error('❌ Erro ao carregar usuários:', error);
console.warn('⚠️ Usando usuários padrão da memória');
```

---

## 🔧 Uso e Integração

### Backend - Usando o Logger

```javascript
const logger = require('../config/logger');

// Log de informação
logger.info('Usuário criado com sucesso', { 
  userId: user.id, 
  userName: user.name 
});

// Log de erro
logger.error('Falha na validação', { 
  error: error.message,
  data: req.body 
});

// Log HTTP (automático com Morgan)
app.use(morgan('combined', { stream: logger.stream }));
```

### Frontend - Log de Atividades

```javascript
// Registrar atividade de segurança
await window.Auth.logActivity('login_success', 'Login realizado: João');

// Logs de debugging
if (window.Settings.get('logLevel') === 'debug') {
  console.log('🔍 Debug info:', data);
}
```

---

## 📱 Monitoramento e Dashboards

### Endpoint de Métricas

**GET** `/api/logs/metrics`

Retorna métricas agregadas dos logs.

```json
{
  "period": "24h",
  "metrics": {
    "totalRequests": 1250,
    "errorRate": 0.02,
    "averageResponseTime": 145,
    "topEndpoints": [
      {
        "endpoint": "/api/clients",
        "count": 450,
        "avgResponseTime": 120
      }
    ],
    "errorsByType": {
      "ValidationError": 15,
      "DatabaseError": 5,
      "AuthenticationError": 8
    }
  }
}
```

### Log Streaming (WebSocket)

**WebSocket** `/api/logs/stream`

Stream em tempo real de logs (apenas administradores).

```javascript
const ws = new WebSocket('wss://api.rc-construcoes.com/api/logs/stream');

ws.onmessage = (event) => {
  const logEntry = JSON.parse(event.data);
  console.log('New log:', logEntry);
};
```

---

## 🔒 Segurança e Acesso

### Controle de Acesso

```javascript
// Middleware para logs (apenas admin)
const requireAdminAccess = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Acesso negado. Apenas administradores.' 
    });
  }
  next();
};

// Aplicação nas rotas
router.get('/logs', authMiddleware, requireAdminAccess, logsController.index);
```

### Proteção contra Path Traversal

```javascript
// Validação de nome de arquivo
if (!filename || filename.includes('..') || !filename.endsWith('.log')) {
  return res.status(400).json({ 
    error: 'Nome de arquivo de log inválido.' 
  });
}
```

### Rate Limiting

```nginx
# nginx.conf - Rate limiting para logs
location /api/logs {
    limit_req zone=api burst=10 nodelay;
    proxy_pass http://backend_api;
}
```

---

## 📋 Rotação e Retenção de Logs

### Configuração de Rotação

| Tipo de Log | Rotação | Tamanho Máximo | Retenção | Compressão |
|-------------|---------|----------------|----------|------------|
| Application | Diária | 20MB | 14 dias | Sim (.gz) |
| Error | Diária | 20MB | 30 dias | Sim (.gz) |
| HTTP | Diária | 50MB | 7 dias | Sim (.gz) |

### Limpeza Automática

```javascript
// Script de limpeza (executado diariamente)
const cleanupLogs = async () => {
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
  const logsDir = 'logs';
  
  const files = await fs.readdir(logsDir);
  
  for (const file of files) {
    const stats = await fs.stat(path.join(logsDir, file));
    if (Date.now() - stats.mtime.getTime() > maxAge) {
      await fs.unlink(path.join(logsDir, file));
      logger.info(`Log antigo removido: ${file}`);
    }
  }
};
```

---

## 🧪 Testes e Debugging

### Teste de Logs

```bash
# Listar arquivos de log
curl -X GET http://localhost:3001/api/logs \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Visualizar log específico  
curl -X GET http://localhost:3001/api/logs/application-2024-01-15.log \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Debug no Frontend

```javascript
// Ativar logs de debug
window.Settings.set('logLevel', 'debug');

// Visualizar logs de atividade
const logs = await window.Database.getAll('security_logs');
console.table(logs);

// Testar log de atividade
await window.Auth.logActivity('test_action', 'Teste de logging');
```

---

## ⚠️ Considerações de Performance

### Impacto nos Logs

- **Desenvolvimento**: Logs detalhados (debug level)
- **Produção**: Logs essenciais (info level ou superior)
- **Arquivos grandes**: Rotação automática previne problemas
- **I/O Assíncrono**: Winston usa streams não-bloqueantes

### Otimizações

```javascript
// Log condicional para performance
if (logger.isDebugEnabled()) {
  logger.debug('Dados complexos:', JSON.stringify(largeObject));
}

// Usar meta objects para dados estruturados
logger.info('Operação concluída', { 
  duration: Date.now() - startTime,
  recordsProcessed: count 
});
```

---

## 📞 Alertas e Notificações

### Configuração de Alertas

```javascript
// Alerta automático para errors críticos
logger.on('error', (error) => {
  if (error.level === 'error') {
    // Enviar notificação para administradores
    notificationService.sendAlert({
      type: 'critical_error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### Monitoramento de Métricas

- **Error Rate**: Taxa de erros > 5% 
- **Response Time**: Tempo médio > 1000ms
- **Disk Usage**: Logs > 1GB
- **Log Volume**: > 10MB/hora

---

## 📞 Suporte e Recursos

Para dúvidas sobre logging:

- **Email**: dev@rc-construcoes.com
- **Logs em Tempo Real**: `/monitoring/logs.html`
- **Métricas**: `/api/logs/metrics`
- **Health Check**: `/api/health`

---

*Documentação atualizada em: Janeiro 2025*  
*Versão da API: 5.1*