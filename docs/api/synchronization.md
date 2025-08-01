# Documentação da API de Sincronização
## RC Construções v5.1

### Visão Geral

O sistema RC Construções implementa um sistema avançado de sincronização **offline-first** que permite aos usuários trabalharem sem conexão com a internet e sincronizarem automaticamente quando a conectividade for restaurada. O sistema utiliza **IndexedDB** localmente e **PostgreSQL** no servidor com resolução inteligente de conflitos.

---

## 🔄 Arquitetura de Sincronização

### Fluxo de Sincronização

```mermaid
graph TD
    A[Aplicação Frontend] --> B[CloudSyncManager]
    B --> C[IndexedDB Local]
    B --> D[Fila de Sincronização]
    D --> E{Online?}
    E -->|Sim| F[API Backend]
    E -->|Não| G[Armazenar Pendências]
    F --> H[SyncController]
    H --> I[PostgreSQL]
    H --> J{Conflito?}
    J -->|Sim| K[Resolução de Conflito]
    J -->|Não| L[Sincronização OK]
    K --> M[Estratégia de Merge]
    M --> L
```

### Componentes Principais

| Componente | Localização | Responsabilidade |
|------------|-------------|------------------|
| **CloudSyncManager** | Frontend | Gerenciamento de sincronização client-side |
| **SyncController** | Backend | Endpoint de sincronização server-side |
| **IndexedDB** | Frontend | Armazenamento local offline |
| **PostgreSQL** | Backend | Banco de dados principal |
| **Queue System** | Frontend | Fila de operações pendentes |

---

## 🌐 Endpoints da API de Sincronização

### Base URL
```
Production: https://api.rc-construcoes.com
Development: http://localhost:3001
```

### 🔄 Sincronização de Dados

**POST** `/api/sync`

Sincroniza dados de uma entidade específica com o servidor.

#### Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

#### Request Body
```json
{
  "data": {
    "id": "client-123",
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "modifiedAt": "2024-01-15T10:30:00.000Z"
  },
  "operation": "save",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "userId": "admin-001",
  "hash": "abc123def456"
}
```

#### Campos do Request

| Campo | Tipo | Descrição |
|-------|------|-----------|
| **data** | object | Dados da entidade a sincronizar |
| **operation** | string | Operação: `save`, `update`, `delete` |
| **timestamp** | string | Timestamp da modificação local |
| **userId** | string | ID do usuário que fez a modificação |
| **hash** | string | Hash dos dados para verificação de integridade |

#### Response (200 OK) - Sucesso
```json
{
  "success": true,
  "data": {
    "id": "client-123",
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "modifiedAt": "2024-01-15T10:30:00.000Z",
    "syncedAt": "2024-01-15T10:30:05.000Z"
  },
  "message": "Dados sincronizados com sucesso"
}
```

#### Response (409 Conflict) - Conflito Detectado
```json
{
  "success": false,
  "conflict": true,
  "serverData": {
    "id": "client-123",
    "name": "João Santos",
    "email": "joao@exemplo.com",
    "modifiedAt": "2024-01-15T10:25:00.000Z"
  },
  "clientData": {
    "id": "client-123",
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "modifiedAt": "2024-01-15T10:20:00.000Z"
  },
  "message": "Conflito detectado - resolução necessária"
}
```

---

### 📥 Download de Dados do Servidor

**GET** `/api/{entity}/sync/{userId}`

Baixa todas as modificações do servidor para uma entidade específica.

#### Parameters
- **entity**: `clients`, `contracts`, `budgets`, `financial_transactions`
- **userId**: ID do usuário

#### Response (200 OK)
```json
{
  "data": [
    {
      "id": "client-123",
      "name": "João Silva",
      "email": "joao@exemplo.com",
      "modifiedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "client-124",
      "name": "Maria Santos",
      "email": "maria@exemplo.com",
      "modifiedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "lastSync": "2024-01-15T11:00:00.000Z",
  "count": 2
}
```

---

### 🔍 Status de Sincronização

**GET** `/api/sync/status`

Retorna o status atual da sincronização para o usuário.

#### Response (200 OK)
```json
{
  "isOnline": true,
  "syncInProgress": false,
  "pendingCount": 3,
  "lastSyncTime": "2024-01-15T10:30:00.000Z",
  "entities": {
    "clients": {
      "lastSync": "2024-01-15T10:30:00.000Z",
      "pendingOperations": 1
    },
    "contracts": {
      "lastSync": "2024-01-15T10:25:00.000Z",
      "pendingOperations": 2
    }
  }
}
```

