# 🚀 Deployment Guide - RC Construções

## 📋 Visão Geral

Este guia fornece instruções completas para fazer deploy do sistema RC Construções em diferentes ambientes, desde desenvolvimento local até produção em nuvem. O sistema foi projetado para ser flexível e escalável, suportando tanto deployments simples quanto arquiteturas distribuídas complexas.

## 🏗️ Arquitetura do Sistema

### Componentes Principais

```
┌─────────────────────────────────────────────────────────────────┐
│                        RC Construções                          │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (PWA)           │  Backend API        │  Database     │
│  ├── HTML/CSS/JS          │  ├── Node.js        │  ├── PostgreSQL│
│  ├── Service Worker       │  ├── Express        │  ├── Redis     │
│  ├── Dexie.js (Local DB)  │  ├── JWT Auth       │  └── Backups   │
│  ├── Chart.js             │  ├── Winston Logs   │               │
│  └── PWA Manifest         │  └── Metrics        │               │
├─────────────────────────────────────────────────────────────────┤
│                    Infrastructure                               │
│  ├── Docker Containers    │  ├── Load Balancer  │  ├── Monitoring│
│  ├── Nginx Proxy          │  ├── SSL/TLS        │  ├── Grafana   │
│  ├── CI/CD Pipeline       │  ├── CDN             │  ├── Prometheus│
│  └── Cloud Services       │  └── Auto Scaling   │  └── Alerts    │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Requisitos do Sistema

### Desenvolvimento Local

#### Hardware Mínimo
- **CPU**: 2 cores, 2.0 GHz
- **RAM**: 4 GB (8 GB recomendado)
- **Disco**: 10 GB livres
- **Rede**: Conexão banda larga

#### Software Necessário
- **Node.js**: v18.0+ (LTS recomendado)
- **npm**: v8.0+ ou **yarn**: v1.22+
- **Git**: v2.30+
- **Docker**: v20.0+ (opcional)
- **Docker Compose**: v2.0+ (opcional)

#### Sistema Operacional
- **Windows**: 10/11 (64-bit)
- **macOS**: 10.15+ (Catalina)
- **Linux**: Ubuntu 20.04+, CentOS 8+

### Produção

#### Hardware Recomendado
- **CPU**: 4+ cores, 2.4+ GHz
- **RAM**: 8-16 GB
- **Disco**: 100+ GB SSD
- **Rede**: 100+ Mbps

#### Software de Produção
- **Docker**: v20.0+
- **Docker Compose**: v2.0+
- **Nginx**: v1.20+
- **PostgreSQL**: v13+
- **Redis**: v6.0+
- **Prometheus**: v2.35+
- **Grafana**: v9.0+

## 🛠️ Instalação e Configuração

### 1. Setup Local de Desenvolvimento

#### Clone do Repositório
```bash
# Clone o projeto
git clone https://github.com/seu-usuario/rc-construcoes.git
cd rc-construcoes

# Verificar estrutura do projeto
ls -la
```

#### Configuração de Ambiente
```bash
# Copiar arquivo de exemplo de variáveis de ambiente
cp .env.example .env

# Editar configurações (use seu editor preferido)
nano .env
```

#### Arquivo .env Exemplo
```bash
# Ambiente
NODE_ENV=development

# Aplicação
APP_NAME="RC Construções"
APP_VERSION="5.1.0"
PORT=3001

# Frontend
FRONTEND_URL=http://localhost:3000

# Banco de Dados (Local)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=rc_construcoes_dev

# Redis (Opcional para desenvolvimento)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Autenticação
JWT_SECRET=seu-jwt-secret-super-seguro-desenvolvimento
JWT_EXPIRES_IN=8h

# Logs
LOG_LEVEL=debug

# API Externa (se disponível)
API_URL=http://localhost:3001/api

# Monitoramento (Desenvolvimento)
PROMETHEUS_ENABLED=false
GRAFANA_ENABLED=false
```

#### Instalação de Dependências
```bash
# Se usar npm
npm install

# Se usar yarn
yarn install

# Verificar se tudo foi instalado corretamente
npm list --depth=0
```

#### Setup do Banco de Dados Local (Opcional)
```bash
# Com Docker (Recomendado)
docker run --name rc-postgres \
  -e POSTGRES_DB=rc_construcoes_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:13

# Com Redis (Opcional)
docker run --name rc-redis \
  -p 6379:6379 \
  -d redis:6-alpine
