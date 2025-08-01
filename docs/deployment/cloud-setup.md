# ☁️ Configuração de Cloud para RC Construções

## 📋 Visão Geral

Este guia fornece instruções completas para configurar o sistema RC Construções em ambientes de nuvem, incluindo AWS, Azure, Google Cloud e DigitalOcean. O sistema foi projetado para ser altamente escalável e resiliente.

## 🏗️ Arquitetura Recomendada

### Componentes Principais
- **Frontend**: Aplicação PWA estática
- **Backend API**: Node.js com Express
- **Banco de Dados**: PostgreSQL ou MySQL
- **Cache**: Redis
- **Proxy Reverso**: Nginx
- **Monitoramento**: Prometheus + Grafana
- **CI/CD**: GitHub Actions

## 🚀 AWS (Amazon Web Services)

### 1. Configuração Básica

#### 1.1 EC2 Instance
```bash
# Instância recomendada: t3.medium ou superior
# Sistema Operacional: Ubuntu 22.04 LTS

# Conectar via SSH
ssh -i "rc-key.pem" ubuntu@your-ec2-ip

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker e Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 1.2 RDS (PostgreSQL)
```yaml
# Configuração RDS
Engine: PostgreSQL 15
Instance Class: db.t3.micro (dev) / db.t3.small (prod)
Storage: 20GB SSD
Multi-AZ: Sim (produção)
Backup Retention: 7 dias
```

#### 1.3 ElastiCache (Redis)
```yaml
# Configuração ElastiCache
Engine: Redis 7.0
Node Type: cache.t3.micro
Cluster Mode: Disabled
Backup: Habilitado
```

#### 1.4 S3 Bucket (Armazenamento)
```bash
# Criar bucket para backups e logs
aws s3 mb s3://rc-construcoes-backups
aws s3 mb s3://rc-construcoes-logs

# Configurar lifecycle policy
aws s3api put-bucket-lifecycle-configuration --bucket rc-construcoes-backups --lifecycle-configuration file://s3-lifecycle.json
```

### 2. Deployment com Docker

#### 2.1 Docker Compose - Produção AWS
```yaml
# docker-compose.aws.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DB_HOST=${RDS_ENDPOINT}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=rc_construcoes_db
      - REDIS_HOST=${ELASTICACHE_ENDPOINT}
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
    volumes:
      - frontend_dist:/usr/share/nginx/html
    restart: unless-stopped

volumes:
  frontend_dist:
```

#### 2.2 Variáveis de Ambiente
```bash
# .env.aws
NODE_ENV=production
DB_HOST=rc-db.cluster-xxxxx.us-east-1.rds.amazonaws.com
DB_USER=rcadmin
DB_PASSWORD=your-secure-password
DB_NAME=rc_construcoes_db
REDIS_HOST=rc-cache.xxxxx.cache.amazonaws.com
JWT_SECRET=your-super-secure-jwt-secret-key
API_URL=https://api.rc-construcoes.com
```

### 3. Load Balancer e Auto Scaling

#### 3.1 Application Load Balancer
```json
{
  "Type": "application",
  "Scheme": "internet-facing",
  "IpAddressType": "ipv4",
  "Subnets": ["subnet-12345", "subnet-67890"],
  "SecurityGroups": ["sg-web"],
  "Tags": [
    {
      "Key": "Name",
      "Value": "RC-Construcoes-ALB"
    }
  ]
}
```

#### 3.2 Auto Scaling Group
```json
{
  "AutoScalingGroupName": "rc-construcoes-asg",
  "MinSize": 1,
  "MaxSize": 3,
  "DesiredCapacity": 2,
  "LaunchTemplate": {
    "LaunchTemplateName": "rc-construcoes-template",
    "Version": "$Latest"
  },
  "TargetGroupARNs": ["arn:aws:elasticloadbalancing:..."],
  "HealthCheckType": "ELB",
  "HealthCheckGracePeriod": 300
}
```

## ☁️ Microsoft Azure

### 1. Azure Container Instances

#### 1.1 Resource Group
```bash
# Criar Resource Group
az group create --name rc-construcoes-rg --location eastus

# Criar Azure Container Registry
az acr create --resource-group rc-construcoes-rg --name rccontainers --sku Standard
```

#### 1.2 Azure Database for PostgreSQL
```bash
# Criar servidor PostgreSQL
az postgres server create \
  --resource-group rc-construcoes-rg \
  --name rc-postgres-server \
  --location eastus \
  --admin-user rcadmin \
  --admin-password YourSecurePassword123! \
  --sku-name GP_Gen5_2 \
  --version 13
