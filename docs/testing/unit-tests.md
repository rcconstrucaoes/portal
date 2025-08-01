# 🧪 Guia de Testes Unitários - RC Construções

Este documento oferece um guia completo para a execução e criação de testes unitários no sistema RC Construções v5.1. O sistema utiliza Jest como framework principal de testes para garantir a qualidade e confiabilidade do código.

## 📋 Índice

- [Configuração do Ambiente](#-configuração-do-ambiente)
- [Estrutura de Testes](#-estrutura-de-testes)
- [Executando Testes](#-executando-testes)
- [Testes por Módulo](#-testes-por-módulo)
- [Mocks e Utilitários](#-mocks-e-utilitários)
- [Cobertura de Código](#-cobertura-de-código)
- [Boas Práticas](#-boas-práticas)
- [Troubleshooting](#-troubleshooting)

## ⚙️ Configuração do Ambiente

### Pré-requisitos

```bash
# Instalar dependências de teste
npm install --save-dev jest @types/jest jsdom
npm install --save-dev @testing-library/dom @testing-library/user-event
```

### Configuração Jest (jest.config.js)

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/lib/**',
    '!js/demo.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  globals: {
    window: {},
    document: {},
    localStorage: {},
    sessionStorage: {}
  }
};
```

## 📁 Estrutura de Testes

```
tests/
├── unit/                          # Testes unitários
│   ├── auth.test.js              # Testes de autenticação
│   ├── database.test.js          # Testes do banco de dados
│   ├── security.test.js          # Testes de segurança
│   ├── validation.test.js        # Testes de validação
│   ├── utils.test.js             # Testes de utilitários
│   ├── charts.test.js            # Testes de gráficos
│   └── logger.test.js            # Testes de logging
├── fixtures/                     # Dados de teste
│   ├── clients.json
│   ├── contracts.json
│   ├── budgets.json
│   └── users.json
├── helpers/                      # Utilitários de teste
│   ├── mock-database.js
│   ├── mock-auth.js
│   └── test-utils.js
└── setup.js                     # Configuração global
```

## ▶️ Executando Testes

### Comandos Básicos

```bash
# Executar todos os testes unitários
npm test

# Executar testes específicos
npm test auth.test.js

# Executar testes com cobertura
npm run test:coverage

# Executar testes em modo watch
npm run test:watch

# Executar testes com verbose
npm test -- --verbose
```

### Scripts Package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:debug": "jest --runInBand --no-cache"
  }
}
```

## 🧪 Testes por Módulo

### 1. Testes de Autenticação (auth.test.js)

```javascript
// tests/unit/auth.test.js
describe('Sistema de Autenticação', () => {
  let authManager;
  
  beforeEach(() => {
    // Mock do Database
    window.Database = {
      getAll: jest.fn(),
      save: jest.fn(),
      init: jest.fn()
    };
    
    authManager = new AuthManager();
  });

  describe('Login', () => {
    test('deve autenticar usuário com credenciais válidas', async () => {
      // Arrange
      const mockUser = {
        id: '1',
        username: 'admin',
        password: 'admin123',
        name: 'Administrador',
        role: 'admin'
      };
      
      window.Database.getAll.mockResolvedValue([mockUser]);
      
      // Act
      const session = await authManager.login('admin', 'admin123');
      
      // Assert
      expect(session).toBeDefined();
      expect(session.user.username).toBe('admin');
      expect(session.token).toBeDefined();
    });

    test('deve rejeitar credenciais inválidas', async () => {
      // Arrange
      window.Database.getAll.mockResolvedValue([]);
      
      // Act & Assert
      await expect(authManager.login('invalid', 'wrong'))
        .rejects.toThrow('Usuário não encontrado');
    });
  });

  describe('Sessão', () => {
    test('deve criar sessão válida', () => {
      // Arrange
      const user = {
        id: '1',
        username: 'test',
        name: 'Test User',
        role: 'user'
      };
      
      // Act
      const session = authManager.createSession(user);
      
      // Assert
      expect(session.userId).toBe('1');
      expect(session.token).toBeDefined();
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });
  });
});
```

### 2. Testes de Database (database.test.js)

```javascript
// tests/unit/database.test.js
describe('Sistema de Database', () => {
  let database;
  
  beforeEach(async () => {
    // Mock do Dexie
    global.Dexie = class MockDexie {
      constructor() {
        this.version = jest.fn().mockReturnThis();
        this.stores = jest.fn().mockReturnThis();
        this.open = jest.fn().mockResolvedValue(this);
      }
    };
    
    const { DatabaseManager } = require('../../js/database.js');
    database = new DatabaseManager();
    await database.init();
  });

  test('deve inicializar o banco de dados', () => {
    expect(database.db).toBeDefined();
    expect(database.isConnected).toBe(true);
  });

  test('deve salvar dados corretamente', async () => {
    // Arrange
    const testData = { id: '1', name: 'Test Client' };
    
    // Mock do método add
    database.db.clients = {
      add: jest.fn().mockResolvedValue('1'),
      put: jest.fn().mockResolvedValue('1')
    };
    
    // Act
    const result = await database.save('clients', testData);
    
    // Assert
    expect(result).toBe('1');
    expect(database.db.clients.add).toHaveBeenCalledWith(testData);
  });

  test('deve buscar todos os registros', async () => {
    // Arrange
    const mockData = [
      { id: '1', name: 'Client 1' },
      { id: '2', name: 'Client 2' }
    ];
    
    database.db.clients = {
      toArray: jest.fn().mockResolvedValue(mockData)
    };
    
    // Act
    const result = await database.getAll('clients');
    
    // Assert
    expect(result).toEqual(mockData);
    expect(result.length).toBe(2);
  });
});
```

### 3. Testes de Validação (validation.test.js)

```javascript
// tests/unit/validation.test.js
describe('Sistema de Validação', () => {
  let validation;
  
  beforeEach(() => {
    validation = new ValidationManager();
  });

  describe('Validação de Email', () => {
    test('deve validar emails corretos', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.com.br',
        'admin@rc-construcoes.com'
      ];
      
      validEmails.forEach(email => {
        expect(validation.validateEmail(email)).toBe(true);
      });
    });

    test('deve rejeitar emails inválidos', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user name@domain.com'
      ];
      
      invalidEmails.forEach(email => {
        expect(validation.validateEmail(email)).toBe(false);
      });
    });
  });

  describe('Validação de CPF/CNPJ', () => {
    test('deve validar CPF correto', () => {
      const validCPF = '123.456.789-09';
      expect(validation.validateCPF(validCPF)).toBe(true);
    });

    test('deve validar CNPJ correto', () => {
      const validCNPJ = '12.345.678/0001-90';
      expect(validation.validateCNPJ(validCNPJ)).toBe(true);
    });
  });

  describe('Validação de Formulários', () => {
    test('deve validar dados de cliente', () => {
      const clientData = {
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '(11) 99999-9999',
        document: '123.456.789-09'
      };
      
      const result = validation.validateClient(clientData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('deve identificar erros em dados inválidos', () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
        phone: '123',
        document: '000.000.000-00'
      };
      
      const result = validation.validateClient(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
```

### 4. Testes de Utilitários (utils.test.js)

```javascript
// tests/unit/utils.test.js
describe('Utilitários do Sistema', () => {
  let utils;
  
  beforeEach(() => {
    utils = new UtilsManager();
  });

  describe('Formatação', () => {
    test('deve formatar valores monetários', () => {
      expect(utils.formatCurrency(1000)).toBe('R$ 1.000,00');
      expect(utils.formatCurrency(50.5)).toBe('R$ 50,50');
      expect(utils.formatCurrency(0)).toBe('R$ 0,00');
    });

    test('deve formatar datas', () => {
      const date = new Date('2023-12-25');
      expect(utils.formatDate(date)).toBe('25/12/2023');
    });

    test('deve formatar telefones', () => {
      expect(utils.formatPhone('11999999999')).toBe('(11) 99999-9999');
      expect(utils.formatPhone('1133334444')).toBe('(11) 3333-4444');
    });
  });

  describe('Cálculos', () => {
    test('deve calcular percentuais', () => {
      expect(utils.calculatePercentage(50, 200)).toBe(25);
      expect(utils.calculatePercentage(0, 100)).toBe(0);
    });

    test('deve calcular totais de orçamento', () => {
      const items = [
        { quantity: 2, price: 100 },
        { quantity: 3, price: 50 },
        { quantity: 1, price: 75 }
      ];
      
      expect(utils.calculateBudgetTotal(items)).toBe(425);
    });
  });

  describe('Validação de Dados', () => {
    test('deve identificar objetos vazios', () => {
      expect(utils.isEmpty({})).toBe(true);
      expect(utils.isEmpty({ name: 'test' })).toBe(false);
      expect(utils.isEmpty([])).toBe(true);
      expect(utils.isEmpty([1, 2, 3])).toBe(false);
    });

    test('deve gerar IDs únicos', () => {
      const id1 = utils.generateId();
      const id2 = utils.generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });
});
```

### 5. Testes de Segurança (security.test.js)

```javascript
// tests/unit/security.test.js
describe('Sistema de Segurança', () => {
  let security;
  
  beforeEach(() => {
    security = new SecurityManager();
  });

  describe('Sanitização', () => {
    test('deve sanitizar entrada de usuário', () => {
      const input = '<script>alert("xss")</script>João';
      const sanitized = security.sanitizeInput(input);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('João');
    });

    test('deve validar tokens', () => {
      const validToken = security.generateToken();
      expect(security.validateToken(validToken)).toBe(true);
      
      const invalidToken = 'invalid-token';
      expect(security.validateToken(invalidToken)).toBe(false);
    });
  });

  describe('Criptografia', () => {
    test('deve hash de senhas', async () => {
      const password = 'minhasenha123';
      const hash = await security.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(password.length);
    });

    test('deve verificar senhas hasheadas', async () => {
      const password = 'testpassword';
      const hash = await security.hashPassword(password);
      
      const isValid = await security.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await security.verifyPassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });
});
```

## 🎭 Mocks e Utilitários

### Mock Database (tests/helpers/mock-database.js)

```javascript
// tests/helpers/mock-database.js
export class MockDatabase {
  constructor() {
    this.stores = {
      clients: [],
      contracts: [],
      budgets: [],
      users: []
    };
  }

  async getAll(storeName) {
    return this.stores[storeName] || [];
  }

  async save(storeName, data) {
    if (!this.stores[storeName]) {
      this.stores[storeName] = [];
    }
    
    const id = data.id || Date.now().toString();
    const item = { ...data, id };
    
    this.stores[storeName].push(item);
    return id;
  }

  async delete(storeName, id) {
    if (this.stores[storeName]) {
      this.stores[storeName] = this.stores[storeName].filter(item => item.id !== id);
      return true;
    }
    return false;
  }

  clear() {
    Object.keys(this.stores).forEach(key => {
      this.stores[key] = [];
    });
  }
}
```

### Test Utils (tests/helpers/test-utils.js)

```javascript
// tests/helpers/test-utils.js
export const testUtils = {
  // Criar dados de teste
  createTestClient: (overrides = {}) => ({
    id: '1',
    name: 'Cliente Teste',
    email: 'teste@email.com',
    phone: '(11) 99999-9999',
    document: '123.456.789-09',
    ...overrides
  }),

  createTestContract: (overrides = {}) => ({
    id: '1',
    clientId: '1',
    title: 'Contrato Teste',
    value: 10000,
    status: 'active',
    ...overrides
  }),

  // Aguardar elemento no DOM
  waitForElement: (selector, timeout = 1000) => {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Elemento ${selector} não encontrado`));
      }, timeout);
    });
  },

  // Mock de eventos
  mockEvent: (type, options = {}) => {
    return new Event(type, {
      bubbles: true,
      cancelable: true,
      ...options
    });
  }
};
```

## 📊 Cobertura de Código

### Configuração de Cobertura

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/lib/**',
    '!js/demo.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './js/core/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

### Relatórios de Cobertura

```bash
# Gerar relatório HTML
npm run test:coverage

# Visualizar relatório
open coverage/lcov-report/index.html
```

## ✅ Boas Práticas

### Estrutura de Testes

1. **Organização AAA (Arrange, Act, Assert)**
```javascript
test('deve fazer algo específico', () => {
  // Arrange - Preparar os dados
  const input = 'test input';
  const expected = 'expected output';
  
  // Act - Executar a ação
  const result = functionUnderTest(input);
  
  // Assert - Verificar o resultado
  expect(result).toBe(expected);
});
```

2. **Nomes Descritivos**
```javascript
// ✅ Bom
test('deve retornar erro quando email é inválido')

// ❌ Ruim
test('test email validation')
```

3. **Um Teste, Uma Responsabilidade**
```javascript
// ✅ Bom - cada teste verifica uma coisa específica
test('deve validar email válido')
test('deve rejeitar email sem @')
test('deve rejeitar email sem domínio')

// ❌ Ruim - teste fazendo muitas verificações
test('deve validar emails')
```

### Mocks Eficientes

1. **Mock apenas o necessário**
```javascript
// ✅ Bom
const mockDatabase = {
  save: jest.fn().mockResolvedValue('1'),
  getAll: jest.fn().mockResolvedValue([])
};

// ❌ Ruim - mock de tudo
const mockDatabase = {
  save: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  // ... outros métodos não utilizados
};
```

2. **Limpar mocks entre testes**
```javascript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Testes Determinísticos

```javascript
// ✅ Bom - controlar o tempo
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2023-01-01'));
});

afterAll(() => {
  jest.useRealTimers();
});

// ❌ Ruim - depender do tempo real
test('deve criar timestamp', () => {
  const result = createTimestamp();
  expect(result).toBe(Date.now()); // Pode falhar
});
```

## 🔧 Troubleshooting

### Problemas Comuns

1. **Erro: ReferenceError: window is not defined**
```javascript
// Solução: Adicionar no jest.config.js
testEnvironment: 'jsdom'
```

2. **Mocks não funcionam**
```javascript
// Solução: Verificar ordem de imports
jest.mock('./module', () => ({
  default: jest.fn()
}));

// Import após o mock
const Module = require('./module');
```

3. **Testes assíncronos não funcionam**
```javascript
// ✅ Bom - aguardar promise
test('async test', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// ❌ Ruim - não aguardar
test('async test', () => {
  asyncFunction().then(result => {
    expect(result).toBeDefined(); // Pode não executar
  });
});
```

### Debug de Testes

```bash
# Executar teste específico com debug
npm test -- --testNamePattern="nome do teste" --verbose

# Executar com debug do Node.js
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📈 Métricas de Qualidade

### Objetivos de Cobertura

- **Core Modules**: 90%+ cobertura
- **Business Logic**: 85%+ cobertura
- **Utils/Helpers**: 80%+ cobertura
- **UI Components**: 70%+ cobertura

### Execução Contínua

```bash
# Script para CI/CD
#!/bin/bash
npm test -- --coverage --watchAll=false
if [ $? -eq 0 ]; then
  echo "✅ Todos os testes passaram"
else
  echo "❌ Testes falharam"
  exit 1
fi
```

---

## 📚 Recursos Adicionais

- [Documentação Jest](https://jestjs.io/docs/)
- [Testing Library](https://testing-library.com/)
- [Guia de Integration Tests](./integration-tests.md)
- [Guia de E2E Tests](./e2e-tests.md)

---

**RC Construções v5.1** - Sistema de Gestão de Construção Civil  
*Documentação de Testes Unitários*