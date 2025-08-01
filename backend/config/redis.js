/**
 * RC Construções - Configuração do Redis (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este arquivo centraliza a configuração para a conexão com o servidor Redis.
 * As credenciais são carregadas de variáveis de ambiente para garantir segurança e flexibilidade
 * em diferentes ambientes (desenvolvimento, teste, produção).
 */

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

module.exports = {
  /**
   * Host do Redis.
   * O endereço onde o servidor Redis está rodando.
   * Pode ser 'localhost', um IP, ou um nome de serviço Docker.
   */
  host: process.env.REDIS_HOST || 'localhost', //

  /**
   * Porta do Redis.
   * A porta em que o servidor Redis está escutando.
   */
  port: parseInt(process.env.REDIS_PORT || '6379', 10), // Converte para número

  /**
   * Senha do Redis.
   * Se o seu servidor Redis exigir autenticação. Use null se não houver senha.
   * * IMPORTANTE: Em produção, SEMPRE defina a variável de ambiente REDIS_PASSWORD.
   */
  password: process.env.REDIS_PASSWORD || null, //

  /**
   * Banco de Dados (DB) do Redis a ser utilizado.
   * Redis suporta múltiplos bancos de dados numerados de 0 a 15 (ou mais).
   * Geralmente, 0 é o padrão.
   */
  db: parseInt(process.env.REDIS_DB || '0', 10), //

  /**
   * Opções adicionais do cliente Redis.
   * Consulte a documentação da biblioteca cliente Node.js para Redis que você está usando (ex: `ioredis`, `node_redis`).
   */
  options: {
    // Reconexão automática em caso de desconexão
    retryStrategy: (times) => { //
      const delay = Math.min(times * 50, 2000); // Tenta reconectar a cada 50ms, com máximo de 2 segundos
      console.warn(`Redis: Tentando reconectar (tentativa ${times}). Próxima tentativa em ${delay}ms.`);
      return delay;
    },
    // Tempo limite para a conexão inicial
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10), // 10 segundos
    // Se deve pular o comando 'ready' (para alguns proxies ou setups específicos)
    // lazyConnect: true, // Conecta apenas na primeira operação
    // reconnectOnError: (err) => { // Exemplo de reconexão condicional em erro
    //   const targetErrors = ['READONLY']; // Erros específicos para reconectar
    //   if (targetErrors.some(target => err.message.includes(target))) {
    //     return true;
    //   }
    //   return false;
    // },
    // maxRetriesPerRequest: 1, // Número de vezes para tentar uma requisição antes de falhar
  },

  /**
   * Habilitar/Desabilitar o cliente Redis.
   * Útil para desabilitar o Redis em ambientes onde ele não é necessário (ex: certos testes).
   */
  enabled: process.env.REDIS_ENABLED === 'true' || false // Padrão para false, ative explicitamente em .env
};