```

#### 1.3 Azure Cache for Redis
```bash
# Criar cache Redis
az redis create \
  --resource-group rc-construcoes-rg \
  --name rc-redis-cache \
  --location eastus \
  --sku Standard \
  --vm-size c1
```

### 2. Container Deployment

#### 2.1 Docker Compose - Azure
```yaml
# docker-compose.azure.yml
version: '3.8'

services:
  app:
    image: rccontainers.azurecr.io/rc-construcoes:latest
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=${AZURE_POSTGRES_HOST}
      - DB_USER=${AZURE_POSTGRES_USER}
      - DB_PASSWORD=${AZURE_POSTGRES_PASSWORD}
      - REDIS_HOST=${AZURE_REDIS_HOST}
      - REDIS_PASSWORD=${AZURE_REDIS_PASSWORD}
    restart: unless-stopped
```

## 🌐 Google Cloud Platform

### 1. Google Cloud Run

#### 1.1 Dockerfile Otimizado para Cloud Run
```dockerfile
# Dockerfile.cloudrun
FROM node:18-alpine

WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código
COPY . .

# Expor porta (Cloud Run usa PORT env var)
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

# Comando de inicialização
CMD ["npm", "start"]
```

#### 1.2 Deploy para Cloud Run
```bash
# Build e push da imagem
gcloud builds submit --tag gcr.io/PROJECT_ID/rc-construcoes

# Deploy no Cloud Run
gcloud run deploy rc-construcoes \
  --image gcr.io/PROJECT_ID/rc-construcoes \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DB_HOST=$CLOUD_SQL_CONNECTION_NAME \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10
```

### 2. Cloud SQL e Memorystore

#### 2.1 Cloud SQL (PostgreSQL)
```bash
# Criar instância Cloud SQL
gcloud sql instances create rc-postgres \
  --database-version=POSTGRES_13 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YourSecurePassword

# Criar database
gcloud sql databases create rc_construcoes_db --instance=rc-postgres
```

#### 2.2 Memorystore (Redis)
```bash
# Criar instância Redis
gcloud redis instances create rc-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_6_x
```

## 🌊 DigitalOcean

### 1. Droplet Setup

#### 1.1 Criação do Droplet
```bash
# Criar droplet via CLI
doctl compute droplet create rc-construcoes \
  --region nyc1 \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-2gb \
  --ssh-keys YOUR_SSH_KEY_ID
```

#### 1.2 Managed Database
```bash
# Criar cluster PostgreSQL
doctl databases create rc-postgres-cluster \
  --engine pg \
  --version 13 \
  --region nyc1 \
  --size db-s-1vcpu-1gb \
  --num-nodes 1
```

### 2. App Platform Deployment

#### 2.1 App Spec (app.yaml)
```yaml
name: rc-construcoes
services:
- name: backend
  source_dir: /backend
  github:
    repo: your-username/rc-construcoes
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: DB_HOST
    value: ${rc-postgres.HOSTNAME}
  - key: DB_USER
    value: ${rc-postgres.USERNAME}
  - key: DB_PASSWORD
    value: ${rc-postgres.PASSWORD}

- name: frontend
  source_dir: /
  github:
    repo: your-username/rc-construcoes
    branch: main
  build_command: npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs

databases:
- name: rc-postgres
  engine: PG
  version: "13"
  size: db-s-1vcpu-1gb
```

## 🔧 Configurações Comuns

### 1. Nginx Configuration

#### 1.1 nginx.conf
```nginx
upstream backend {
    server backend:3000;
}