```

#### Inicialização do Sistema
```bash
# Modo desenvolvimento (apenas frontend)
python -m http.server 3000
# ou
npx serve -p 3000

# Com backend (se configurado)
npm run dev

# Verificar no navegador
open http://localhost:3000
```

### 2. Deployment com Docker

#### Preparação do Ambiente
```bash
# Verificar se Docker está funcionando
docker --version
docker-compose --version

# Criar rede Docker
docker network create rc-network
```

#### Configuração para Produção
```bash
# Copiar arquivo de produção
cp .env.example .env.prod

# Configurar variáveis de produção
nano .env.prod
```

#### Arquivo .env.prod Exemplo
```bash
# Ambiente
NODE_ENV=production

# Aplicação
APP_NAME="RC Construções"
APP_VERSION="5.1.0"
PORT=3001

# URLs de Produção
FRONTEND_URL=https://rc-construcoes.com
API_URL=https://api.rc-construcoes.com

# Banco de Dados
DB_HOST=database
DB_PORT=5432
DB_USER=rcadmin
DB_PASSWORD=SUA_SENHA_SEGURA_AQUI
DB_NAME=rc_construcoes_prod

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=SUA_SENHA_REDIS_AQUI

# Autenticação (IMPORTANTE: Use uma chave segura)
JWT_SECRET=SUA_CHAVE_JWT_SUPER_SEGURA_256_BITS_AQUI
JWT_EXPIRES_IN=8h

# SSL/TLS
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/rc-construcoes.crt
SSL_KEY_PATH=/etc/ssl/private/rc-construcoes.key

# Monitoramento
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
GRAFANA_ADMIN_PASSWORD=SUA_SENHA_GRAFANA_AQUI

# Logs
LOG_LEVEL=info
```

#### Build e Deploy com Docker
```bash
# Build das imagens
docker-compose -f docker-compose.prod.yml build

# Iniciar serviços
docker-compose -f docker-compose.prod.yml up -d

# Verificar status
docker-compose -f docker-compose.prod.yml ps

# Verificar logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Deployment em Cloud

#### AWS (Amazon Web Services)
```bash
# Instalar AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurar credenciais
aws configure

# Deploy usando EC2 + RDS + ElastiCache
# Consulte docs/deployment/cloud-setup.md para detalhes
```

#### Azure
```bash
# Instalar Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login
az login

# Deploy usando Container Instances
# Consulte docs/deployment/cloud-setup.md para detalhes
```

#### Google Cloud
```bash
# Instalar gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Autenticar
gcloud auth login

# Deploy usando Cloud Run
# Consulte docs/deployment/cloud-setup.md para detalhes
```

#### DigitalOcean
```bash
# Instalar doctl
wget https://github.com/digitalocean/doctl/releases/download/v1.78.0/doctl-1.78.0-linux-amd64.tar.gz
tar xf doctl-1.78.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Autenticar
doctl auth init

# Deploy usando App Platform
# Consulte docs/deployment/cloud-setup.md para detalhes
```

## 🔐 Configuração de Segurança

### 1. SSL/TLS Certificate

#### Let's Encrypt (Gratuito)
```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d rc-construcoes.com -d www.rc-construcoes.com

# Configurar renovação automática
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
```

#### Certificado Comercial
```bash
# Gerar CSR (Certificate Signing Request)
openssl req -new -newkey rsa:2048 -nodes \
  -keyout rc-construcoes.key \
  -out rc-construcoes.csr

# Enviar CSR para autoridade certificadora
# Instalar certificado recebido
```

### 2. Firewall Configuration

#### UFW (Ubuntu Firewall)
```bash
# Habilitar UFW
sudo ufw enable

# Permitir SSH (cuidado!)
sudo ufw allow ssh

# Permitir HTTP e HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Permitir apenas IPs específicos para admin
sudo ufw allow from SEU_IP to any port 22
sudo ufw allow from SEU_IP to any port 9090  # Prometheus
sudo ufw allow from SEU_IP to any port 3000  # Grafana

# Verificar status
sudo ufw status verbose
```

### 3. Database Security

#### PostgreSQL Hardening
```sql
-- Criar usuário específico para aplicação
CREATE USER rcapp WITH PASSWORD 'senha_super_segura';

-- Criar database
CREATE DATABASE rc_construcoes_prod OWNER rcapp;

-- Conceder apenas permissões necessárias
GRANT CONNECT ON DATABASE rc_construcoes_prod TO rcapp;
GRANT USAGE ON SCHEMA public TO rcapp;
GRANT CREATE ON SCHEMA public TO rcapp;

-- Configurar pg_hba.conf para autenticação específica
-- Editar /etc/postgresql/13/main/pg_hba.conf
```

