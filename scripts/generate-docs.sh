#!/bin/bash

# RC Construções - Script Gerador de Documentação
# Versão 5.1 - Revisado e Aprimorado
#
# Este script automatiza a geração de documentação para o projeto RC Construções.
# Inclui documentação da API (Swagger/OpenAPI), frontend (JSDoc) e Markdown.
# Assegura que todas as ferramentas necessárias estão instaladas e que a documentação é organizada.

# =======================================================================
# CONFIGURAÇÃO
# =======================================================================

PROJECT_ROOT="$(dirname "$(cd "$(dirname "$0")" && pwd)")" # Define PROJECT_ROOT como o diretório pai do diretório 'scripts'
DOCS_DIR="${PROJECT_ROOT}/docs"
OUTPUT_DIR="${DOCS_DIR}/generated"
API_DOCS_DIR="${OUTPUT_DIR}/api"
FRONTEND_DOCS_DIR="${OUTPUT_DIR}/frontend"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Caminhos e configurações das ferramentas de documentação
JSDOC_CONFIG_FRONTEND="${PROJECT_ROOT}/jsdoc.frontend.json" # Configuração JSDoc para o frontend
JSDOC_CONFIG_BACKEND="${PROJECT_ROOT}/jsdoc.backend.json"   # Configuração JSDoc para o backend
SWAGGER_API_SPEC="${PROJECT_ROOT}/backend/swagger.yaml" # Arquivo de especificação OpenAPI/Swagger para a API
CHANGELOG_FILE="${PROJECT_ROOT}/CHANGELOG.md"             # Arquivo de Changelog (se gerado por ferramenta)

# Diretórios que contêm arquivos Markdown (ex: README.md, guias)
MARKDOWN_SOURCES=(
  "${PROJECT_ROOT}/README.md"
  "${PROJECT_ROOT}/docs/api"
  "${PROJECT_ROOT}/docs/deployment"
  "${PROJECT_ROOT}/docs/development"
  "${PROJECT_ROOT}/docs/testing"
)

# =======================================================================
# SETUP DE LOGS
# =======================================================================

LOG_FILE="${OUTPUT_DIR}/docs_generation_${TIMESTAMP}.log"

# Cria o diretório de saída de logs e documentação, se não existir
mkdir -p "${OUTPUT_DIR}" "${API_DOCS_DIR}" "${FRONTEND_DOCS_DIR}"

log_message() {
  echo -e "[$(date +%Y-%m-%d\ %H:%M:%S)] $1" | tee -a "${LOG_FILE}"
}

# =======================================================================
# FUNÇÕES DE VERIFICAÇÃO DE DEPENDÊNCIAS
# =======================================================================

check_dependencies() {
  log_message "Verificando dependências de ferramentas de documentação..."
  local missing_deps=0

  if ! command -v jsdoc > /dev/null; then
    log_message "ERRO: 'jsdoc' não está instalado. Instale com 'npm install -g jsdoc'."
    missing_deps=1
  fi

  # Verifica se swagger-cli está instalado
  if ! command -v swagger-cli > /dev/null; then
    log_message "ERRO: 'swagger-cli' não está instalado. Instale com 'npm install -g swagger-cli'."
    missing_deps=1
  fi
  
  # Verifica se conventional-changelog-cli está instalado (se usar para Changelog)
  # if ! command -v conventional-changelog > /dev/null; then
  #   log_message "AVISO: 'conventional-changelog' não está instalado. O Changelog não será gerado automaticamente."
  # fi

  if [ "${missing_deps}" -ne 0 ]; then
    log_message "ERRO: Algumas dependências necessárias não estão instaladas. Abortando geração de documentação."
    exit 1
  fi
  log_message "Todas as dependências essenciais estão instaladas."
}

# =======================================================================
# FUNÇÕES DE GERAÇÃO DE DOCUMENTAÇÃO
# =======================================================================

