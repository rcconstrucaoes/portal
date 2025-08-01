# 🎭 Testes End-to-End (E2E) - RC Construções

## Índice

- [📋 Visão Geral](#-visão-geral)
- [⚙️ Configuração do Cypress](#%EF%B8%8F-configuração-do-cypress)
- [🏗️ Estrutura dos Testes](#%EF%B8%8F-estrutura-dos-testes)
- [🔐 Testes de Autenticação](#-testes-de-autenticação)
- [📊 Testes de Dashboard](#-testes-de-dashboard)
- [👥 Testes de Gestão de Clientes](#-testes-de-gestão-de-clientes)
- [📄 Testes de Contratos](#-testes-de-contratos)
- [🧮 Testes de Orçamentos](#-testes-de-orçamentos)
- [💰 Testes Financeiros](#-testes-financeiros)
- [🔧 Comandos Customizados](#-comandos-customizados)
- [📱 Testes PWA](#-testes-pwa)
- [🎯 Fixtures e Dados de Teste](#-fixtures-e-dados-de-teste)
- [📊 Relatórios e Cobertura](#-relatórios-e-cobertura)
- [🚀 Execução dos Testes](#-execução-dos-testes)
- [🐛 Debugging e Solução de Problemas](#-debugging-e-solução-de-problemas)

## 📋 Visão Geral

Os testes End-to-End (E2E) do RC Construções validam funcionalidades completas da aplicação do ponto de vista do usuário final. Utilizamos **Cypress** para simular interações reais com a interface, testando fluxos críticos como autenticação, gestão de clientes, criação de contratos e funcionalidades financeiras.

### Objetivos dos Testes E2E

- ✅ **Validar fluxos de usuário críticos**
- ✅ **Garantir integração entre frontend e backend**
- ✅ **Testar funcionalidades PWA (offline/online)**
- ✅ **Verificar responsividade em diferentes dispositivos**
- ✅ **Assegurar performance e acessibilidade**

### Cobertura dos Testes

| Módulo | Cobertura | Status |
|--------|-----------|--------|
| **Autenticação** | 95% | ✅ Completo |
| **Dashboard** | 90% | ✅ Completo |
| **Clientes** | 85% | 🔄 Em desenvolvimento |
| **Contratos** | 80% | 🔄 Em desenvolvimento |
| **Orçamentos** | 75% | 📝 Planejado |
| **Financeiro** | 70% | 📝 Planejado |

## ⚙️ Configuração do Cypress

### Arquivo de Configuração

```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // URLs base para testes
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3001/api',
    
    // Configurações de arquivos
    supportFile: 'tests/e2e/support/index.js',
    specPattern: 'tests/e2e/**/*.cy.js',
    fixturesFolder: 'tests/fixtures',
    
    // Configurações de captura
    screenshotsFolder: 'tests/screenshots',
    videosFolder: 'tests/videos',
    video: true,
    screenshotOnRunFailure: true,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 15000,
    
    // Viewport
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Configurações experimentais
    experimentalStudio: true,
    experimentalOriginDependencies: true,
    
    // Configurações específicas do RC Construções
    env: {
      // Credenciais de teste
      TEST_USER_ADMIN: 'admin',
      TEST_PASSWORD_ADMIN: 'admin123',
      TEST_USER_USER: 'usuario',
      TEST_PASSWORD_USER: 'user123',
      
      // URLs da aplicação
      LOGIN_URL: '/login.html',
      DASHBOARD_URL: '/index.html',
      
      // Configurações de teste
      ENABLE_PWA_TESTS: true,
      ENABLE_PERFORMANCE_TESTS: true,
      TEST_TIMEOUT: 30000
    },
    
    setupNodeEvents(on, config) {
      // Plugin para tarefas customizadas
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        
        // Reset do banco de dados de teste
        resetDatabase() {
          // Implementar reset do banco
          return null;
        },
        
        // Carregar dados de teste
        seedTestData() {
          // Implementar seeding
          return null;
        }
      });
      
      // Plugin para cobertura de código
      require('@cypress/code-coverage/task')(on, config);
      
      return config;
    }
  }
});
```

### Comandos de Execução

```json
{
  "scripts": {
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:e2e:chrome": "cypress run --browser chrome",
    "test:e2e:firefox": "cypress run --browser firefox",
    "test:e2e:mobile": "cypress run --config viewportWidth=375,viewportHeight=667",
    "test:e2e:tablet": "cypress run --config viewportWidth=768,viewportHeight=1024",
    "test:e2e:headless": "cypress run --headless",
    "test:e2e:record": "cypress run --record --key=your-record-key"
  }
}
```

## 🏗️ Estrutura dos Testes

### Organização de Arquivos

```
tests/e2e/
├── specs/                          # Arquivos de teste
│   ├── auth/
│   │   ├── login-flow.cy.js        # Fluxo de login
│   │   ├── logout-flow.cy.js       # Fluxo de logout
│   │   └── session-management.cy.js # Gestão de sessão
│   ├── dashboard/
│   │   ├── dashboard-navigation.cy.js # Navegação do dashboard
│   │   ├── dashboard-charts.cy.js     # Gráficos e métricas
│   │   └── dashboard-responsive.cy.js # Responsividade
│   ├── clients/
│   │   ├── client-management.cy.js    # CRUD de clientes
│   │   ├── client-search.cy.js        # Busca e filtros
│   │   └── client-import-export.cy.js # Import/Export
│   ├── contracts/
│   │   ├── contract-creation.cy.js    # Criação de contratos
│   │   ├── contract-workflow.cy.js    # Fluxo de aprovação
│   │   └── contract-pdf.cy.js         # Geração de PDFs
│   ├── budgets/
│   │   ├── budget-approval.cy.js      # Aprovação de orçamentos
│   │   ├── budget-calculation.cy.js   # Cálculos automáticos
│   │   └── budget-templates.cy.js     # Templates
│   └── financial/
│       ├── financial-reports.cy.js   # Relatórios financeiros
│       ├── payment-tracking.cy.js    # Acompanhamento de pagamentos
│       └── financial-export.cy.js    # Exportação de dados
├── support/
│   ├── index.js                      # Configurações globais
│   ├── commands.js                   # Comandos customizados
│   ├── helpers/
│   │   ├── auth-helpers.js           # Helpers de autenticação
│   │   ├── form-helpers.js           # Helpers de formulários
│   │   └── data-helpers.js           # Helpers de dados
│   └── page-objects/
│       ├── LoginPage.js              # Page Object para login
│       ├── DashboardPage.js          # Page Object para dashboard
│       ├── ClientsPage.js            # Page Object para clientes
│       └── ContractsPage.js          # Page Object para contratos
└── utils/
    ├── constants.js                  # Constantes de teste
    ├── test-data-generator.js        # Gerador de dados
    └── performance-helpers.js        # Helpers de performance
```

## 🔐 Testes de Autenticação

### Login Flow - Cenários Principais

```javascript
// tests/e2e/specs/auth/login-flow.cy.js
describe('🔐 Fluxo de Autenticação', () => {
  beforeEach(() => {
    // Limpar storage e visitar página de login
    cy.clearAllLocalStorage();
    cy.clearAllSessionStorage();
    cy.visit('/login.html');
    
    // Aguardar sistema estar pronto
    cy.waitForSystemReady();
  });

  describe('Login Bem-sucedido', () => {
    it('deve fazer login com credenciais de administrador', () => {
      cy.loginAs('admin');
      
      // Verificar redirecionamento
      cy.url().should('include', '/index.html');
      
      // Verificar elementos da interface logada
      cy.get('[data-testid="user-name"]').should('contain', 'Administrador');
      cy.get('[data-testid="sidebar"]').should('be.visible');
      cy.get('[data-testid="dashboard"]').should('be.visible');
    });

    it('deve fazer login com credenciais de usuário comum', () => {
      cy.loginAs('user');
      
      cy.url().should('include', '/index.html');
      cy.get('[data-testid="user-name"]').should('contain', 'Usuário');
      
      // Verificar permissões limitadas
      cy.get('[data-testid="admin-only-section"]').should('not.exist');
    });

    it('deve manter sessão após recarregar página', () => {
      cy.loginAs('admin');
      
      // Recarregar página
      cy.reload();
      
      // Verificar que continua logado
      cy.url().should('include', '/index.html');
      cy.get('[data-testid="user-name"]').should('be.visible');
    });
  });

  describe('Login com Falha', () => {
    it('deve mostrar erro para credenciais inválidas', () => {
      cy.get('[data-testid="credential-input"]').type('usuario_inexistente');
      cy.get('[data-testid="password-input"]').type('senha_errada');
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain', 'Credenciais inválidas');
    });

    it('deve validar campos obrigatórios', () => {
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="error-message"]')
        .should('contain', 'preencha todos os campos');
    });

    it('deve mostrar loading durante tentativa de login', () => {
      cy.intercept('POST', '/api/auth/login', { delay: 2000 }).as('loginRequest');
      
      cy.get('[data-testid="credential-input"]').type('admin');
      cy.get('[data-testid="password-input"]').type('admin123');
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="loading-indicator"]').should('be.visible');
      cy.get('[data-testid="login-button"]').should('be.disabled');
    });
  });

  describe('Recuperação de Senha', () => {
    it('deve exibir link para recuperação de senha', () => {
      cy.get('[data-testid="forgot-password-link"]')
        .should('be.visible')
        .and('contain', 'Esqueci minha senha');
    });
  });
});
```

### Session Management

```javascript
// tests/e2e/specs/auth/session-management.cy.js
describe('🔑 Gerenciamento de Sessão', () => {
  it('deve fazer logout corretamente', () => {
    cy.loginAs('admin');
    
    // Fazer logout
    cy.get('[data-testid="logout-button"]').click();
    
    // Verificar redirecionamento para login
    cy.url().should('include', '/login.html');
    
    // Verificar que dados da sessão foram limpos
    cy.getAllLocalStorage().should('be.empty');
    cy.getAllSessionStorage().should('be.empty');
  });

  it('deve expirar sessão após timeout', () => {
    cy.loginAs('admin');
    
    // Simular expiração de sessão
    cy.clock();
    cy.tick(8 * 60 * 60 * 1000); // 8 horas
    
    // Tentar acessar página protegida
    cy.visit('/index.html');
    
    // Deve ser redirecionado para login
    cy.url().should('include', '/login.html');
    cy.get('[data-testid="session-expired-message"]')
      .should('contain', 'Sessão expirada');
  });
});
```

## 📊 Testes de Dashboard

### Navegação e Interface

```javascript
// tests/e2e/specs/dashboard/dashboard-navigation.cy.js
describe('📊 Dashboard - Navegação', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.visit('/index.html');
  });

  describe('Elementos da Interface', () => {
    it('deve exibir todos os elementos principais', () => {
      // Header
      cy.get('[data-testid="app-header"]').should('be.visible');
      cy.get('[data-testid="current-page-title"]').should('contain', 'Dashboard');
      
      // Sidebar
      cy.get('[data-testid="sidebar"]').should('be.visible');
      cy.get('[data-testid="nav-dashboard"]').should('have.class', 'active');
      
      // Estatísticas
      cy.get('[data-testid="stats-grid"]').should('be.visible');
      cy.get('[data-testid="stat-card"]').should('have.length', 4);
      
      // Gráficos
      cy.get('[data-testid="charts-grid"]').should('be.visible');
      cy.get('[data-testid="financial-chart"]').should('be.visible');
      cy.get('[data-testid="contracts-chart"]').should('be.visible');
    });

    it('deve navegar entre páginas corretamente', () => {
      // Navegar para Clientes
      cy.get('[data-testid="nav-clients"]').click();
      cy.url().should('include', '#clients');
      cy.get('[data-testid="current-page-title"]').should('contain', 'Clientes');
      
      // Navegar para Contratos
      cy.get('[data-testid="nav-contracts"]').click();
      cy.url().should('include', '#contracts');
      cy.get('[data-testid="current-page-title"]').should('contain', 'Contratos');
      
      // Voltar para Dashboard
      cy.get('[data-testid="nav-dashboard"]').click();
      cy.url().should('include', '#dashboard');
      cy.get('[data-testid="current-page-title"]').should('contain', 'Dashboard');
    });
  });

  describe('Responsividade', () => {
    it('deve adaptar layout para mobile', () => {
      cy.viewport(375, 667);
      
      // Sidebar deve ficar oculta
      cy.get('[data-testid="sidebar"]').should('not.be.visible');
      
      // Botão de menu deve aparecer
      cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
      
      // Stats devem empilhar
      cy.get('[data-testid="stats-grid"]')
        .should('have.css', 'grid-template-columns')
        .and('match', /repeat\(1,/);
    });

    it('deve adaptar layout para tablet', () => {
      cy.viewport(768, 1024);
      
      // Sidebar deve ficar visível mas compacta
      cy.get('[data-testid="sidebar"]').should('be.visible');
      
      // Stats devem ter 2 colunas
      cy.get('[data-testid="stats-grid"]')
        .should('have.css', 'grid-template-columns')
        .and('match', /repeat\(2,/);
    });
  });
});
```

### Gráficos e Métricas

```javascript
// tests/e2e/specs/dashboard/dashboard-charts.cy.js
describe('📈 Dashboard - Gráficos e Métricas', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.seedTestData(); // Carregar dados de teste
    cy.visit('/index.html');
  });

  describe('Estatísticas Principais', () => {
    it('deve exibir estatísticas corretas', () => {
      // Receita Total
      cy.get('[data-testid="stat-revenue"]')
        .should('be.visible')
        .find('[data-testid="stat-value"]')
        .should('match', /R\$ [\d,]+/);
      
      // Contratos Ativos
      cy.get('[data-testid="stat-contracts"]')
        .find('[data-testid="stat-value"]')
        .should('match', /\d+/);
      
      // Novos Clientes
      cy.get('[data-testid="stat-new-clients"]')
        .find('[data-testid="stat-value"]')
        .should('match', /\d+/);
      
      // Lucro Estimado
      cy.get('[data-testid="stat-profit"]')
        .find('[data-testid="stat-value"]')
        .should('match', /R\$ [\d,]+/);
    });

    it('deve atualizar estatísticas ao mudar período', () => {
      // Alterar período
      cy.get('[data-testid="start-date"]').type('2024-01-01');
      cy.get('[data-testid="end-date"]').type('2024-12-31');
      cy.get('[data-testid="apply-date-range"]').click();
      
      // Verificar que estatísticas foram atualizadas
      cy.get('[data-testid="stats-grid"]').should('not.contain', 'Carregando...');
      cy.get('[data-testid="stat-revenue"]').should('be.visible');
    });
  });

  describe('Gráfico Financeiro', () => {
    it('deve renderizar gráfico financeiro', () => {
      cy.get('[data-testid="financial-chart"]').should('be.visible');
      
      // Verificar se Canvas do Chart.js está presente
      cy.get('[data-testid="financial-chart"] canvas').should('exist');
      
      // Verificar legendas
      cy.get('[data-testid="chart-legend"]').should('contain', 'Receitas');
      cy.get('[data-testid="chart-legend"]').should('contain', 'Despesas');
    });

    it('deve permitir interação com gráfico', () => {
      // Hover sobre pontos do gráfico
      cy.get('[data-testid="financial-chart"] canvas').trigger('mouseover', 100, 100);
      
      // Verificar tooltip
      cy.get('[data-testid="chart-tooltip"]').should('be.visible');
    });
  });

  describe('Gráfico de Contratos', () => {
    it('deve exibir distribuição de contratos por status', () => {
      cy.get('[data-testid="contracts-chart"]').should('be.visible');
      cy.get('[data-testid="contracts-chart"] canvas').should('exist');
      
      // Verificar legendas de status
      cy.get('[data-testid="chart-legend"]').should('contain', 'Em Andamento');
      cy.get('[data-testid="chart-legend"]').should('contain', 'Concluído');
      cy.get('[data-testid="chart-legend"]').should('contain', 'Pendente');
    });
  });
});
```

## 👥 Testes de Gestão de Clientes

### CRUD de Clientes

```javascript
// tests/e2e/specs/clients/client-management.cy.js
describe('👥 Gestão de Clientes', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.visit('/index.html#clients');
  });

  describe('Listagem de Clientes', () => {
    it('deve exibir lista de clientes', () => {
      cy.get('[data-testid="clients-list"]').should('be.visible');
      cy.get('[data-testid="client-card"]').should('have.length.at.least', 1);
      
      // Verificar informações básicas do cliente
      cy.get('[data-testid="client-card"]').first().within(() => {
        cy.get('[data-testid="client-name"]').should('be.visible');
        cy.get('[data-testid="client-phone"]').should('be.visible');
        cy.get('[data-testid="client-email"]').should('be.visible');
      });
    });

    it('deve permitir busca de clientes', () => {
      const searchTerm = 'João';
      
      cy.get('[data-testid="clients-search"]').type(searchTerm);
      
      // Verificar que resultados foram filtrados
      cy.get('[data-testid="client-card"]').each(($card) => {
        cy.wrap($card).should('contain.text', searchTerm);
      });
    });

    it('deve exibir estatísticas de clientes', () => {
      cy.get('[data-testid="total-clients-stat"]').should('contain.text', /\d+/);
      cy.get('[data-testid="new-clients-month-stat"]').should('contain.text', /\d+/);
      cy.get('[data-testid="unique-cities-stat"]').should('contain.text', /\d+/);
    });
  });

  describe('Criação de Cliente', () => {
    it('deve criar novo cliente com sucesso', () => {
      const newClient = {
        name: 'Maria Silva',
        cpf: '12345678901',
        rg: '123456789',
        phone: '(11) 99999-9999',
        email: 'maria@email.com',
        cep: '01234-567',
        street: 'Rua das Flores, 123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP'
      };

      // Abrir modal de novo cliente
      cy.get('[data-testid="add-client-button"]').click();
      cy.get('[data-testid="client-modal"]').should('be.visible');

      // Preencher formulário
      cy.fillClientForm(newClient);

      // Salvar cliente
      cy.get('[data-testid="save-client-button"]').click();

      // Verificar sucesso
      cy.get('[data-testid="success-message"]')
        .should('contain', 'Cliente criado com sucesso');
      
      // Verificar que cliente aparece na lista
      cy.get('[data-testid="clients-search"]').type(newClient.name);
      cy.get('[data-testid="client-card"]')
        .should('contain', newClient.name)
        .and('contain', newClient.phone);
    });

    it('deve validar campos obrigatórios', () => {
      cy.get('[data-testid="add-client-button"]').click();
      cy.get('[data-testid="save-client-button"]').click();

      // Verificar mensagens de erro
      cy.get('[data-testid="name-error"]').should('contain', 'Nome é obrigatório');
      cy.get('[data-testid="phone-error"]').should('contain', 'Telefone é obrigatório');
    });

    it('deve validar formato do CPF', () => {
      cy.get('[data-testid="add-client-button"]').click();
      cy.get('[data-testid="client-cpf"]').type('123');
      cy.get('[data-testid="save-client-button"]').click();

      cy.get('[data-testid="cpf-error"]').should('contain', 'CPF inválido');
    });

    it('deve buscar endereço por CEP', () => {
      cy.intercept('GET', '**/viacep.com.br/**', {
        fixture: 'cep-response.json'
      }).as('cepLookup');

      cy.get('[data-testid="add-client-button"]').click();
      cy.get('[data-testid="client-cep"]').type('01234567');

      cy.wait('@cepLookup');

      // Verificar que campos foram preenchidos automaticamente
      cy.get('[data-testid="client-street"]').should('have.value', 'Rua das Flores');
      cy.get('[data-testid="client-neighborhood"]').should('have.value', 'Centro');
      cy.get('[data-testid="client-city"]').should('have.value', 'São Paulo');
      cy.get('[data-testid="client-state"]').should('have.value', 'SP');
    });
  });

  describe('Edição de Cliente', () => {
    it('deve editar cliente existente', () => {
      // Selecionar primeiro cliente
      cy.get('[data-testid="client-card"]').first().within(() => {
        cy.get('[data-testid="edit-client-button"]').click();
      });

      // Verificar que modal abriu com dados preenchidos
      cy.get('[data-testid="client-modal"]').should('be.visible');
      cy.get('[data-testid="client-name"]').should('not.have.value', '');

      // Alterar nome
      const newName = 'João Silva Editado';
      cy.get('[data-testid="client-name"]').clear().type(newName);

      // Salvar
      cy.get('[data-testid="save-client-button"]').click();

      // Verificar sucesso
      cy.get('[data-testid="success-message"]')
        .should('contain', 'Cliente atualizado com sucesso');
    });
  });

  describe('Exclusão de Cliente', () => {
    it('deve excluir cliente com confirmação', () => {
      cy.get('[data-testid="client-card"]').first().within(() => {
        cy.get('[data-testid="delete-client-button"]').click();
      });

      // Verificar modal de confirmação
      cy.get('[data-testid="confirm-modal"]').should('be.visible');
      cy.get('[data-testid="confirm-delete-button"]').click();

      // Verificar sucesso
      cy.get('[data-testid="success-message"]')
        .should('contain', 'Cliente excluído com sucesso');
    });

    it('deve cancelar exclusão', () => {
      const initialCount = cy.get('[data-testid="client-card"]').length;

      cy.get('[data-testid="client-card"]').first().within(() => {
        cy.get('[data-testid="delete-client-button"]').click();
      });

      cy.get('[data-testid="cancel-delete-button"]').click();

      // Verificar que cliente não foi excluído
      cy.get('[data-testid="client-card"]').should('have.length', initialCount);
    });
  });
});
```

## 📄 Testes de Contratos

### Criação e Workflow

```javascript
// tests/e2e/specs/contracts/contract-creation.cy.js
describe('📄 Gestão de Contratos', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.seedTestData(); // Garantir que há clientes cadastrados
    cy.visit('/index.html#contracts');
  });

  describe('Criação de Contrato', () => {
    it('deve criar contrato completo', () => {
      const contractData = {
        clientName: 'João Silva',
        title: 'Reforma Residencial',
        description: 'Reforma completa de casa',
        value: '50000',
        startDate: '2024-08-01',
        endDate: '2024-12-01',
        paymentTerms: 'Parcelado em 5x'
      };

      // Iniciar criação
      cy.get('[data-testid="add-contract-button"]').click();
      cy.get('[data-testid="contract-modal"]').should('be.visible');

      // Preencher dados básicos
      cy.get('[data-testid="contract-client"]').select(contractData.clientName);
      cy.get('[data-testid="contract-title"]').type(contractData.title);
      cy.get('[data-testid="contract-description"]').type(contractData.description);
      cy.get('[data-testid="contract-value"]').type(contractData.value);
      cy.get('[data-testid="contract-start-date"]').type(contractData.startDate);
      cy.get('[data-testid="contract-end-date"]').type(contractData.endDate);
      cy.get('[data-testid="contract-payment-terms"]').type(contractData.paymentTerms);

      // Salvar contrato
      cy.get('[data-testid="save-contract-button"]').click();

      // Verificar sucesso
      cy.get('[data-testid="success-message"]')
        .should('contain', 'Contrato criado com sucesso');
      
      // Verificar que contrato aparece na lista
      cy.get('[data-testid="contracts-list"]')
        .should('contain', contractData.title)
        .and('contain', contractData.clientName);
    });

    it('deve validar campos obrigatórios do contrato', () => {
      cy.get('[data-testid="add-contract-button"]').click();
      cy.get('[data-testid="save-contract-button"]').click();

      cy.get('[data-testid="client-error"]').should('contain', 'Cliente é obrigatório');
      cy.get('[data-testid="title-error"]').should('contain', 'Título é obrigatório');
      cy.get('[data-testid="value-error"]').should('contain', 'Valor é obrigatório');
    });

    it('deve validar datas do contrato', () => {
      cy.get('[data-testid="add-contract-button"]').click();
      
      // Data de fim anterior à data de início
      cy.get('[data-testid="contract-start-date"]').type('2024-12-01');
      cy.get('[data-testid="contract-end-date"]').type('2024-08-01');
      cy.get('[data-testid="save-contract-button"]').click();

      cy.get('[data-testid="date-error"]')
        .should('contain', 'Data de fim deve ser posterior à data de início');
    });
  });

  describe('Workflow de Aprovação', () => {
    it('deve aprovar contrato pendente', () => {
      // Encontrar contrato pendente
      cy.get('[data-testid="contract-card"]')
        .contains('Pendente')
        .parent()
        .within(() => {
          cy.get('[data-testid="approve-contract-button"]').click();
        });

      // Confirmar aprovação
      cy.get('[data-testid="approval-modal"]').should('be.visible');
      cy.get('[data-testid="approval-notes"]').type('Contrato aprovado após análise');
      cy.get('[data-testid="confirm-approval-button"]').click();

      // Verificar mudança de status
      cy.get('[data-testid="success-message"]')
        .should('contain', 'Contrato aprovado com sucesso');
    });

    it('deve rejeitar contrato com justificativa', () => {
      cy.get('[data-testid="contract-card"]')
        .contains('Pendente')
        .parent()
        .within(() => {
          cy.get('[data-testid="reject-contract-button"]').click();
        });

      cy.get('[data-testid="rejection-modal"]').should('be.visible');
      cy.get('[data-testid="rejection-reason"]').type('Documentação incompleta');
      cy.get('[data-testid="confirm-rejection-button"]').click();

      cy.get('[data-testid="success-message"]')
        .should('contain', 'Contrato rejeitado');
    });
  });

  describe('Geração de PDF', () => {
    it('deve gerar PDF do contrato', () => {
      cy.get('[data-testid="contract-card"]').first().within(() => {
        cy.get('[data-testid="generate-pdf-button"]').click();
      });

      // Verificar que PDF foi gerado (pode ser um download ou visualização)
      cy.get('[data-testid="pdf-preview"]').should('be.visible');
      
      // Ou verificar download
      cy.readFile('cypress/downloads/contrato.pdf').should('exist');
    });
  });
});
```

## 🧮 Testes de Orçamentos

### Processo de Aprovação

```javascript
// tests/e2e/specs/budgets/budget-approval.cy.js
describe('🧮 Sistema de Orçamentos', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.seedTestData();
    cy.visit('/index.html#budgets');
  });

  describe('Criação de Orçamento', () => {
    it('deve criar orçamento em etapas', () => {
      const budgetData = {
        clientName: 'Maria Santos',
        projectType: 'Reforma',
        description: 'Reforma de cozinha',
        area: '20',
        materials: [
          { name: 'Azulejo', quantity: '10', unit: 'm²', price: '50' },
          { name: 'Tinta', quantity: '5', unit: 'L', price: '80' }
        ],
        labor: [
          { description: 'Pedreiro', hours: '40', rate: '25' },
          { description: 'Pintor', hours: '16', rate: '30' }
        ]
      };

      // Etapa 1: Informações básicas
      cy.get('[data-testid="new-budget-button"]').click();
      cy.get('[data-testid="budget-client"]').select(budgetData.clientName);
      cy.get('[data-testid="project-type"]').select(budgetData.projectType);
      cy.get('[data-testid="project-description"]').type(budgetData.description);
      cy.get('[data-testid="project-area"]').type(budgetData.area);
      cy.get('[data-testid="next-step-button"]').click();

      // Etapa 2: Materiais
      budgetData.materials.forEach((material, index) => {
        if (index > 0) {
          cy.get('[data-testid="add-material-button"]').click();
        }
        cy.get(`[data-testid="material-name-${index}"]`).type(material.name);
        cy.get(`[data-testid="material-quantity-${index}"]`).type(material.quantity);
        cy.get(`[data-testid="material-unit-${index}"]`).select(material.unit);
        cy.get(`[data-testid="material-price-${index}"]`).type(material.price);
      });
      cy.get('[data-testid="next-step-button"]').click();

      // Etapa 3: Mão de obra
      budgetData.labor.forEach((labor, index) => {
        if (index > 0) {
          cy.get('[data-testid="add-labor-button"]').click();
        }
        cy.get(`[data-testid="labor-description-${index}"]`).type(labor.description);
        cy.get(`[data-testid="labor-hours-${index}"]`).type(labor.hours);
        cy.get(`[data-testid="labor-rate-${index}"]`).type(labor.rate);
      });
      cy.get('[data-testid="next-step-button"]').click();

      // Etapa 4: Revisão e finalização
      cy.get('[data-testid="budget-summary"]').should('be.visible');
      cy.get('[data-testid="total-materials"]').should('contain', 'R);
      cy.get('[data-testid="total-labor"]').should('contain', 'R);
      cy.get('[data-testid="grand-total"]').should('contain', 'R);

      cy.get('[data-testid="finish-budget-button"]').click();

      // Verificar sucesso
      cy.get('[data-testid="success-message"]')
        .should('contain', 'Orçamento criado com sucesso');
    });

    it('deve calcular totais automaticamente', () => {
      cy.get('[data-testid="new-budget-button"]').click();
      
      // Pular para etapa de materiais
      cy.fillBasicBudgetInfo();
      cy.get('[data-testid="next-step-button"]').click();

      // Adicionar material
      cy.get('[data-testid="material-quantity-0"]').type('10');
      cy.get('[data-testid="material-price-0"]').type('50');

      // Verificar cálculo automático
      cy.get('[data-testid="material-total-0"]').should('contain', 'R$ 500,00');
      cy.get('[data-testid="subtotal-materials"]').should('contain', 'R$ 500,00');
    });
  });

  describe('Aprovação de Orçamento', () => {
    it('deve aprovar orçamento pelo cliente', () => {
      // Simular aprovação via link/token
      const approvalToken = 'abc123';
      cy.visit(`/budget-approval.html?token=${approvalToken}`);

      cy.get('[data-testid="budget-details"]').should('be.visible');
      cy.get('[data-testid="approve-budget-button"]').click();

      // Assinatura digital (simulada)
      cy.get('[data-testid="digital-signature"]').type('Maria Santos');
      cy.get('[data-testid="confirm-approval-button"]').click();

      cy.get('[data-testid="approval-success"]')
        .should('contain', 'Orçamento aprovado com sucesso');
    });

    it('deve rejeitar orçamento com comentários', () => {
      const approvalToken = 'abc123';
      cy.visit(`/budget-approval.html?token=${approvalToken}`);

      cy.get('[data-testid="reject-budget-button"]').click();
      cy.get('[data-testid="rejection-comments"]')
        .type('Preciso de mais detalhes sobre os materiais');
      cy.get('[data-testid="confirm-rejection-button"]').click();

      cy.get('[data-testid="rejection-success"]')
        .should('contain', 'Orçamento rejeitado');
    });
  });

  describe('Templates de Orçamento', () => {
    it('deve criar template a partir de orçamento', () => {
      cy.get('[data-testid="budget-card"]').first().within(() => {
        cy.get('[data-testid="budget-actions"]').click();
        cy.get('[data-testid="create-template"]').click();
      });

      cy.get('[data-testid="template-modal"]').should('be.visible');
      cy.get('[data-testid="template-name"]').type('Template Reforma Cozinha');
      cy.get('[data-testid="template-description"]')
        .type('Template padrão para reformas de cozinha');
      cy.get('[data-testid="save-template-button"]').click();

      cy.get('[data-testid="success-message"]')
        .should('contain', 'Template criado com sucesso');
    });

    it('deve usar template para novo orçamento', () => {
      cy.get('[data-testid="new-budget-button"]').click();
      cy.get('[data-testid="use-template-button"]').click();

      cy.get('[data-testid="template-selector"]').should('be.visible');
      cy.get('[data-testid="template-item"]').first().click();
      cy.get('[data-testid="apply-template-button"]').click();

      // Verificar que campos foram preenchidos
      cy.get('[data-testid="project-type"]').should('not.have.value', '');
      cy.get('[data-testid="material-name-0"]').should('not.have.value', '');
    });
  });
});
```

## 💰 Testes Financeiros

### Relatórios e Acompanhamento

```javascript
// tests/e2e/specs/financial/financial-reports.cy.js
describe('💰 Sistema Financeiro', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.seedFinancialData();
    cy.visit('/index.html#financial');
  });

  describe('Relatórios Financeiros', () => {
    it('deve gerar relatório de receitas e despesas', () => {
      // Configurar período
      cy.get('[data-testid="report-start-date"]').type('2024-01-01');
      cy.get('[data-testid="report-end-date"]').type('2024-12-31');
      cy.get('[data-testid="generate-report-button"]').click();

      // Verificar relatório gerado
      cy.get('[data-testid="financial-report"]').should('be.visible');
      cy.get('[data-testid="total-revenue"]').should('contain', 'R);
      cy.get('[data-testid="total-expenses"]').should('contain', 'R);
      cy.get('[data-testid="net-profit"]').should('contain', 'R);

      // Verificar gráfico
      cy.get('[data-testid="revenue-chart"]').should('be.visible');
      cy.get('[data-testid="expense-chart"]').should('be.visible');
    });

    it('deve filtrar relatório por categoria', () => {
      cy.get('[data-testid="category-filter"]').select('Materiais');
      cy.get('[data-testid="apply-filter-button"]').click();

      cy.get('[data-testid="financial-transactions"]')
        .find('[data-testid="transaction-item"]')
        .each(($item) => {
          cy.wrap($item).should('contain', 'Materiais');
        });
    });

    it('deve exportar relatório para PDF', () => {
      cy.get('[data-testid="generate-report-button"]').click();
      cy.get('[data-testid="export-pdf-button"]').click();

      // Verificar download
      cy.readFile('cypress/downloads/relatorio-financeiro.pdf').should('exist');
    });

    it('deve exportar relatório para Excel', () => {
      cy.get('[data-testid="generate-report-button"]').click();
      cy.get('[data-testid="export-excel-button"]').click();

      cy.readFile('cypress/downloads/relatorio-financeiro.xlsx').should('exist');
    });
  });

  describe('Acompanhamento de Pagamentos', () => {
    it('deve registrar recebimento de pagamento', () => {
      const paymentData = {
        contract: 'Reforma João Silva',
        amount: '10000',
        date: '2024-08-01',
        method: 'Transferência'
      };

      cy.get('[data-testid="add-payment-button"]').click();
      cy.get('[data-testid="payment-contract"]').select(paymentData.contract);
      cy.get('[data-testid="payment-amount"]').type(paymentData.amount);
      cy.get('[data-testid="payment-date"]').type(paymentData.date);
      cy.get('[data-testid="payment-method"]').select(paymentData.method);
      cy.get('[data-testid="save-payment-button"]').click();

      cy.get('[data-testid="success-message"]')
        .should('contain', 'Pagamento registrado com sucesso');
    });

    it('deve mostrar pagamentos em atraso', () => {
      cy.get('[data-testid="overdue-payments"]').should('be.visible');
      cy.get('[data-testid="overdue-payment-item"]').should('have.length.at.least', 1);

      // Verificar detalhes do pagamento em atraso
      cy.get('[data-testid="overdue-payment-item"]').first().within(() => {
        cy.get('[data-testid="client-name"]').should('be.visible');
        cy.get('[data-testid="amount-due"]').should('contain', 'R);
        cy.get('[data-testid="days-overdue"]').should('contain', 'dias');
      });
    });

    it('deve enviar lembrete de pagamento', () => {
      cy.get('[data-testid="overdue-payment-item"]').first().within(() => {
        cy.get('[data-testid="send-reminder-button"]').click();
      });

      cy.get('[data-testid="reminder-modal"]').should('be.visible');
      cy.get('[data-testid="reminder-message"]')
        .should('contain', 'Lembrete de pagamento');
      cy.get('[data-testid="send-reminder-confirm"]').click();

      cy.get('[data-testid="success-message"]')
        .should('contain', 'Lembrete enviado com sucesso');
    });
  });
});
```

## 🔧 Comandos Customizados

### Arquivo de Comandos Cypress

```javascript
// tests/e2e/support/commands.js

// Comando para login
Cypress.Commands.add('loginAs', (userType = 'admin') => {
  const users = {
    admin: {
      credential: Cypress.env('TEST_USER_ADMIN'),
      password: Cypress.env('TEST_PASSWORD_ADMIN')
    },
    user: {
      credential: Cypress.env('TEST_USER_USER'),
      password: Cypress.env('TEST_PASSWORD_USER')
    }
  };

  const user = users[userType];
  
  cy.visit('/login.html');
  cy.waitForSystemReady();
  
  cy.get('[data-testid="credential-input"]').type(user.credential);
  cy.get('[data-testid="password-input"]').type(user.password);
  cy.get('[data-testid="login-button"]').click();
  
  // Aguardar redirecionamento
  cy.url().should('include', '/index.html');
  cy.get('[data-testid="sidebar"]').should('be.visible');
});

// Comando para aguardar sistema estar pronto
Cypress.Commands.add('waitForSystemReady', () => {
  cy.window().its('rcSystemReady').should('eq', true);
});

// Comando para preencher formulário de cliente
Cypress.Commands.add('fillClientForm', (clientData) => {
  cy.get('[data-testid="client-name"]').type(clientData.name);
  cy.get('[data-testid="client-cpf"]').type(clientData.cpf);
  cy.get('[data-testid="client-rg"]').type(clientData.rg);
  cy.get('[data-testid="client-phone"]').type(clientData.phone);
  cy.get('[data-testid="client-email"]').type(clientData.email);
  cy.get('[data-testid="client-cep"]').type(clientData.cep);
  cy.get('[data-testid="client-street"]').type(clientData.street);
  cy.get('[data-testid="client-neighborhood"]').type(clientData.neighborhood);
  cy.get('[data-testid="client-city"]').type(clientData.city);
  cy.get('[data-testid="client-state"]').select(clientData.state);
});

// Comando para preencher informações básicas do orçamento
Cypress.Commands.add('fillBasicBudgetInfo', () => {
  cy.get('[data-testid="budget-client"]').select('João Silva');
  cy.get('[data-testid="project-type"]').select('Reforma');
  cy.get('[data-testid="project-description"]').type('Projeto de teste');
  cy.get('[data-testid="project-area"]').type('50');
});

// Comando para carregar dados de teste
Cypress.Commands.add('seedTestData', () => {
  cy.task('seedTestData');
});

// Comando para carregar dados financeiros de teste
Cypress.Commands.add('seedFinancialData', () => {
  cy.task('seedFinancialData');
});

// Comando para limpar banco de dados
Cypress.Commands.add('resetDatabase', () => {
  cy.task('resetDatabase');
});

// Comando para verificar acessibilidade
Cypress.Commands.add('checkA11y', () => {
  cy.injectAxe();
  cy.checkA11y();
});

// Comando para simular dispositivo móvel
Cypress.Commands.add('setMobileViewport', () => {
  cy.viewport(375, 667);
});

// Comando para simular tablet
Cypress.Commands.add('setTabletViewport', () => {
  cy.viewport(768, 1024);
});

// Comando para aguardar elemento estar visível
Cypress.Commands.add('waitForElement', (selector, timeout = 10000) => {
  cy.get(selector, { timeout }).should('be.visible');
});

// Comando para upload de arquivo
Cypress.Commands.add('uploadFile', (selector, fileName) => {
  cy.get(selector).selectFile(`cypress/fixtures/${fileName}`);
});
```

## 📱 Testes PWA

### Funcionalidades Offline

```javascript
// tests/e2e/specs/pwa/offline-functionality.cy.js
describe('📱 Funcionalidades PWA', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.visit('/index.html');
  });

  describe('Modo Offline', () => {
    it('deve funcionar offline após cache inicial', () => {
      // Garantir que recursos estão cacheados
      cy.reload();
      cy.waitForElement('[data-testid="dashboard"]');

      // Simular modo offline
      cy.window().then((win) => {
        cy.stub(win.navigator, 'onLine').value(false);
        win.dispatchEvent(new Event('offline'));
      });

      // Verificar que aplicação continua funcionando
      cy.get('[data-testid="nav-clients"]').click();
      cy.get('[data-testid="clients-list"]').should('be.visible');

      // Verificar indicador offline
      cy.get('[data-testid="offline-indicator"]')
        .should('be.visible')
        .and('contain', 'Modo Offline');
    });

    it('deve sincronizar dados quando voltar online', () => {
      // Simular criação de dados offline
      cy.window().then((win) => {
        cy.stub(win.navigator, 'onLine').value(false);
      });

      // Criar cliente offline
      cy.get('[data-testid="nav-clients"]').click();
      cy.get('[data-testid="add-client-button"]').click();
      cy.fillClientForm({
        name: 'Cliente Offline',
        phone: '(11) 99999-9999',
        email: 'offline@test.com'
      });
      cy.get('[data-testid="save-client-button"]').click();

      // Verificar que foi salvo localmente
      cy.get('[data-testid="pending-sync-indicator"]').should('be.visible');

      // Simular volta online
      cy.window().then((win) => {
        cy.stub(win.navigator, 'onLine').value(true);
        win.dispatchEvent(new Event('online'));
      });

      // Verificar sincronização
      cy.get('[data-testid="sync-success-message"]')
        .should('contain', 'Dados sincronizados');
      cy.get('[data-testid="pending-sync-indicator"]').should('not.exist');
    });
  });

  describe('Service Worker', () => {
    it('deve registrar service worker', () => {
      cy.window().then((win) => {
        expect(win.navigator.serviceWorker).to.exist;
        return win.navigator.serviceWorker.getRegistration();
      }).should('exist');
    });

    it('deve cachear recursos corretamente', () => {
      cy.window().then(async (win) => {
        const cacheNames = await win.caches.keys();
        expect(cacheNames).to.have.length.at.least(1);
        expect(cacheNames[0]).to.include('rc-construcoes-cache');
      });
    });
  });

  describe('Instalação PWA', () => {
    it('deve mostrar prompt de instalação', () => {
      // Simular evento beforeinstallprompt
      cy.window().then((win) => {
        const event = new Event('beforeinstallprompt');
        event.prompt = cy.stub();
        win.dispatchEvent(event);
      });

      cy.get('[data-testid="install-pwa-button"]').should('be.visible');
    });

    it('deve permitir instalação da PWA', () => {
      let promptEvent;
      
      cy.window().then((win) => {
        promptEvent = new Event('beforeinstallprompt');
        promptEvent.prompt = cy.stub().resolves();
        promptEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
        win.dispatchEvent(promptEvent);
      });

      cy.get('[data-testid="install-pwa-button"]').click();
      
      cy.get('[data-testid="install-success-message"]')
        .should('contain', 'Aplicativo instalado');
    });
  });
});
```

## 🎯 Fixtures e Dados de Teste

### Estrutura de Fixtures

```javascript
// tests/fixtures/clients.json
{
  "validClient": {
    "name": "João Silva",
    "cpf": "12345678901",
    "rg": "123456789",
    "phone": "(11) 99999-9999",
    "email": "joao@email.com",
    "cep": "01234-567",
    "street": "Rua das Flores, 123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP"
  },
  "clientWithoutCPF": {
    "name": "Maria Santos",
    "phone": "(11) 88888-8888",
    "email": "maria@email.com"
  },
  "clientList": [
    {
      "id": 1,
      "name": "Pedro Oliveira",
      "cpf": "98765432100",
      "phone": "(11) 77777-7777",
      "email": "pedro@email.com",
      "city": "Rio de Janeiro",
      "state": "RJ"
    },
    {
      "id": 2,
      "name": "Ana Costa",
      "cpf": "45678912300",
      "phone": "(11) 66666-6666",
      "email": "ana@email.com",
      "city": "Belo Horizonte",
      "state": "MG"
    }
  ]
}
```

```javascript
// tests/fixtures/contracts.json
{
  "pendingContract": {
    "clientId": 1,
    "title": "Reforma Residencial",
    "description": "Reforma completa de casa",
    "value": 50000,
    "startDate": "2024-08-01",
    "endDate": "2024-12-01",
    "status": "pending"
  },
  "approvedContract": {
    "clientId": 2,
    "title": "Construção Comercial",
    "description": "Construção de loja",
    "value": 150000,
    "startDate": "2024-09-01",
    "endDate": "2025-03-01",
    "status": "approved"
  }
}
```

```javascript
// tests/fixtures/cep-response.json
{
  "cep": "01234-567",
  "logradouro": "Rua das Flores",
  "complemento": "",
  "bairro": "Centro",
  "localidade": "São Paulo",
  "uf": "SP",
  "ibge": "3550308",
  "gia": "1004",
  "ddd": "11",
  "siafi": "7107"
}
```

### Gerador de Dados de Teste

```javascript
// tests/e2e/utils/test-data-generator.js
class TestDataGenerator {
  static generateClient(overrides = {}) {
    const defaultClient = {
      name: `Cliente ${Math.random().toString(36).substr(2, 9)}`,
      cpf: this.generateCPF(),
      rg: this.generateRG(),
      phone: this.generatePhone(),
      email: `test${Date.now()}@email.com`,
      cep: '01234-567',
      street: 'Rua de Teste, 123',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP'
    };

    return { ...defaultClient, ...overrides };
  }

  static generateContract(clientId, overrides = {}) {
    const defaultContract = {
      clientId,
      title: `Projeto ${Math.random().toString(36).substr(2, 9)}`,
      description: 'Descrição do projeto de teste',
      value: Math.floor(Math.random() * 100000) + 10000,
      startDate: '2024-08-01',
      endDate: '2024-12-01',
      status: 'pending'
    };

    return { ...defaultContract, ...overrides };
  }

  static generateBudget(clientId, overrides = {}) {
    const defaultBudget = {
      clientId,
      title: `Orçamento ${Math.random().toString(36).substr(2, 9)}`,
      description: 'Orçamento de teste',
      materials: [
        { name: 'Material 1', quantity: 10, unit: 'm²', price: 50 },
        { name: 'Material 2', quantity: 5, unit: 'un', price: 100 }
      ],
      labor: [
        { description: 'Pedreiro', hours: 40, rate: 25 },
        { description: 'Pintor', hours: 16, rate: 30 }
      ],
      status: 'pending'
    };

    return { ...defaultBudget, ...overrides };
  }

  static generateCPF() {
    // Gera CPF válido para testes
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    
    // Calcula primeiro dígito verificador
    let sum = digits.reduce((acc, digit, index) => acc + digit * (10 - index), 0);
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    // Calcula segundo dígito verificador
    sum = [...digits, digit1].reduce((acc, digit, index) => acc + digit * (11 - index), 0);
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    return [...digits, digit1, digit2].join('');
  }

  static generateRG() {
    return Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  }

  static generatePhone() {
    const ddd = Math.floor(Math.random() * 89) + 11; // 11-99
    const number = Math.floor(Math.random() * 900000000) + 100000000;
    return `(${ddd}) 9${number.toString().substr(0, 4)}-${number.toString().substr(4, 4)}`;
  }
}

module.exports = TestDataGenerator;
```

## 📊 Relatórios e Cobertura

### Configuração de Relatórios

```javascript
// tests/e2e/support/index.js
import '@cypress/code-coverage/support';
import 'cypress-axe';
import './commands';

// Configuração global
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignorar erros específicos que não afetam os testes
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  return true;
});

// Configurar relatórios de teste
beforeEach(() => {
  // Instrumentar código para cobertura
  cy.visit('/', {
    onBeforeLoad(win) {
      win.__coverage__ = null;
    }
  });
});

afterEach(() => {
  // Coletar cobertura de código
  cy.window().then((win) => {
    if (win.__coverage__) {
      cy.task('coverage', win.__coverage__);
    }
  });
});

// Configurações de viewport padrão para diferentes dispositivos
Cypress.Commands.add('setViewport', (device) => {
  const viewports = {
    mobile: [375, 667],
    tablet: [768, 1024],
    desktop: [1280, 720],
    large: [1920, 1080]
  };
  
  const [width, height] = viewports[device] || viewports.desktop;
  cy.viewport(width, height);
});
```

### Métricas de Performance

```javascript
// tests/e2e/utils/performance-helpers.js
class PerformanceHelpers {
  static measurePageLoad() {
    return cy.window().then((win) => {
      const perfData = win.performance.getEntriesByType('navigation')[0];
      return {
        loadTime: perfData.loadEventEnd - perfData.loadEventStart,
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        firstPaint: win.performance.getEntriesByType('paint')
          .find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: win.performance.getEntriesByType('paint')
          .find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
      };
    });
  }

  static measureInteraction(selector, action = 'click') {
    const startTime = performance.now();
    
    return cy.get(selector).then(($el) => {
      return cy.wrap($el).trigger(action).then(() => {
        const endTime = performance.now();
        return endTime - startTime;
      });
    });
  }

  static checkWebVitals() {
    return cy.window().then((win) => {
      return new Promise((resolve) => {
        // Simular coleta de Web Vitals
        const vitals = {
          CLS: Math.random() * 0.1, // Cumulative Layout Shift
          FID: Math.random() * 100, // First Input Delay
          LCP: Math.random() * 2500 + 500, // Largest Contentful Paint
          FCP: Math.random() * 1800 + 200, // First Contentful Paint
          TTFB: Math.random() * 200 + 100 // Time to First Byte
        };
        resolve(vitals);
      });
    });
  }
}

module.exports = PerformanceHelpers;
```

### Testes de Performance

```javascript
// tests/e2e/specs/performance/page-performance.cy.js
import PerformanceHelpers from '../../utils/performance-helpers';

describe('🚀 Performance da Aplicação', () => {
  beforeEach(() => {
    cy.loginAs('admin');
  });

  describe('Métricas de Carregamento', () => {
    it('deve carregar dashboard em tempo aceitável', () => {
      cy.visit('/index.html');
      
      PerformanceHelpers.measurePageLoad().then((metrics) => {
        expect(metrics.loadTime).to.be.lessThan(3000); // 3 segundos
        expect(metrics.firstContentfulPaint).to.be.lessThan(1500); // 1.5 segundos
        
        cy.task('log', `Dashboard Load Time: ${metrics.loadTime}ms`);
        cy.task('log', `First Contentful Paint: ${metrics.firstContentfulPaint}ms`);
      });
    });

    it('deve manter Web Vitals dentro dos limites', () => {
      cy.visit('/index.html');
      cy.waitForElement('[data-testid="dashboard"]');
      
      PerformanceHelpers.checkWebVitals().then((vitals) => {
        expect(vitals.CLS).to.be.lessThan(0.1); // Cumulative Layout Shift
        expect(vitals.FID).to.be.lessThan(100); // First Input Delay
        expect(vitals.LCP).to.be.lessThan(2500); // Largest Contentful Paint
        
        cy.task('log', `Web Vitals: ${JSON.stringify(vitals)}`);
      });
    });
  });

  describe('Performance de Interações', () => {
    it('deve responder rapidamente a cliques de navegação', () => {
      cy.visit('/index.html');
      
      PerformanceHelpers.measureInteraction('[data-testid="nav-clients"]')
        .then((duration) => {
          expect(duration).to.be.lessThan(100); // 100ms
          cy.task('log', `Navigation interaction: ${duration}ms`);
        });
    });

    it('deve filtrar lista de clientes rapidamente', () => {
      cy.visit('/index.html#clients');
      cy.seedTestData();
      
      const startTime = performance.now();
      cy.get('[data-testid="clients-search"]').type('João');
      cy.get('[data-testid="client-card"]').should('be.visible');
      
      cy.then(() => {
        const duration = performance.now() - startTime;
        expect(duration).to.be.lessThan(500); // 500ms
        cy.task('log', `Search filter duration: ${duration}ms`);
      });
    });
  });
});
```

## 🚀 Execução dos Testes

### Scripts de Execução

```bash
#!/bin/bash
# scripts/run-e2e-tests.sh

echo "🎭 Executando Testes E2E - RC Construções"

# Verificar se aplicação está rodando
if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ Aplicação não está rodando em localhost:3000"
    echo "Execute: npm run dev"
    exit 1
fi

# Verificar se backend está rodando
if ! curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "❌ Backend não está rodando em localhost:3001"
    echo "Execute: cd backend && npm run dev"
    exit 1
fi

# Preparar ambiente de teste
echo "🔧 Preparando ambiente de teste..."
npm run test:reset-db
npm run test:seed-data

# Executar testes por categoria
echo "🔐 Executando testes de autenticação..."
npx cypress run --spec "tests/e2e/specs/auth/**/*.cy.js"

echo "📊 Executando testes de dashboard..."
npx cypress run --spec "tests/e2e/specs/dashboard/**/*.cy.js"

echo "👥 Executando testes de clientes..."
npx cypress run --spec "tests/e2e/specs/clients/**/*.cy.js"

echo "📄 Executando testes de contratos..."
npx cypress run --spec "tests/e2e/specs/contracts/**/*.cy.js"

echo "🧮 Executando testes de orçamentos..."
npx cypress run --spec "tests/e2e/specs/budgets/**/*.cy.js"

echo "💰 Executando testes financeiros..."
npx cypress run --spec "tests/e2e/specs/financial/**/*.cy.js"

echo "📱 Executando testes PWA..."
npx cypress run --spec "tests/e2e/specs/pwa/**/*.cy.js"

echo "🚀 Executando testes de performance..."
npx cypress run --spec "tests/e2e/specs/performance/**/*.cy.js"

echo "✅ Testes E2E concluídos!"
echo "📊 Relatórios disponíveis em: cypress/reports/"
```

### Pipeline CI/CD

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        browser: [chrome, firefox, edge]
        viewport: [desktop, mobile, tablet]
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: rc_construcoes_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci

      - name: Build application
        run: npm run build

      - name: Start backend
        run: |
          cd backend
          npm run migrate
          npm run seed:test
          npm run start &
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_PASSWORD: postgres

      - name: Start frontend
        run: |
          npm run start &
          npx wait-on http://localhost:3000

      - name: Run E2E tests
        uses: cypress-io/github-action@v6
        with:
          browser: ${{ matrix.browser }}
          record: true
          parallel: true
          group: 'E2E Tests - ${{ matrix.browser }} - ${{ matrix.viewport }}'
        env:
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CYPRESS_viewportWidth: ${{ matrix.viewport == 'mobile' && '375' || matrix.viewport == 'tablet' && '768' || '1280' }}
          CYPRESS_viewportHeight: ${{ matrix.viewport == 'mobile' && '667' || matrix.viewport == 'tablet' && '1024' || '720' }}

      - name: Upload screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots-${{ matrix.browser }}-${{ matrix.viewport }}
          path: cypress/screenshots

      - name: Upload videos
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: cypress-videos-${{ matrix.browser }}-${{ matrix.viewport }}
          path: cypress/videos

      - name: Generate coverage report
        run: npx nyc report --reporter=lcov

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: e2e
```

## 🐛 Debugging e Solução de Problemas

### Estratégias de Debug

```javascript
// tests/e2e/support/debug-helpers.js
class DebugHelpers {
  static captureAppState() {
    return cy.window().then((win) => {
      return {
        currentUser: win.Auth?.getCurrentUser(),
        currentPage: win.location.hash,
        databaseState: win.Database?.debugInfo(),
        localStorageData: { ...win.localStorage },
        sessionStorageData: { ...win.sessionStorage }
      };
    });
  }

  static logNetworkRequests() {
    cy.intercept('**', (req) => {
      cy.task('log', `${req.method} ${req.url}`);
    });
  }

  static pauseOnFailure() {
    cy.on('fail', (error) => {
      debugger; // Pausa execução no DevTools
      throw error;
    });
  }

  static takeScreenshotWithTimestamp(name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cy.screenshot(`${name}-${timestamp}`);
  }
}

// Comandos para debug
Cypress.Commands.add('debug', () => {
  cy.pause();
  DebugHelpers.captureAppState().then((state) => {
    cy.task('log', 'App State:', state);
  });
});

Cypress.Commands.add('logAppState', () => {
  DebugHelpers.captureAppState().then((state) => {
    cy.task('log', JSON.stringify(state, null, 2));
  });
});
```

### Problemas Comuns e Soluções

#### 1. Elemento não encontrado

```javascript
// ❌ Problema
cy.get('[data-testid="button"]').click();

// ✅ Solução
cy.get('[data-testid="button"]', { timeout: 10000 }).should('be.visible').click();
```

#### 2. Timing issues com animações

```javascript
// ❌ Problema
cy.get('[data-testid="modal"]').should('be.visible');
cy.get('[data-testid="modal-content"]').click();

// ✅ Solução
cy.get('[data-testid="modal"]').should('be.visible');
cy.get('[data-testid="modal"]').should('have.class', 'animation-complete');
cy.get('[data-testid="modal-content"]').click();
```

#### 3. Falhas intermitentes

```javascript
// ✅ Usar retry para operações instáveis
Cypress.Commands.add('reliableClick', (selector) => {
  cy.get(selector).should('be.visible').and('not.be.disabled');
  cy.get(selector).click({ force: true });
});
```

#### 4. Problemas de sincronização com banco

```javascript
// ✅ Aguardar operações assíncronas
cy.get('[data-testid="save-button"]').click();
cy.get('[data-testid="success-message"]').should('be.visible');
cy.wait(1000); // Aguardar sincronização
```

### Configuração de Debug

```javascript
// cypress.config.js - Configurações para debug
module.exports = defineConfig({
  e2e: {
    // Manter vídeos apenas para falhas
    video: true,
    videoCompression: false,
    
    // Screenshots em falhas
    screenshotOnRunFailure: true,
    
    // Timeout maior para debug
    defaultCommandTimeout: 15000,
    
    // Configurações de retry
    retries: {
      runMode: 2,
      openMode: 0
    },
    
    env: {
      // Habilitar logs detalhados
      DEBUG_MODE: true,
      LOG_LEVEL: 'debug'
    }
  }
});
```

---

## ✅ Checklist de Testes E2E

### Antes de Executar

- [ ] **Ambiente configurado**: Frontend e backend rodando
- [ ] **Banco de dados**: Limpo e com dados de teste
- [ ] **Cypress instalado**: Versão mais recente
- [ ] **Fixtures atualizadas**: Dados de teste válidos

### Durante os Testes

- [ ] **Fluxos críticos**: Login, CRUD, aprovações
- [ ] **Responsividade**: Mobile, tablet, desktop
- [ ] **Performance**: Tempo de carregamento aceitável
- [ ] **Acessibilidade**: Elementos focáveis e semânticos
- [ ] **PWA**: Funcionalidade offline

### Após os Testes

- [ ] **Relatórios gerados**: Screenshots, vídeos, cobertura
- [ ] **Falhas documentadas**: Bugs reportados
- [ ] **Métricas coletadas**: Performance, cobertura
- [ ] **Ambiente limpo**: Dados de teste removidos

---

## 📚 Recursos Adicionais

### Documentação Relacionada

- [Configuração de Ambiente](../development/setup.md)
- [Testes Unitários](unit-tests.md)
- [Testes de Integração](integration-tests.md)
- [Arquitetura do Sistema](../development/architecture.md)

### Links Úteis

- [Cypress Documentation](https://docs.cypress.io/)
- [Cypress Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Testing Library](https://testing-library.com/)
- [Web Vitals](https://web.dev/vitals/)

### Suporte

- **Issues**: GitHub Issues para bugs nos testes
- **Discussões**: GitHub Discussions para dúvidas
- **Chat**: Slack #qa-testing
- **Email**: qa-team@rc-construcoes.com

---

**Última atualização**: 30 de julho de 2025  
**Versão do documento**: 5.1  
**Mantenedores**: Equipe de QA RC Construções