#!/bin/bash

# RC Construções - Script de Backup do Banco de Dados PostgreSQL
# Versão 5.1 - Revisado e Aprimorado
#
# Este script automatiza o backup do banco de dados PostgreSQL.
# Ele cria um dump do banco de dados e gerencia a retenção de backups antigos.
# As configurações são lidas a partir de variáveis de ambiente para segurança e flexibilidade.

# =======================================================================
# CONFIGURAÇÕES (Lidas de Variáveis de Ambiente ou valores padrão)
# =======================================================================

# Credenciais e conexão com o Banco de Dados (PostgreSQL)
DB_HOST=${DB_HOST_PROD:-db} # Host do banco de dados (nome do serviço Docker em produção)
DB_PORT=${DB_PORT_PROD:-5432} # Porta do banco de dados
DB_USER=${DB_USER_PROD:-postgres} # Usuário do banco de dados
DB_PASSWORD=${DB_PASSWORD_PROD} # Senha do banco de dados (ESSENCIAL, SEM PADRÃO SEGURO)
DB_NAME=${DB_NAME_PROD:-rc_construcoes_prod} # Nome do banco de dados a ser backupado

# Diretório de saída dos backups DENTRO DO CONTAINER
# Este diretório deve ser montado como um volume no docker-compose.prod.yml
BACKUP_DIR=${DB_BACKUP_OUTPUT_DIR:-/app/backups}

# Retenção de backups (número de dias para manter backups)
BACKUP_RETENTION_DAYS=${DB_BACKUP_RETENTION_DAYS:-30} # Padrão: 30 dias

# Nome do arquivo de backup (com timestamp)
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/rc_construcoes_db_backup_${TIMESTAMP}.sql"

# Caminho para o log do script de backup
LOG_FILE="${BACKUP_DIR}/backup.log"

# =======================================================================
# FUNÇÕES DE LOG
# =======================================================================

log_info() {
  echo "$(date +%Y-%m-%d\ %H:%M:%S) [INFO] $1" | tee -a "$LOG_FILE"
}

log_success() {
  echo "$(date +%Y-%m-%d\ %H:%M:%S) [SUCCESS] $1" | tee -a "$LOG_FILE"
}

log_warn() {
  echo "$(date +%Y-%m-%d\ %H:%M:%S) [WARN] $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo "$(date +%Y-%m-%d\ %H:%M:%S) [ERROR] $1" | tee -a "$LOG_FILE"
}

# =======================================================================
# VERIFICAÇÕES PRÉ-EXECUÇÃO
# =======================================================================

# Verifica se a senha do banco de dados está definida
if [ -z "$DB_PASSWORD" ]; then
  log_error "Variável de ambiente DB_PASSWORD não definida. Impossível conectar ao banco de dados."
  exit 1
fi

# Cria o diretório de backup se não existir
if [ ! -d "$BACKUP_DIR" ]; then
  log_info "Diretório de backup '$BACKUP_DIR' não encontrado. Criando..."
  mkdir -p "$BACKUP_DIR"
  if [ $? -ne 0 ]; then
    log_error "Falha ao criar o diretório de backup '$BACKUP_DIR'. Verifique as permissões."
    exit 1
  fi
fi

# Exporta a senha do DB para que pg_dump possa usá-la sem exigir interação
export PGPASSWORD="$DB_PASSWORD"

# =======================================================================
# EXECUÇÃO DO BACKUP
# =======================================================================

log_info "Iniciando backup do banco de dados '$DB_NAME' em '$DB_HOST:$DB_PORT'..."
log_info "Arquivo de backup: $BACKUP_FILE"

# Executa o pg_dump
# -h: host
# -p: porta
# -U: usuário
# -d: database
# -Fc: formato custom (pode ser compactado e restaurado seletivamente)
# -Fp: formato plain text (útil para inspeção direta)
# -v: verbose (saída detalhada)
# >: redireciona a saída para o arquivo de backup
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fp -v > "$BACKUP_FILE"

# Verifica o status da execução do pg_dump
if [ $? -eq 0 ]; then
  log_success "Backup do banco de dados '$DB_NAME' concluído com sucesso."
  # Verifica se o arquivo de backup foi criado e não está vazio
  if [ -s "$BACKUP_FILE" ]; then
    log_info "Tamanho do arquivo de backup: $(du -h "$BACKUP_FILE" | awk '{print $1}')"
  else
    log_warn "Arquivo de backup '$BACKUP_FILE' foi criado, mas está vazio ou é muito pequeno. Verifique o backup."
  fi
else
  log_error "Falha no backup do banco de dados '$DB_NAME'."
  rm -f "$BACKUP_FILE" # Remove o arquivo de backup incompleto/com erro
  exit 1
fi

# =======================================================================
# GESTÃO DE RETENÇÃO (LIMPEZA DE BACKUPS ANTIGOS)
# =======================================================================

log_info "Iniciando limpeza de backups antigos. Retenção: ${BACKUP_RETENTION_DAYS} dias."

# Encontra e deleta arquivos de backup mais antigos que a retenção
# -mtime +N: arquivos modificados há mais de N dias
# -type f: apenas arquivos (não diretórios)
# -name "*.sql": apenas arquivos .sql
# -delete: deleta os arquivos encontrados
find "$BACKUP_DIR" -type f -name "*.sql" -mtime +"$BACKUP_RETENTION_DAYS" -delete

if [ $? -eq 0 ]; then
  log_success "Limpeza de backups antigos concluída com sucesso."
else
  log_error "Falha na limpeza de backups antigos. Verifique as permissões do diretório '$BACKUP_DIR'."
fi

# =======================================================================
# FIM DO SCRIPT
# =======================================================================

# Desconfigura a variável de ambiente PGPASSWORD por segurança
unset PGPASSWORD

log_info "Script de backup concluído."
exit 0