# 🛠️ Guia de Desenvolvimento - RC Construções

## Índice

- [📋 Visão Geral](#-visão-geral)
- [🏗️ Arquitetura do Sistema](#%EF%B8%8F-arquitetura-do-sistema)
- [⚙️ Configuração do Ambiente](#%EF%B8%8F-configuração-do-ambiente)
- [🚀 Iniciando o Desenvolvimento](#-iniciando-o-desenvolvimento)
- [📂 Estrutura de Pastas](#-estrutura-de-pastas)
- [🧪 Testes](#-testes)
- [🔧 Ferramentas e Tecnologias](#-ferramentas-e-tecnologias)
- [📝 Padrões de Código](#-padrões-de-código)
- [🔄 Fluxo de Desenvolvimento](#-fluxo-de-desenvolvimento)
- [🐛 Debugging](#-debugging)
- [📊 Monitoramento](#-monitoramento)
- [🚀 Deploy](#-deploy)

## 📋 Visão Geral

O **RC Construções** é um sistema completo de gestão para empresas de construção civil, desenvolvido como uma Progressive Web App (PWA) com arquitetura híbrida frontend/backend.

### Características Principais

- **Frontend**: PWA com JavaScript vanilla e IndexedDB
- **Backend**: Node.js com Express, PostgreSQL/MySQL
- **Autenticação**: JWT (JSON Web Tokens)
- **Sincronização**: Sistema de sync offline-first
- **Testes**: Jest (unitários) + Cypress (E2E)
- **Containerização**: Docker e Docker Compose

## 🏗️ Arquitetura do Sistema

### Frontend (Cliente)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Service       │    │    Modern       │    │   Módulos de    │
│   Worker        │◄──►│    App JS       │◄──►│ Funcionalidade  │
│   (Cache/PWA)   │    │ (Controlador)   │    │ (CRUD Modules)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   IndexedDB     │    │   Core Systems  │    │   UI Components │
│   (Dexie.js)    │    │ (Auth/Security) │    │   (HTML/CSS)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Backend (Servidor)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Routes    │    │   Controllers   │    │     Models      │
│   (Express)     │◄──►│   (Business)    │◄──►│   (Sequelize)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Middleware    │    │   Database      │    │   Monitoring    │
│  (Auth/Logger)  │    │ (PostgreSQL)    │    │ (Winston/Logs)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ⚙️ Configuração do Ambiente

### Pré-requisitos

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **Docker** e **Docker Compose** (opcional)
- **PostgreSQL** >= 12.0 (ou MySQL >= 8.0)
- **Git**

### Instalação Rápida

```bash
# 1. Clone o repositório
git clone https://github.com/your-org/rc-construcoes-web.git
cd rc-construcoes-web

# 2. Execute o script de setup
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### Setup Manual

```bash
# 1. Instalar dependências do frontend
npm install

# 2. Instalar dependências do backend
cd backend
npm install
cd ..

# 3. Configurar banco de dados
# Edite backend/config/database.js
# Execute as migrações
cd backend
npm run migrate
npm run seed
cd ..
```

## 🚀 Iniciando o Desenvolvimento

### Desenvolvimento Local

```bash
# Frontend (servidor de desenvolvimento)
npm run dev

# Backend (em outro terminal)
cd backend
npm run dev

# Ou usando Docker Compose
docker-compose up -d
```

### URLs de Desenvolvimento

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Documentação API**: http://localhost:3001/docs
- **Monitoramento**: http://localhost:3002

## 📂 Estrutura de Pastas

```
rc-construcoes-web/
├── 📁 frontend/                    # Aplicação cliente
│   ├── 📁 js/                     # JavaScript modules
│   │   ├── 📁 core/               # Módulos essenciais
│   │   ├── 📁 modules/            # Funcionalidades
│   │   └── 📁 utils/              # Utilitários
│   ├── 📁 css/                    # Estilos
│   ├── 📁 assets/                 # Recursos estáticos
│   └── 📁 templates/              # Templates HTML
│
├── 📁 backend/                     # API servidor
│   ├── 📁 routes/                 # Rotas da API
│   ├── 📁 controllers/            # Lógica de negócio
│   ├── 📁 models/                 # Modelos de dados
│   ├── 📁 middleware/             # Middlewares
│   └── 📁 config/                 # Configurações
│
├── 📁 tests/                       # Testes automatizados
│   ├── 📁 unit/                   # Testes unitários
│   ├── 📁 integration/            # Testes de integração
│   ├── 📁 e2e/                    # Testes end-to-end
│   └── 📁 fixtures/               # Dados de teste
│
├── 📁 docker/                      # Containerização
├── 📁 scripts/                     # Scripts de automação
└── 📁 docs/                        # Documentação
```

### Módulos Core Principais

| Módulo | Responsabilidade |
|--------|------------------|
| `init_system_js.js` | Orquestrador de inicialização |
| `modern_app_js.js` | Controlador principal da UI |
| `database.js` | Gerenciamento IndexedDB |
| `auth.js` | Sistema de autenticação |
| `security.js` | Validações e segurança |
| `cloud-sync.js` | Sincronização com servidor |

## 🧪 Testes

### Estrutura de Testes

```bash
tests/
├── unit/                          # Testes isolados de funções
├── integration/                   # Testes de fluxos completos
├── e2e/                          # Testes de interface do usuário
├── fixtures/                     # Dados de teste
└── helpers/                      # Utilitários de teste
```

### Executando Testes

```bash
# Todos os testes
npm test

# Apenas testes unitários
npm run test:unit

# Apenas testes de integração
npm run test:integration

# Testes E2E com Cypress
npm run test:e2e

# Testes com cobertura
npm run test:coverage

# Modo watch para desenvolvimento
npm run test:watch
```

### Configuração de Testes

#### Jest (Unitários/Integração)
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/lib/**',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

#### Cypress (E2E)
```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'tests/e2e/support/index.js',
    specPattern: 'tests/e2e/**/*.cy.js',
    video: true,
    screenshotOnRunFailure: true
  }
});
```

## 🔧 Ferramentas e Tecnologias

### Frontend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **Dexie.js** | ~3.2.0 | IndexedDB wrapper |
| **Chart.js** | ~4.0.0 | Gráficos e visualizações |
| **jsPDF** | ~2.5.0 | Geração de PDFs |
| **SweetAlert2** | ~11.0.0 | Alertas e modais |
| **Papa Parse** | ~5.4.0 | Processamento CSV |
| **bcrypt.js** | ~2.4.0 | Hash de senhas |

### Backend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **Express** | ~4.18.0 | Framework web |
| **Sequelize** | ~6.28.0 | ORM para banco de dados |
| **jsonwebtoken** | ~9.0.0 | Autenticação JWT |
| **bcryptjs** | ~2.4.0 | Hash de senhas |
| **winston** | ~3.8.0 | Sistema de logs |
| **yup** | ~1.0.0 | Validação de dados |

### Desenvolvimento

| Ferramenta | Propósito |
|------------|-----------|
| **Jest** | Testes unitários e integração |
| **Cypress** | Testes end-to-end |
| **ESLint** | Linting de código |
| **Prettier** | Formatação de código |
| **Husky** | Git hooks |
| **Docker** | Containerização |

## 📝 Padrões de Código

### Estrutura de Módulos

```javascript
/**
 * Template padrão para módulos do sistema
 * RC Construções v5.1
 */

class ModuleName {
    constructor() {
        this.initialized = false;
        this.data = [];
        
        // Initialize quando necessário
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.initialized = true;
            console.log('✅ ModuleName inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar ModuleName:', error);
        }
    }

    async loadData() {
        // Implementar carregamento de dados
    }

    setupEventListeners() {
        // Implementar event listeners
    }
}

// Exportação global
window.ModuleName = new ModuleName();
```

### Nomenclatura

#### JavaScript
- **Classes**: PascalCase (`ClientsManager`)
- **Métodos/Funções**: camelCase (`loadClients`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_ITEMS_PER_PAGE`)
- **Variáveis**: camelCase (`clientData`)

#### CSS
- **Classes**: kebab-case (`client-card`)
- **IDs**: kebab-case (`client-form`)
- **Variáveis CSS**: kebab-case (`--primary-color`)

#### Arquivos
- **JavaScript**: camelCase ou kebab-case (`clients.js`, `cloud-sync.js`)
- **CSS**: kebab-case (`main-styles.css`)
- **HTML**: kebab-case (`client-details.html`)

### Tratamento de Erros

```javascript
// Padrão para tratamento de erros
async function exampleFunction() {
    try {
        const result = await someAsyncOperation();
        return result;
    } catch (error) {
        console.error('Contexto específico do erro:', error);
        
        // Log para monitoramento
        if (window.Logger) {
            window.Logger.error('exampleFunction', error);
        }
        
        // Notificação para usuário
        if (window.app) {
            window.app.showError('Mensagem amigável para o usuário');
        }
        
        throw error; // Re-throw se necessário
    }
}
```

## 🔄 Fluxo de Desenvolvimento

### Git Workflow

```bash
# 1. Criar nova feature branch
git checkout -b feature/nova-funcionalidade

# 2. Desenvolvimento
# ... código ...

# 3. Executar testes
npm test

# 4. Commit com padrão
git add .
git commit -m "feat: adiciona nova funcionalidade X

- Implementa funcionalidade Y
- Adiciona testes para Z
- Atualiza documentação"

# 5. Push e Pull Request
git push origin feature/nova-funcionalidade
```

### Convenção de Commits

```
tipo(escopo): descrição breve

Descrição detalhada opcional.

- Lista de mudanças
- Outros detalhes importantes

Closes #123
```

**Tipos válidos:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação/estilo
- `refactor`: Refatoração
- `test`: Testes
- `chore`: Tarefas de manutenção

### Code Review Checklist

- [ ] **Funcionalidade**: O código funciona conforme esperado?
- [ ] **Testes**: Existem testes adequados?
- [ ] **Performance**: O código é eficiente?
- [ ] **Segurança**: Não há vulnerabilidades óbvias?
- [ ] **Documentação**: Código bem documentado?
- [ ] **Padrões**: Segue os padrões do projeto?

## 🐛 Debugging

### Frontend

```javascript
// Debug mode
if (window.location.hostname === 'localhost') {
    window.DEBUG = true;
    
    // Helpers globais para debug
    window.debugAuth = () => console.log(window.Auth?.getCurrentUser());
    window.debugDB = () => window.Database?.debugInfo();
    window.debugSync = () => window.CloudSync?.getStatus();
}
```

### Console Commands

```javascript
// Comandos úteis no DevTools
window.rc = {
    // Informações do sistema
    info: () => ({
        version: window.app?.version,
        user: window.Auth?.getCurrentUser(),
        modules: Object.keys(window).filter(k => k.endsWith('Manager'))
    }),
    
    // Reset de dados
    reset: () => window.Database?.clear(),
    
    // Simulação de dados
    demo: () => window.DemoData?.loadSampleData(),
    
    // Status de sincronização
    sync: () => window.CloudSync?.syncAll()
};
```

### Logging

```javascript
// Sistema de logs estruturado
class Logger {
    static levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
    
    static log(level, module, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, level, module, message, data };
        
        console.log(`[${timestamp}] ${level} ${module}: ${message}`, data);
        
        // Armazenar logs localmente
        this.storeLogs(logEntry);
    }
    
    static error(module, error) {
        this.log('ERROR', module, error.message, error);
    }
    
    static info(module, message, data) {
        this.log('INFO', module, message, data);
    }
}

window.Logger = Logger;
```

## 📊 Monitoramento

### Métricas de Performance

```javascript
// Web Vitals monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
    console.log('Performance metric:', metric);
    // Enviar para sistema de monitoramento
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Health Checks

```javascript
// Status de saúde da aplicação
window.healthCheck = async () => {
    const checks = {
        database: await window.Database?.isHealthy(),
        auth: !!window.Auth?.getCurrentUser(),
        sync: window.CloudSync?.isOnline(),
        storage: !!window.localStorage
    };
    
    const healthy = Object.values(checks).every(Boolean);
    
    return { healthy, checks, timestamp: new Date().toISOString() };
};
```

## 🚀 Deploy

### Ambientes

| Ambiente | URL | Branch | Deploy |
|----------|-----|--------|--------|
| **Desenvolvimento** | localhost:3000 | `develop` | Manual |
| **Staging** | staging.rc-app.com | `staging` | Auto (PR) |
| **Produção** | app.rc-construcoes.com | `main` | Manual |

### Pipeline CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        run: ./scripts/deploy.sh production
```

### Deploy Manual

```bash
# Build de produção
npm run build

# Deploy usando Docker
docker-compose -f docker-compose.prod.yml up -d

# Ou deploy tradicional
./scripts/deploy.sh production
```

### Checklist de Deploy

- [ ] **Testes**: Todos os testes passando
- [ ] **Build**: Build de produção sem erros
- [ ] **Database**: Migrações aplicadas
- [ ] **Environment**: Variáveis de ambiente configuradas
- [ ] **Backup**: Backup do banco de dados
- [ ] **Monitoring**: Logs e métricas funcionando
- [ ] **Rollback**: Plano de rollback preparado

---

## 📚 Recursos Adicionais

### Documentação Relacionada

- [Setup Inicial](setup.md)
- [Arquitetura do Sistema](architecture.md)
- [Guia de Contribuição](contributing.md)
- [Documentação da API](../api/README.md)
- [Guia de Testes](../testing/README.md)

### Links Úteis

- [Dexie.js Documentation](https://dexie.org/)
- [Express.js Guide](https://expressjs.com/)
- [Jest Testing Framework](https://jestjs.io/)
- [Cypress Documentation](https://docs.cypress.io/)
- [Docker Documentation](https://docs.docker.com/)

### Suporte

- **Issues**: GitHub Issues
- **Discussões**: GitHub Discussions
- **Chat**: Slack #dev-rc-construcoes
- **Email**: dev-team@rc-construcoes.com

---

**Última atualização**: 30 de julho de 2025  
**Versão do documento**: 5.1  
**Mantenedores**: Equipe de Desenvolvimento RC Construções