server {
    listen 80;
    server_name rc-construcoes.com www.rc-construcoes.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rc-construcoes.com www.rc-construcoes.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Frontend (Static Files)
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Backend
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health Check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### 2. SSL Certificate (Let's Encrypt)

#### 2.1 Certbot Installation
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d rc-construcoes.com -d www.rc-construcoes.com

# Auto-renovação
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Monitoring e Logs

#### 3.1 Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'rc-construcoes'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
```

#### 3.2 Grafana Dashboard
```json
{
  "dashboard": {
    "title": "RC Construções - Monitoring",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "http_request_duration_seconds_bucket"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

### 4. Backup e Recovery

#### 4.1 Script de Backup
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="rc_construcoes_db"

# Backup do banco de dados
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Backup dos arquivos de upload (se houver)
tar -czf $BACKUP_DIR/files_backup_$DATE.tar.gz /app/uploads

# Upload para S3 (AWS) ou equivalente
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql s3://rc-construcoes-backups/
aws s3 cp $BACKUP_DIR/files_backup_$DATE.tar.gz s3://rc-construcoes-backups/

# Limpeza de backups antigos (manter últimos 7 dias)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### 5. CI/CD Pipeline

#### 5.1 GitHub Actions Workflow
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
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Build and push Docker image
        run: |
          docker build -t rc-construcoes .
          docker tag rc-construcoes:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rc-construcoes:latest
          aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
          docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rc-construcoes:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster rc-construcoes --service rc-construcoes --force-new-deployment
```

## 🔐 Segurança

### 1. Variáveis de Ambiente Seguras
```bash
# Usar AWS Secrets Manager, Azure Key Vault, ou equivalente
# Nunca commitar secrets no código

# Exemplo AWS Secrets Manager
aws secretsmanager create-secret \
    --name rc-construcoes/db-credentials \
    --description "RC Construções Database Credentials" \
    --secret-string '{"username":"rcadmin","password":"YourSecurePassword"}'
```

### 2. Firewall Rules
```bash
# Permitir apenas tráfego necessário
# HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# SSH (restrito a IPs específicos)
ufw allow from YOUR_IP to any port 22

# Banco de dados (apenas para aplicação)
ufw allow from APP_SUBNET to any port 5432

# Ativar firewall
ufw enable
```

### 3. Network Security
```yaml
# Security Groups (AWS) / Network Security Groups (Azure)
WebSecurityGroup:
  - Port: 80, Source: 0.0.0.0/0
  - Port: 443, Source: 0.0.0.0/0

AppSecurityGroup:
  - Port: 3000, Source: WebSecurityGroup
  - Port: 22, Source: AdminIPs

DatabaseSecurityGroup:
  - Port: 5432, Source: AppSecurityGroup
```

## 📊 Monitoramento e Alertas

### 1. Health Checks
```javascript
// Backend health endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    // Check Redis connection
    await redis.ping();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### 2. Alertas
```yaml
# AlertManager configuration
groups:
  - name: rc-construcoes-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Alta taxa de erro em RC Construções"
          
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Banco de dados indisponível"
```

## 🚀 Performance Optimization

### 1. CDN Configuration
```javascript
// Frontend build com CDN
const CDN_URL = process.env.NODE_ENV === 'production' 
  ? 'https://d123456789.cloudfront.net' 
  : '';

// Cache headers para assets estáticos
app.use('/static', express.static('public', {
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
```

### 2. Database Optimization
```sql
-- Índices para performance
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_budgets_contract_id ON budgets(contract_id);
CREATE INDEX idx_financial_date ON financial_records(transaction_date);

-- Vacuum e análise regular
SELECT cron.schedule('vacuum-analyze', '0 2 * * *', 'VACUUM ANALYZE;');
```

## 📝 Checklist de Deploy

### Pré-Deploy
- [ ] Testes unitários passando
- [ ] Testes de integração passando
- [ ] Variáveis de ambiente configuradas
- [ ] Secrets configurados no provedor
- [ ] Backup do banco de dados atual
- [ ] SSL certificado válido

### Deploy
- [ ] Build da aplicação
- [ ] Push das imagens Docker
- [ ] Deploy da aplicação
- [ ] Verificação dos health checks
- [ ] Teste das funcionalidades críticas

### Pós-Deploy
- [ ] Monitoramento ativo
- [ ] Logs funcionando
- [ ] Backup schedule ativo
- [ ] Alertas configurados
- [ ] Performance monitoring

## 🆘 Troubleshooting

### Problemas Comuns

#### 1. Conexão com Banco de Dados
```bash
# Verificar conectividade
telnet DB_HOST 5432

# Verificar logs da aplicação
docker logs rc-construcoes-backend

# Verificar configurações
env | grep DB_
```

#### 2. Problemas de Performance
```bash
# Verificar recursos do sistema
htop
iotop
df -h

# Verificar logs do Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Análise de performance do banco
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

#### 3. Problemas de SSL
```bash
# Verificar certificado
openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout

# Teste SSL
curl -I https://rc-construcoes.com

# Renovar certificado
sudo certbot renew --dry-run
```

## 📞 Suporte

Para problemas específicos de configuração ou deploy, consulte:

1. **Documentação da API**: `/docs/api/`
2. **Logs da aplicação**: `/monitoring/dashboards/logs.html`
3. **Health checks**: `https://your-domain.com/health`
4. **Métricas**: `https://your-domain.com/metrics`

---

**⚠️ Importante**: Sempre teste as configurações em um ambiente de desenvolvimento antes de aplicar em produção. Mantenha backups atualizados e monitore constantemente a saúde da aplicação.