---

### 🔄 Sincronização Manual

**POST** `/api/sync/manual`

Força uma sincronização manual de todos os dados pendentes.

#### Response (200 OK)
```json
{
  "success": true,
  "syncedItems": 5,
  "errors": 0,
  "message": "Sincronização manual concluída com sucesso"
}
```

---

## 🏗️ Sistema de Filas (Frontend)

### Estrutura da Fila de Sincronização

```javascript
// Estrutura de um item na fila
const syncItem = {
  id: "sync-1642248600000-abc123",      // ID único
  objectStore: "clients",               // Entidade (clients, contracts, etc.)
  data: { /* dados da entidade */ },    // Dados a sincronizar
  operation: "save",                    // Operação (save, update, delete)
  timestamp: "2024-01-15T10:30:00.000Z", // Timestamp da modificação
  userId: "admin-001",                  // ID do usuário
  attempts: 0,                          // Número de tentativas
  hash: "abc123def456",                 // Hash de integridade
  lastError: null                       // Último erro (se houver)
};
```

### Operações Suportadas

| Operação | Descrição | Endpoint |
|----------|-----------|----------|
| **save** | Criar nova entidade | `POST /api/{entity}/sync` |
| **update** | Atualizar entidade existente | `PUT /api/{entity}/sync` |
| **delete** | Deletar entidade | `DELETE /api/{entity}/sync` |
| **force** | Forçar upload (ignorar conflitos) | `POST /api/{entity}/force` |

---

## ⚡ Resolução de Conflitos

### Estratégias de Resolução

O sistema suporta 4 estratégias diferentes para resolução de conflitos:

#### 1. **Server Priority** (`server`)
```javascript
// Prioriza sempre os dados do servidor
conflictResolution: 'server'
```
- **Vantagem**: Garantia de consistência
- **Desvantagem**: Perde modificações locais
- **Uso**: Ambientes onde consistência é crítica

#### 2. **Client Priority** (`client`)
```javascript
// Prioriza sempre os dados do cliente
conflictResolution: 'client'
```
- **Vantagem**: Preserva trabalho local
- **Desvantagem**: Pode sobrescrever dados importantes
- **Uso**: Usuários únicos ou dados específicos do cliente

#### 3. **Merge Inteligente** (`merge`)
```javascript
// Tenta mesclar dados automaticamente
conflictResolution: 'merge'
```
- **Vantagem**: Preserva dados de ambos os lados
- **Desvantagem**: Pode criar inconsistências
- **Uso**: Campos independentes que podem ser mesclados

#### 4. **Prompt do Usuário** (`prompt`)
```javascript
// Pergunta ao usuário como resolver
conflictResolution: 'prompt'
```
- **Vantagem**: Controle total do usuário
- **Desvantagem**: Requer intervenção manual
- **Uso**: Dados críticos que requerem decisão humana

### Algoritmo de Merge

```javascript
// Exemplo de merge inteligente
async mergeData(localData, serverData) {
  const merged = { ...serverData };
  const localModified = new Date(localData.modifiedAt || 0);
  const serverModified = new Date(serverData.modifiedAt || 0);
  
  // Se dados locais são mais recentes, preserva campos específicos
  if (localModified > serverModified) {
    const localFields = ['name', 'description', 'value', 'status'];
    localFields.forEach(field => {
      if (localData[field] !== undefined) {
        merged[field] = localData[field];
      }
    });
  }
  
  merged.mergedAt = new Date().toISOString();
  merged.conflictResolved = true;
  
  return merged;
}
```

---

## 🔧 Configuração do Sistema

### Configurações Frontend

```javascript
// CloudSyncManager Configuration
const syncConfig = {
  apiUrl: 'https://api.rc-construcoes.com',
  syncInterval: 5 * 60 * 1000,        // 5 minutos
  conflictResolution: 'merge',         // Estratégia padrão
  maxRetries: 3,                       // Máximo de tentativas
  encryptSensitiveData: true           // Criptografar dados sensíveis
};
```

### Configurações Disponíveis

