/**
 * RC Construções - Configuração do Cypress
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Configura o Cypress para a execução de testes End-to-End (E2E) no projeto.
 * Inclui variáveis de ambiente, configurações de vídeo/screenshots,
 * retentativas de teste e integração com plugins.
 */

const { defineConfig } = require('cypress');
const path = require('path'); // Necessário para resolver caminhos

module.exports = defineConfig({
  // Configurações gerais do projeto Cypress
  projectId: 'sua_project_id_aqui', // Obtenha este ID do seu painel Cypress Cloud (opcional)
  
  // URL base para os testes. Geralmente é a URL do seu frontend durante os testes E2E.
  // Em ambiente Docker, pode ser 'http://localhost:8080' ou o nome do serviço 'frontend'
  // se o Cypress estiver rodando no mesmo network Docker.
  baseUrl: 'http://localhost:8080', // Ajuste conforme a URL do seu frontend em teste

  // Tempo máximo para carregar a página antes de falhar o teste
  pageLoadTimeout: 60000, // 60 segundos

  // Tempo máximo para esperar por um elemento antes de falhar
  defaultCommandTimeout: 10000, // 10 segundos

  // Habilita a gravação de vídeo dos testes
  video: true,
  videosFolder: 'cypress/videos', //

  // Habilita a captura de screenshots em caso de falha de teste
  screenshotsFolder: 'cypress/screenshots', //
  screenshotOnRunFailure: true,

  // Configuração para relatórios de teste (ex: Mochawesome)
  reporter: 'mochawesome', //
  reporterOptions: {
    reportDir: 'cypress/results', // Diretório para os relatórios
    overwrite: false, // Não sobrescreve relatórios anteriores
    html: true, // Gera relatório HTML
    json: true, // Gera relatório JSON
    timestamp: 'mm-dd-yyyy_HH-MM-ss', // Adiciona timestamp aos relatórios
  },

  // Retentativas de teste (útil para CI/CD instável)
  retries: {
    runMode: 2, // Tenta novamente 2 vezes em modo 'run' (CI/CD)
    openMode: 0, // Sem retries em modo 'open' (desenvolvimento)
  },

  // Variáveis de ambiente que o Cypress terá acesso
  env: {
    // URL da sua API de backend para os testes
    // Ex: http://localhost:3000 (se o backend estiver rodando no host ou acessível pelo Cypress)
    apiUrl: 'http://localhost:3000/api', //
    // Outras variáveis de ambiente específicas para testes
    // Ex: CYPRESS_USER_ADMIN: 'admin@rc-construcoes.com'
  },

  // Configurações E2E
  e2e: {
    // Padrão para encontrar arquivos de especificação de teste E2E
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}', //
    
    // Caminho para o arquivo de suporte (onde você adiciona comandos customizados)
    supportFile: 'cypress/support/e2e.js', //

    // Setup Node Events (para plugins, tarefas, acesso ao sistema de arquivos)
    setupNodeEvents(on, config) {
      // Importa e configura o test-utils para comandos Cypress e mocks
      const { setupAllMocks, resetAllMocks } = require('./tests/helpers/test-utils');

      // Exemplo de como usar o test-utils para tarefas globais ou hooks
      on('task', {
        // Exemplo de tarefa para resetar o DB mockado antes de certos testes
        resetDb: async () => {
          resetAllMocks();
          return null;
        },
        // Outras tarefas Cypress customizadas podem ser definidas aqui
      });

      // Permite que o Cypress acesse variáveis de ambiente do sistema host
      config.env = { ...process.env, ...config.env };
      
      // Retorne a configuração modificada
      return config;
    },
  },

  // Configurações de Component Testing (se você usa para testes de componentes)
  component: {
    devServer: {
      framework: 'vue', // Substitua 'vue' pelo framework que você está usando (react, angular, webpack, vite)
      bundler: 'webpack', // Substitua 'webpack' pelo bundler que você está usando (vite)
    },
    specPattern: '**/__tests__/*.cy.{js,jsx,ts,tsx}', // Exemplo de padrão para testes de componentes
    supportFile: 'cypress/support/component.js',
  },
});