/**
 * RC Construções - Configuração do Jest
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Configura o Jest para a execução de testes unitários e de integração
 * para o projeto RC Construções (backend e frontend).
 */

module.exports = {
  // Define os ambientes de teste. O `node` é padrão para o backend.
  // Para testes de frontend que envolvem o DOM, você pode usar `jsdom`.
  // Como temos testes de backend (models, controllers) e frontend (js/core, js/modules),
  // a configuração padrão será `node` e, se necessário, pode ser sobrescrita por script de teste específico.
  testEnvironment: 'node',

  // Padrões para encontrar arquivos de teste.
  // - Unit: arquivos que terminam com .test.js na pasta unit/
  // - Integration: arquivos que terminam com .test.js na pasta integration/
  // - E2E: (Opcional) Se você quiser rodar Cypress via Jest, mas geralmente Cypress roda separado.
  testMatch: [
    "**/tests/unit/**/*.test.js",
    "**/tests/integration/**/*.test.js"
    // "**/tests/e2e/**/*.test.js" // Testes E2E são geralmente executados com Cypress
  ],

  // Pastas onde Jest deve procurar por arquivos de teste
  roots: [
    "<rootDir>/backend", // Para os arquivos de backend
    "<rootDir>/js",     // Para os arquivos JS do frontend (módulos, core, utils)
    "<rootDir>/tests"   // Para os próprios arquivos de teste e helpers
  ],

  // Extensões de arquivo que Jest deve procurar
  moduleFileExtensions: ["js", "json", "node"],

  // Transformadores para arquivos. Se você usa Babel para ESNext ou TypeScript.
  // Se não usa Babel, remova ou comente.
  transform: {
    "^.+\\.js$": "babel-jest", // Se você tiver um setup Babel para Jest
  },

  // Ignorar arquivos e diretórios específicos
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/cypress/" // Ignora diretórios do Cypress
  ],

  // Mapeia módulos para arquivos mockados ou para que Jest saiba como lidar com eles.
  // Ex: para lidar com importação de CSS ou imagens em testes unitários.
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy", // Mocka importação de CSS
    "\\.(gif|ttf|eot|svg|png)$": "<rootDir>/tests/__mocks__/fileMock.js", // Mocka importação de arquivos de mídia
    // Alias para módulos ou diretórios (ex: '@/components' -> './src/components')
    // Se você tiver aliases no seu webpack/vite, replique-os aqui.
    // "^@/(.*)$": "<rootDir>/src/$1"
  },

  // Arquivos de setup que Jest executa antes de cada arquivo de teste.
  // Útil para configurar variáveis de ambiente de teste ou mocks globais.
  setupFiles: [
    "jest-localstorage-mock", // Para mockar localStorage/sessionStorage
    // Seus polifills ou configs de env antes de carregar os testes
  ],

  // Arquivos de setup que Jest executa uma vez após o ambiente de teste ser configurado,
  // mas antes de cada suíte de teste.
  setupFilesAfterEnv: [
    "<rootDir>/tests/setupTests.js", // Arquivo de setup customizado (ex: para jest-dom, resetar mocks)
  ],

  // Relatório de cobertura de código
  collectCoverage: true, // Habilita a coleta de cobertura
  coverageDirectory: "coverage", // Diretório onde os relatórios de cobertura serão salvos
  collectCoverageFrom: [ // Arquivos dos quais a cobertura deve ser coletada
    "backend/**/*.js",
    "js/**/*.js",
    "!js/**/*.min.js", // Exclui arquivos minificados
    "!**/node_modules/**",
    "!**/tests/**", // Exclui os próprios arquivos de teste da cobertura
    "!**/coverage/**",
    "!backend/server.js", // Exclui o arquivo principal do servidor
    "!backend/database/connection.js", // Exclui o arquivo de conexão do DB (opcional)
    "!js/init_system_js.js", // Exclui o inicializador principal (opcional)
    "!js/modern_app_js.js" // Exclui o gerenciador principal da aplicação (opcional)
  ],
  coverageReporters: ["json", "lcov", "text", "clover"], // Formatos de relatório de cobertura

  // Limiares de cobertura (opcional: para falhar o build se a cobertura for muito baixa)
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80
  //   }
  // },

  // Se Jest deve exibir um relatório de testes que demoraram mais para executar
  // (útil para identificar testes lentos)
  verbose: true,
  timers: 'real', // Usa timers reais por padrão, use 'fake' no teste específico se for necessário
  
  // Para Jest 27+, se usar esm modules
  // "extensionsToTreatAsEsm": [".js"],
  // "transformIgnorePatterns": [
  //   "/node_modules/(?!(your-esm-module-here)/)"
  // ]

  // Para `supertest` e `express-async-errors`
  clearMocks: true, // Limpa mocks entre testes por padrão
};