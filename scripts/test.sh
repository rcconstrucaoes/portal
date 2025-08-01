#!/bin/bash

# RC Construções - Script de Execução de Testes
# Versão 5.1 - Revisado e Aprimorado
#
# Este script automatiza a execução de testes unitários, de integração e E2E
# para o projeto RC Construções. Ele configura um ambiente de teste isolado com Docker Compose,
# executa os testes e gera relatórios.

# =======================================================================
# CONFIGURAÇÃO
# =======================================================================

PROJECT_ROOT="$(dirname "$(cd "$(dirname "$0")" && pwd)")" # Define PROJECT_ROOT como o diretório pai do diretório 'scripts'
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/rc-construcoes-web"
DOCKER_DIR="${PROJECT_ROOT}/docker"

# Arquivo .env de exemplo para variáveis de ambiente de teste
ENV_TEST_FILE="${PROJECT_ROOT}/.env.test"

# Variáveis para o ambiente de teste (usar valores do .env.test ou padrões)
# Estas deveriam ser configuradas no .env.test
# DB_NAME_TEST, DB_USER_TEST, DB_PASSWORD_TEST, JWT_SECRET_TEST, etc.

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
# FUNÇÕES DE VERIFICAÇÃO DE DEPENDÊNCIAS
# =======================================================================

command_exists () {
  command -v "$1" >/dev/null 2>&1
}

check_dependencies() {
  log_message "Verificando dependências de ferramentas de teste (Jest, Cypress, Docker Compose)..."
  local missing_deps=0

  if ! command_exists jest; then
    log_warn "Jest não encontrado. Instale com 'npm install -g jest' (ou localmente no projeto)."
    missing_deps=1
  fi

  if ! command_exists cypress; then
    log_warn "Cypress não encontrado. Instale com 'npm install -g cypress' (ou localmente no projeto)."
    missing_deps=1
  fi
  
  local docker_compose_cmd="docker compose"
  if ! command_exists docker compose; then
    docker_compose_cmd="docker-compose"
  fi
  if ! command_exists "${docker_compose_cmd}"; then
    log_error "Docker Compose não encontrado. É necessário para configurar o ambiente de teste."
  fi
  
  if [ "${missing_deps}" -ne 0 ]; then
    log_message "ERRO: Algumas dependências de teste necessárias não estão instaladas. Abortando execução de testes."
    exit 1
  fi
  log_success "Todas as dependências essenciais de teste estão instaladas."
}

# =======================================================================
# FUNÇÕES DE CONFIGURAÇÃO DO AMBIENTE DE TESTE
# =======================================================================

# Deruba e limpa o ambiente Docker de teste
teardown_docker_env() {
  log_message "Derrubando ambiente Docker de teste..."
  cd "$PROJECT_ROOT" || log_error "Diretório raiz do projeto não encontrado."
  local docker_compose_cmd="docker compose"
  if ! command_exists docker compose; then docker_compose_cmd="docker-compose"; fi
  "${docker_compose_cmd}" -f "${DOCKER_DIR}/docker-compose.test.yml" down --volumes --remove-orphans
  if [ $? -ne 0 ]; then log_warn "Falha ao derrubar ambiente Docker de teste. Pode haver containers/volumes órfãos."; fi
  log_success "Ambiente Docker de teste derrubado e limpo."
}

# Configura e sobe o ambiente Docker de teste
setup_docker_env() {
  log_message "Configurando ambiente Docker de teste..."
  cd "$PROJECT_ROOT" || log_error "Diretório raiz do projeto não encontrado."

  # Cria um arquivo .env.test a partir de .env.example se não existir
  if [ ! -f "$ENV_TEST_FILE" ]; then
    log_warn "Arquivo .env.test não encontrado. Criando um a partir de .env.example."
    cp "${PROJECT_ROOT}/.env.example" "$ENV_TEST_FILE"
    # Adicione valores específicos para teste no .env.test aqui, se necessário.
    # Ex: sed -i 's/DB_NAME=.*/DB_NAME=rc_construcoes_test/' "$ENV_TEST_FILE"
    log_message "Por favor, verifique e ajuste as variáveis em ${ENV_TEST_FILE} para o ambiente de teste."
  fi
  
  # Exporta as variáveis de ambiente do .env.test para o script atual
  # Isso garante que docker-compose use as variáveis específicas de teste
  set -a # Export all variables defined
  source "$ENV_TEST_FILE"
  set +a # Stop exporting

  # Constrói as imagens e sobe os serviços em modo detached
  log_message "Subindo serviços Docker para teste (backend, db, redis)..."
  local docker_compose_cmd="docker compose"
  if ! command_exists docker compose; then docker_compose_cmd="docker-compose"; fi
  "${docker_compose_cmd}" -f "${DOCKER_DIR}/docker-compose.test.yml" up -d --build
  if [ $? -ne 0 ]; then log_error "Falha ao subir serviços Docker de teste. Verifique os logs."; fi
  log_success "Serviços Docker de teste iniciados."

  # Aguarda o banco de dados estar pronto
  log_message "Aguardando o banco de dados de teste estar saudável (máx. 60s)..."
  timeout 60 bash -c '
    local docker_compose_cmd="docker compose"
    if ! command_exists docker compose; then docker_compose_cmd="docker-compose"; fi
    while ! "${docker_compose_cmd}" -f "${DOCKER_DIR}/docker-compose.test.yml" exec db pg_isready -U "${DB_USER_TEST:-postgres}" -d "${DB_NAME_TEST:-rc_construcoes_test}"; do
      sleep 2
    done
  '
  if [ $? -ne 0 ]; then log_error "Banco de dados de teste não ficou saudável a tempo."; fi
  log_success "Banco de dados de teste está saudável."

  # Executa migrações no banco de dados de teste
  log_message "Executando migrações no banco de dados de teste..."
  "${docker_compose_cmd}" -f "${DOCKER_DIR}/docker-compose.test.yml" exec backend npm run db:migrate
  if [ $? -ne 0 ]; then log_warn "Falha nas migrações de teste. Pode ser normal se já atualizado, ou um problema."; fi
  log_success "Migrações de teste executadas."
  
  # Executa seeders no banco de dados de teste (para dados iniciais de teste)
  log_message "Executando seeders no banco de dados de teste..."
  "${docker_compose_cmd}" -f "${DOCKER_DIR}/docker-compose.test.yml" exec backend npm run db:seed
  if [ $? -ne 0 ]; then log_warn "Falha nos seeders de teste. Pode ser normal se já houver dados."; fi
  log_success "Seeders de teste executados."
}