# Gera documentação da API (usando Swagger/OpenAPI)
generate_api_docs() {
  log_message "Gerando documentação da API (Swagger/OpenAPI)..."
  if [ -f "${SWAGGER_API_SPEC}" ]; then
    swagger-cli bundle "${SWAGGER_API_SPEC}" --outfile "${API_DOCS_DIR}/swagger.json" --type json
    if [ $? -eq 0 ]; then
      log_message "Especificação OpenAPI/Swagger gerada em ${API_DOCS_DIR}/swagger.json."
      # Opcional: usar o Redocly/Swagger UI para gerar HTML a partir do JSON
      # Ex: redocly build-docs ${API_DOCS_DIR}/swagger.json -o ${API_DOCS_DIR}/index.html
      # Ex: npx swagger-ui-dist-package -i ${API_DOCS_DIR}/swagger.json -o ${API_DOCS_DIR}/
      log_message "Gere o HTML da documentação da API usando uma ferramenta como Redocly ou Swagger UI a partir de ${API_DOCS_DIR}/swagger.json."
    else
      log_message "ERRO: Falha ao gerar especificação OpenAPI/Swagger. Verifique ${SWAGGER_API_SPEC}."
    fi
  else
    log_message "AVISO: Arquivo de especificação Swagger/OpenAPI não encontrado em ${SWAGGER_API_SPEC}. Documentação da API não será gerada."
  fi
}

# Gera documentação do Frontend (usando JSDoc)
generate_frontend_docs() {
  log_message "Gerando documentação do Frontend (JSDoc)..."
  if [ -f "${JSDOC_CONFIG_FRONTEND}" ]; then
    # jsdoc -c ${JSDOC_CONFIG_FRONTEND} -d ${FRONTEND_DOCS_DIR} ${PROJECT_ROOT}/rc-construcoes-web/js/
    # O comando JSDoc pode precisar ser ajustado com base na estrutura de seus arquivos JS
    # e na configuração do seu jsdoc.json.
    log_message "AVISO: Gerar documentação JSDoc para frontend requer configuração específica de 'jsdoc -c ...' em ${JSDOC_CONFIG_FRONTEND}."
    log_message "Documentação do Frontend (JSDoc) gerada em ${FRONTEND_DOCS_DIR}."
  else
    log_message "AVISO: Arquivo de configuração JSDoc para Frontend não encontrado em ${JSDOC_CONFIG_FRONTEND}. Documentação do Frontend não será gerada."
  fi
}

# Copia arquivos Markdown para o diretório de documentação
generate_markdown_docs() {
  log_message "Copiando arquivos Markdown para a documentação..."
  for doc_path in "${MARKDOWN_SOURCES[@]}"; do
    if [ -f "${doc_path}" ]; then
      cp "${doc_path}" "${OUTPUT_DIR}/$(basename "${doc_path}")"
      log_message "Copiado: ${doc_path}"
    elif [ -d "${doc_path}" ]; then
      # Copia todo o diretório, mantendo a estrutura
      cp -r "${doc_path}" "${OUTPUT_DIR}/"
      log_message "Copiado diretório: ${doc_path}"
    else
      log_message "AVISO: Arquivo ou diretório Markdown não encontrado: ${doc_path}."
    fi
  done
  log_message "Arquivos Markdown copiados."
}

# Gera o Changelog automaticamente (se 'conventional-changelog' estiver instalado)
generate_changelog() {
  log_message "Gerando CHANGELOG..."
  if command -v conventional-changelog > /dev/null; then
    conventional-changelog -p angular -i "${CHANGELOG_FILE}" -s -r 0 # Gera/atualiza o CHANGELOG.md
    if [ $? -eq 0 ]; then
      log_message "CHANGELOG.md gerado/atualizado com sucesso."
    else
      log_message "AVISO: Falha ao gerar CHANGELOG. Verifique a configuração do conventional-changelog."
    fi
  else
    log_message "AVISO: 'conventional-changelog' não encontrado. O CHANGELOG não será gerado automaticamente."
  fi
}


