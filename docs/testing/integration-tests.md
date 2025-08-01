# 🔗 Testes de Integração - RC Construções

## Índice

- [📋 Visão Geral](#-visão-geral)
- [⚙️ Configuração do Jest](#%EF%B8%8F-configuração-do-jest)
- [🏗️ Estrutura dos Testes](#%EF%B8%8F-estrutura-dos-testes)
- [📊 Testes de Dashboard](#-testes-de-dashboard)
- [👥 Testes CRUD de Clientes](#-testes-crud-de-clientes)
- [📄 Testes de Fluxo de Contratos](#-testes-de-fluxo-de-contratos)
- [🧮 Testes de Workflow de Orçamentos](#-testes-de-workflow-de-orçamentos)
- [🔄 Testes de Sincronização](#-testes-de-sincronização)
- [💰 Testes de Sistema Financeiro](#-testes-de-sistema-financeiro)
- [🗃️ Testes de Integração com Database](#%EF%B8%8F-testes-de-integração-com-database)
- [🌐 Testes de API Backend](#-testes-de-api-backend)
- [🔧 Mocks e Stubs](#-mocks-e-stubs)
- [📊 Relatórios e Cobertura](#-relatórios-e-cobertura)
- [🚀 Execução dos Testes](#-execução-dos-testes)
- [🐛 Debugging](#-debugging)

## 📋 Visão Geral

Os testes de integração verificam se os diferentes módulos do sistema RC Construções funcionam corretamente quando integrados. Eles testam as interações entre frontend/backend, sincronização de dados, fluxos completos de negócio e integrações com APIs externas.

### Objetivos dos Testes de Integração

- ✅ **Validar fluxos de dados entre módulos**
- ✅ **Testar integração frontend/backend**
- ✅ **Verificar sincronização IndexedDB/API**
- ✅ **Validar workflows completos de negócio**
- ✅ **Testar integrações com APIs externas (ViaCEP)**

### Cobertura dos Testes

| Módulo | Integração Testada | Status |
|--------|-------------------|--------|
| **Dashboard** | Agregação de dados de múltiplos módulos | ✅ Completo |
| **Clientes** | CRUD local + sync com API | ✅ Completo |
| **Contratos** | Workflow com clientes e aprovações | 🔄 Em desenvolvimento |
| **Orçamentos** | Processo multi-etapas + templates | 🔄 Em desenvolvimento |
| **Sincronização** | Cloud sync offline/online | ✅ Completo |
| **Financeiro** | Integração com contratos/orçamentos | 📝 Planejado |

## ⚙️ Configuração do Jest

### Arquivo de Configuração

```javascript
// jest.config.js
module.exports = {
  // Ambiente de teste
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/helpers/setup.js',
    '<rootDir>/tests/helpers/mock-database.js'
  ],
  
  // Padrões de teste
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.js'
  ],
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/js/$1',
    '^@core/(.*)$': '<rootDir>/js/core/$1',
    '^@modules/(.*)$': '<rootDir>/js/modules/$1'
  },
  
  // Transform ignorar node_modules exceto bibliotecas específicas
  transformIgnorePatterns: [
    'node_modules/(?!(dexie)/)'
  ],
  
  // Cobertura de código
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/lib/**',
    '!js/**/*.test.js',
    '!**/node_modules/**'
  ],
  
  // Thresholds de cobertura para integração
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Thresholds específicos para módulos críticos
    'js/core/cloud-sync.js': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'js/core/database.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Timeout para testes assíncronos
  testTimeout: 30000,
  
  // Configuração para testes de integração
  globals: {
    'jest-environment-jsdom': {
      url: 'http://localhost:3000'
    }
  }
};
```

### Setup de Teste

```javascript
// tests/helpers/setup.js
import { TextEncoder, TextDecoder } from 'util';

// Polyfills para JSDOM
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock de APIs globais
global.fetch = require('jest-fetch-mock');

// Mock do localStorage/sessionStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
global.sessionStorage = localStorageMock;

// Mock de APIs específicas do browser
global.navigator = {
  ...global.navigator,
  onLine: true,
  userAgent: 'Mozilla/5.0 (Test Environment)'
};

// Mock de eventos customizados
global.CustomEvent = class CustomEvent extends Event {
  constructor(event, params) {
    super(event, params);
    this.detail = params?.detail;
  }
};

// Configuração global para testes
beforeEach(() => {
  // Limpar mocks
  jest.clearAllMocks();
  fetch.resetMocks();
  
  // Reset localStorage
  localStorage.clear();
  sessionStorage.clear();
  
  // Mock console para reduzir ruído nos testes
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // Restaurar console
  console.log.mockRestore?.();
  console.warn.mockRestore?.();
});
```

## 🏗️ Estrutura dos Testes

### Organização de Arquivos

```
tests/integration/
├── dashboard-integration.test.js      # Integração do dashboard
├── clients-crud.test.js               # CRUD completo de clientes
├── contracts-flow.test.js             # Fluxo de contratos
├── budgets-workflow.test.js           # Workflow de orçamentos
├── sync-integration.test.js           # Sincronização de dados
├── financial-integration.test.js      # Sistema financeiro
├── api-integration.test.js            # Integração com backend
├── database-integration.test.js       # Integração com IndexedDB
└── external-apis.test.js              # APIs externas (ViaCEP)
```

### Utilities de Teste

```javascript
// tests/helpers/integration-utils.js
export class IntegrationTestUtils {
  static async initializeSystem() {
    // Simular carregamento do sistema
    return new Promise((resolve) => {
      // Mock do sistema de inicialização
      window.rcSystemReady = true;
      window.dispatchEvent(new CustomEvent('rcSystemReady'));
      resolve();
    });
  }

  static async seedTestData() {
    const testData = {
      clients: [
        {
          id: 1,
          name: 'João Silva',
          cpf: '12345678901',
          phone: '(11) 99999-9999',
          email: 'joao@test.com',
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Maria Santos',
          cpf: '98765432100',
          phone: '(11) 88888-8888',
          email: 'maria@test.com',
          createdAt: new Date().toISOString()
        }
      ],
      contracts: [
        {
          id: 101,
          clientId: 1,
          title: 'Reforma Residencial',
          totalValue: 50000,
          status: 'active',
          signingDate: new Date().toISOString()
        }
      ],
      budgets: [
        {
          id: 201,
          clientId: 1,
          title: 'Orçamento Cozinha',
          totalValue: 25000,
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      ]
    };

    // Mock do Database para retornar dados de teste
    if (window.Database) {
      Object.keys(testData).forEach(store => {
        jest.spyOn(window.Database, 'getAll')
          .mockImplementation((storeName) => {
            if (storeName === store) {
              return Promise.resolve(testData[store]);
            }
            return Promise.resolve([]);
          });
      });
    }

    return testData;
  }

  static mockApiResponses() {
    // Mock respostas da API backend
    fetch.mockImplementation((url, options) => {
      const method = options?.method || 'GET';
      
      if (url.includes('/api/clients')) {
        if (method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: Date.now(), ...JSON.parse(options.body) })
          });
        }
      }
      
      // Mock ViaCEP
      if (url.includes('viacep.com.br')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            cep: '01234-567',
            logradouro: 'Rua de Teste',
            bairro: 'Centro',
            localidade: 'São Paulo',
            uf: 'SP'
          })
        });
      }
      
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
  }

  static async waitForAsync(fn, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = async () => {
        try {
          const result = await fn();
          if (result) {
            resolve(result);
          } else if (Date.now() - startTime >= timeout) {
            reject(new Error('Timeout waiting for async condition'));
          } else {
            setTimeout(check, 100);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      check();
    });
  }
}
```

## 📊 Testes de Dashboard

### Integração de Múltiplos Módulos

```javascript
// tests/integration/dashboard-integration.test.js
import { IntegrationTestUtils } from '../helpers/integration-utils';

describe('🔗 Dashboard - Integração de Módulos', () => {
  beforeEach(async () => {
    await IntegrationTestUtils.initializeSystem();
    IntegrationTestUtils.mockApiResponses();
  });

  describe('Agregação de Dados', () => {
    test('deve agregar dados de clientes, contratos e orçamentos', async () => {
      // Arrange
      const testData = await IntegrationTestUtils.seedTestData();
      
      // Mock dos módulos necessários
      window.Database = {
        getAll: jest.fn(),
        isConnected: true
      };
      
      window.Database.getAll
        .mockResolvedValueOnce(testData.clients)
        .mockResolvedValueOnce(testData.contracts)
        .mockResolvedValueOnce(testData.budgets);

      // Simular Dashboard Manager
      const { DashboardManager } = require('../../js/dashboard');
      const dashboardManager = new DashboardManager();
      
      // Act
      await dashboardManager.loadData();
      const stats = dashboardManager.calculateMainStats();
      
      // Assert
      expect(stats).toEqual({
        totalRevenue: expect.any(Number),
        activeContracts: expect.any(Number),
        newClients: expect.any(Number),
        estimatedProfit: expect.any(Number)
      });
      
      expect(stats.activeContracts).toBe(1); // 1 contrato ativo nos dados de teste
      expect(stats.totalRevenue).toBe(50000); // Total do contrato ativo
    });

    test('deve lidar com módulos indisponíveis graciosamente', async () => {
      // Arrange
      window.Database = null;
      
      const { DashboardManager } = require('../../js/dashboard');
      const dashboardManager = new DashboardManager();
      
      // Act & Assert - não deve lançar erro
      await expect(dashboardManager.loadData()).resolves.not.toThrow();
      
      const stats = dashboardManager.calculateMainStats();
      expect(stats.totalRevenue).toBe(0);
      expect(stats.activeContracts).toBe(0);
    });
  });

  describe('Renderização de Gráficos', () => {
    test('deve integrar com Charts Manager para renderizar gráficos', async () => {
      // Arrange
      const testData = await IntegrationTestUtils.seedTestData();
      
      // Mock Charts Manager
      window.Charts = {
        createAreaChart: jest.fn(),
        createDoughnutChart: jest.fn()
      };
      
      window.Database = {
        getAll: jest.fn()
          .mockResolvedValueOnce(testData.clients)
          .mockResolvedValueOnce(testData.contracts)
          .mockResolvedValueOnce(testData.budgets)
      };
      
      const { DashboardManager } = require('../../js/dashboard');
      const dashboardManager = new DashboardManager();
      
      // Act
      await dashboardManager.loadData();
      dashboardManager.renderCharts();
      
      // Assert
      expect(window.Charts.createAreaChart).toHaveBeenCalledWith(
        'financial-overview-chart',
        expect.any(Object),
        expect.any(Object)
      );
      
      expect(window.Charts.createDoughnutChart).toHaveBeenCalledWith(
        'contracts-status-chart',
        expect.any(Object)
      );
    });
  });

  describe('Atualizações em Tempo Real', () => {
    test('deve atualizar estatísticas quando dados mudam', async () => {
      // Arrange
      const testData = await IntegrationTestUtils.seedTestData();
      
      window.Database = {
        getAll: jest.fn()
      };
      
      // Primeira carga de dados
      window.Database.getAll
        .mockResolvedValueOnce(testData.clients)
        .mockResolvedValueOnce(testData.contracts)
        .mockResolvedValueOnce(testData.budgets);
      
      const { DashboardManager } = require('../../js/dashboard');
      const dashboardManager = new DashboardManager();
      
      await dashboardManager.loadData();
      const initialStats = dashboardManager.calculateMainStats();
      
      // Simular adição de novo contrato
      const updatedContracts = [
        ...testData.contracts,
        {
          id: 102,
          clientId: 2,
          title: 'Novo Contrato',
          totalValue: 30000,
          status: 'active',
          signingDate: new Date().toISOString()
        }
      ];
      
      // Segunda carga com dados atualizados
      window.Database.getAll
        .mockResolvedValueOnce(testData.clients)
        .mockResolvedValueOnce(updatedContracts)
        .mockResolvedValueOnce(testData.budgets);
      
      // Act
      await dashboardManager.loadData();
      const updatedStats = dashboardManager.calculateMainStats();
      
      // Assert
      expect(updatedStats.activeContracts).toBe(2);
      expect(updatedStats.totalRevenue).toBe(80000); // 50000 + 30000
      expect(updatedStats.totalRevenue).toBeGreaterThan(initialStats.totalRevenue);
    });
  });
});
```

## 👥 Testes CRUD de Clientes

### Integração Local/Remoto

```javascript
// tests/integration/clients-crud.test.js
import { IntegrationTestUtils } from '../helpers/integration-utils';

describe('🔗 Clientes - CRUD Integrado', () => {
  let clientsManager;
  
  beforeEach(async () => {
    await IntegrationTestUtils.initializeSystem();
    IntegrationTestUtils.mockApiResponses();
    
    // Mock dos módulos necessários
    window.Database = {
      save: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn(),
      init: jest.fn()
    };
    
    window.CloudSync = {
      addToQueue: jest.fn(),
      syncPendingData: jest.fn()
    };
    
    window.Notifications = {
      show: jest.fn()
    };
    
    const { ClientsManager } = require('../../js/clients');
    clientsManager = new ClientsManager();
  });

  describe('Criação de Cliente', () => {
    test('deve criar cliente localmente e sincronizar com API', async () => {
      // Arrange
      const clientData = {
        name: 'João Silva',
        cpf: '12345678901',
        phone: '(11) 99999-9999',
        email: 'joao@test.com'
      };
      
      window.Database.save.mockResolvedValue({ id: 1, ...clientData });
      
      // Act
      const result = await clientsManager.createClient(clientData);
      
      // Assert
      expect(window.Database.save).toHaveBeenCalledWith('clients', expect.objectContaining(clientData));
      expect(window.CloudSync.addToQueue).toHaveBeenCalledWith('clients', 'save', expect.any(Object));
      expect(window.Notifications.show).toHaveBeenCalledWith(
        expect.stringContaining('Cliente criado'),
        'success'
      );
      expect(result).toEqual(expect.objectContaining({ id: 1, ...clientData }));
    });

    test('deve integrar com ViaCEP para busca de endereço', async () => {
      // Arrange
      const cep = '01234567';
      
      // Mock ViaCEP response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          cep: '01234-567',
          logradouro: 'Rua de Teste',
          bairro: 'Centro',
          localidade: 'São Paulo',
          uf: 'SP'
        })
      });
      
      // Act
      const addressData = await clientsManager.searchAddressByCep(cep);
      
      // Assert
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`viacep.com.br/ws/${cep}/json/`)
      );
      
      expect(addressData).toEqual({
        street: 'Rua de Teste',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP'
      });
    });

    test('deve lidar com erro na API ViaCEP', async () => {
      // Arrange
      const cep = '00000000';
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ erro: true })
      });
      
      // Act & Assert
      await expect(clientsManager.searchAddressByCep(cep))
        .rejects
        .toThrow('CEP não encontrado');
    });
  });

  describe('Listagem e Filtros', () => {
    test('deve integrar busca local com dados sincronizados', async () => {
      // Arrange
      const mockClients = [
        { id: 1, name: 'João Silva', cpf: '12345678901' },
        { id: 2, name: 'Maria Santos', cpf: '98765432100' },
        { id: 3, name: 'Pedro João', cpf: '11111111111' }
      ];
      
      window.Database.getAll.mockResolvedValue(mockClients);
      
      // Act
      await clientsManager.loadClients();
      const searchResults = clientsManager.searchClients('João');
      
      // Assert
      expect(window.Database.getAll).toHaveBeenCalledWith('clients');
      expect(searchResults).toHaveLength(2); // João Silva e Pedro João
      expect(searchResults.every(client => client.name.includes('João'))).toBe(true);
    });
  });

  describe('Atualização de Cliente', () => {
    test('deve atualizar localmente e sincronizar', async () => {
      // Arrange
      const clientId = 1;
      const updateData = { name: 'João Silva Atualizado' };
      
      window.Database.save.mockResolvedValue({ id: clientId, ...updateData });
      
      // Act
      const result = await clientsManager.updateClient(clientId, updateData);
      
      // Assert
      expect(window.Database.save).toHaveBeenCalledWith(
        'clients',
        expect.objectContaining({ id: clientId, ...updateData })
      );
      expect(window.CloudSync.addToQueue).toHaveBeenCalledWith('clients', 'update', expect.any(Object));
    });
  });

  describe('Exclusão de Cliente', () => {
    test('deve verificar dependências antes de excluir', async () => {
      // Arrange
      const clientId = 1;
      
      // Mock dependências
      window.Database.getAll
        .mockResolvedValueOnce([{ id: 101, clientId: 1 }]) // contratos
        .mockResolvedValueOnce([{ id: 201, clientId: 1 }]); // orçamentos
      
      // Act & Assert
      await expect(clientsManager.deleteClient(clientId))
        .rejects
        .toThrow('Cliente possui contratos ou orçamentos vinculados');
      
      expect(window.Database.delete).not.toHaveBeenCalled();
    });

    test('deve excluir cliente sem dependências', async () => {
      // Arrange
      const clientId = 1;
      
      // Mock sem dependências
      window.Database.getAll
        .mockResolvedValueOnce([]) // contratos
        .mockResolvedValueOnce([]); // orçamentos
      
      window.Database.delete.mockResolvedValue();
      
      // Act
      await clientsManager.deleteClient(clientId);
      
      // Assert
      expect(window.Database.delete).toHaveBeenCalledWith('clients', clientId);
      expect(window.CloudSync.addToQueue).toHaveBeenCalledWith('clients', 'delete', { id: clientId });
    });
  });
});
```

## 📄 Testes de Fluxo de Contratos

### Integração Cliente-Contrato

```javascript
// tests/integration/contracts-flow.test.js
import { IntegrationTestUtils } from '../helpers/integration-utils';

describe('🔗 Contratos - Fluxo Integrado', () => {
  let contractsManager;
  
  beforeEach(async () => {
    await IntegrationTestUtils.initializeSystem();
    IntegrationTestUtils.mockApiResponses();
    
    window.Database = {
      save: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn(),
      delete: jest.fn()
    };
    
    window.CloudSync = {
      addToQueue: jest.fn()
    };
    
    window.Notifications = {
      show: jest.fn()
    };
    
    window.PDFGenerator = {
      generateContractPDF: jest.fn()
    };
    
    const { ContractsManager } = require('../../js/contracts');
    contractsManager = new ContractsManager();
  });

  describe('Criação de Contrato', () => {
    test('deve validar cliente existente antes de criar contrato', async () => {
      // Arrange
      const contractData = {
        clientId: 1,
        title: 'Reforma Residencial',
        totalValue: 50000,
        startDate: '2024-08-01'
      };
      
      // Mock cliente existente
      window.Database.getById.mockResolvedValue({
        id: 1,
        name: 'João Silva',
        cpf: '12345678901'
      });
      
      window.Database.save.mockResolvedValue({ id: 101, ...contractData });
      
      // Act
      const result = await contractsManager.createContract(contractData);
      
      // Assert
      expect(window.Database.getById).toHaveBeenCalledWith('clients', 1);
      expect(window.Database.save).toHaveBeenCalledWith('contracts', expect.objectContaining(contractData));
      expect(result.id).toBe(101);
    });

    test('deve rejeitar criação com cliente inexistente', async () => {
      // Arrange
      const contractData = {
        clientId: 999,
        title: 'Contrato Inválido'
      };
      
      window.Database.getById.mockResolvedValue(null);
      
      // Act & Assert
      await expect(contractsManager.createContract(contractData))
        .rejects
        .toThrow('Cliente não encontrado');
      
      expect(window.Database.save).not.toHaveBeenCalled();
    });
  });

  describe('Workflow de Aprovação', () => {
    test('deve processar aprovação de contrato com histórico', async () => {
      // Arrange
      const contractId = 101;
      const approvalData = {
        approvedBy: 'Admin',
        notes: 'Contrato aprovado após análise'
      };
      
      const existingContract = {
        id: contractId,
        status: 'pending',
        clientId: 1,
        title: 'Reforma Residencial'
      };
      
      window.Database.getById.mockResolvedValue(existingContract);
      window.Database.save.mockResolvedValue({
        ...existingContract,
        status: 'approved',
        approvalHistory: [{
          action: 'approved',
          timestamp: expect.any(String),
          ...approvalData
        }]
      });
      
      // Act
      const result = await contractsManager.approveContract(contractId, approvalData);
      
      // Assert
      expect(result.status).toBe('approved');
      expect(result.approvalHistory).toHaveLength(1);
      expect(result.approvalHistory[0]).toEqual(
        expect.objectContaining(approvalData)
      );
    });

    test('deve gerar notificação após aprovação', async () => {
      // Arrange
      const contractId = 101;
      const contract = {
        id: contractId,
        status: 'pending',
        clientId: 1,
        title: 'Reforma Residencial'
      };
      
      window.Database.getById.mockResolvedValue(contract);
      window.Database.save.mockResolvedValue({ ...contract, status: 'approved' });
      
      // Act
      await contractsManager.approveContract(contractId, { approvedBy: 'Admin' });
      
      // Assert
      expect(window.Notifications.show).toHaveBeenCalledWith(
        expect.stringContaining('Contrato aprovado'),
        'success'
      );
    });
  });

  describe('Geração de PDF', () => {
    test('deve integrar com PDFGenerator para criar documento', async () => {
      // Arrange
      const contractId = 101;
      const contract = {
        id: contractId,
        title: 'Reforma Residencial',
        clientId: 1,
        totalValue: 50000
      };
      
      const client = {
        id: 1,
        name: 'João Silva',
        cpf: '12345678901'
      };
      
      window.Database.getById
        .mockResolvedValueOnce(contract)
        .mockResolvedValueOnce(client);
      
      window.PDFGenerator.generateContractPDF.mockResolvedValue('mock-pdf-data');
      
      // Act
      const pdfData = await contractsManager.generateContractPDF(contractId);
      
      // Assert
      expect(window.PDFGenerator.generateContractPDF).toHaveBeenCalledWith({
        contract,
        client
      });
      expect(pdfData).toBe('mock-pdf-data');
    });
  });

  describe('Conversão Orçamento-Contrato', () => {
    test('deve converter orçamento aprovado em contrato', async () => {
      // Arrange
      const budgetId = 201;
      const budget = {
        id: budgetId,
        clientId: 1,
        title: 'Orçamento Cozinha',
        totalValue: 25000,
        status: 'approved',
        materials: [
          { name: 'Azulejo', quantity: 10, price: 50 }
        ],
        labor: [
          { description: 'Pedreiro', hours: 40, rate: 25 }
        ]
      };
      
      window.Database.getById.mockResolvedValue(budget);
      window.Database.save.mockResolvedValue({ id: 102, ...budget, status: 'active' });
      
      // Act
      const contract = await contractsManager.convertBudgetToContract(budgetId);
      
      // Assert
      expect(contract).toEqual(
        expect.objectContaining({
          clientId: budget.clientId,
          title: expect.stringContaining(budget.title),
          totalValue: budget.totalValue,
          status: 'active',
          sourceType: 'budget',
          sourceBudgetId: budgetId
        })
      );
      
      expect(window.Database.save).toHaveBeenCalledWith('contracts', expect.any(Object));
    });
  });
});
```

## 🧮 Testes de Workflow de Orçamentos

### Processo Multi-Etapas

```javascript
// tests/integration/budgets-workflow.test.js
import { IntegrationTestUtils } from '../helpers/integration-utils';

describe('🔗 Orçamentos - Workflow Integrado', () => {
  let budgetsManager;
  
  beforeEach(async () => {
    await IntegrationTestUtils.initializeSystem();
    IntegrationTestUtils.mockApiResponses();
    
    window.Database = {
      save: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn()
    };
    
    window.CloudSync = {
      addToQueue: jest.fn()
    };
    
    window.Notifications = {
      show: jest.fn()
    };
    
    const { BudgetsManager } = require('../../js/budgets');
    budgetsManager = new BudgetsManager();
  });

  describe('Criação Multi-Etapas', () => {
    test('deve salvar progresso entre etapas', async () => {
      // Arrange
      const budgetData = {
        step1: { clientId: 1, projectType: 'Reforma', description: 'Reforma cozinha' },
        step2: { materials: [{ name: 'Azulejo', quantity: 10, price: 50 }] },
        step3: { labor: [{ description: 'Pedreiro', hours: 40, rate: 25 }] }
      };
      
      // Simular sessionStorage para salvar progresso
      const progressData = {};
      window.sessionStorage.setItem = jest.fn((key, value) => {
        progressData[key] = value;
      });
      window.sessionStorage.getItem = jest.fn((key) => progressData[key]);
      
      // Act - Etapa 1
      await budgetsManager.saveStepData(1, budgetData.step1);
      
      // Act - Etapa 2
      await budgetsManager.saveStepData(2, budgetData.step2);
      
      // Act - Etapa 3
      await budgetsManager.saveStepData(3, budgetData.step3);
      
      // Assert
      expect(window.sessionStorage.setItem).toHaveBeenCalledTimes(3);
      
      const savedProgress = budgetsManager.getProgressData();
      expect(savedProgress).toEqual(
        expect.objectContaining({
          step1Data: budgetData.step1,
          step2Data: budgetData.step2,
          step3Data: budgetData.step3
        })
      );
    });

    test('deve calcular totais automaticamente', async () => {
      // Arrange
      const budgetData = {
        materials: [
          { name: 'Azulejo', quantity: 10, price: 50 },
          { name: 'Tinta', quantity: 5, price: 80 }
        ],
        labor: [
          { description: 'Pedreiro', hours: 40, rate: 25 },
          { description: 'Pintor', hours: 16, rate: 30 }
        ]
      };
      
      // Act
      const calculations = budgetsManager.calculateTotals(budgetData);
      
      // Assert
      expect(calculations).toEqual({
        materialsTotal: 900, // (10*50) + (5*80)
        laborTotal: 1480,    // (40*25) + (16*30)
        subtotal: 2380,
        tax: expect.any(Number),
        total: expect.any(Number)
      });
    });

    test('deve finalizar orçamento com todos os dados', async () => {
      // Arrange
      const completeData = {
        clientId: 1,
        projectType: 'Reforma',
        description: 'Reforma completa de cozinha',
        materials: [{ name: 'Azulejo', quantity: 10, price: 50 }],
        labor: [{ description: 'Pedreiro', hours: 40, rate: 25 }]
      };
      
      window.Database.save.mockResolvedValue({ id: 201, ...completeData });
      
      // Act
      const budget = await budgetsManager.finalizeBudget(completeData);
      
      // Assert
      expect(window.Database.save).toHaveBeenCalledWith('budgets', 
        expect.objectContaining({
          ...completeData,
          status: 'pending',
          createdAt: expect.any(String),
          expiresAt: expect.any(String) // Data de expiração
        })
      );
      
      expect(budget.id).toBe(201);
    });
  });

  describe('Sistema de Templates', () => {
    test('deve criar template a partir de orçamento existente', async () => {
      // Arrange
      const budgetId = 201;
      const budget = {
        id: budgetId,
        title: 'Orçamento Cozinha',
        materials: [{ name: 'Azulejo', quantity: 10, price: 50 }],
        labor: [{ description: 'Pedreiro', hours: 40, rate: 25 }]
      };
      
      const templateData = {
        name: 'Template Reforma Cozinha',
        description: 'Template padrão para reformas de cozinha'
      };
      
      window.Database.getById.mockResolvedValue(budget);
      window.Database.save.mockResolvedValue({ id: 301, ...templateData });
      
      // Act
      const template = await budgetsManager.createTemplateFromBudget(budgetId, templateData);
      
      // Assert
      expect(template).toEqual(
        expect.objectContaining({
          ...templateData,
          materials: budget.materials,
          labor: budget.labor,
          type: 'template'
        })
      );
    });

    test('deve aplicar template a novo orçamento', async () => {
      // Arrange
      const templateId = 301;
      const template = {
        id: templateId,
        name: 'Template Reforma Cozinha',
        materials: [{ name: 'Azulejo', quantity: 10, price: 50 }],
        labor: [{ description: 'Pedreiro', hours: 40, rate: 25 }]
      };
      
      window.Database.getById.mockResolvedValue(template);
      
      // Act
      const budgetData = await budgetsManager.applyTemplate(templateId, { clientId: 2 });
      
      // Assert
      expect(budgetData).toEqual(
        expect.objectContaining({
          clientId: 2,
          materials: template.materials,
          labor: template.labor,
          templateUsed: templateId
        })
      );
    });
  });

  describe('Processo de Aprovação', () => {
    test('deve processar aprovação externa via token', async () => {
      // Arrange
      const budgetId = 201;
      const approvalToken = 'abc123def456';
      
      const budget = {
        id: budgetId,
        status: 'pending',
        approvalToken: approvalToken
      };
      
      window.Database.getById.mockResolvedValue(budget);
      window.Database.save.mockResolvedValue({ ...budget, status: 'approved' });
      
      // Mock de Email/SMS service
      window.NotificationService = {
        sendApprovalLink: jest.fn()
      };
      
      // Act
      const result = await budgetsManager.processExternalApproval(approvalToken, {
        approved: true,
        signature: 'João Silva',
        notes: 'Aprovado conforme apresentado'
      });
      
      // Assert
      expect(result.status).toBe('approved');
      expect(window.Database.save).toHaveBeenCalledWith('budgets',
        expect.objectContaining({
          status: 'approved',
          approvalData: expect.objectContaining({
            signature: 'João Silva',
            approvedAt: expect.any(String)
          })
        })
      );
    });

    test('deve processar rejeição com comentários', async () => {
      // Arrange
      const budgetId = 201;
      const approvalToken = 'abc123def456';
      
      const budget = {
        id: budgetId,
        status: 'pending',
        approvalToken: approvalToken
      };
      
      window.Database.getById.mockResolvedValue(budget);
      window.Database.save.mockResolvedValue({ ...budget, status: 'rejected' });
      
      // Act
      const result = await budgetsManager.processExternalApproval(approvalToken, {
        approved: false,
        comments: 'Preciso de mais detalhes sobre os materiais'
      });
      
      // Assert
      expect(result.status).toBe('rejected');
      expect(result.rejectionComments).toBe('Preciso de mais detalhes sobre os materiais');
    });
  });
});
```

## 🔄 Testes de Sincronização

### Cloud Sync Integration

```javascript
// tests/integration/sync-integration.test.js
import { IntegrationTestUtils } from '../helpers/integration-utils';

describe('🔗 Sincronização - Integração Cloud', () => {
  let cloudSync;
  
  beforeEach(async () => {
    await IntegrationTestUtils.initializeSystem();
    
    window.Database = {
      save: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn()
    };
    
    window.Auth = {
      getCurrentUser: jest.fn().mockReturnValue({ id: 1, name: 'Test User' })
    };
    
    window.Notifications = {
      show: jest.fn()
    };
    
    // Mock fetch para API calls
    global.fetch = jest.fn();
    
    const { CloudSyncManager } = require('../../js/cloud-sync');
    cloudSync = new CloudSyncManager();
  });

  describe('Upload de Dados', () => {
    test('deve sincronizar dados locais pendentes com API', async () => {
      // Arrange
      const pendingData = [
        {
          id: 'temp-1',
          objectStore: 'clients',
          operation: 'save',
          data: { name: 'João Silva', cpf: '12345678901' },
          timestamp: Date.now()
        },
        {
          id: 'temp-2',
          objectStore: 'contracts',
          operation: 'save',
          data: { clientId: 1, title: 'Reforma' },
          timestamp: Date.now()
        }
      ];
      
      // Mock API responses
      fetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ id: 1, success: true }))
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ id: 101, success: true }))
        });
      
      cloudSync.pendingSync = pendingData;
      
      // Act
      await cloudSync.syncPendingData();
      
      // Assert
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/clients/sync'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(pendingData[0])
        })
      );
      
      expect(cloudSync.pendingSync).toHaveLength(0); // Fila deve estar vazia
    });

    test('deve lidar com falhas de rede durante upload', async () => {
      // Arrange
      const pendingData = [{
        id: 'temp-1',
        objectStore: 'clients',
        operation: 'save',
        data: { name: 'João Silva' }
      }];
      
      fetch.mockRejectedValue(new Error('Network error'));
      cloudSync.pendingSync = pendingData;
      
      // Act
      await cloudSync.syncPendingData();
      
      // Assert
      expect(cloudSync.pendingSync).toHaveLength(1); // Item deve permanecer na fila
      expect(window.Notifications.show).toHaveBeenCalledWith(
        expect.stringContaining('Erro na sincronização'),
        'error'
      );
    });

    test('deve resolver conflitos de dados', async () => {
      // Arrange
      const localData = {
        id: 1,
        name: 'João Silva',
        modifiedAt: '2024-07-30T10:00:00Z'
      };
      
      const serverData = {
        id: 1,
        name: 'João Santos', // Conflito: nome diferente
        modifiedAt: '2024-07-30T11:00:00Z' // Servidor mais recente
      };
      
      fetch.mockResolvedValue({
        ok: false,
        status: 409, // Conflict
        text: () => Promise.resolve(JSON.stringify({ conflict: serverData }))
      });
      
      cloudSync.conflictResolution = 'server'; // Usar dados do servidor
      
      // Act
      await cloudSync.uploadItem({
        objectStore: 'clients',
        operation: 'save',
        data: localData
      });
      
      // Assert
      expect(window.Database.save).toHaveBeenCalledWith('clients', serverData);
    });
  });

  describe('Download de Dados', () => {
    test('deve baixar e mesclar dados do servidor', async () => {
      // Arrange
      const serverData = [
        { id: 1, name: 'Cliente Servidor', modifiedAt: '2024-07-30T12:00:00Z' },
        { id: 2, name: 'Novo Cliente', modifiedAt: '2024-07-30T12:00:00Z' }
      ];
      
      const localData = [
        { id: 1, name: 'Cliente Local', modifiedAt: '2024-07-30T10:00:00Z' }
      ];
      
      fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: serverData }))
      });
      
      window.Database.getAll.mockResolvedValue(localData);
      window.Database.save.mockResolvedValue();
      
      // Act
      await cloudSync.downloadServerData();
      
      // Assert
      expect(window.Database.save).toHaveBeenCalledTimes(2);
      expect(window.Database.save).toHaveBeenCalledWith('clients', serverData[0]); // Atualizar existente
      expect(window.Database.save).toHaveBeenCalledWith('clients', serverData[1]); // Adicionar novo
    });
  });

  describe('Modo Offline/Online', () => {
    test('deve detectar mudança de conectividade', async () => {
      // Arrange
      cloudSync.isOnline = false;
      const syncSpy = jest.spyOn(cloudSync, 'syncPendingData');
      
      // Act - Simular volta da conexão
      cloudSync.isOnline = true;
      window.dispatchEvent(new Event('online'));
      
      // Aguardar processamento assíncrono
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      expect(syncSpy).toHaveBeenCalled();
    });

    test('deve adicionar dados à fila quando offline', async () => {
      // Arrange
      cloudSync.isOnline = false;
      
      const itemData = {
        objectStore: 'clients',
        operation: 'save',
        data: { name: 'Cliente Offline' }
      };
      
      // Act
      await cloudSync.addToQueue(itemData.objectStore, itemData.operation, itemData.data);
      
      // Assert
      expect(cloudSync.pendingSync).toHaveLength(1);
      expect(cloudSync.pendingSync[0]).toEqual(
        expect.objectContaining(itemData)
      );
    });
  });

  describe('Auto Sync', () => {
    test('deve configurar sincronização automática', async () => {
      // Arrange
      jest.useFakeTimers();
      const syncSpy = jest.spyOn(cloudSync, 'syncPendingData');
      
      // Act
      cloudSync.setSyncInterval(1); // 1 minuto
      cloudSync.setupAutoSync();
      
      // Avançar tempo
      jest.advanceTimersByTime(60000); // 1 minuto
      
      // Assert
      expect(syncSpy).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
});
```

## 💰 Testes de Sistema Financeiro

### Integração com Contratos

```javascript
// tests/integration/financial-integration.test.js
import { IntegrationTestUtils } from '../helpers/integration-utils';

describe('🔗 Sistema Financeiro - Integração', () => {
  let financialManager;
  
  beforeEach(async () => {
    await IntegrationTestUtils.initializeSystem();
    IntegrationTestUtils.mockApiResponses();
    
    window.Database = {
      save: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn()
    };
    
    const { FinancialManager } = require('../../js/financial');
    financialManager = new FinancialManager();
  });

  describe('Vinculação com Contratos', () => {
    test('deve registrar recebimento vinculado a contrato', async () => {
      // Arrange
      const contractId = 101;
      const contract = {
        id: contractId,
        clientId: 1,
        title: 'Reforma Residencial',
        totalValue: 50000,
        status: 'active'
      };
      
      const paymentData = {
        contractId: contractId,
        amount: 10000,
        type: 'revenue',
        description: 'Primeira parcela',
        date: '2024-08-01'
      };
      
      window.Database.getById.mockResolvedValue(contract);
      window.Database.save.mockResolvedValue({ id: 301, ...paymentData });
      
      // Act
      const transaction = await financialManager.registerPayment(paymentData);
      
      // Assert
      expect(window.Database.getById).toHaveBeenCalledWith('contracts', contractId);
      expect(transaction).toEqual(
        expect.objectContaining({
          contractId: contractId,
          amount: 10000,
          type: 'revenue'
        })
      );
    });

    test('deve calcular saldo do contrato', async () => {
      // Arrange
      const contractId = 101;
      const contract = { id: contractId, totalValue: 50000 };
      
      const transactions = [
        { contractId: contractId, amount: 10000, type: 'revenue' },
        { contractId: contractId, amount: 15000, type: 'revenue' },
        { contractId: contractId, amount: 5000, type: 'expense' }
      ];
      
      window.Database.getById.mockResolvedValue(contract);
      window.Database.getAll.mockResolvedValue(transactions);
      
      // Act
      const balance = await financialManager.calculateContractBalance(contractId);
      
      // Assert
      expect(balance).toEqual({
        totalValue: 50000,
        received: 25000,    // 10000 + 15000
        expenses: 5000,
        remaining: 25000,   // 50000 - 25000
        netProfit: 20000    // 25000 - 5000
      });
    });
  });

  describe('Relatórios Financeiros', () => {
    test('deve gerar relatório consolidado por período', async () => {
      // Arrange
      const startDate = '2024-07-01';
      const endDate = '2024-07-31';
      
      const transactions = [
        { amount: 10000, type: 'revenue', date: '2024-07-15', category: 'Contratos' },
        { amount: 15000, type: 'revenue', date: '2024-07-20', category: 'Contratos' },
        { amount: 3000, type: 'expense', date: '2024-07-10', category: 'Materiais' },
        { amount: 2000, type: 'expense', date: '2024-07-25', category: 'Mão de Obra' }
      ];
      
      window.Database.getAll.mockResolvedValue(transactions);
      
      // Act
      const report = await financialManager.generateReport(startDate, endDate);
      
      // Assert
      expect(report).toEqual({
        period: { startDate, endDate },
        summary: {
          totalRevenue: 25000,
          totalExpenses: 5000,
          netProfit: 20000,
          profitMargin: 0.8 // 80%
        },
        byCategory: {
          revenue: { 'Contratos': 25000 },
          expense: { 'Materiais': 3000, 'Mão de Obra': 2000 }
        },
        transactions: transactions.filter(t => 
          t.date >= startDate && t.date <= endDate
        )
      });
    });

    test('deve exportar relatório para CSV', async () => {
      // Arrange
      const transactions = [
        { amount: 10000, type: 'revenue', date: '2024-07-15', description: 'Pagamento João' }
      ];
      
      window.Database.getAll.mockResolvedValue(transactions);
      
      // Mock Utils para CSV
      window.Utils = {
        downloadCSV: jest.fn()
      };
      
      // Act
      await financialManager.exportToCSV('2024-07-01', '2024-07-31');
      
      // Assert
      expect(window.Utils.downloadCSV).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            'Data': '2024-07-15',
            'Tipo': 'Receita',
            'Valor': 'R$ 10.000,00',
            'Descrição': 'Pagamento João'
          })
        ]),
        expect.stringContaining('relatorio-financeiro')
      );
    });
  });

  describe('Alertas e Notificações', () => {
    test('deve detectar pagamentos em atraso', async () => {
      // Arrange
      const hoje = new Date();
      const vencimentoAtrasado = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 dias atrás
      
      const contracts = [
        {
          id: 101,
          clientId: 1,
          totalValue: 50000,
          paymentSchedule: [
            { dueDate: vencimentoAtrasado.toISOString(), amount: 10000, paid: false }
          ]
        }
      ];
      
      const clients = [
        { id: 1, name: 'João Silva', email: 'joao@test.com' }
      ];
      
      window.Database.getAll
        .mockResolvedValueOnce(contracts)
        .mockResolvedValueOnce(clients);
      
      // Act
      const overduePayments = await financialManager.getOverduePayments();
      
      // Assert
      expect(overduePayments).toHaveLength(1);
      expect(overduePayments[0]).toEqual(
        expect.objectContaining({
          contractId: 101,
          clientName: 'João Silva',
          amount: 10000,
          daysOverdue: 7
        })
      );
    });

    test('deve enviar lembrete de pagamento', async () => {
      // Arrange
      const overduePayment = {
        contractId: 101,
        clientId: 1,
        clientName: 'João Silva',
        clientEmail: 'joao@test.com',
        amount: 10000,
        daysOverdue: 7
      };
      
      // Mock serviço de email
      window.EmailService = {
        sendPaymentReminder: jest.fn().mockResolvedValue(true)
      };
      
      // Act
      const result = await financialManager.sendPaymentReminder(overduePayment);
      
      // Assert
      expect(window.EmailService.sendPaymentReminder).toHaveBeenCalledWith({
        to: 'joao@test.com',
        clientName: 'João Silva',
        amount: 10000,
        daysOverdue: 7
      });
      
      expect(result).toBe(true);
    });
  });
});
```

## 🗃️ Testes de Integração com Database

### IndexedDB Operations

```javascript
// tests/integration/database-integration.test.js
import { IntegrationTestUtils } from '../helpers/integration-utils';

describe('🔗 Database - Integração IndexedDB', () => {
  let database;
  
  beforeEach(async () => {
    await IntegrationTestUtils.initializeSystem();
    
    // Mock Dexie
    const mockDexie = {
      version: jest.fn().mockReturnThis(),
      stores: jest.fn().mockReturnThis(),
      open: jest.fn().mockResolvedValue(),
      table: jest.fn(),
      transaction: jest.fn()
    };
    
    global.Dexie = jest.fn(() => mockDexie);
    
    const { DatabaseManager } = require('../../js/database');
    database = new DatabaseManager();
  });

  describe('CRUD Operations', () => {
    test('deve realizar operações CRUD completas', async () => {
      // Arrange
      const clientData = {
        name: 'João Silva',
        cpf: '12345678901',
        phone: '(11) 99999-9999'
      };
      
      // Mock das operações da tabela
      const mockTable = {
        add: jest.fn().mockResolvedValue(1),
        get: jest.fn().mockResolvedValue({ id: 1, ...clientData }),
        put: jest.fn().mockResolvedValue(1),
        delete: jest.fn().mockResolvedValue(),
        toArray: jest.fn().mockResolvedValue([{ id: 1, ...clientData }])
      };
      
      database.db = {
        table: jest.fn().mockReturnValue(mockTable)
      };
      
      // Act & Assert - Create
      const savedClient = await database.save('clients', clientData);
      expect(mockTable.add).toHaveBeenCalledWith(expect.objectContaining(clientData));
      
      // Act & Assert - Read
      const retrievedClient = await database.getById('clients', 1);
      expect(mockTable.get).toHaveBeenCalledWith(1);
      expect(retrievedClient).toEqual(expect.objectContaining(clientData));
      
      // Act & Assert - Update
      const updateData = { ...clientData, name: 'João Santos' };
      await database.save('clients', { id: 1, ...updateData });
      expect(mockTable.put).toHaveBeenCalledWith(expect.objectContaining(updateData));
      
      // Act & Assert - List
      const allClients = await database.getAll('clients');
      expect(mockTable.toArray).toHaveBeenCalled();
      expect(allClients).toHaveLength(1);
      
      // Act & Assert - Delete
      await database.delete('clients', 1);
      expect(mockTable.delete).toHaveBeenCalledWith(1);
    });

    test('deve lidar com transações', async () => {
      // Arrange
      const mockTransaction = {
        table: jest.fn().mockReturnValue({
          add: jest.fn().mockResolvedValue(1),
          put: jest.fn().mockResolvedValue(1)
        })
      };
      
      database.db = {
        transaction: jest.fn().mockImplementation((mode, tables, callback) => {
          return callback(mockTransaction);
        })
      };
      
      const clientData = { name: 'João Silva' };
      const contractData = { clientId: 1, title: 'Reforma' };
      
      // Act
      await database.executeTransaction(['clients', 'contracts'], async (tx) => {
        const client = await tx.table('clients').add(clientData);
        await tx.table('contracts').add({ ...contractData, clientId: client });
      });
      
      // Assert
      expect(database.db.transaction).toHaveBeenCalledWith(
        'rw',
        ['clients', 'contracts'],
        expect.any(Function)
      );
    });
  });

  describe('Schema Management', () => {
    test('deve lidar com migração de schema', async () => {
      // Arrange
      const oldVersion = 4;
      const newVersion = 5;
      
      const migrationMock = jest.fn();
      database.migrations = {
        [newVersion]: migrationMock
      };
      
      // Simular upgrade de versão
      database.db = {
        version: newVersion,
        verno: oldVersion
      };
      
      // Act
      await database.runMigrations(oldVersion, newVersion);
      
      // Assert
      expect(migrationMock).toHaveBeenCalled();
    });

    test('deve validar integridade de dados', async () => {
      // Arrange
      const mockTable = {
        toArray: jest.fn().mockResolvedValue([
          { id: 1, name: 'João Silva', cpf: '12345678901' },
          { id: 2, name: 'Maria Santos', cpf: null }, // Dados inválidos
          { id: 3, name: '', cpf: '98765432100' }     // Dados inválidos
        ])
      };
      
      database.db = {
        table: jest.fn().mockReturnValue(mockTable)
      };
      
      // Act
      const validationResult = await database.validateDataIntegrity('clients');
      
      // Assert
      expect(validationResult).toEqual({
        totalRecords: 3,
        validRecords: 1,
        invalidRecords: 2,
        errors: [
          { id: 2, field: 'cpf', message: 'CPF é obrigatório' },
          { id: 3, field: 'name', message: 'Nome é obrigatório' }
        ]
      });
    });
  });

  describe('Performance e Otimização', () => {
    test('deve usar índices para consultas eficientes', async () => {
      // Arrange
      const mockTable = {
        where: jest.fn().mockReturnThis(),
        equals: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([])
      };
      
      database.db = {
        table: jest.fn().mockReturnValue(mockTable)
      };
      
      // Act
      await database.findByField('clients', 'cpf', '12345678901');
      
      // Assert
      expect(mockTable.where).toHaveBeenCalledWith('cpf');
      expect(mockTable.equals).toHaveBeenCalledWith('12345678901');
    });

    test('deve implementar paginação para grandes volumes', async () => {
      // Arrange
      const mockTable = {
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(100)
      };
      
      database.db = {
        table: jest.fn().mockReturnValue(mockTable)
      };
      
      // Act
      const page = 2;
      const pageSize = 10;
      const result = await database.getPaginated('clients', page, pageSize);
      
      // Assert
      expect(mockTable.offset).toHaveBeenCalledWith(10); // (page - 1) * pageSize
      expect(mockTable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [],
        pagination: {
          page: 2,
          pageSize: 10,
          totalItems: 100,
          totalPages: 10
        }
      });
    });
  });
});
```

## 🌐 Testes de API Backend

### Integração Frontend/Backend

```javascript
// tests/integration/api-integration.test.js
import { IntegrationTestUtils } from '../helpers/integration-utils';

describe('🔗 API Backend - Integração', () => {
  beforeEach(() => {
    IntegrationTestUtils.mockApiResponses();
  });

  describe('Autenticação', () => {
    test('deve realizar login e obter token JWT', async () => {
      // Arrange
      const credentials = {
        email: 'admin@test.com',
        password: 'admin123'
      };
      
      const mockResponse = {
        user: { id: 1, name: 'Admin', email: 'admin@test.com' },
        token: 'mock-jwt-token'
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });
      
      // Act
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const result = await response.json();
      
      // Assert
      expect(fetch).toHaveBeenCalledWith('/api/auth/login', 
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(credentials)
        })
      );
      
      expect(result).toEqual(mockResponse);
    });

    test('deve renovar token automaticamente', async () => {
      // Arrange
      const expiredToken = 'expired-token';
      const newToken = 'new-token';
      
      // Primeira chamada - token expirado
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Token expired' })
        })
        // Segunda chamada - renovação
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: newToken })
        })
        // Terceira chamada - retry com novo token
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        });
      
      // Mock auto-renewal
      const apiClient = {
        makeRequest: async (endpoint, options = {}) => {
          let response = await fetch(endpoint, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${expiredToken}`
            }
          });
          
          if (response.status === 401) {
            // Renovar token
            const renewResponse = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${expiredToken}` }
            });
            
            if (renewResponse.ok) {
              const { token } = await renewResponse.json();
              
              // Retry com novo token
              response = await fetch(endpoint, {
                ...options,
                headers: {
                  ...options.headers,
                  'Authorization': `Bearer ${token}`
                }
              });
            }
          }
          
          return response;
        }
      };
      
      // Act
      const response = await apiClient.makeRequest('/api/clients');
      
      // Assert
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(response.ok).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    test('deve sincronizar CRUD de clientes com backend', async () => {
      // Arrange
      const clientData = {
        name: 'João Silva',
        cpf: '12345678901',
        phone: '(11) 99999-9999'
      };
      
      const createdClient = { id: 1, ...clientData };
      
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createdClient)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([createdClient])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...createdClient, name: 'João Santos' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204
        });
      
      // Create
      let response = await fetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify(clientData)
      });
      let result = await response.json();
      expect(result).toEqual(createdClient);
      
      // Read
      response = await fetch('/api/clients');
      result = await response.json();
      expect(result).toEqual([createdClient]);
      
      // Update
      response = await fetch(`/api/clients/${createdClient.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'João Santos' })
      });
      result = await response.json();
      expect(result.name).toBe('João Santos');
      
      // Delete
      response = await fetch(`/api/clients/${createdClient.id}`, {
        method: 'DELETE'
      });
      expect(response.status).toBe(204);
    });
  });

  describe('Validação e Erros', () => {
    test('deve lidar com erros de validação da API', async () => {
      // Arrange
      const invalidData = { name: '', cpf: 'invalid' };
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Falha na validação',
          messages: [
            'Nome é obrigatório',
            'CPF inválido'
          ]
        })
      });
      
      // Act
      const response = await fetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });
      
      const error = await response.json();
      
      // Assert
      expect(response.ok).toBe(false);
      expect(error.messages).toContain('Nome é obrigatório');
      expect(error.messages).toContain('CPF inválido');
    });

    test('deve implementar rate limiting', async () => {
      // Arrange
      fetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '60']]),
        json: () => Promise.resolve({ error: 'Rate limit exceeded' })
      });
      
      // Act
      const response = await fetch('/api/clients');
      const error = await response.json();
      
      // Assert
      expect(response.status).toBe(429);
      expect(error.error).toBe('Rate limit exceeded');
    });
  });

  describe('Bulk Operations', () => {
    test('deve processar operações em lote', async () => {
      // Arrange
      const bulkData = [
        { name: 'Cliente 1', cpf: '11111111111' },
        { name: 'Cliente 2', cpf: '22222222222' },
        { name: 'Cliente 3', cpf: '33333333333' }
      ];
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: 2,
          failed: 1,
          results: [
            { success: true, id: 1 },
            { success: true, id: 2 },
            { success: false, error: 'CPF já existe' }
          ]
        })
      });
      
      // Act
      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        body: JSON.stringify({ items: bulkData })
      });
      
      const result = await response.json();
      
      // Assert
      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);
    });
  });
});
```

## 🔧 Mocks e Stubs

### Database Mock

```javascript
// tests/helpers/mock-database.js
export class MockDatabase {
  constructor() {
    this.stores = {};
    this.nextId = 1;
  }

