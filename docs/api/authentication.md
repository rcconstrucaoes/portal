# Documentação da API de Autenticação
## RC Construções v5.1

### Visão Geral

O sistema RC Construções utiliza autenticação baseada em **JSON Web Tokens (JWT)** para proteger todas as rotas da API. O sistema suporta diferentes níveis de acesso (roles) e permissões granulares para diferentes tipos de usuário.

---

## 🔐 Endpoints de Autenticação

### Base URL
```
Production: https://api.rc-construcoes.com
Development: http://localhost:3001
```

### 🚀 Registro de Usuário

**POST** `/api/auth/register`

Cria um novo usuário no sistema.

#### Headers
```http
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "João Silva",
  "email": "joao.silva@exemplo.com",
  "password": "senha123456"
}
```

#### Validações
- **name**: Obrigatório, string
- **email**: Obrigatório, formato de email válido
- **password**: Obrigatório, mínimo 6 caracteres

#### Response (201 Created)
```json
{
  "id": "uuid-do-usuario",
  "name": "João Silva",
  "email": "joao.silva@exemplo.com",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses
```json
// 400 - Validação falhou
{
  "error": "Falha na validação.",
  "messages": [
    "O nome é obrigatório.",
    "Formato de e-mail inválido."
  ]
}

// 400 - Email já existe
{
  "error": "Este e-mail já está em uso."
}