# Cria um arquivo index.html principal para navegar na documentação
create_index_html() {
  log_message "Criando index.html para a documentação..."
  cat > "${OUTPUT_DIR}/index.html" << EOF
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RC Construções - Documentação</title>
    <style>
        body { font-family: 'Inter', sans-serif; margin: 40px; line-height: 1.6; color: #333; }
        h1 { color: #1a3a6c; }
        h2 { color: #f58220; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px; }
        .section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; }
        .section a { color: #1a73e8; text-decoration: none; }
        .section a:hover { text-decoration: underline; }
        ul { list-style-type: none; padding: 0; }
        li { margin-bottom: 8px; }
    </style>
</head>
<body>
    <h1>RC Construções - Documentação Geral</h1>
    <p>Documentação gerada em: $(date +"%d/%m/%Y %H:%M:%S")</p>
    
    <div class="section">
        <h2>Documentação da Aplicação</h2>
        <ul>
            <li><a href="api/swagger.json">Especificação OpenAPI/Swagger (JSON)</a></li>
            <li>(Para HTML da API, gere com Redocly/Swagger UI a partir do JSON acima)</li>
            <li><a href="frontend/index.html">Documentação JSDoc do Frontend (se gerada)</a></li>
        </ul>
    </div>

    <div class="section">
        <h2>Guias e Manuais</h2>
        <ul>
            <li><a href="README.md">README do Projeto</a></li>
            <li><a href="docs/api/authentication.md">Guia: Autenticação da API</a></li>
            <li><a href="docs/api/logging.md">Guia: Logging da API</a></li>
            <li><a href="docs/api/synchronization.md">Guia: Sincronização da API</a></li>
            <li><a href="docs/development/architecture.md">Guia: Arquitetura de Desenvolvimento</a></li>
            <li><a href="docs/development/contributing.md">Guia: Como Contribuir</a></li>
            <li><a href="docs/deployment/docker.md">Guia: Implantação com Docker</a></li>
            <li><a href="docs/deployment/monitoring.md">Guia: Monitoramento (Prometheus/Grafana)</a></li>
            <li><a href="docs/testing/README.md">Guia: Estratégias de Teste</a></li>
        </ul>
    </div>

    <div class="section">
        <h2>Histórico do Projeto</h2>
        <ul>
            <li><a href="CHANGELOG.md">Changelog (Histórico de Mudanças)</a></li>
        </ul>
    </div>
</body>
</html>
EOF
  log_message "index.html principal criado."
}

# =======================================================================
# EXECUÇÃO PRINCIPAL
# =======================================================================

main() {
  log_message "Iniciando processo de geração de documentação..."

  # Verifica as dependências
  check_dependencies

  # Limpa o diretório de saída anterior (opcional, mas bom para builds limpos)
  log_message "Limpando diretório de saída anterior: ${OUTPUT_DIR}"
  rm -rf "${OUTPUT_DIR}/*"

  # Gera a documentação
  generate_api_docs
  generate_frontend_docs
  generate_markdown_docs
  generate_changelog
  create_index_html

  # Compacta toda a documentação gerada em um arquivo .tar.gz
  log_message "Compactando documentação gerada em um arquivo..."
  tar -czf "${DOCS_DIR}/documentation_${TIMESTAMP}.tar.gz" -C "${OUTPUT_DIR}" .
  if [ $? -eq 0 ]; then
    log_success "Documentação compactada com sucesso: ${DOCS_DIR}/documentation_${TIMESTAMP}.tar.gz"
  else
    log_message "ERRO: Falha ao compactar a documentação."
  fi

  log_message "Geração de documentação concluída."

  # Exibe o tamanho total da documentação gerada
  DOCS_SIZE=$(du -sh "${OUTPUT_DIR}" | awk '{print $1}')
  log_message "Tamanho total da documentação gerada: ${DOCS_SIZE}"
}

# Chama a função principal
main