| Configuração | Tipo | Padrão | Descrição |
|--------------|------|--------|-----------|
| **syncInterval** | number | 300000 | Intervalo entre sincronizações (ms) |
| **conflictResolution** | string | 'server' | Estratégia de resolução de conflitos |
| **maxRetries** | number | 3 | Máximo de tentativas por item |
| **encryptSensitiveData** | boolean | true | Criptografar dados sensíveis |

### Configuração via Interface

```javascript
// Alterar intervalo de sincronização
window.CloudSync.setSyncInterval(15); // 15 minutos

// Alterar estratégia de conflito
window.CloudSync.setConflictResolution('merge');

// Verificar status
const status = window.CloudSync.getSyncStatus();
```

---

## 📱 Interface de Usuário

### Indicadores de Sincronização

#### Status Online/Offline
```html
<div class="sync-status">
  <span class="status-indicator online">
    <i class="fas fa-wifi"></i> Online
  </span>
  <span class="last-sync">
    Última sync: há 2 minutos
  </span>
</div>
```

#### Fila de Sincronização
```html
<div class="sync-queue">
  <span class="pending-count">3 itens pendentes</span>
  <button class="sync-now">Sincronizar Agora</button>
</div>
```

### Notificações de Sincronização

```javascript
// Notificações automáticas
syncManager.on('syncComplete', (result) => {
  if (result.errors === 0) {
    showNotification('Sincronização concluída', 'success');
  } else {
    showNotification(`${result.errors} erros na sincronização`, 'warning');
  }
});
```

---

## 🛡️ Segurança na Sincronização

### Criptografia de Dados Sensíveis

```javascript
// Dados sensíveis são criptografados antes do envio
async prepareDataForSync(data) {
  if (window.Security?.isSensitiveData(data)) {
    return await window.Security.encryptSensitiveFields(data);
  }
  return data;
}
```

### Campos Sensíveis Identificados
- Informações pessoais (CPF, RG)
- Dados financeiros (valores, contas bancárias)
- Informações de contato sensíveis

### Verificação de Integridade

```javascript
// Hash para verificação de integridade
async generateDataHash(data) {
  const content = JSON.stringify(data);
  return await window.Security.generateHash(content);
}
```

### Rate Limiting

```nginx
# nginx.conf - Rate limiting para sync
location /api/sync {
    limit_req zone=sync burst=30 nodelay;
    proxy_pass http://backend_api;
}
```

---

## 📊 Monitoramento e Métricas

### Métricas de Sincronização

**GET** `/api/sync/metrics`

```json
{
  "period": "24h",
  "totalSyncs": 1250,
  "successRate": 0.98,
  "averageConflicts": 0.05,
  "entitiesStats": {
    "clients": {
      "syncs": 450,
      "conflicts": 12,
      "errors": 3
    },
    "contracts": {
      "syncs": 320,
      "conflicts": 8,
      "errors": 1
    }
  },
  "conflictResolution": {
    "server": 0.60,
    "client": 0.15,
    "merge": 0.20,
    "prompt": 0.05
  }
}
```

### Logs de Sincronização

```javascript
// Logs automáticos no Winston
logger.info('Sync completed', {
  userId: 'admin-001',
  syncedItems: 5,
  conflicts: 1,
  duration: 1250, // ms
  strategy: 'merge'
});
```

---

## 🧪 Testes de Sincronização

### Cenários de Teste

#### 1. Teste de Sincronização Básica
```javascript
// Teste de sync simples
const testBasicSync = async () => {
  const client = { name: 'Teste', email: 'teste@exemplo.com' };
  await window.Database.save('clients', client);
  
  // Simular conexão online
  window.CloudSync.isOnline = true;
  await window.CloudSync.syncPendingData();
  
  // Verificar sincronização
  const synced = await window.Database.get('clients', client.id);
  assert(synced.syncedAt);
};
```

#### 2. Teste de Resolução de Conflitos
```javascript
// Teste de conflito e resolução
const testConflictResolution = async () => {
  const localData = { id: 1, name: 'Local', modifiedAt: '2024-01-15T10:30:00Z' };
  const serverData = { id: 1, name: 'Server', modifiedAt: '2024-01-15T10:25:00Z' };
  
  window.CloudSync.setConflictResolution('merge');
  const merged = await window.CloudSync.mergeData(localData, serverData);
  
  assert(merged.name === 'Local'); // Local é mais recente
  assert(merged.conflictResolved === true);
};
```

