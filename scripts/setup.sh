#!/bin/bash

# RC Construções - Script de Configuração do Ambiente de Desenvolvimento
# Versão 5.1 - Revisado e Aprimorado
#
# Este script automatiza a configuração inicial de um ambiente de desenvolvimento
# para o projeto RC Construções. Ele verifica e instala pré-requisitos,
# configura variáveis de ambiente, instala dependências e inicia serviços Docker.

# =======================================================================
# CONFIGURAÇÃO
# =======================================================================

PROJECT_ROOT="$(dirname "$(cd "$(dirname "$0")" && pwd)")" # Define PROJECT_ROOT como o diretório pai do diretório 'scripts'
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/rc-construcoes-web"
DOCKER_DIR="${PROJECT_ROOT}/docker"

ENV_FILE="${PROJECT_ROOT}/.env" # Arquivo .env central para o projeto

# =======================================================================
# FUNÇÕES DE LOG
# =======================================================================

log_message() {
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
# FUNÇÕES DE PRÉ-REQUISITOS
# =======================================================================

# Função para verificar se um comando existe
command_exists () {
  command -v "$1" >/dev/null 2>&1
}

# Verifica e instala Git
check_git() {
  log_message "Verificando instalação do Git..."
  if ! command_exists git; then
    log_warn "Git não encontrado. Tentando instalar..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
      sudo apt-get update && sudo apt-get install -y git
    elif [[ "$OSTYPE" == "darwin"* ]]; then
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      brew install git
    else
      log_error "Sistema operacional não suportado para instalação automática do Git. Por favor, instale o Git manualmente."
    fi
  fi
  log_success "Git está instalado."
}

# Verifica e instala Node.js e npm
check_node_npm() {
  log_message "Verificando instalação do Node.js e npm..."
  if ! command_exists node; then
    log_warn "Node.js não encontrado. Por favor, instale a versão 18 ou superior. Recomendado: nvm (Node Version Manager)."
    log_error "Instalação automática de Node.js não é recomendada por este script. Visite https://nodejs.org/pt-br/download/ para instruções."
  fi
  if ! command_exists npm; then
    log_warn "npm não encontrado. Ele geralmente vem com o Node.js. Verifique sua instalação do Node.js."
    log_error "Instalação do npm falhou ou não está no PATH. Por favor, resolva isso manualmente."
  fi
  log_success "Node.js e npm estão instalados."
  node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
  npm_version=$(npm -v | cut -d '.' -f 1)
  if [ "$node_version" -lt 18 ] || [ "$npm_version" -lt 9 ]; then
    log_warn "Aviso: Node.js v${node_version} ou npm v${npm_version} podem não atender aos requisitos mínimos (Node >=18, npm >=9). Considere atualizar."
  fi
}

# Verifica e instala Docker e Docker Compose
check_docker() {
  log_message "Verificando instalação do Docker e Docker Compose..."
  if ! command_exists docker; then
    log_warn "Docker não encontrado. Por favor, instale o Docker Desktop (Windows/macOS) ou Docker Engine (Linux)."
    log_error "Instalação automática de Docker não é recomendada por este script. Visite https://docs.docker.com/get-docker/ para instruções."
  fi
  if ! command_exists docker compose; then # docker compose (novo CLI) ou docker-compose (legado)
    log_warn "Docker Compose (novo CLI) não encontrado. Verificando docker-compose legado..."
    if ! command_exists docker-compose; then
      log_error "Docker Compose não encontrado. Por favor, instale o Docker Compose."
    fi
  fi
  log_success "Docker e Docker Compose estão instalados."
  docker_compose_cmd="docker compose" # Preferir o novo comando
  if ! command_exists docker compose; then docker_compose_cmd="docker-compose"; fi
  log_message "Usando comando Docker Compose: ${docker_compose_cmd}"
}

# =======================================================================
# FUNÇÕES DE CONFIGURAÇÃO DO AMBIENTE
# =======================================================================

# Cria e configura o arquivo .env
setup_env_file() {
  log_message "Configurando arquivo .env..."
  if [ ! -f "$ENV_FILE" ]; then
    log_warn "Arquivo .env não encontrado. Criando um a partir de .env.example."
    cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE"
    if [ $? -ne 0 ]; then
      log_error "Falha ao criar o arquivo .env."
    fi
  fi
  log_success "Arquivo .env está presente. Verifique e edite-o para suas configurações (DB, JWT, Redis)."
  log_message "Você pode abrir o arquivo ${ENV_FILE} para ajustar as credenciais e configurações."
}

# Instala dependências do NPM para backend e frontend
install_npm_dependencies() {
  log_message "Instalando dependências NPM para o Backend..."
  cd "$BACKEND_DIR" || log_error "Diretório do Backend não encontrado: ${BACKEND_DIR}"
  npm install
  if [ $? -ne 0 ]; then log_error "Falha ao instalar dependências do Backend."; fi
  log_success "Dependências do Backend instaladas."

  log_message "Instalando dependências NPM para o Frontend..."
  cd "$FRONTEND_DIR" || log_error "Diretório do Frontend não encontrado: ${FRONTEND_DIR}"
  npm install
  if [ $? -ne 0 ]; then log_error "Falha ao instalar dependências do Frontend."; fi
  log_success "Dependências do Frontend instaladas."
}

# Inicia os serviços Docker (DB e Redis) e executa migrações/seeders
start_docker_services_and_db_setup() {
  log_message "Iniciando serviços Docker (PostgreSQL, Redis)..."
  cd "$PROJECT_ROOT" || log_error "Diretório raiz do projeto não encontrado: ${PROJECT_ROOT}"
  
  # Usa 'docker compose' (novo CLI) ou 'docker-compose' (legado)
  local docker_compose_command="docker compose"
  if ! command_exists docker compose; then
    docker_compose_command="docker-compose"
  fi

  # Inicia os serviços definidos no docker-compose.yml em modo detached
  "${docker_compose_command}" up -d --build
  if [ $? -ne 0 ]; then log_error "Falha ao iniciar serviços Docker. Verifique seus logs do Docker."; fi
  log_success "Serviços Docker iniciados."

  log_message "Aguardando o banco de dados estar pronto (pode levar alguns segundos)..."
  sleep 10 # Dá um tempo para o DB iniciar completamente
  # Você pode usar um loop de verificação de healthcheck mais robusto aqui se necessário

  log_message "Executando migrações do banco de dados (no container do backend)..."
  # O comando `exec` do Docker Compose precisa do nome do serviço e do comando a ser executado dentro dele
  "${docker_compose_command}" exec backend npm run db:migrate
  if [ $? -ne 0 ]; then log_warn "Falha nas migrações do banco de dados. Isso pode ser normal se o DB já estiver atualizado, ou um problema real."; fi
  log_success "Migrações do banco de dados executadas."

  log_message "Executando seeders do banco de dados (para dados de demonstração/iniciais)..."
  "${docker_compose_command}" exec backend npm run db:seed
  if [ $? -ne 0 ]; then log_warn "Falha nos seeders do banco de dados. Pode ser normal se já houver dados."; fi
  log_success "Seeders do banco de dados executados."
}

# =======================================================================
# FUNÇÃO PRINCIPAL
# =======================================================================

main() {
  log_message "Iniciando script de configuração do ambiente de desenvolvimento RC Construções..."

  # Etapa 1: Verificar e instalar pré-requisitos
  check_git
  check_node_npm
  check_docker

  # Etapa 2: Configurar arquivo .env
  setup_env_file

  # Etapa 3: Instalar dependências NPM
  install_npm_dependencies

  # Etapa 4: Iniciar serviços Docker e configurar DB
  start_docker_services_and_db_setup

  log_success "Ambiente de desenvolvimento RC Construções configurado com sucesso!"
  log_message "Para iniciar o backend: cd ${BACKEND_DIR} && npm run dev"
  log_message "Para iniciar o frontend: cd ${FRONTEND_DIR} && npm start"
  log_message "Acesse o frontend em: http://localhost:8080"
  log_message "Acesse o backend em: http://localhost:3000"
}

# =======================================================================
# OPÇÃO DE LIMPEZA (CLEANUP)
# =======================================================================

cleanup() {
  log_message "Iniciando limpeza do ambiente de desenvolvimento Docker..."
  cd "$PROJECT_ROOT" || log_error "Diretório raiz do projeto não encontrado: ${PROJECT_ROOT}"

  local docker_compose_command="docker compose"
  if ! command_exists docker compose; then docker_compose_command="docker-compose"; fi

  "${docker_compose_command}" down --volumes --remove-orphans
  if [ $? -ne 0 ]; then log_warn "Falha ao derrubar serviços Docker. Alguns containers/volumes podem persistir."; fi
  log_success "Serviços Docker e volumes persistentes removidos."

  log_message "Removendo pastas node_modules..."
  if [ -d "${BACKEND_DIR}/node_modules" ]; then
    rm -rf "${BACKEND_DIR}/node_modules"
    log_success "node_modules do Backend removido."
  fi
  if [ -d "${FRONTEND_DIR}/node_modules" ]; then
    rm -rf "${FRONTEND_DIR}/node_modules"
    log_success "node_modules do Frontend removido."
  fi

  log_message "Limpeza concluída. O ambiente está pronto para uma nova configuração."
}

# =======================================================================
# ANÁLISE DE ARGUMENTOS
# =======================================================================

if [ "$1" == "cleanup" ]; then
  cleanup
elif [ -z "$1" ]; then
  main
else
  log_error "Uso: $0 [cleanup]"
fi