## 📊 Monitoramento e Observabilidade

### 1. Setup de Monitoramento

#### Prometheus + Grafana
```bash
# Criar diretórios
mkdir -p monitoring/{prometheus,grafana,alertmanager}

# Configurar Prometheus
cp monitoring/config/prometheus.yml monitoring/prometheus/

# Iniciar stack de monitoramento
docker-compose -f docker-compose.monitoring.yml up -d

# Verificar serviços
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:3000/api/health # Grafana
```

#### Dashboards Pré-configurados
```bash
# Importar dashboards para Grafana
curl -X POST \
  http://admin:admin@localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -d @monitoring/dashboards/rc-overview.json
```

### 2. Health Checks

#### Script de Verificação
```bash
#!/bin/bash
# scripts/health-check.sh

echo "🔍 Verificando saúde do sistema RC Construções..."

# Verificar frontend
if curl -f http://localhost > /dev/null 2>&1; then
    echo "✅ Frontend: OK"
else
    echo "❌ Frontend: FAIL"
fi

# Verificar backend (se configurado)
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: FAIL"
fi

# Verificar banco de dados
if docker exec rc-postgres pg_isready > /dev/null 2>&1; then
    echo "✅ Database: OK"
else
    echo "❌ Database: FAIL"
fi

echo "🏁 Verificação concluída"
```

## 🔄 CI/CD Pipeline

### 1. GitHub Actions

#### Workflow de Deploy
```yaml
# .github/workflows/deploy.yml
name: Deploy RC Construções

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: |
          # Setup SSH
          echo "$DEPLOY_KEY" > deploy_key
          chmod 600 deploy_key
          
          # Deploy via SSH
          ssh -i deploy_key -o StrictHostKeyChecking=no \
            $DEPLOY_USER@$DEPLOY_HOST \
            'cd /var/www/rc-construcoes && git pull && docker-compose restart'
```

### 2. Deployment Automatizado

#### Script de Deploy
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Iniciando deploy do RC Construções..."

# Verificar se estamos no branch correto
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo "❌ Deploy deve ser feito a partir do branch main"
    exit 1
fi

# Backup antes do deploy
echo "📦 Criando backup..."
./scripts/backup.sh

# Pull das últimas mudanças
echo "📥 Atualizando código..."
git pull origin main

# Build da aplicação
echo "🔨 Construindo aplicação..."
npm run build

# Atualizar containers
echo "🐳 Atualizando containers..."
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verificar saúde do sistema
echo "🔍 Verificando saúde do sistema..."
sleep 30
./scripts/health-check.sh

# Limpeza
echo "🧹 Limpando recursos antigos..."
docker system prune -f

echo "✅ Deploy concluído com sucesso!"
echo "🌐 Aplicação disponível em: https://rc-construcoes.com"
```

## 💾 Backup e Recovery

### 1. Estratégia de Backup

#### Script de Backup Automatizado
```bash
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/rc-construcoes"
RETENTION_DAYS=30

echo "📦 Iniciando backup do RC Construções..."

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup do banco de dados
echo "💾 Backup do banco de dados..."
docker exec rc-postgres pg_dump -U rcadmin rc_construcoes_prod | \
  gzip > $BACKUP_DIR/database_$DATE.sql.gz

# Backup dos arquivos de upload (se houver)
echo "📁 Backup de arquivos..."
tar -czf $BACKUP_DIR/files_$DATE.tar.gz uploads/ logs/

# Backup das configurações
echo "⚙️ Backup de configurações..."
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  .env.prod docker-compose.prod.yml monitoring/

# Limpeza de backups antigos
echo "🧹 Limpando backups antigos..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

# Upload para cloud (opcional)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo "☁️ Enviando backup para S3..."
    aws s3 sync $BACKUP_DIR s3://$AWS_S3_BUCKET/backups/
fi

echo "✅ Backup concluído: $DATE"
```

### 2. Recovery Procedures

#### Restauração de Banco de Dados
```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Uso: ./restore.sh <arquivo_backup>"
    exit 1
fi

echo "⚠️ ATENÇÃO: Esta operação irá substituir os dados atuais!"
read -p "Tem certeza? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operação cancelada"
    exit 1
fi

echo "🔄 Restaurando banco de dados..."