#### 3. Teste de Offline/Online
```javascript
// Teste de comportamento offline
const testOfflineSync = async () => {
  // Simular offline
  window.CloudSync.isOnline = false;
  
  const client = { name: 'Offline Test' };
  await window.Database.save('clients', client);
  
  // Verificar fila de pendências
  assert(window.CloudSync.pendingSync.length > 0);
  
  // Simular reconexão
  window.CloudSync.isOnline = true;
  await window.CloudSync.syncPendingData();
  
  // Verificar fila vazia
  assert(window.CloudSync.pendingSync.length === 0);
};
```

---

## 🔧 Implementação Prática

### Inicialização do Sistema

```javascript
// 1. Inicializar CloudSyncManager
const syncManager = new CloudSyncManager();
await syncManager.init();

// 2. Configurar estratégia de conflitos
syncManager.setConflictResolution('merge');

// 3. Configurar intervalo de sync
syncManager.setSyncInterval(5); // 5 minutos
```

### Uso em Operações CRUD

```javascript
// Exemplo: Salvar cliente com sincronização
const saveClient = async (clientData) => {
  try {
    // 1. Salvar localmente
    const client = await window.Database.save('clients', clientData);
    
    // 2. Adicionar à fila de sync
    await window.CloudSync.queueForSync('clients', client, 'save');
    
    // 3. Tentar sincronizar imediatamente se online
    if (window.CloudSync.isOnline) {
      await window.CloudSync.syncPendingData();
    }
    
    return client;
  } catch (error) {
    console.error('Erro ao salvar cliente:', error);
    throw error;
  }
};
```

### Tratamento de Eventos

```javascript
// Listeners para eventos de rede
window.addEventListener('online', () => {
  console.log('Conexão restaurada - iniciando sync');
  window.CloudSync.syncPendingData();
});

window.addEventListener('offline', () => {
  console.log('Conexão perdida - modo offline');
});
```

---

## ⚠️ Limitações e Considerações

### Limitações Técnicas

| Limitação | Valor | Observação |
|-----------|-------|------------|
| **Tamanho máximo por item** | 1MB | Dados muito grandes podem causar problemas |
| **Itens na fila** | 1000 | Limite para evitar problemas de memória |
| **Tentativas por item** | 3 | Após 3 falhas, item é removido da fila |
| **Timeout de requisição** | 30s | Timeout para requisições de sync |

### Considerações de Performance

- **Batch sync**: Sync de múltiplos itens simultaneamente
- **Delta sync**: Apenas campos modificados são enviados
- **Compressão**: Dados são comprimidos antes do envio
- **Cache inteligente**: Evita syncs desnecessários

### Cenários de Edge Cases

1. **Conflitos complexos**: Dados modificados simultaneamente por múltiplos usuários
2. **Conexão instável**: Reconexões frequentes podem causar syncs duplicados
3. **Dados corrompidos**: Verificação de integridade via hash
4. **Fila grande**: Estratégia de priorização para syncs críticos

---

## 📞 Troubleshooting

### Problemas Comuns

#### Sync Não Funciona
```javascript
// Debug de sincronização
const debugSync = () => {
  console.log('Status:', window.CloudSync.getSyncStatus());
  console.log('Pending:', window.CloudSync.pendingSync);
  console.log('Online:', window.CloudSync.isOnline);
};
```

#### Conflitos Frequentes
```javascript
// Verificar configuração de conflitos
if (window.CloudSync.conflictResolution === 'prompt') {
  // Mudar para merge automático
  window.CloudSync.setConflictResolution('merge');
}
```

#### Performance Lenta
```javascript
// Reduzir intervalo de sync
window.CloudSync.setSyncInterval(15); // 15 minutos em vez de 5
```

### Comandos de Debug

```bash
# Verificar logs de sincronização
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/logs/application-$(date +%Y-%m-%d).log

# Forçar sincronização manual
curl -X POST -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/sync/manual
```

---

## 📞 Suporte e Recursos

Para dúvidas sobre sincronização:

- **Documentação técnica**: `/docs/api/`
- **Monitoring dashboard**: `/monitoring/sync.html`
- **API status**: `/api/sync/status`
- **Email**: dev@rc-construcoes.com

---

*Documentação atualizada em: Janeiro 2025*  
*Versão do sistema: 5.1*  
*Estratégia padrão: Merge inteligente*