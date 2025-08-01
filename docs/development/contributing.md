# 📋 Contributing Guide - RC Construções

## 🎯 Welcome Contributors!

Obrigado pelo seu interesse em contribuir para o projeto RC Construções! Este guia fornece todas as informações necessárias para contribuir de forma efetiva e seguir nossos padrões de qualidade.

## 📖 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Development Workflow](#-development-workflow)
- [Coding Standards](#-coding-standards)
- [Testing Guidelines](#-testing-guidelines)
- [Documentation Standards](#-documentation-standards)
- [Pull Request Process](#-pull-request-process)
- [Issue Guidelines](#-issue-guidelines)
- [Release Process](#-release-process)

## 🤝 Code of Conduct

### Our Standards

Nosso projeto adota os seguintes princípios para criar um ambiente colaborativo e respeitoso:

#### ✅ **Comportamentos Esperados**
- **Respeito**: Tratar todos os membros com cortesia e profissionalismo
- **Inclusividade**: Valorizar diversas perspectivas e experiências
- **Colaboração**: Trabalhar em conjunto para alcançar objetivos comuns
- **Construtividade**: Fornecer feedback útil e específico
- **Transparência**: Comunicar-se de forma clara e honesta

#### ❌ **Comportamentos Inaceitáveis**
- Linguagem ofensiva, discriminatória ou inadequada
- Assédio de qualquer tipo
- Ataques pessoais ou trolling
- Spam ou autopromoção excessiva
- Violação de privacidade ou confidencialidade

### Enforcement

Violações do código de conduta devem ser reportadas para [conduct@rc-construcoes.com](mailto:conduct@rc-construcoes.com). Todas as denúncias serão investigadas e tratadas apropriadamente.

## 🚀 Getting Started

### Prerequisites

Antes de contribuir, certifique-se de ter:

- **Node.js** v18.0+ instalado
- **Git** configurado com sua identidade
- **Editor** configurado com ESLint e Prettier
- Familiaridade com **JavaScript ES6+**, **HTML5**, **CSS3**

### Initial Setup

```bash
# 1. Fork do repositório no GitHub
# Click no botão "Fork" na página do projeto

# 2. Clone seu fork
git clone https://github.com/SEU_USERNAME/rc-construcoes.git
cd rc-construcoes

# 3. Adicione o repositório original como upstream
git remote add upstream https://github.com/rc-construcoes/rc-construcoes.git

# 4. Instale dependências
npm install

# 5. Configure seu ambiente
cp .env.example .env
# Edite o arquivo .env conforme necessário

# 6. Execute os testes para verificar se tudo está funcionando
npm test

# 7. Inicie o servidor de desenvolvimento
npm start
```

### Project Structure Familiarization

```
rc-construcoes/
├── js/
│   ├── core/           # Módulos essenciais (auth, database, security)
│   ├── modules/        # Módulos de funcionalidade (clients, contracts)
│   └── utils/          # Utilitários específicos
├── css/                # Estilos organizados por componente
├── tests/              # Testes unitários, integração e E2E
├── docs/               # Documentação do projeto
└── scripts/            # Scripts de automação
```

## 🔄 Development Workflow

### Git Workflow

Utilizamos o **GitFlow** modificado com as seguintes branches:

```
main                    # Código de produção
├── develop            # Integração de desenvolvimento
├── feature/           # Novas funcionalidades
├── hotfix/           # Correções urgentes
└── release/          # Preparação de releases
```

### Branch Naming Convention

```bash
# Features
feature/ISSUE-123-add-client-validation
feature/dashboard-performance-optimization

# Bug fixes
bugfix/ISSUE-456-fix-login-timeout
bugfix/contract-date-calculation

# Hotfixes
hotfix/CRITICAL-789-security-vulnerability
hotfix/database-connection-error

# Releases
release/v2.1.0
```

### Commit Message Format

Seguimos o padrão **Conventional Commits**:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types
- **feat**: Nova funcionalidade
- **fix**: Correção de bug
- **docs**: Mudanças na documentação
- **style**: Formatação (não afeta funcionalidade)
- **refactor**: Refatoração de código
- **test**: Adição ou correção de testes
- **chore**: Tarefas de manutenção

#### Examples
```bash
feat(clients): add CPF validation to client registration

fix(auth): resolve session timeout issue
- Fix token refresh mechanism
- Add proper error handling for expired tokens
- Update session storage logic

docs(api): update authentication endpoint documentation

test(validation): add unit tests for email validation

chore(deps): update Chart.js to v4.2.0
```

### Daily Workflow

```bash
# 1. Sincronize com upstream
git checkout develop
git pull upstream develop

# 2. Crie branch para sua feature
git checkout -b feature/ISSUE-123-your-feature-name

# 3. Faça suas mudanças e commits
git add .
git commit -m "feat(scope): add new feature"

# 4. Execute testes
npm test
npm run lint

# 5. Push para seu fork
git push origin feature/ISSUE-123-your-feature-name

# 6. Abra Pull Request no GitHub
```

## 📝 Coding Standards

### JavaScript Style Guide

#### General Principles
- **Clarity over cleverness**: Código fácil de entender é melhor que código "inteligente"
- **Consistency**: Mantenha padrões consistentes em todo o projeto
- **ES6+ features**: Use recursos modernos do JavaScript quando apropriado
- **Functional approach**: Prefira funções puras quando possível

#### Naming Conventions

```javascript
// Variables and functions: camelCase
const userName = 'João Silva';
const clientData = { name: 'Maria', email: 'maria@email.com' };

function calculateTotalValue(items) {
    return items.reduce((sum, item) => sum + item.value, 0);
}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const API_ENDPOINTS = {
    CLIENTS: '/api/clients',
    CONTRACTS: '/api/contracts'
};

// Classes: PascalCase
class ClientsManager {
    constructor(database) {
        this.database = database;
    }
}

// Private methods: _camelCase (convention)
class DatabaseManager {
    async _validateConnection() {
        // Private method
    }
}

// File names: kebab-case
// client-manager.js
// pdf-generator.js
// cloud-sync.js
```

#### Code Organization

```javascript
/**
 * Module documentation
 * @description Brief description of what this module does
 * @version 5.1.0
 * @author RC Construções Dev Team
 */

// 1. External imports first
import { Chart } from 'chart.js';
import Swal from 'sweetalert2';

// 2. Internal imports
import { ValidationManager } from './validation.js';
import { DatabaseManager } from './database.js';

// 3. Constants
const DEFAULT_CONFIG = {
    timeout: 5000,
    retries: 3
};

// 4. Main class or function
class ExampleManager {
    constructor() {
        // Constructor logic
    }

    // Public methods first
    async publicMethod() {
        return this._privateMethod();
    }

    // Private methods last
    _privateMethod() {
        // Implementation
    }
}

// 5. Export at the end
export default ExampleManager;
```

#### Error Handling

```javascript
// Good: Comprehensive error handling
async function createClient(clientData) {
    try {
        // Validate input
        if (!clientData || !clientData.name) {
            throw new ValidationError('Nome do cliente é obrigatório');
        }

        // Validate CPF
        if (!window.Validation.validateCPF(clientData.cpf)) {
            throw new ValidationError('CPF inválido');
        }

        // Attempt to save
        const result = await window.Database.save('clients', clientData);
        
        // Log success
        console.log('Cliente criado com sucesso:', result.id);
        
        return { success: true, client: result };
        
    } catch (error) {
        // Log error with context
        console.error('Erro ao criar cliente:', {
            error: error.message,
            clientData: { name: clientData?.name, cpf: clientData?.cpf },
            stack: error.stack
        });

        // Return user-friendly error
        return {
            success: false,
            error: error.message,
            errorType: error.constructor.name
        };
    }
}

// Custom error classes
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class DatabaseError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = 'DatabaseError';
        this.originalError = originalError;
    }
}
```

#### Async/Await Best Practices

```javascript
// Good: Proper async/await usage
async function processClientData(clients) {
    const results = [];
    
    // Sequential processing when order matters
    for (const client of clients) {
        try {
            const processed = await processClient(client);
            results.push(processed);
        } catch (error) {
            console.error(`Failed to process client ${client.id}:`, error);
            results.push({ error: error.message, clientId: client.id });
        }
    }
    
    return results;
}

// Good: Parallel processing when order doesn't matter
async function validateMultipleClients(clients) {
    const validationPromises = clients.map(async (client) => {
        try {
            return await validateClient(client);
        } catch (error) {
            return { isValid: false, error: error.message };
        }
    });
    
    return Promise.all(validationPromises);
}

// Good: Timeout handling
async function fetchWithTimeout(url, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
    }
}
```

### CSS/SCSS Standards

#### Architecture

```css
/* CSS organization follows ITCSS methodology */

/* 1. Settings - Global variables */
:root {
    --primary-color: #007bff;
    --spacing-md: 16px;
}

/* 2. Tools - Mixins and functions (in SCSS) */
@mixin button-style($bg-color, $text-color) {
    background-color: $bg-color;
    color: $text-color;
}

/* 3. Generic - Reset and normalize */
*, *::before, *::after {
    box-sizing: border-box;
}

/* 4. Base - Basic element styles */
body {
    font-family: var(--font-family);
    line-height: 1.6;
}

/* 5. Objects - Layout patterns */
.o-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-md);
}

/* 6. Components - UI components */
.c-button {
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
}

.c-button--primary {
    background-color: var(--primary-color);
    color: white;
}

/* 7. Utilities - Helper classes */
.u-text-center { text-align: center; }
.u-margin-bottom-md { margin-bottom: var(--spacing-md); }
```

#### BEM Methodology

```css
/* Block */
.client-card {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
}

/* Element */
.client-card__header {
    margin-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border-light);
}

.client-card__title {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
}

.client-card__content {
    color: var(--text-secondary);
}

/* Modifier */
.client-card--featured {
    border-color: var(--primary-color);
    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.1);
}

.client-card--compact {
    padding: var(--spacing-md);
}

.client-card__title--large {
    font-size: 1.4rem;
}
```

### HTML Standards

```html
<!-- Semantic HTML5 -->
<article class="client-card">
    <header class="client-card__header">
        <h2 class="client-card__title">João Silva</h2>
        <span class="client-card__badge">Cliente Premium</span>
    </header>
    
    <div class="client-card__content">
        <p class="client-card__description">
            Cliente desde 2020, com histórico de projetos residenciais.
        </p>
        
        <dl class="client-card__details">
            <dt>CPF:</dt>
            <dd>123.456.789-00</dd>
            <dt>Email:</dt>
            <dd>joao@email.com</dd>
        </dl>
    </div>
    
    <footer class="client-card__actions">
        <button type="button" class="btn btn-primary" aria-label="Editar cliente João Silva">
            <i class="fas fa-edit" aria-hidden="true"></i>
            Editar
        </button>
        <button type="button" class="btn btn-outline" aria-label="Ver contratos de João Silva">
            <i class="fas fa-file-contract" aria-hidden="true"></i>
            Contratos
        </button>
    </footer>
</article>
```

### Accessibility Standards

```html
<!-- Always include proper ARIA attributes -->
<form role="form" aria-labelledby="client-form-title">
    <h2 id="client-form-title">Cadastro de Cliente</h2>
    
    <div class="form-group">
        <label for="client-name" class="form-label">
            Nome Completo
            <span class="required" aria-label="Campo obrigatório">*</span>
        </label>
        <input 
            type="text" 
            id="client-name" 
            name="name" 
            class="form-control"
            required 
            aria-describedby="name-help"
            autocomplete="name"
        >
        <div id="name-help" class="form-hint">
            Digite o nome completo do cliente
        </div>
    </div>
    
    <div class="form-group">
        <label for="client-cpf" class="form-label">CPF</label>
        <input 
            type="text" 
            id="client-cpf" 
            name="cpf" 
            class="form-control"
            pattern="[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}"
            aria-describedby="cpf-help cpf-error"
            autocomplete="off"
        >
        <div id="cpf-help" class="form-hint">
            Formato: 000.000.000-00
        </div>
        <div id="cpf-error" class="form-feedback error" role="alert" aria-live="polite">
            <!-- Error message inserted by JavaScript -->
        </div>
    </div>
</form>
```

## 🧪 Testing Guidelines

### Testing Philosophy

- **Test-Driven Development (TDD)**: Escreva testes antes do código quando possível
- **Coverage**: Mantenha cobertura de testes acima de 80%
- **Quality over Quantity**: Testes bem escritos são mais valiosos que muitos testes ruins
- **Fast Feedback**: Testes devem executar rapidamente

### Test Structure

```javascript
// Good test structure following AAA pattern
describe('ClientsManager', () => {
    let clientsManager;
    let mockDatabase;
    let mockValidation;

    // Setup before each test
    beforeEach(() => {
        mockDatabase = new MockDatabase();
        mockValidation = new MockValidation();
        clientsManager = new ClientsManager(mockDatabase, mockValidation);
    });

    // Cleanup after each test
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createClient', () => {
        it('should create a valid client successfully', async () => {
            // Arrange
            const validClientData = {
                name: 'João Silva',
                cpf: '123.456.789-00',
                email: 'joao@email.com'
            };
            
            mockValidation.validateCPF.mockReturnValue(true);
            mockValidation.validateEmail.mockReturnValue(true);
            mockDatabase.save.mockResolvedValue({ id: 1, ...validClientData });

            // Act
            const result = await clientsManager.createClient(validClientData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.client).toMatchObject(validClientData);
            expect(mockDatabase.save).toHaveBeenCalledWith('clients', validClientData);
            expect(mockValidation.validateCPF).toHaveBeenCalledWith('123.456.789-00');
        });

        it('should reject client with invalid CPF', async () => {
            // Arrange
            const invalidClientData = {
                name: 'João Silva',
                cpf: 'invalid-cpf',
                email: 'joao@email.com'
            };
            
            mockValidation.validateCPF.mockReturnValue(false);

            // Act
            const result = await clientsManager.createClient(invalidClientData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('CPF inválido');
            expect(mockDatabase.save).not.toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            // Arrange
            const validClientData = {
                name: 'João Silva',
                cpf: '123.456.789-00',
                email: 'joao@email.com'
            };
            
            mockValidation.validateCPF.mockReturnValue(true);
            mockValidation.validateEmail.mockReturnValue(true);
            mockDatabase.save.mockRejectedValue(new Error('Database connection failed'));

            // Act
            const result = await clientsManager.createClient(validClientData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('Database connection failed');
        });
    });

    describe('getClientById', () => {
        it('should return client when found', async () => {
            // Arrange
            const clientId = 1;
            const expectedClient = { id: 1, name: 'João Silva' };
            mockDatabase.get.mockResolvedValue(expectedClient);

            // Act
            const result = await clientsManager.getClientById(clientId);

            // Assert
            expect(result).toEqual(expectedClient);
            expect(mockDatabase.get).toHaveBeenCalledWith('clients', clientId);
        });

        it('should return null when client not found', async () => {
            // Arrange
            const clientId = 999;
            mockDatabase.get.mockResolvedValue(null);

            // Act
            const result = await clientsManager.getClientById(clientId);

            // Assert
            expect(result).toBeNull();
        });
    });
});
```

### Integration Tests

```javascript
// Integration test example
describe('Client Management Integration', () => {
    let database;
    let clientsManager;

    beforeAll(async () => {
        // Setup test database
        database = new DatabaseManager();
        await database.init();
        clientsManager = new ClientsManager(database);
    });

    afterAll(async () => {
        // Cleanup test database
        await database.clearAll();
        await database.close();
    });

    beforeEach(async () => {
        // Clear data before each test
        await database.clear('clients');
    });

    it('should complete full client lifecycle', async () => {
        // Create client
        const clientData = {
            name: 'Integration Test Client',
            cpf: '123.456.789-00',
            email: 'integration@test.com'
        };

        const createResult = await clientsManager.createClient(clientData);
        expect(createResult.success).toBe(true);
        
        const clientId = createResult.client.id;

        // Retrieve client
        const retrievedClient = await clientsManager.getClientById(clientId);
        expect(retrievedClient).toMatchObject(clientData);

        // Update client
        const updatedData = { ...clientData, name: 'Updated Name' };
        const updateResult = await clientsManager.updateClient(clientId, updatedData);
        expect(updateResult.success).toBe(true);

        // Verify update
        const updatedClient = await clientsManager.getClientById(clientId);
        expect(updatedClient.name).toBe('Updated Name');

        // Delete client
        const deleteResult = await clientsManager.deleteClient(clientId);
        expect(deleteResult.success).toBe(true);

        // Verify deletion
        const deletedClient = await clientsManager.getClientById(clientId);
        expect(deletedClient).toBeNull();
    });
});
```

### E2E Tests

```javascript
// Cypress E2E test example
describe('Client Management E2E', () => {
    beforeEach(() => {
        // Visit the application
        cy.visit('/');
        
        // Login if necessary
        cy.login('admin', 'password');
        
        // Navigate to clients page
        cy.get('[data-page="clients"]').click();
    });

    it('should create a new client', () => {
        // Open create client modal
        cy.get('[data-testid="create-client-btn"]').click();
        
        // Fill form
        cy.get('#client-name').type('João Silva');
        cy.get('#client-cpf').type('123.456.789-00');
        cy.get('#client-email').type('joao@email.com');
        cy.get('#client-phone').type('(11) 99999-9999');
        
        // Submit form
        cy.get('[data-testid="save-client-btn"]').click();
        
        // Verify success
        cy.get('.notification.success').should('contain', 'Cliente criado com sucesso');
        cy.get('[data-testid="client-list"]').should('contain', 'João Silva');
    });

    it('should validate required fields', () => {
        // Open create client modal
        cy.get('[data-testid="create-client-btn"]').click();
        
        // Try to submit without filling required fields
        cy.get('[data-testid="save-client-btn"]').click();
        
        // Verify validation errors
        cy.get('#client-name + .form-feedback.error').should('be.visible');
        cy.get('#client-cpf + .form-feedback.error').should('be.visible');
        cy.get('#client-email + .form-feedback.error').should('be.visible');
    });

    it('should validate CPF format', () => {
        // Open create client modal
        cy.get('[data-testid="create-client-btn"]').click();
        
        // Fill form with invalid CPF
        cy.get('#client-name').type('João Silva');
        cy.get('#client-cpf').type('123.456.789-99'); // Invalid CPF
        cy.get('#client-email').type('joao@email.com');
        
        // Submit form
        cy.get('[data-testid="save-client-btn"]').click();
        
        // Verify CPF validation error
        cy.get('#client-cpf + .form-feedback.error')
            .should('be.visible')
            .and('contain', 'CPF inválido');
    });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=clients

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Run specific E2E test
npm run test:e2e -- --spec "cypress/e2e/clients.cy.js"
```

## 📚 Documentation Standards

### Code Documentation

#### JSDoc Standards

```javascript
/**
 * Manages client data and operations for RC Construções
 * @class ClientsManager
 * @description Handles all client-related CRUD operations, validation, and business logic.
 * This class serves as the main interface for client management throughout the application.
 * @version 5.1.0
 * @author RC Construções Dev Team
 * @since 1.0.0
 * @example
 * // Initialize the clients manager
 * const clientsManager = new ClientsManager(database, validation);
 * 
 * // Create a new client
 * const result = await clientsManager.createClient({
 *   name: 'João Silva',
 *   cpf: '123.456.789-00',
 *   email: 'joao@email.com'
 * });
 */
class ClientsManager {
    /**
     * Creates a new ClientsManager instance
     * @constructor
     * @param {DatabaseManager} database - Database manager instance for data persistence
     * @param {ValidationManager} validation - Validation manager for data validation
     * @throws {Error} When required dependencies are not provided or are invalid
     * @example
     * const clientsManager = new ClientsManager(
     *   new DatabaseManager(),
     *   new ValidationManager()
     * );
     */
    constructor(database, validation) {
        // Implementation
    }

    /**
     * Creates a new client with comprehensive validation
     * @async
     * @method createClient
     * @param {Object} clientData - Client information object
     * @param {string} clientData.name - Full name of the client (required)
     * @param {string} clientData.cpf - Brazilian CPF number in format XXX.XXX.XXX-XX (required)
     * @param {string} clientData.email - Valid email address (required)
     * @param {string} [clientData.phone] - Phone number in format (XX) XXXXX-XXXX (optional)
     * @param {string} [clientData.address] - Physical address (optional)
     * @param {string} [clientData.city] - City name (optional)
     * @param {string} [clientData.state] - State abbreviation (optional)
     * @param {string} [clientData.zipCode] - ZIP code in format XXXXX-XXX (optional)
     * @returns {Promise<Object>} Result object with operation status and data
     * @returns {boolean} returns.success - Whether the operation was successful
     * @returns {Object} [returns.client] - Created client object (when successful)
     * @returns {string} [returns.error] - Error message (when unsuccessful)
     * @returns {Array<string>} [returns.validationErrors] - List of validation errors
     * @throws {ValidationError} When client data fails validation rules
     * @throws {DatabaseError} When database operation fails
     * @throws {DuplicateError} When client with same CPF already exists
     * @example
     * // Create a new client with minimal data
     * const result = await clientsManager.createClient({
     *   name: 'João Silva',
     *   cpf: '123.456.789-00',
     *   email: 'joao@email.com'
     * });
     * 
     * if (result.success) {
     *   console.log('Client created:', result.client);
     * } else {
     *   console.error('Failed to create client:', result.error);
     * }
     * 
     * @example
     * // Create a client with complete data
     * const result = await clientsManager.createClient({
     *   name: 'Maria Santos',
     *   cpf: '987.654.321-00',
     *   email: 'maria@email.com',
     *   phone: '(11) 98765-4321',
     *   address: 'Rua das Flores, 123',
     *   city: 'São Paulo',
     *   state: 'SP',
     *   zipCode: '01234-567'
     * });
     */
    async createClient(clientData) {
        // Implementation
    }

    /**
     * Retrieves a client by their unique identifier
     * @async
     * @method getClientById
     * @param {number} clientId - Unique identifier of the client
     * @returns {Promise<Object|null>} Client object if found, null otherwise
     * @throws {DatabaseError} When database query fails
     * @example
     * const client = await clientsManager.getClientById(123);
     * if (client) {
     *   console.log('Found client:', client.name);
     * } else {
     *   console.log('Client not found');
     * }
     */
    async getClientById(clientId) {
        // Implementation
    }
}
```

### README Updates

When adding new features, update the appropriate README files:

```markdown
<!-- In module-specific README -->
## New Feature: Advanced Client Search

### Description
Added advanced search functionality that allows filtering clients by multiple criteria simultaneously.

### Usage
```javascript
// Search clients with multiple filters
const searchResults = await clientsManager.searchClients({
    name: 'João',
    city: 'São Paulo',
    status: 'active',
    dateRange: {
        start: '2024-01-01',
        end: '2024-12-31'
    }
});
```

### API Reference
- `searchClients(filters)` - Search clients with advanced filters
- `getSearchSuggestions(query)` - Get search suggestions for autocomplete

### Migration
If you're upgrading from v5.0, no breaking changes were introduced. The new search functionality is backward compatible.
```

## 🔀 Pull Request Process

### PR Checklist

Before submitting a Pull Request, ensure:

#### ✅ **Code