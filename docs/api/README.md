# RC Construções - API Documentation
## Sistema de Gestão para Construção Civil v5.1

<div align="center">

![RC Construções](https://img.shields.io/badge/RC%20Construções-v5.1-blue?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue?style=for-the-badge&logo=postgresql)
![PWA](https://img.shields.io/badge/PWA-Ready-purple?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue?style=for-the-badge&logo=docker)

**Sistema completo de gestão para empresas de construção civil com funcionalidades PWA, sincronização offline e API REST robusta.**

</div>

---

## 📋 Índice

- [🎯 Visão Geral](#-visão-geral)
- [🏗️ Arquitetura](#️-arquitetura)
- [🚀 Quick Start](#-quick-start)
- [📚 Documentação da API](#-documentação-da-api)
- [🔐 Autenticação](#-autenticação)
- [💡 Funcionalidades](#-funcionalidades)
- [🛠️ Tecnologias](#️-tecnologias)
- [🐳 Docker](#-docker)
- [📊 Monitoramento](#-monitoramento)
- [🧪 Testes](#-testes)
- [🤝 Contribuição](#-contribuição)

---

## 🎯 Visão Geral

O **RC Construções** é um sistema completo de gestão empresarial desenvolvido especificamente para empresas de construção civil. O sistema oferece:

### ✨ Principais Características

- 📱 **Progressive Web App (PWA)** - Funciona offline e pode ser instalado
- 🔄 **Sincronização Automática** - Dados sincronizados entre dispositivos
- 🏗️ **Módulos Especializados** - Dashboard, clientes, contratos, orçamentos e financeiro
- 🔐 **Autenticação Robusta** - JWT com diferentes níveis de acesso
- 📊 **Relatórios Avançados** - Gráficos interativos e exportação PDF
- 🛡️ **Segurança Avançada** - Criptografia, logs de auditoria e validação
- 🐳 **Containerizado** - Deploy fácil com Docker

### 🎪 Demo e Acesso

```bash
# URLs de Desenvolvimento
Frontend: http://localhost:80
Backend API: http://localhost:3001
Documentação: http://localhost:3001/docs

# Usuários de Teste
admin / admin123          # Administrador (acesso total)
gerente / gerente123      # Gerente (gestão e relatórios)
financeiro / financeiro123 # Financeiro (módulo financeiro)
```

---

## 🏗️ Arquitetura

### Arquitetura de Alto Nível

```mermaid
graph TB
    Client[PWA Frontend] --> Nginx[Nginx Reverse Proxy]
    Nginx --> API[Node.js API]
    API --> DB[(PostgreSQL)]
    API --> Cache[(Redis)]
    API --> Logs[Winston Logs]
    Client --> IndexedDB[(IndexedDB)]
    
    subgraph "Containers"
        Nginx
        API
        DB
        Cache
    end
```

### Stack Tecnológico

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 13+
- **Cache**: Redis 6+
- **ORM**: Sequelize
- **Authentication**: JWT + bcrypt
- **Logging**: Winston
- **Validation**: Yup

#### Frontend
- **Architecture**: SPA (Single Page Application)
- **Storage**: IndexedDB (Dexie.js)
- **Charts**: Chart.js
- **PWA**: Service Workers
- **PDF**: jsPDF
- **Security**: bcrypt.js client-side

#### DevOps
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **SSL/TLS**: Let's Encrypt ready
- **Monitoring**: Winston + Custom dashboard

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+ 
- Docker & Docker Compose
- Git

### 1. Clone e Configure

```bash
# Clone o repositório
git clone https://github.com/your-org/rc-construcoes.git
cd rc-construcoes

# Configure variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### 2. Docker Setup (Recomendado)

```bash
# Inicie todos os serviços
docker-compose up -d

# Verifique os serviços
docker-compose ps
```

### 3. Desenvolvimento Local

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (novo terminal)
cd ..
python -m http.server 80  # ou nginx
```

### 4. Verificação

```bash
# Health check da API
curl http://localhost:3001/health

# Frontend
open http://localhost
```

---

## 📚 Documentação da API

### 📖 Documentação Completa

| Módulo | Descrição | Link |
|--------|-----------|------|
| **Autenticação** | JWT, login, logout, permissões | [📖 authentication.md](./authentication.md) |
| **Logging** | Sistema de logs, monitoramento | [📖 logging.md](./logging.md) |
| **Sincronização** | Sync offline, resolução de conflitos | [📖 synchronization.md](./synchronization.md) |

### 🌐 Base URLs

```bash
# Produção
https://api.rc-construcoes.com

# Desenvolvimento  
http://localhost:3001

# Health Check
GET /health
```

### 📋 Endpoints Principais

#### Autenticação
```http
POST   /api/auth/login          # Login do usuário
POST   /api/auth/register       # Registro de usuário
GET    /api/auth/verify         # Verificar token
POST   /api/auth/logout         # Logout
```

#### Gestão de Dados
```http
# Clientes
GET    /api/clients            # Listar clientes
POST   /api/clients            # Criar cliente
GET    /api/clients/:id        # Obter cliente
PUT    /api/clients/:id        # Atualizar cliente
DELETE /api/clients/:id        # Deletar cliente

# Contratos
GET    /api/contracts          # Listar contratos
POST   /api/contracts          # Criar contrato
GET    /api/contracts/:id      # Obter contrato
PUT    /api/contracts/:id      # Atualizar contrato

# Orçamentos
GET    /api/budgets            # Listar orçamentos
POST   /api/budgets            # Criar orçamento
GET    /api/budgets/:id        # Obter orçamento
PUT    /api/budgets/:id        # Atualizar orçamento

# Financeiro
GET    /api/financial          # Listar transações
POST   /api/financial          # Criar transação
GET    /api/financial/reports  # Relatórios financeiros
```

#### Sistema
```http
GET    /api/logs               # Listar logs (admin)
GET    /api/logs/:filename     # Visualizar log (admin)
POST   /api/sync               # Sincronização de dados
GET    /api/health             # Health check
```

---

## 🔐 Autenticação

### JWT Authentication

Todas as rotas protegidas requerem um token JWT válido:

```javascript
// Header obrigatório
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Níveis de Acesso

| Role | Permissões | Descrição |
|------|------------|-----------|
| **admin** | `["all"]` | Acesso total ao sistema |
| **manager** | `["dashboard", "clients", "contracts", "budgets", "reports"]` | Gestão operacional |
| **financial** | `["dashboard", "financial", "reports", "clients_view"]` | Módulo financeiro |

### Exemplo de Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@rcconstrucoes.com",
    "password": "admin123"
  }'
```

---

## 💡 Funcionalidades

### 📊 Dashboard Interativo
- **Métricas em tempo real**: Receita, contratos ativos, novos clientes
- **Gráficos dinâmicos**: Visão financeira e distribuição de contratos
- **Atividades recentes**: Timeline de ações do sistema
- **Resumo executivo**: KPIs principais

### 👥 Gestão de Clientes
- **CRUD completo**: Criar, listar, editar e deletar clientes
- **Informações detalhadas**: Dados pessoais, endereço, contato
- **Histórico**: Contratos e orçamentos associados
- **Validação**: CPF, email e dados obrigatórios

### 📄 Contratos
- **Lifecycle management**: Draft → Active → Completed → Canceled
- **Integração com clientes**: Seleção e associação automática
- **Valores e datas**: Controle de prazos e valores
- **Status tracking**: Acompanhamento do progresso

### 🧮 Orçamentos
- **Wizard de criação**: Processo guiado passo a passo
- **Cálculos automáticos**: Materiais + mão de obra + margem
- **Múltiplos serviços**: Construção, reforma, pintura, etc.
- **Geração de PDF**: Orçamentos profissionais

### 💰 Módulo Financeiro
- **Fluxo de caixa**: Entradas e saídas
- **Relatórios**: Análises por período e categoria
- **Gráficos**: Visualização de tendências
- **Exportação**: Dados para contabilidade

### 📱 PWA Features
- **Instalação**: App nativo via navegador
- **Offline-first**: Funciona sem internet
- **Sincronização**: Dados sincronizados automaticamente
- **Notificações**: Alertas e lembretes

---

## 🛠️ Tecnologias

### Backend Stack

```json
{
  "runtime": "Node.js 18+",
  "framework": "Express.js 4.18+",
  "database": "PostgreSQL 13+",
  "cache": "Redis 6+",
  "orm": "Sequelize 6+",
  "auth": "jsonwebtoken + bcryptjs",
  "validation": "yup",
  "logging": "winston + winston-daily-rotate-file",
  "security": "helmet + cors + rate-limiting"
}
```

### Frontend Stack

```json
{
  "architecture": "Vanilla JS SPA",
  "storage": "IndexedDB (Dexie.js)",
  "charts": "Chart.js",
  "pdf": "jsPDF",
  "notifications": "SweetAlert2",
  "csv": "PapaParse",
  "pwa": "Service Workers",
  "security": "bcrypt.js"
}
```

### DevOps & Infrastructure

```json
{
  "containerization": "Docker + Docker Compose",
  "reverse_proxy": "Nginx",
  "ssl": "Let's Encrypt ready",
  "monitoring": "Winston + Custom dashboards",
  "testing": "Jest + Cypress",
  "ci_cd": "GitHub Actions ready"
}
```

---

## 🐳 Docker

### Desenvolvimento

```bash
# Iniciar todos os serviços
docker-compose up -d

# Logs em tempo real
docker-compose logs -f

# Parar serviços
docker-compose down
```

### Produção

```bash
# Build e deploy de produção
docker-compose -f docker-compose.prod.yml up -d

# Scaling
docker-compose up --scale backend=3
```

### Serviços Incluídos

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **nginx** | 80, 443 | Reverse proxy + Frontend |
| **backend** | 3001 | API Node.js |
| **postgres** | 5432 | Database |
| **redis** | 6379 | Cache |

---

## 📊 Monitoramento

### Health Checks

```bash
# API Health
curl http://localhost:3001/health

# Database Status  
curl http://localhost:3001/api/health/db

# Redis Status
curl http://localhost:3001/api/health/redis
```

### Logs

```bash
# Logs da aplicação
docker-compose logs backend

# Logs do Nginx
docker-compose logs nginx

# Logs específicos por data
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/logs/application-2024-01-15.log
```

### Métricas

```bash
# Métricas da API
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/logs/metrics
```

---

## 🧪 Testes

### Setup de Testes

```bash
# Instalar dependências de teste
npm install --include=dev

# Executar todos os testes
npm test

# Testes com coverage
npm run test:coverage
```

### Tipos de Teste

```bash
# Testes unitários
npm run test:unit

# Testes de integração  
npm run test:integration

# Testes E2E
npm run test:e2e
```

### Estrutura de Testes

```
tests/
├── unit/                 # Testes unitários
│   ├── auth.test.js
│   ├── database.test.js
│   └── validation.test.js
├── integration/          # Testes de integração
│   ├── clients-crud.test.js
│   └── contracts-flow.test.js
└── e2e/                  # Testes end-to-end
    ├── login-flow.cy.js
    └── dashboard.cy.js
```

---

## 📝 Configuração

### Variáveis de Ambiente

```bash
# .env
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=rc_construcoes_db
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your-super-secure-jwt-secret-256-bits
JWT_EXPIRES_IN=8h

# Optional
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info
```

### Nginx Configuration

O sistema inclui configuração Nginx otimizada com:

- **SSL/TLS**: Ready para Let's Encrypt
- **Compression**: Gzip habilitado
- **Caching**: Headers otimizados para performance
- **Security**: Headers de segurança configurados
- **Rate Limiting**: Proteção contra DDoS

---

## 🚀 Deploy

### Deploy Manual

```bash
# 1. Clone e configure
git clone https://github.com/your-org/rc-construcoes.git
cd rc-construcoes

# 2. Configure environment
cp .env.example .env
# Edite .env com configurações de produção

# 3. Deploy com Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Deploy com CI/CD

O projeto inclui workflows GitHub Actions para:

- ✅ **Testing**: Execução automática de testes
- 🚀 **Deploy**: Deploy automático para staging/production
- 🔒 **Security**: Scan de vulnerabilidades

---

## 📋 Roadmap

### v5.2 (Próxima)
- [ ] API REST completa para mobile
- [ ] Módulo de relatórios avançados
- [ ] Integração com APIs de pagamento
- [ ] Notificações push

### v6.0 (Futuro)
- [ ] Aplicativo mobile nativo
- [ ] IA para análise de custos
- [ ] Integração com ERPs
- [ ] Módulo de estoque

---

## 🤝 Contribuição

### Como Contribuir

1. **Fork** o projeto
2. **Crie** uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. **Commit** suas mudanças (`git commit -m 'Add: nova feature'`)
4. **Push** para a branch (`git push origin feature/nova-feature`)
5. **Abra** um Pull Request

### Padrões de Código

```bash
# Linting
npm run lint

# Formatting
npm run format

# Type checking
npm run type-check
```

### Estrutura de Commits

```bash
feat: adiciona nova funcionalidade
fix: corrige bug
docs: atualiza documentação
style: formatação de código
refactor: refatoração
test: adiciona/atualiza testes
chore: tarefas de build/configuração
```

---

## 📞 Suporte

### Recursos de Ajuda

- 📖 **Documentação**: `/docs/api/`
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-org/rc-construcoes/issues)
- 💬 **Discussões**: [GitHub Discussions](https://github.com/your-org/rc-construcoes/discussions)
- 📧 **Email**: dev@rc-construcoes.com

### Status do Sistema

- 🟢 **API Status**: [status.rc-construcoes.com](https://status.rc-construcoes.com)
- 📊 **Uptime**: 99.9% SLA
- 🔄 **Updates**: Changelog automático

---

## 📄 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---

## 👨‍💻 Equipe

Desenvolvido com ❤️ pela equipe RC Construções.

**Versão atual**: v5.1  
**Última atualização**: Janeiro 2025  
**Node.js**: 18+  
**Status**: ✅ Produção

---

<div align="center">

**[⬆ Voltar ao topo](#rc-construções---api-documentation)**

</div>