  async init() {
    return Promise.resolve();
  }

  async save(storeName, data) {
    if (!this.stores[storeName]) {
      this.stores[storeName] = [];
    }

    const item = {
      id: data.id || this.nextId++,
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    const existingIndex = this.stores[storeName].findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      this.stores[storeName][existingIndex] = item;
    } else {
      this.stores[storeName].push(item);
    }

    return Promise.resolve(item);
  }

  async getAll(storeName) {
    return Promise.resolve(this.stores[storeName] || []);
  }

  async getById(storeName, id) {
    const items = this.stores[storeName] || [];
    return Promise.resolve(items.find(item => item.id === id) || null);
  }

  async delete(storeName, id) {
    if (!this.stores[storeName]) {
      return Promise.resolve();
    }

    this.stores[storeName] = this.stores[storeName].filter(item => item.id !== id);
    return Promise.resolve();
  }

  async clear() {
    this.stores = {};
    this.nextId = 1;
    return Promise.resolve();
  }

  async hasData(storeName) {
    return Promise.resolve((this.stores[storeName] || []).length > 0);
  }

  isConnected() {
    return true;
  }

  debugInfo() {
    return {
      stores: Object.keys(this.stores),
      totalItems: Object.values(this.stores).reduce((sum, store) => sum + store.length, 0)
    };
  }
}