# =======================================================================
# FUNÇÕES DE EXECUÇÃO DE TESTES
# =======================================================================

run_backend_tests() {
  log_message "Executando testes de Backend (Unitários e Integração)..."
  cd "$BACKEND_DIR" || log_error "Diretório do Backend não encontrado."
  npm test -- --ci --runInBand # --ci para ambiente CI, --runInBand para evitar testes paralelos (DB)
  local exit_code=$?
  if [ ${exit_code} -ne 0 ]; then log_error "Testes de Backend falharam."; fi
  log_success "Testes de Backend concluídos."
  return ${exit_code}
}

run_frontend_tests() {
  log_message "Executando testes de Frontend (Unitários e Integração)..."
  cd "$FRONTEND_DIR" || log_error "Diretório do Frontend não encontrado."
  # Assumindo que os testes de frontend são Jest ou similar
  npm test -- --ci --runInBand
  local exit_code=$?
  if [ ${exit_code} -ne 0 ]; then log_error "Testes de Frontend falharam."; fi
  log_success "Testes de Frontend concluídos."
  return ${exit_code}
}

run_e2e_tests() {
  log_message "Executando testes E2E (End-to-End) com Cypress..."
  cd "$FRONTEND_DIR" || log_error "Diretório do Frontend não encontrado." # Cypress é geralmente executado do frontend
  
  # Cypress precisa que os serviços frontend e backend estejam rodando
  local docker_compose_cmd="docker compose"
  if ! command_exists docker compose; then docker_compose_cmd="docker-compose"; fi
  
  log_message "Aguardando Frontend estar acessível (máx. 60s)..."
  timeout 60 bash -c '
    while ! curl -s http://localhost:8080 > /dev/null; do
      sleep 2
    done
  '
  if [ $? -ne 0 ]; then log_error "Frontend não ficou acessível para testes E2E."; fi
  log_success "Frontend está acessível."

  # Executa Cypress em modo headless (sem UI)
  npx cypress run
  local exit_code=$?
  if [ ${exit_code} -ne 0 ]; then log_error "Testes E2E falharam."; fi
  log_success "Testes E2E concluídos."
  return ${exit_code}
}

# =======================================================================
# FUNÇÃO PRINCIPAL DO SCRIPT
# =======================================================================

main() {
  log_message "Iniciando execução de testes para RC Construções..."

  local overall_exit_code=0

  # Configura o ambiente Docker de teste
  setup_docker_env

  # Executa os testes sequencialmente
  if ! run_backend_tests; then overall_exit_code=1; fi
  if ! run_frontend_tests; then overall_exit_code=1; fi
  if ! run_e2e_tests; then overall_exit_code=1; fi

  # Derruba o ambiente Docker de teste
  teardown_docker_env

  if [ ${overall_exit_code} -eq 0 ]; then
    log_success "🎉 Todos os testes foram executados com sucesso!"
  else
    log_error "❌ Alguns testes falharam. Verifique os logs acima."
  fi

  exit ${overall_exit_code}
}

# =======================================================================
# ANÁLISE DE ARGUMENTOS (Permite rodar partes específicas)
# =======================================================================

case "$1" in
  "backend")
    setup_docker_env
    run_backend_tests
    teardown_docker_env
    ;;
  "frontend")
    setup_docker_env
    run_frontend_tests
    teardown_docker_env
    ;;
  "e2e")
    setup_docker_env
    run_e2e_tests
    teardown_docker_env
    ;;
  "all" | "") # Padrão: rodar todos os testes
    main
    ;;
  *)
    log_error "Uso: $0 [backend|frontend|e2e|all]"
    ;;
esac