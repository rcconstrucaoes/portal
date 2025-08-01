# 🧪 Documentação de Testes - RC Construções

## Índice

- [📋 Visão Geral](#-visão-geral)
- [🏗️ Estrutura de Testes](#%EF%B8%8F-estrutura-de-testes)
- [🔧 Ferramentas e Tecnologias](#-ferramentas-e-tecnologias)
- [🚀 Início Rápido](#-início-rápido)
- [📊 Tipos de Teste](#-tipos-de-teste)
- [📈 Métricas e Cobertura](#-métricas-e-cobertura)
- [🔄 Pipeline CI/CD](#-pipeline-cicd)
- [💡 Boas Práticas](#-boas-práticas)
- [🐛 Debugging e Troubleshooting](#-debugging-e-troubleshooting)
- [📚 Recursos e Links](#-recursos-e-links)

## 📋 Visão Geral

O sistema RC Construções implementa uma estratégia abrangente de testes que garante a qualidade, confiabilidade e estabilidade da aplicação. Nossa abordagem de testes cobre desde unidades isoladas até fluxos completos de usuário, garantindo que cada aspecto do sistema funcione corretamente.

### Filosofia de Testes

- **Qualidade First**: Testes são uma prioridade, não uma tarefa secundária
- **Pirâmide de Testes**: Mais testes unitários, moderados de integração, poucos E2E
- **Fast Feedback**: Testes rápidos para feedback imediato durante desenvolvimento
- **Confidence**: Confiança para refatorar e fazer mudanças sem medo
- **Documentation**: Testes servem como documentação viva do comportamento esperado

### Objetivos dos Testes

| Objetivo | Descrição | Benefício |
|----------|-----------|-----------|
| **Qualidade** | Detectar bugs antes da produção | Reduz custos de correção |
| **Confiabilidade** | Garantir funcionamento consistente | Aumenta confiança do usuário |
| **Refatoração** | Permitir mudanças seguras no código | Acelera desenvolvimento |
| **Documentação** | Especificar comportamento esperado | Facilita manutenção |
| **Regressão** | Evitar quebras em funcionalidades existentes | Mantém estabilidade |

## 🏗️ Estrutura de Testes

### Organização de Arquivos

```
tests/
├── 🧪 unit/                           # Testes Unitários
│   ├── core/                          # Módulos essenciais
│   │   ├── auth.test.js               # Sistema de autenticação
│   │   ├── database.test.js           # Operações de banco
│   │   ├── security.test.js           # Validações de segurança
│   │   ├── validation.test.js         # Regras de validação
│   │   ├── utils.test.js              # Funções utilitárias
│   │   ├── charts.test.js             # Geração de gráficos
│   │   └── logger.test.js             # Sistema de logs
│   └── modules/                       # Módulos funcionais
│       ├── clients.test.js            # Gestão de clientes
│       ├── contracts.test.js          # Gestão de contratos
│       ├── budgets.test.js            # Sistema de orçamentos
│       ├── financial.test.js          # Módulo financeiro
│       └── dashboard.test.js          # Dashboard e métricas
│
├── 🔗 integration/                    # Testes de Integração
│   ├── dashboard-integration.test.js  # Agregação de dados
│   ├── clients-crud.test.js           # CRUD completo de clientes
│   ├── contracts-flow.test.js         # Fluxo de contratos
│   ├── budgets-workflow.test.js       # Workflow de orçamentos
│   ├── sync-integration.test.js       # Sincronização de dados
│   ├── financial-integration.test.js  # Sistema financeiro
│   ├── api-integration.test.js        # Integração com backend
│   └── database-integration.test.js   # Operações de banco
│
├── 🎭 e2e/                            # Testes End-to-End
│   ├── auth/                          # Fluxos de autenticação
│   │   ├── login-flow.cy.js           # Processo de login
│   │   ├── logout-flow.cy.js          # Processo de logout
│   │   └── session-management.cy.js   # Gestão de sessão
│   ├── dashboard/                     # Dashboard e navegação
│   │   ├── dashboard-navigation.cy.js # Navegação principal
│   │   ├── dashboard-charts.cy.js     # Gráficos e métricas
│   │   └── dashboard-responsive.cy.js # Responsividade
│   ├── clients/                       # Gestão de clientes
│   │   ├── client-management.cy.js    # CRUD de clientes
│   │   ├── client-search.cy.js        # Busca e filtros
│   │   └── client-import-export.cy.js # Import/Export
│   ├── contracts/                     # Gestão de contratos
│   │   ├── contract-creation.cy.js    # Criação de contratos
│   │   ├── contract-workflow.cy.js    # Fluxo de aprovação
│   │   └── contract-pdf.cy.js         # Geração de PDFs
│   └── pwa/                           # Funcionalidades PWA
│       ├── offline-functionality.cy.js # Modo offline
│       └── installation.cy.js         # Instalação PWA
│
├── 🎯 fixtures/                       # Dados de Teste
│   ├── clients.json                   # Dados de clientes
│   ├── contracts.json                 # Dados de contratos
│   ├── budgets.json                   # Dados de orçamentos
│   ├── users.json                     # Dados de usuários
│   └── api-responses/                 # Respostas de API
│       ├── cep-response.json          # ViaCEP responses
│       └── auth-responses.json        # Respostas de auth
│
└── 🛠️ helpers/                        # Utilitários de Teste
    ├── setup.js                       # Configuração global
    ├── mock-database.js               # Mock do banco de dados
    ├── mock-auth.js                   # Mock de autenticação
    ├── test-utils.js                  # Utilities gerais
    ├── integration-utils.js           # Utils para integração
    └── e2e-commands.js                # Comandos Cypress
```

### Configurações de Teste

| Arquivo | Finalidade | Framework |
|---------|------------|-----------|
| `jest.config.js` | Configuração testes unitários | Jest |
| `jest.integration.config.js` | Configuração testes integração | Jest |
| `cypress.config.js` | Configuração testes E2E | Cypress |
| `.env.test` | Variáveis ambiente de teste | - |

## 🔧 Ferramentas e Tecnologias

### Stack de Testes

| Categoria | Ferramenta | Versão | Finalidade |
|-----------|------------|--------|------------|
| **Unit Testing** | Jest | ~29.0 | Framework de testes JavaScript |
| **E2E Testing** | Cypress | ~12.0 | Testes end-to-end automatizados |
| **Mocking** | Jest Mocks | - | Simulação de dependências |
| **Coverage** | Jest Coverage | - | Análise de cobertura de código |
| **API Testing** | MSW | ~1.0 | Mock Service Worker |
| **Visual Testing** | Percy | - | Testes de regressão visual |
| **Performance** | Lighthouse CI | - | Testes de performance |

### Bibliotecas de Apoio

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "cypress": "^12.0.0",
    "@testing-library/jest-dom": "^5.16.0",
    "@testing-library/dom": "^9.0.0",
    "jest-environment-jsdom": "^29.0.0",
    "cypress-axe": "^1.4.0",
    "jest-fetch-mock": "^3.0.0",
    "msw": "^1.0.0"
  }
}
```

## 🚀 Início Rápido

### Pré-requisitos

```bash
# Verificar versões
node --version  # >= 16.x
npm --version   # >= 8.x

# Instalar dependências
npm install
```

### Comandos Básicos

```bash
# 🧪 Testes Unitários
npm run test                    # Executar todos os testes unitários
npm run test:watch              # Modo watch para desenvolvimento
npm run test:coverage           # Gerar relatório de cobertura
npm run test:unit:specific      # Testar arquivo específico

# 🔗 Testes de Integração
npm run test:integration        # Executar testes de integração
npm run test:integration:watch  # Modo watch para integração
npm run test:integration:ci     # Modo CI (sem watch)

# 🎭 Testes E2E
npm run test:e2e               # Executar testes E2E (headless)
npm run test:e2e:open          # Abrir Cypress GUI
npm run test:e2e:chrome        # Executar no Chrome
npm run test:e2e:firefox       # Executar no Firefox

# 🏃‍♂️ Executar Todos
npm run test:all               # Executar todos os tipos de teste
npm run test:ci                # Modo CI completo
```

### Setup Inicial

```bash
# 1. Clonar e instalar
git clone <repo-url>
cd rc-construcoes-web
npm install

# 2. Configurar ambiente de teste
cp .env.example .env.test
# Editar .env.test com configurações de teste

# 3. Executar primeiro teste
npm test

# 4. Verificar E2E
npm run test:e2e:open
```

## 📊 Tipos de Teste

### 🧪 Testes Unitários

**Objetivo**: Testar unidades isoladas de código (funções, classes, módulos)

**Características**:
- ✅ Rápidos de executar (< 1s cada)
- ✅ Isolados (sem dependências externas)
- ✅ Determinísticos (sempre mesmo resultado)
- ✅ Fáceis de debug

**Exemplo**:
```javascript
// tests/unit/core/validation.test.js
describe('Validation Utils', () => {
  test('should validate CPF correctly', () => {
    expect(validateCPF('12345678901')).toBe(true);
    expect(validateCPF('invalid')).toBe(false);
  });
});
```

**Quando usar**:
- Funções puras e utilitários
- Lógica de negócio complexa
- Algoritmos e cálculos
- Validações e transformações

**Documentação**: [Testes Unitários](unit-tests.md)

### 🔗 Testes de Integração

**Objetivo**: Testar interação entre módulos e sistemas

**Características**:
- ⚡ Moderadamente rápidos (1-5s cada)
- 🔄 Testam fluxos de dados
- 🗃️ Podem usar banco de teste
- 🌐 Podem fazer chamadas de API

**Exemplo**:
```javascript
// tests/integration/clients-crud.test.js
describe('Clients CRUD Integration', () => {
  test('should create client and sync with API', async () => {
    const client = await clientsManager.createClient(clientData);
    expect(client.id).toBeDefined();
    expect(mockAPI.post).toHaveBeenCalled();
  });
});
```

**Quando usar**:
- Fluxos de dados entre módulos
- Integração com APIs
- Workflows de negócio
- Sincronização de dados

**Documentação**: [Testes de Integração](integration-tests.md)

### 🎭 Testes End-to-End (E2E)

**Objetivo**: Testar aplicação completa do ponto de vista do usuário

**Características**:
- 🐌 Mais lentos (10-30s cada)
- 🖥️ Testam interface real
- 🌐 Testam em browsers reais
- 🔄 Testam fluxos completos

**Exemplo**:
```javascript
// tests/e2e/auth/login-flow.cy.js
describe('Login Flow', () => {
  it('should login successfully', () => {
    cy.visit('/login');
    cy.get('[data-testid="email"]').type('admin@test.com');
    cy.get('[data-testid="password"]').type('password');
    cy.get('[data-testid="login-btn"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

**Quando usar**:
- Fluxos críticos de usuário
- Testes de aceitação
- Validação de releases
- Testes de regressão

**Documentação**: [Testes E2E](e2e-tests.md)

## 📈 Métricas e Cobertura

### Objetivos de Cobertura

| Tipo de Teste | Meta de Cobertura | Threshold Mínimo |
|---------------|-------------------|------------------|
| **Unitários** | 90% | 80% |
| **Integração** | 80% | 70% |
| **E2E** | 70% | 60% |
| **Overall** | 85% | 75% |

### Métricas Importantes

#### Cobertura de Código
```bash
# Gerar relatório detalhado
npm run test:coverage

# Visualizar no browser
open coverage/lcov-report/index.html
```

#### Métricas de Qualidade
- **Lines**: Linhas de código testadas
- **Functions**: Funções testadas
- **Branches**: Caminhos de código testados
- **Statements**: Declarações testadas

#### Performance dos Testes
```bash
# Relatório de tempo de execução
npm run test -- --verbose

# Análise de testes lentos
npm run test:slow
```

### Dashboard de Métricas

```
📊 Test Metrics Dashboard
├── Coverage Report (lcov-report/index.html)
├── Jest Report (jest-report.html)
├── Cypress Report (cypress/reports/)
└── Performance Report (lighthouse/)
```

## 🔄 Pipeline CI/CD

### GitHub Actions Workflow

```yaml
# .github/workflows/tests.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit:ci
      
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration:ci
      
  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chrome, firefox]
    steps:
      - uses: actions/checkout@v3
      - uses: cypress-io/github-action@v6
        with:
          browser: ${{ matrix.browser }}
```

### Estratégia de Execução

| Ambiente | Quando Executar | Tipos de Teste |
|----------|----------------|----------------|
| **Local** | Durante desenvolvimento | Unitários + watch |
| **PR** | A cada pull request | Todos os tipos |
| **Main** | A cada push para main | Todos + reports |
| **Release** | Antes de cada release | Todos + smoke tests |

### Quality Gates

```javascript
// jest.config.js
module.exports = {
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

## 💡 Boas Práticas

### Estrutura de Testes

#### 📝 Naming Conventions

```javascript
// ✅ Bom: Descritivo e claro
describe('ClientsManager', () => {
  describe('createClient', () => {
    test('should create client with valid data', () => {});
    test('should reject invalid CPF format', () => {});
    test('should handle duplicate CPF error', () => {});
  });
});

// ❌ Ruim: Vago e confuso
describe('test', () => {
  test('it works', () => {});
});
```

#### 🏗️ Arrange-Act-Assert Pattern

```javascript
test('should calculate budget total correctly', () => {
  // Arrange
  const materials = [
    { quantity: 10, price: 50 },
    { quantity: 5, price: 100 }
  ];
  
  // Act
  const total = calculateTotal(materials);
  
  // Assert
  expect(total).toBe(1000); // (10*50) + (5*100)
});
```

#### 🧼 Clean Test Code

```javascript
// ✅ Bom: Setup compartilhado
describe('Database Operations', () => {
  let database;
  
  beforeEach(() => {
    database = new MockDatabase();
  });
  
  afterEach(() => {
    database.clear();
  });
  
  test('should save client', async () => {
    const client = await database.save('clients', clientData);
    expect(client.id).toBeDefined();
  });
});
```

### Mocking Estratégico

#### 🎭 Quando Usar Mocks

```javascript
// ✅ Mock para dependências externas
jest.mock('axios');
jest.mock('./external-api');

// ✅ Mock para operações custosas
jest.mock('./heavy-calculation');

// ❌ Não mockar o que está sendo testado
// jest.mock('./clients-manager'); // Se está testando ClientsManager
```

#### 🎯 Mocks Específicos

```javascript
// Mock de função específica
const mockSave = jest.fn().mockResolvedValue({ id: 1 });
window.Database = { save: mockSave };

// Mock de módulo completo
jest.mock('../api-client', () => ({
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));
```

### Test Data Management

#### 🏭 Factories para Dados

```javascript
// tests/helpers/test-factories.js
export const ClientFactory = {
  build: (overrides = {}) => ({
    name: 'João Silva',
    cpf: '12345678901',
    email: 'joao@test.com',
    ...overrides
  }),
  
  buildList: (count, overrides = {}) => {
    return Array.from({ length: count }, (_, i) => 
      ClientFactory.build({ ...overrides, id: i + 1 })
    );
  }
};
```

#### 📁 Fixtures Organizadas

```javascript
// tests/fixtures/clients.json
{
  "validClient": {
    "name": "João Silva",
    "cpf": "12345678901",
    "phone": "(11) 99999-9999"
  },
  "invalidClient": {
    "name": "",
    "cpf": "invalid"
  }
}
```

### Performance de Testes

#### ⚡ Testes Rápidos

```javascript
// ✅ Use fake timers para timeouts
jest.useFakeTimers();
component.startTimer();
jest.advanceTimersByTime(1000);
expect(component.hasExpired()).toBe(true);

// ✅ Paralelize testes independentes
test.concurrent('should process data quickly', async () => {
  // teste independente
});
```

#### 🎯 Testes Focados

```bash
# Executar apenas testes modificados
npm test -- --changedSince=main

# Executar testes específicos
npm test -- --testNamePattern="should create client"

# Executar arquivo específico
npm test -- tests/unit/clients.test.js
```

## 🐛 Debugging e Troubleshooting

### Debug de Testes Jest

```javascript
// Debug mode
npm test -- --debug

// Run em modo verbose
npm test -- --verbose

// Debug teste específico
node --inspect-brk node_modules/.bin/jest --runInBand test-file.js
```

### Debug de Testes Cypress

```javascript
// Cypress debug commands
cy.debug();        // Pausa execução
cy.pause();        // Pausa até continuar manualmente
cy.screenshot();   // Captura screenshot

// Debug no browser
cy.window().then((win) => {
  debugger; // Abre DevTools
});
```

### Problemas Comuns

#### 🔄 Timing Issues

```javascript
// ❌ Problema: Race condition
test('should load data', () => {
  component.loadData();
  expect(component.data).toHaveLength(5);
});

// ✅ Solução: Await async operations
test('should load data', async () => {
  await component.loadData();
  expect(component.data).toHaveLength(5);
});
```

#### 🧹 Cleanup Issues

```javascript
// ✅ Sempre limpar após testes
afterEach(() => {
  jest.clearAllMocks();
  cleanup();
  window.Database?.clear();
});
```

#### 📱 Browser Compatibility

```javascript
// Cypress - Diferentes browsers
npm run test:e2e -- --browser chrome
npm run test:e2e -- --browser firefox
npm run test:e2e -- --browser edge
```

### Debugging Tools

| Tool | Finalidade | Comando |
|------|------------|---------|
| **Jest Debug** | Debug testes unitários | `npm run test:debug` |
| **Cypress GUI** | Debug testes E2E | `npm run test:e2e:open` |
| **Coverage Report** | Análise de cobertura | `npm run test:coverage` |
| **VS Code Jest** | Extensão para VS Code | Jest Extension |

## 📚 Recursos e Links

### Documentação Específica

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [Testes Unitários](unit-tests.md) | Guia completo de testes unitários | ✅ Completo |
| [Testes de Integração](integration-tests.md) | Testes de integração entre módulos | ✅ Completo |
| [Testes E2E](e2e-tests.md) | Testes end-to-end com Cypress | ✅ Completo |

### Links Externos

#### Frameworks e Ferramentas
- [Jest Documentation](https://jestjs.io/)
- [Cypress Documentation](https://docs.cypress.io/)
- [Testing Library](https://testing-library.com/)
- [MSW (Mock Service Worker)](https://mswjs.io/)

#### Boas Práticas
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Kent C. Dodds Testing Blog](https://kentcdodds.com/blog/)
- [Martin Fowler Testing](https://martinfowler.com/testing/)

#### RC Construções Específico
- [Arquitetura do Sistema](../development/architecture.md)
- [Guia de Contribuição](../development/contributing.md)
- [Setup de Desenvolvimento](../development/setup.md)

### Scripts Úteis

```bash
# Utilitários de desenvolvimento
npm run test:watch:unit      # Watch apenas unitários
npm run test:watch:integration # Watch apenas integração
npm run test:coverage:open   # Abrir relatório de cobertura
npm run test:update:snapshots # Atualizar snapshots Jest
npm run test:clear:cache     # Limpar cache de testes
```

### Suporte e Ajuda

#### Canais de Comunicação
- **Issues**: GitHub Issues para bugs nos testes
- **Discussões**: GitHub Discussions para dúvidas
- **Chat**: Slack #qa-testing
- **Email**: qa-team@rc-construcoes.com

#### Code Review Checklist
- [ ] Testes cobrem cenários principais
- [ ] Nomes de teste são descritivos
- [ ] Mocks são usados apropriadamente
- [ ] Cleanup é feito corretamente
- [ ] Performance é adequada

---

## ✅ Quick Reference

### Comandos Mais Usados

```bash
# Desenvolvimento diário
npm test                    # Executar testes unitários
npm run test:watch          # Watch mode para desenvolvimento
npm run test:e2e:open       # Abrir Cypress para debug

# Antes de commit
npm run test:all            # Executar todos os testes
npm run test:coverage       # Verificar cobertura

# CI/CD
npm run test:ci             # Modo CI completo
npm run test:lint           # Verificar qualidade código
```

### Estrutura de Arquivo de Teste

```javascript
// Template padrão para testes
describe('ModuleName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    test('should handle success case', () => {
      // Arrange
      // Act
      // Assert
    });

    test('should handle error case', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

**Última atualização**: 30 de julho de 2025  
**Versão do documento**: 5.1  
**Mantenedores**: Equipe de QA RC Construções

*"Testes não são sobre encontrar bugs, são sobre prevenir bugs."* - Anonymous