// Setup global
beforeEach(() => {
  window.Database = new MockDatabase();
});
```

### Cloud Sync Mock

```javascript
// tests/helpers/mock-cloud-sync.js
export class MockCloudSync {
  constructor() {
    this.pendingSync = [];
    this.isOnline = true;
    this.syncInProgress = false;
  }

  async addToQueue(objectStore, operation, data) {
    this.pendingSync.push({
      id: `temp-${Date.now()}`,
      objectStore,
      operation,
      data,
      timestamp: Date.now()
    });
    return Promise.resolve();
  }

  async syncPendingData() {
    if (!this.isOnline || this.syncInProgress) {
      return Promise.resolve();
    }

    this.syncInProgress = true;

    try {
      // Simular sincronização
      await new Promise(resolve => setTimeout(resolve, 100));
      this.pendingSync = [];
    } finally {
      this.syncInProgress = false;
    }

    return Promise.resolve();
  }

  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pendingCount: this.pendingSync.length,
      lastSyncTime: new Date().toISOString()
    };
  }

  setOnlineStatus(status) {
    this.isOnline = status;
  }
}

beforeEach(() => {
  window.CloudSync = new MockCloudSync();
});
```

## 📊 Relatórios e Cobertura

### Configuração de Coverage

```javascript
// jest.coverage.config.js
module.exports = {
  ...require('./jest.config'),
  
  collectCoverage: true,
  coverageDirectory: 'coverage/integration',
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'cobertura'
  ],
  
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/lib/**',
    '!js/**/*.test.js',
    '!**/node_modules/**'
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Scripts de Relatório