# Parar aplicação
docker-compose -f docker-compose.prod.yml stop backend

# Restaurar backup
gunzip -c $BACKUP_FILE | \
  docker exec -i rc-postgres psql -U rcadmin rc_construcoes_prod

# Reiniciar aplicação
docker-compose -f docker-compose.prod.yml start backend

echo "✅ Restauração concluída"
```

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Aplicação não carrega
```bash
# Verificar se o servidor web está funcionando
curl -I http://localhost

# Verificar logs do navegador (F12 -> Console)
# Procurar por erros de JavaScript

# Verificar se todos os arquivos estão presentes
ls -la js/ css/ lib/

# Limpar cache do navegador
# Ctrl+Shift+R (hard refresh)
```

#### 2. Banco de dados não conecta
```bash
# Verificar se PostgreSQL está rodando
docker ps | grep postgres

# Verificar logs do PostgreSQL
docker logs rc-postgres

# Testar conexão manual
docker exec -it rc-postgres psql -U postgres -d rc_construcoes_prod

# Verificar configurações de rede
docker network ls
docker network inspect rc-network
```

#### 3. Performance baixa
```bash
# Verificar uso de recursos
docker stats

# Verificar logs de performance
docker logs rc-backend | grep "performance"

# Analisar queries do banco
docker exec -it rc-postgres psql -U postgres -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  ORDER BY total_time DESC 
  LIMIT 10;"
```

#### 4. SSL/HTTPS problemas
```bash
# Verificar certificado
openssl x509 -in /etc/ssl/certs/rc-construcoes.crt -text -noout

# Testar SSL
curl -I https://rc-construcoes.com

# Verificar configuração do Nginx
nginx -t

# Renovar certificado Let's Encrypt
certbot renew --dry-run
```

### Logs Importantes

#### Localização dos Logs
- **Application**: `logs/application-YYYY-MM-DD.log`
- **Error**: `logs/error-YYYY-MM-DD.log`
- **Nginx**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **PostgreSQL**: Docker logs ou `/var/log/postgresql/`
- **Sistema**: `/var/log/syslog`

#### Comandos Úteis
```bash
# Seguir logs em tempo real
tail -f logs/application-$(date +%Y-%m-%d).log

# Logs do Docker
docker-compose logs -f

# Filtrar logs por erro
grep "ERROR" logs/application-*.log

# Logs do sistema
journalctl -f -u docker
```

## 📋 Checklist de Deployment

### Pré-Deployment
- [ ] Código testado e versionado
- [ ] Variáveis de ambiente configuradas
- [ ] Certificados SSL válidos
- [ ] Backup do sistema atual
- [ ] Dependências atualizadas
- [ ] Testes de segurança realizados

### Durante o Deployment
- [ ] Aplicação buildada com sucesso
- [ ] Containers iniciados corretamente
- [ ] Health checks passando
- [ ] SSL/HTTPS funcionando
- [ ] Banco de dados conectando
- [ ] Monitoramento ativo

### Pós-Deployment
- [ ] Funcionalidades testadas
- [ ] Performance verificada
- [ ] Logs funcionando
- [ ] Backups configurados
- [ ] Alertas configurados
- [ ] Documentação atualizada

## 📞 Suporte e Manutenção

### Contatos de Emergência
- **Administrador do Sistema**: admin@rc-construcoes.com
- **Desenvolvedor Principal**: dev@rc-construcoes.com
- **Suporte Técnico**: +55 (11) 99999-9999

### Manutenção Regular
- **Diária**: Verificar logs e alertas
- **Semanal**: Atualizar dependências não-críticas
- **Mensal**: Revisar métricas de performance
- **Trimestral**: Atualizar sistema operacional e dependências críticas

### Recursos Adicionais
- 📖 [Documentação da API](../api/README.md)
- 🐳 [Guia Docker](docker.md)
- ☁️ [Setup em Nuvem](cloud-setup.md)
- 📊 [Monitoramento](monitoring.md)
- 🧪 [Testes](../testing/README.md)

---

**⚠️ Importante**: 
- Sempre teste em ambiente de desenvolvimento antes de fazer deploy em produção
- Mantenha backups atualizados e teste procedures de recovery regularmente
- Monitore constantemente a saúde e performance da aplicação
- Mantenha a documentação atualizada conforme o sistema evolui

**🎉 Parabéns!** Se chegou até aqui, você tem tudo que precisa para fazer deploy do RC Construções com sucesso!