// 500 - Erro interno
{
  "error": "Ocorreu um erro interno no servidor."
}
```

---

### 🔑 Login (Autenticação)

**POST** `/api/auth/login`

Autentica um usuário e retorna um token JWT.

#### Headers
```http
Content-Type: application/json
```

#### Request Body
```json
{
  "email": "admin@rcconstrucoes.com",
  "password": "admin123"
}
```

#### Response (200 OK)
```json
{
  "user": {
    "id": "admin-001",
    "name": "Administrador",
    "email": "admin@rcconstrucoes.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Error Responses
```json
// 400 - Dados inválidos
{
  "error": "Falha na validação. Verifique seu e-mail e senha."
}

// 401 - Usuário não encontrado
{
  "error": "Usuário não encontrado."
}

// 401 - Senha incorreta
{
  "error": "Senha incorreta."
}
```

---

### 🔍 Verificação de Token

**GET** `/api/auth/verify`

Verifica se um token JWT é válido e retorna os dados do usuário.

#### Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response (200 OK)
```json
{
  "valid": true,
  "user": {
    "id": "admin-001",
    "name": "Administrador",
    "email": "admin@rcconstrucoes.com",
    "role": "admin",
    "permissions": ["all"]
  }
}
```

#### Error Responses
```json
// 401 - Token inválido ou expirado
{
  "error": "Token inválido ou expirado."
}

// 401 - Token não fornecido
{
  "error": "Token de acesso obrigatório."
}
```

---

### 🚪 Logout

**POST** `/api/auth/logout`

Invalida o token atual (adiciona à blacklist).

#### Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response (200 OK)
```json
{
  "message": "Logout realizado com sucesso."
}
```

---

## 👥 Sistema de Roles e Permissões

### Tipos de Usuário

#### 🔱 Administrador (`admin`)
- **Permissões**: `["all"]` (acesso total)
- **Acesso**: Todos os módulos e funcionalidades
- **Pode**: Criar usuários, alterar configurações, visualizar logs

#### 👔 Gerente (`manager`)
- **Permissões**: `["dashboard", "clients", "contracts", "budgets", "reports"]`
- **Acesso**: Módulos de gestão e relatórios
- **Pode**: Gerenciar clientes, contratos e orçamentos

#### 💰 Financeiro (`financial`)
- **Permissões**: `["dashboard", "financial", "reports", "clients_view"]`
- **Acesso**: Módulo financeiro e visualização
- **Pode**: Gerenciar transações financeiras e visualizar relatórios

### Usuários Padrão (Desenvolvimento)

```javascript
// Usuários de desenvolvimento
const defaultUsers = [
  {
    username: "admin",
    password: "admin123",
    email: "admin@rcconstrucoes.com",
    role: "admin"
  },
  {
    username: "gerente",
    password: "gerente123", 
    email: "gerente@rcconstrucoes.com",
    role: "manager"
  },
  {
    username: "financeiro",
    password: "financeiro123",
    email: "financeiro@rcconstrucoes.com", 
    role: "financial"
  }
];
```

---

## 🛡️ Middleware de Autenticação

### Protegendo Rotas

Todas as rotas protegidas devem incluir o middleware de autenticação:

```javascript
// Exemplo de rota protegida
router.get('/clients', authMiddleware, clientsController.index);
```

### Verificação de Permissões

```javascript
// Middleware para verificar permissões específicas
const requirePermission = (permission) => {
  return (req, res, next) => {
    const user = req.user;
    
    if (user.permissions.includes('all') || 
        user.permissions.includes(permission)) {
      next();
    } else {
      return res.status(403).json({ 
        error: 'Acesso negado. Permissão insuficiente.' 
      });
    }
  };
};

// Uso
router.get('/financial', authMiddleware, requirePermission('financial'), financialController.index);
```

---

## 🔧 Configuração

### Variáveis de Ambiente

```bash
# .env
JWT_SECRET=sua-chave-super-secreta-de-256-bits-aqui
JWT_EXPIRES_IN=8h
```

### Configuração de Segurança

```javascript
// config/auth.js
module.exports = {
  secret: process.env.JWT_SECRET || 'desenvolvimento-apenas',
  expiresIn: process.env.JWT_EXPIRES_IN || '8h'
};
```

---

## 📱 Integração Frontend

### Armazenamento de Token

```javascript
// Salvar token após login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const data = await response.json();
localStorage.setItem('authToken', data.token);
```

### Interceptor para Requisições

```javascript
// Adicionar token automaticamente
const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
};
```

### Verificação de Sessão

```javascript
// Verificar se usuário está autenticado
const checkAuth = async () => {
  const token = localStorage.getItem('authToken');
  
  if (!token) return false;
  
  try {
    const response = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    return response.ok;
  } catch (error) {
    localStorage.removeItem('authToken');
    return false;
  }
};
```

---

## 🔒 Segurança e Boas Práticas

### Rate Limiting

O sistema implementa rate limiting para endpoints de autenticação:

```nginx
# nginx.conf
location ~ ^/api/(auth|login) {
    limit_req zone=login burst=5 nodelay;
    proxy_pass http://backend_api;
}
```

### Headers de Segurança

```javascript
// Headers obrigatórios
{
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block"
}
```

### Validação de Token

```javascript
// Middleware de autenticação
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Token de acesso obrigatório.' 
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, authConfig.secret);
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Token inválido.' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Token inválido ou expirado.' 
    });
  }
};
```

---

## 🧪 Testes

### Teste de Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@rcconstrucoes.com",
    "password": "admin123"
  }'
```

### Teste de Rota Protegida

```bash
curl -X GET http://localhost:3001/api/clients \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

---

## ❌ Códigos de Erro

| Código | Descrição | Exemplo |
|--------|-----------|---------|
| 400 | Bad Request | Dados de entrada inválidos |
| 401 | Unauthorized | Token inválido ou ausente |
| 403 | Forbidden | Permissão insuficiente |
| 404 | Not Found | Usuário não encontrado |
| 422 | Unprocessable Entity | Validação falhou |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Internal Server Error | Erro interno do servidor |

---

## 📞 Suporte

Para dúvidas sobre a API de autenticação:

- **Email**: dev@rc-construcoes.com
- **Documentação**: `/docs/api/`
- **Health Check**: `/api/health`

---

*Documentação atualizada em: Janeiro 2025*  
*Versão da API: 5.1*