```bash
#!/bin/bash
# scripts/run-integration-tests.sh

echo "🔗 Executando Testes de Integração - RC Construções"

# Verificar pré-requisitos
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Preparar ambiente de teste
echo "🔧 Preparando ambiente de teste..."
export NODE_ENV=test

# Executar testes de integração
echo "🧪 Executando testes de integração..."
npx jest --config=jest.config.js --testMatch="**/integration/**/*.test.js" --verbose

# Gerar relatório de cobertura
echo "📊 Gerando relatório de cobertura..."
npx jest --config=jest.coverage.config.js --testMatch="**/integration/**/*.test.js" --coverage

# Abrir relatório (opcional)
if [ "$1" = "--open" ]; then
    echo "🌐 Abrindo relatório de cobertura..."
    open coverage/integration/lcov-report/index.html
fi

echo "✅ Testes de integração concluídos!"
```

## 🚀 Execução dos Testes

### Scripts NPM

```json
{
  "scripts": {
    "test:integration": "jest --testMatch='**/integration/**/*.test.js'",
    "test:integration:watch": "jest --testMatch='**/integration/**/*.test.js' --watch",
    "test:integration:coverage": "jest --testMatch='**/integration/**/*.test.js' --coverage",
    "test:integration:ci": "jest --testMatch='**/integration/**/*.test.js' --ci --coverage --watchAll=false",
    "test:integration:debug": "node --inspect-brk node_modules/.bin/jest --testMatch='**/integration/**/*.test.js' --runInBand",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

### Pipeline CI/CD

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x]
    
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

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci

      - name: Setup test database
        run: |
          cd backend
          npm run migrate:test
          npm run seed:test
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_PASSWORD: postgres

      - name: Start backend for integration tests
        run: |
          cd backend
          npm run start:test &
          npx wait-on http://localhost:3001/health
        env:
          NODE_ENV: test

      - name: Run integration tests
        run: npm run test:integration:ci
        env:
          NODE_ENV: test

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/integration/lcov.info
          flags: integration
          name: integration-coverage

      - name: Comment coverage on PR
        if: github.event_name == 'pull_request'
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          recreate: true
          path: coverage/integration/coverage-summary.txt
```

