# ⚙️ Configuração do Ambiente de Desenvolvimento - RC Construções

## Índice

- [📋 Pré-requisitos](#-pré-requisitos)
- [🚀 Instalação Rápida](#-instalação-rápida)
- [🔧 Configuração Manual](#-configuração-manual)
- [🐳 Setup com Docker](#-setup-com-docker)
- [🗃️ Configuração do Banco de Dados](#%EF%B8%8F-configuração-do-banco-de-dados)
- [🌐 Variáveis de Ambiente](#-variáveis-de-ambiente)
- [📱 Configuração PWA](#-configuração-pwa)
- [🧪 Configuração de Testes](#-configuração-de-testes)
- [🔍 Verificação da Instalação](#-verificação-da-instalação)
- [🚨 Solução de Problemas](#-solução-de-problemas)
- [📚 Próximos Passos](#-próximos-passos)

## 📋 Pré-requisitos

### Software Obrigatório

| Software | Versão Mínima | Versão Recomendada | Verificação |
|----------|---------------|-------------------|-------------|
| **Node.js** | 16.x | 18.x ou superior | `node --version` |
| **npm** | 8.x | 9.x ou superior | `npm --version` |
| **Git** | 2.x | Última | `git --version` |

### Software Opcional (Recomendado)

| Software | Propósito | Instalação |
|----------|-----------|------------|
| **Docker** | Containerização e BD | [docker.com](https://docker.com) |
| **Docker Compose** | Orquestração | Incluso no Docker Desktop |
| **PostgreSQL** | Banco de dados principal | [postgresql.org](https://postgresql.org) |
| **Redis** | Cache e sessões | [redis.io](https://redis.io) |
| **VS Code** | Editor recomendado | [code.visualstudio.com](https://code.visualstudio.com) |

### Extensões VS Code Recomendadas

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-jest",
    "ms-vscode.vscode-docker",
    "ms-postgresql.postgresql"
  ]
}
```

## 🚀 Instalação Rápida

### Script de Setup Automatizado

```bash
# 1. Clone o repositório
git clone https://github.com/your-org/rc-construcoes-web.git
cd rc-construcoes-web

# 2. Execute o script de setup (Linux/macOS)
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. Para Windows (PowerShell)
.\scripts\setup.ps1
```

### O que o script faz:

- ✅ Verifica pré-requisitos
- ✅ Instala dependências do frontend e backend
- ✅ Configura variáveis de ambiente
- ✅ Inicia serviços Docker (se disponível)
- ✅ Executa migrações do banco de dados
- ✅ Carrega dados de exemplo
- ✅ Executa testes básicos

## 🔧 Configuração Manual

### 1. Clone e Preparação

```bash
# Clone do repositório
git clone https://github.com/your-org/rc-construcoes-web.git
cd rc-construcoes-web

# Verificar estrutura do projeto
ls -la
```

### 2. Frontend - Instalação de Dependências

```bash
# Instalar dependências do frontend
npm install

# Verificar se todas as bibliotecas estão presentes
npm list --depth=0
```

#### Dependências Frontend Principais

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "cypress": "^12.0.0",
    "eslint": "^8.0.0",
    "prettier": "^2.8.0",
    "http-server": "^14.0.0"
  },
  "dependencies": {
    "dexie": "^3.2.0",
    "chart.js": "^4.0.0",
    "sweetalert2": "^11.0.0"
  }
}
```

### 3. Backend - Instalação de Dependências

```bash
# Navegar para o backend
cd backend

# Instalar dependências do backend
npm install

# Voltar para a raiz
cd ..
```

#### Dependências Backend Principais

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "sequelize": "^6.28.0",
    "pg": "^8.8.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.0",
    "winston": "^3.8.0",
    "dotenv": "^16.0.0",
    "cors": "^2.8.0",
    "helmet": "^6.0.0",
    "yup": "^1.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.0",
    "jest": "^29.0.0",
    "supertest": "^6.3.0"
  }
}
```

### 4. Configuração de Variáveis de Ambiente

```bash
# Copiar template das variáveis de ambiente
cp .env.example .env

# Editar arquivo .env com suas configurações
nano .env  # ou seu editor preferido
```

## 🐳 Setup com Docker

### Opção 1: Docker Compose (Recomendado)

```bash
# Iniciar todos os serviços
docker-compose up -d

# Verificar status dos containers
docker-compose ps

# Ver logs
docker-compose logs -f
```

### Opção 2: Docker Manual

```bash
# Construir imagens
docker build -f docker/Dockerfile.frontend -t rc-frontend .
docker build -f docker/Dockerfile.backend -t rc-backend ./backend

# Iniciar PostgreSQL
docker run -d \
  --name rc-postgres \
  -e POSTGRES_DB=rc_construcoes_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=docker \
  -p 5432:5432 \
  postgres:14

# Iniciar Redis
docker run -d \
  --name rc-redis \
  -p 6379:6379 \
  redis:7-alpine

# Iniciar aplicação
docker run -d \
  --name rc-backend \
  --link rc-postgres:postgres \
  --link rc-redis:redis \
  -p 3001:3000 \
  rc-backend

docker run -d \
  --name rc-frontend \
  -p 3000:3000 \
  rc-frontend
```

### Docker Compose Configuração

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development

  backend:
    build:
      context: ./backend
      dockerfile: ../docker/Dockerfile.backend
    ports:
      - "3001:3000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: rc_construcoes_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: docker
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 🗃️ Configuração do Banco de Dados

### PostgreSQL (Recomendado)

#### Instalação Local

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (Homebrew)
brew install postgresql
brew services start postgresql

# Windows
# Baixe o instalador em: https://www.postgresql.org/download/windows/
```

#### Configuração Inicial

```sql
-- Conectar como usuário postgres
sudo -u postgres psql

-- Criar banco de dados
CREATE DATABASE rc_construcoes_db;

-- Criar usuário (opcional)
CREATE USER rc_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE rc_construcoes_db TO rc_user;

-- Sair
\q
```

### MySQL (Alternativa)

#### Instalação e Configuração

```bash
# Ubuntu/Debian
sudo apt install mysql-server

# macOS (Homebrew)
brew install mysql
brew services start mysql

# Configuração segura
sudo mysql_secure_installation
```

```sql
-- Conectar ao MySQL
mysql -u root -p

-- Criar banco de dados
CREATE DATABASE rc_construcoes_db;

-- Criar usuário
CREATE USER 'rc_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON rc_construcoes_db.* TO 'rc_user'@'localhost';
FLUSH PRIVILEGES;

-- Sair
EXIT;
```

### Migrações e Seeds

```bash
# Executar migrações
cd backend
npm run migrate

# Carregar dados de exemplo
npm run seed

# Verificar tabelas criadas
npm run db:status
```

## 🌐 Variáveis de Ambiente

### Frontend (.env)

```bash
# Configurações da Aplicação
VITE_APP_NAME="RC Construções"
VITE_APP_VERSION="5.1.0"

# API Backend
VITE_API_URL="http://localhost:3001/api"
VITE_API_TIMEOUT=30000

# PWA
VITE_PWA_NAME="RC Construções"
VITE_PWA_SHORT_NAME="RC"
VITE_PWA_DESCRIPTION="Sistema de Gestão para Construção Civil"

# Desenvolvimento
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL="debug"
```

### Backend (.env)

```bash
# Configurações Gerais
NODE_ENV=development
PORT=3001
APP_NAME="RC Construções API"

# Banco de Dados
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rc_construcoes_db
DB_USER=postgres
DB_PASSWORD=docker

# Autenticação JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=8h

# Redis (Cache/Sessões)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Logs
LOG_LEVEL=debug
LOG_FILE_ENABLED=false

# Email (para notificações)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="noreply@rc-construcoes.com"

# Upload de Arquivos
UPLOAD_MAX_SIZE=10MB
UPLOAD_ALLOWED_TYPES=jpg,jpeg,png,pdf,doc,docx

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Geração de JWT Secret

```bash
# Gerar um JWT secret seguro
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ou usando OpenSSL
openssl rand -hex 64
```

## 📱 Configuração PWA

### Service Worker

O service worker está em `sw.js` e é automaticamente registrado. Para development:

```javascript
// Registrar SW apenas em produção
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js');
}
```

### Manifest PWA

```json
{
  "name": "RC Construções",
  "short_name": "RC",
  "description": "Sistema de Gestão para Construção Civil",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1976d2",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "assets/images/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/images/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## 🧪 Configuração de Testes

### Jest (Testes Unitários)

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js'
  ],
  collectCoverageFrom: [
    'js/**/*.js',
    'backend/**/*.js',
    '!**/node_modules/**',
    '!**/lib/**',
    '!**/coverage/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/js/$1'
  }
};
```

### Cypress (Testes E2E)

```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'tests/e2e/support/index.js',
    specPattern: 'tests/e2e/**/*.cy.js',
    fixturesFolder: 'tests/fixtures',
    screenshotsFolder: 'tests/screenshots',
    videosFolder: 'tests/videos',
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    viewportWidth: 1280,
    viewportHeight: 720
  }
});
```

### Scripts de Teste

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

## 🔍 Verificação da Instalação

### Checklist de Verificação

```bash
# 1. Verificar instalação do Node.js
node --version  # Deve mostrar v16+ ou v18+
npm --version   # Deve mostrar v8+ ou v9+

# 2. Verificar dependências instaladas
npm list --depth=0
cd backend && npm list --depth=0 && cd ..

# 3. Testar conexão com banco de dados
cd backend
npm run db:test

# 4. Executar testes básicos
npm test

# 5. Iniciar aplicação
npm run dev

# 6. Verificar se os serviços estão rodando
curl http://localhost:3000      # Frontend
curl http://localhost:3001/api  # Backend API
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

echo "🔍 Verificando saúde da aplicação..."

# Verificar frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend: OK"
else
    echo "❌ Frontend: FALHOU"
fi

# Verificar backend
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: FALHOU"
fi

# Verificar banco de dados
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✅ PostgreSQL: OK"
else
    echo "❌ PostgreSQL: FALHOU"
fi

# Verificar Redis
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: OK"
else
    echo "❌ Redis: FALHOU"
fi
```

### Comandos de Debug

```bash
# Ver logs da aplicação
tail -f backend/logs/application-$(date +%Y-%m-%d).log

# Monitorar requisições
cd backend
DEBUG=* npm run dev

# Verificar processo das portas
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

## 🚨 Solução de Problemas

### Problemas Comuns

#### Erro: "Port already in use"

```bash
# Encontrar processo usando a porta
lsof -ti:3000
lsof -ti:3001

# Matar processo
kill -9 $(lsof -ti:3000)
kill -9 $(lsof -ti:3001)

# Ou usar fuser (Linux)
fuser -k 3000/tcp
fuser -k 3001/tcp
```

#### Erro: "Cannot connect to database"

```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS

# Testar conexão
psql -h localhost -U postgres -d rc_construcoes_db

# Verificar logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### Erro: "Module not found"

```bash
# Limpar cache do npm
npm cache clean --force

# Deletar node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install

# Para backend também
cd backend
rm -rf node_modules package-lock.json
npm install
```

#### Erro: "Permission denied"

```bash
# Ajustar permissões dos scripts
chmod +x scripts/*.sh

# Problema com npm global (se necessário)
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Logs e Debugging

#### Frontend Debug

```javascript
// Ativar debug mode no navegador
localStorage.setItem('debug', 'true');

// Ver estado da aplicação
console.log('App State:', window.app?.getState());
console.log('Database:', window.Database?.debugInfo());
console.log('Auth:', window.Auth?.getCurrentUser());
```

#### Backend Debug

```bash
# Rodar com debug detalhado
DEBUG=express:*,sequelize:* npm run dev

# Ver logs específicos
tail -f backend/logs/error-$(date +%Y-%m-%d).log
```

### Reset Completo

```bash
#!/bin/bash
# scripts/reset.sh - Reset completo da aplicação

echo "🧹 Fazendo reset completo..."

# Parar todos os processos
docker-compose down
pkill -f "node.*rc-construcoes"

# Limpar banco de dados
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS rc_construcoes_db;"
psql -h localhost -U postgres -c "CREATE DATABASE rc_construcoes_db;"

# Limpar cache e dependências
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
npm cache clean --force

# Reinstalar
npm install
cd backend && npm install && cd ..

# Executar migrações
cd backend
npm run migrate
npm run seed
cd ..

echo "✅ Reset completo!"
```

## 📚 Próximos Passos

Após a configuração bem-sucedida:

1. **📖 Leia a documentação**:
   - [Arquitetura do Sistema](architecture.md)
   - [Guia de Contribuição](contributing.md)
   - [Documentação da API](../api/README.md)

2. **🧪 Execute os testes**:
   ```bash
   npm run test:all
   ```

3. **🎯 Configure seu editor**:
   - Instale as extensões recomendadas
   - Configure ESLint e Prettier
   - Ajuste snippets de código

4. **🔧 Personalize o ambiente**:
   - Ajuste as variáveis de ambiente
   - Configure aliases úteis
   - Crie scripts personalizados

5. **🚀 Comece a desenvolver**:
   - Crie uma branch para sua feature
   - Siga os padrões de commit
   - Execute testes antes de fazer push

### Scripts Úteis para Desenvolvimento

```bash
# Adicionar ao seu ~/.bashrc ou ~/.zshrc
alias rc-start="cd ~/rc-construcoes-web && npm run dev"
alias rc-test="cd ~/rc-construcoes-web && npm run test:watch"
alias rc-logs="cd ~/rc-construcoes-web && tail -f backend/logs/application-$(date +%Y-%m-%d).log"
alias rc-reset="cd ~/rc-construcoes-web && ./scripts/reset.sh"
```

### Comandos Docker Úteis

```bash
# Ver todos os containers RC
docker ps --filter "name=rc-"

# Logs de um serviço específico
docker-compose logs -f backend

# Reiniciar apenas um serviço
docker-compose restart backend

# Executar comando no container
docker-compose exec backend npm run migrate
```

---

## ✅ Checklist Final

- [ ] Node.js 16+ instalado
- [ ] Dependências do frontend instaladas
- [ ] Dependências do backend instaladas
- [ ] Banco de dados configurado e rodando
- [ ] Variáveis de ambiente configuradas
- [ ] Migrações executadas
- [ ] Dados de exemplo carregados
- [ ] Testes passando
- [ ] Aplicação rodando em http://localhost:3000
- [ ] API respondendo em http://localhost:3001/api
- [ ] Service Worker funcionando (em HTTPS/produção)

**🎉 Parabéns! Seu ambiente de desenvolvimento RC Construções está pronto!**

---

**Próximo**: [Arquitetura do Sistema](architecture.md)  
**Anterior**: [README de Desenvolvimento](README.md)

**Última atualização**: 30 de julho de 2025  
**Versão do documento**: 5.1  
**Mantenedores**: Equipe de Desenvolvimento RC Construções