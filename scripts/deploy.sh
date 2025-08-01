#!/bin/bash

# RC Construções - Script de Implantação (Deploy)
# Versão 5.1 - Revisado e Aprimorado
#
# Este script automatiza o processo de implantação da aplicação RC Construções
# em um servidor remoto via SSH e Docker Compose.
# As configurações são lidas a partir de variáveis de ambiente para segurança e flexibilidade.

# =======================================================================
# CONFIGURAÇÕES (Lidas de Variáveis de Ambiente)
# =======================================================================

# Credenciais e conexão SSH para o servidor de destino
SSH_USER=${DEPLOY_SSH_USER}       # Usuário SSH (ex: 'deployuser')
SSH_HOST=${DEPLOY_SSH_HOST}       # Endereço IP ou hostname do servidor (ex: '192.168.1.100' ou 'meuservidor.com')
SSH_PORT=${DEPLOY_SSH_PORT:-22}   # Porta SSH, padrão 22
SSH_KEY=${DEPLOY_SSH_KEY:-~/.ssh/id_rsa} # Caminho para a chave SSH privada (opcional, se não usar agente SSH)

# Caminho do diretório da aplicação NO SERVIDOR REMOTO
APP_DIR_REMOTE=${DEPLOY_APP_DIR_REMOTE:-/home/${SSH_USER}/rc-construcoes-app}

# Caminho do arquivo docker-compose.prod.yml NO SERVIDOR REMOTO
DOCKER_COMPOSE_PATH_REMOTE="${APP_DIR_REMOTE}/docker/docker-compose.prod.yml"

# Repositório Git e branch a ser implantado
GIT_REPO=${DEPLOY_GIT_REPO:-https://github.com/rcconstrucoes/gestao-obras.git}
GIT_BRANCH=${DEPLOY_GIT_BRANCH:-main}

# Outras variáveis de ambiente que podem ser necessárias no servidor remoto
# Ex: DB_NAME_PROD, DB_USER_PROD, DB_PASSWORD_PROD, JWT_SECRET_PROD etc.
# Estas devem ser definidas no ambiente remoto ou no arquivo .env no servidor remoto.

# =======================================================================
# FUNÇÕES DE LOG
# =======================================================================

log_info() {
  echo -e "\e[34m$(date +%Y-%m-%d\ %H:%M:%S) [INFO]\e[0m $1"
}

log_success() {
  echo -e "\e[32m$(date +%Y-%m-%d\ %H:%M:%S) [SUCCESS]\e[0m $1"
}

log_warn() {
  echo -e "\e[33m$(date +%Y-%m-%d\ %H:%M:%S) [WARN]\e[0m $1"
}

log_error() {
  echo -e "\e[31m$(date +%Y-%m-%d\ %H:%M:%S) [ERROR]\e[0m $1" >&2 # Redireciona para stderr
  exit 1 # Encerra o script em caso de erro fatal
}

# =======================================================================
# VERIFICAÇÕES PRÉ-IMPLANTAÇÃO
# =======================================================================

log_info "Iniciando script de implantação da RC Construções..."

# Verifica se as variáveis de ambiente essenciais estão definidas
if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ] || [ -z "$GIT_REPO" ]; then
  log_error "Variáveis de ambiente SSH_USER, SSH_HOST, GIT_REPO são obrigatórias. Por favor, defina-as."
fi

# =======================================================================
# FUNÇÃO PARA EXECUTAR COMANDOS VIA SSH
# =======================================================================

# ssh_exec "comando a ser executado no remoto"
ssh_exec() {
  log_info "Executando no remoto: $1"
  ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "$1"
  if [ $? -ne 0 ]; then
    log_error "Falha na execução remota do comando: $1"
  fi
}

# =======================================================================
# ETAPAS DE IMPLANTAÇÃO
# =======================================================================

log_info "Conectando ao servidor remoto ${SSH_USER}@${SSH_HOST}..."

# 1. Navegar para o diretório da aplicação no servidor remoto ou clonar/atualizar
log_info "Verificando/Clonando/Atualizando repositório Git no servidor remoto..."
ssh_exec "
  if [ ! -d \"${APP_DIR_REMOTE}\" ]; then
    mkdir -p \"${APP_DIR_REMOTE}\" && \
    git clone ${GIT_REPO} ${APP_DIR_REMOTE} && \
    cd ${APP_DIR_REMOTE} && git checkout ${GIT_BRANCH};
  else
    cd ${APP_DIR_REMOTE} && \
    git fetch origin && \
    git checkout ${GIT_BRANCH} && \
    git pull origin ${GIT_BRANCH};
  fi
"

# 2. Construir e subir os serviços Docker Compose (backend, frontend, DB, Redis)
log_info "Construindo e subindo serviços Docker Compose..."
# Copia o .env.prod para o servidor (se você o gerencia fora do Git)
# Ex: scp -P "$SSH_PORT" -i "$SSH_KEY" .env.prod "$SSH_USER@$SSH_HOST:${APP_DIR_REMOTE}/.env"
# Ou, garanta que as variáveis de ambiente estejam no ambiente SSH de alguma forma.

# `docker compose build` para reconstruir imagens com base no código atual
# `docker compose up -d` para iniciar/atualizar os serviços em detached mode
# `--force-recreate` força a recriação de containers para aplicar novas imagens
# `--remove-orphans` remove serviços que não estão mais definidos no compose file
ssh_exec "
  cd ${APP_DIR_REMOTE} && \
  docker compose -f ${DOCKER_COMPOSE_PATH_REMOTE} pull && \
  docker compose -f ${DOCKER_COMPOSE_PATH_REMOTE} build --no-cache && \
  docker compose -f ${DOCKER_COMPOSE_PATH_REMOTE} up -d --force-recreate --remove-orphans
"

# 3. Executar Migrações do Banco de Dados (no container do backend)
log_info "Executando migrações do banco de dados..."
# Encontra o ID do container do backend para executar o comando
BACKEND_CONTAINER_ID=$(ssh_exec "docker compose -f ${DOCKER_COMPOSE_PATH_REMOTE} ps -q backend")
if [ -z "$BACKEND_CONTAINER_ID" ]; then
  log_error "Não foi possível encontrar o container do backend. Assegure que ele está rodando."
fi
ssh_exec "docker exec ${BACKEND_CONTAINER_ID} npm run db:migrate"

# 4. Opcional: Executar Seeders (apenas se for necessário para novos dados ou testes)
# log_info "Executando seeders do banco de dados (se aplicável)..."
# ssh_exec "docker exec ${BACKEND_CONTAINER_ID} npm run db:seed"

# 5. Opcional: Limpar imagens Docker antigas para liberar espaço
log_info "Limpando imagens Docker antigas (prune)..."
ssh_exec "docker image prune -f" # Remove imagens não utilizadas
# ssh_exec "docker volume prune -f" # Cuidado: remove volumes não utilizados, incluindo dados de DB se não forem geridos por compose

# =======================================================================
# FIM DA IMPLANTAÇÃO
# =======================================================================

log_success "Implantação da RC Construções concluída com sucesso no servidor ${SSH_HOST}!"
log_info "Acesse sua aplicação em: http://${SSH_HOST}"

exit 0