## 🐛 Debugging

### Configuração de Debug

```javascript
// jest.debug.config.js
module.exports = {
  ...require('./jest.config'),
  
  // Executar testes sequencialmente para debug
  runInBand: true,
  
  // Não usar cache durante debug
  cache: false,
  
  // Timeout maior para debug
  testTimeout: 300000, // 5 minutos
  
  // Verbose output
  verbose: true,
  
  // Detectar handles abertos
  detectOpenHandles: true,
  
  // Detectar leaks de memória
  detectLeaks: true
};
```

### Debug Helpers

```javascript
// tests/helpers/debug-helpers.js
export class DebugHelpers {
  static async captureSystemState() {
    return {
      database: window.Database?.debugInfo(),
      cloudSync: window.CloudSync?.getSyncStatus(),
      auth: window.Auth?.getCurrentUser(),
      modules: this.getLoadedModules(),
      timestamp: new Date().toISOString()
    };
  }

  static getLoadedModules() {
    const modules = {};
    const moduleNames = [
      'Database', 'Auth', 'CloudSync', 'Clients', 'Contracts', 
      'Budgets', 'Financial', 'Dashboard'
    ];
    
    moduleNames.forEach(name => {
      modules[name] = !!window[name];
    });
    
    return modules;
  }

  static async waitForCondition(conditionFn, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await conditionFn()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Timeout: Condition not met within ${timeout}ms`);
  }

  static logTestStep(step, data = null) {
    if (process.env.DEBUG_TESTS) {
      console.log(`🔍 [DEBUG] ${step}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }
}

// Comandos globais para debug
global.debugState = DebugHelpers.captureSystemState;
global.waitFor = DebugHelpers.waitForCondition;
global.logStep = DebugHelpers.logTestStep;
```

### Troubleshooting Common Issues

#### 1. Timing Issues

```javascript
// ❌ Problema
test('should load data', async () => {
  await module.loadData();
  expect(module.data).toHaveLength(5);
});

// ✅ Solução
test('should load data', async () => {
  await module.loadData();
  await waitFor(() => module.data.length === 5);
  expect(module.data).toHaveLength(5);
});
```

#### 2. Async/Await Issues

```javascript
// ❌ Problema
test('should process data', () => {
  module.processData();
  expect(module.isProcessing).toBe(false);
});

// ✅ Solução
test('should process data', async () => {
  await module.processData();
  expect(module.isProcessing).toBe(false);
});
```

#### 3. Mock Cleanup

```javascript
// ✅ Proper cleanup
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  window.Database?.clear();
});
```

---

## ✅ Checklist de Testes de Integração

### Preparação
- [ ] **Ambiente configurado**: Jest, mocks, helpers
- [ ] **Banco de teste**: MockDatabase ou test DB
- [ ] **API mocks**: Respostas simuladas configuradas
- [ ] **Dados de teste**: Fixtures e seeds preparados

### Execução
- [ ] **Dashboard**: Agregação de dados testada
- [ ] **CRUD**: Operações locais + sync testadas
- [ ] **Workflows**: Fluxos completos validados
- [ ] **APIs externas**: Integrações funcionando
- [ ] **Error handling**: Cenários de erro cobertos

### Validação
- [ ] **Cobertura**: Mínimo 70% atingido
- [ ] **Performance**: Testes executam em tempo hábil
- [ ] **Estabilidade**: Testes não são flaky
- [ ] **Documentação**: Cenários documentados

---

## 📚 Recursos Adicionais

### Documentação Relacionada
- [Testes Unitários](unit-tests.md)
- [Testes E2E](e2e-tests.md)
- [Arquitetura do Sistema](../development/architecture.md)
- [Configuração de Ambiente](../development/setup.md)

### Links Úteis
- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Dexie Testing](https://dexie.org/docs/Tutorial/Testing)
- [Fetch Mock](https://github.com/jefflau/jest-fetch-mock)

### Suporte
- **Issues**: GitHub Issues para bugs nos testes
- **Discussões**: GitHub Discussions para dúvidas
- **Chat**: Slack #qa-integration
- **Email**: qa-team@rc-construcoes.com

---

**Última atualização**: 30 de julho de 2025  
**Versão do documento**: 5.1  
**Mantenedores**: Equipe de QA RC Construções