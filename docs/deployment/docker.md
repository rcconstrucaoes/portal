# 🐳 Docker Deployment Guide - RC Construções

## 📋 Visão Geral

Este guia fornece instruções completas para containerizar e executar o sistema RC Construções usando Docker. A aplicação é dividida em múltiplos serviços para máxima escalabilidade e manutenibilidade.

## 🏗️ Arquitetura dos Containers

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Frontend    │    │     Backend     │    │      Nginx      │
│   (React/JS)    │    │   (Node.js)     │    │  (Load Balancer)│
│   Port: 3000    │    │   Port: 3001    │    │   Port: 80/443  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────┐    ┌─────────────────┐
         │   PostgreSQL    │    │      Redis      │
         │   Port: 5432    │    │   Port: 6379    │
         └─────────────────┘    └─────────────────┘
```

## 📁 Estrutura de Arquivos Docker

```
rc-construcoes-web/
├── docker/
│   ├── Dockerfile.frontend          # Container do Frontend
│   ├── Dockerfile.backend           # Container do Backend
│   ├── nginx.conf                   # Configuração do Nginx
│   └── .dockerignore               # Arquivos a ignorar
├── docker-compose.yml              # Desenvolvimento
├── docker-compose.prod.yml         # Produção
└── .env.example                    # Variáveis de ambiente
```

## 🔧 Dockerfiles

### 1. Frontend Dockerfile

<function_calls>
<invoke name="artifacts">
<parameter name="command">update