/**
 * RC Construções - Security Manager (Revisado e Aprimorado)
 * Gerencia operações de segurança como hashing de senhas, criptografia e outras validações de segurança.
 * Aprimorado para ser robusto, integrar-se com bibliotecas de segurança e o SystemLogger.
 */

(function() {
    'use strict';

    let logger;
    let authManager; // Para cenários onde a segurança interage com autenticação (ex: JWT)
    let isInitialized = false;

    // Configurações de segurança
    const SECURITY_CONFIG = {
        bcryptRounds: 10, // Custo de computação para o hashing de senhas (maior = mais seguro, mais lento)
        encryptionKeySize: 256, // Tamanho da chave de criptografia em bits (se usar AES ou similar)
        // Você pode adicionar chaves mestras aqui para criptografia de dados confidenciais
        // masterEncryptionKey: 'sua-chave-secreta-forte-aqui'
    };

    let bcryptLib; // Referência à biblioteca bcrypt

    /**
     * Espera por uma dependência global estar disponível.
     * @param {string} globalName - O nome da variável global a ser esperada.
     * @returns {Promise<any>} A instância da dependência.
     */
    async function waitForGlobal(globalName) {
        return new Promise(resolve => {
            const checkGlobal = () => {
                if (window[globalName]) {
                    resolve(window[globalName]);
                } else {
                    setTimeout(checkGlobal, 50); // Tenta novamente em 50ms
                }
            };
            checkGlobal();
        });
    }

    /**
     * Inicializa o SecurityManager.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('SecurityManager já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('SecurityManager'));
            authManager = await waitForGlobal('AuthManager').catch(() => null); // AuthManager pode ser inicializado depois

            logger.info('🔐 SecurityManager criado, aguardando inicialização...');

            // Espera pela biblioteca bcrypt.js. O nome global pode variar (dcodeIO.bcrypt, bcrypt, etc.)
            // Ajuste 'dcodeIO.bcrypt' para o nome global correto do bcrypt.min.js no seu ambiente
            bcryptLib = await Promise.race([
                waitForGlobal('dcodeIO.bcrypt'), // Nome comum para o bcrypt.js
                waitForGlobal('bcrypt'), // Outro nome possível
                new Promise((_, reject) => setTimeout(() => reject(new Error('bcrypt.js timeout')), 3000))
            ]);

            if (!bcryptLib || typeof bcryptLib.hashSync === 'undefined') {
                throw new Error('bcrypt.js não encontrado ou não funcional.');
            }
            logger.success(`✅ bcrypt encontrado em: ${typeof bcryptLib === 'function' ? '() => window.bcrypt' : 'objeto global'}`); // Ajuste esta linha se souber o nome exato

            // Realiza um auto-teste básico para verificar se o bcrypt está funcionando
            if (!await runSelfTest()) {
                throw new Error('Auto-teste do SecurityManager falhou.');
            }

            // Você pode adicionar lógica para carregar chaves de criptografia aqui, se aplicável
            // logger.info('🔑 Chaves de criptografia preparadas');

            isInitialized = true;
            logger.success('✅ SecurityManager inicializado com sucesso');

        } catch (error) {
            console.error('Erro crítico ao inicializar SecurityManager:', error);
            (logger || console).error(`Falha na inicialização do SecurityManager: ${error.message}. Funcionalidades de segurança podem estar comprometidas.`);
            // Marcar como não inicializado ou desabilitar funções críticas
            isInitialized = false;
        }
    }

    /**
     * Realiza um auto-teste básico para verificar a funcionalidade principal do módulo.
     * @returns {Promise<boolean>} True se o auto-teste for bem-sucedido.
     */
    async function runSelfTest() {
        logger.info('🧪 Executando auto-teste do SecurityManager...');
        try {
            const testPassword = 'mySecurePassword123!';
            const hashedPassword = await hashPassword(testPassword);
            if (!hashedPassword) {
                throw new Error('Hashing de senha retornou valor inválido.');
            }
            const isMatch = await checkPassword(testPassword, hashedPassword);
            if (!isMatch) {
                throw new Error('Verificação de senha falhou: Hash não corresponde ao original.');
            }
            logger.success('✅ Auto-teste concluído com sucesso');
            return true;
        } catch (error) {
            logger.error(`❌ Auto-teste falhou: ${error.message}`);
            return false;
        }
    }

    /**
     * Gera um hash criptográfico de uma senha.
     * @param {string} password - A senha em texto claro.
     * @returns {Promise<string|null>} O hash da senha ou null em caso de erro.
     */
    async function hashPassword(password) {
        if (!isInitialized || !bcryptLib) {
            logger.error('SecurityManager não inicializado ou bcrypt.js não disponível.');
            return null;
        }
        try {
            // O bcrypt.js geralmente é síncrono para hashing no navegador, mas o wrapper pode ser assíncrono
            // Se o bcryptLib.hash() for assíncrono, use await. Se for síncrono, remova await.
            const salt = bcryptLib.genSaltSync(SECURITY_CONFIG.bcryptRounds); // Gera um salt síncronamente
            const hash = bcryptLib.hashSync(password, salt); // Gera o hash síncronamente
            return hash;
        } catch (error) {
            logger.error(`Erro ao gerar hash da senha: ${error.message}`);
            return null;
        }
    }

    /**
     * Compara uma senha em texto claro com um hash.
     * @param {string} password - A senha em texto claro.
     * @param {string} hash - O hash a ser comparado.
     * @returns {Promise<boolean>} True se a senha corresponder ao hash, false caso contrário.
     */
    async function checkPassword(password, hash) {
        if (!isInitialized || !bcryptLib) {
            logger.error('SecurityManager não inicializado ou bcrypt.js não disponível.');
            return false;
        }
        try {
            // bcrypt.js compareSync é síncrono
            const isMatch = bcryptLib.compareSync(password, hash);
            return isMatch;
        } catch (error) {
            logger.error(`Erro ao verificar senha: ${error.message}`);
            return false;
        }
    }

    /**
     * Criptografa dados sensíveis.
     * Nota: A implementação real de criptografia (AES, etc.) exigiria uma biblioteca mais completa
     * e um mecanismo seguro de gerenciamento de chaves.
     * Esta é uma função placeholder/exemplo.
     * @param {string} data - Os dados a serem criptografados.
     * @param {string} key - A chave de criptografia.
     * @returns {string} Dados criptografados.
     */
    function encryptData(data, key) {
        if (!isInitialized) {
            logger.error('SecurityManager não inicializado. Não é possível criptografar.');
            return data; // Retorna dados originais se não puder criptografar
        }
        logger.warn('Função encryptData é um placeholder e não implementa criptografia forte.');
        // Exemplo muito básico (NÃO SEGURO PARA PRODUÇÃO):
        return btoa(data + key); // Base64 + key simples
    }

    /**
     * Descriptografa dados sensíveis.
     * @param {string} encryptedData - Os dados criptografados.
     * @param {string} key - A chave de criptografia.
     * @returns {string} Dados descriptografados.
     */
    function decryptData(encryptedData, key) {
        if (!isInitialized) {
            logger.error('SecurityManager não inicializado. Não é possível descriptografar.');
            return encryptedData;
        }
        logger.warn('Função decryptData é um placeholder e não implementa descriptografia forte.');
        // Exemplo muito básico (NÃO SEGURO PARA PRODUÇÃO):
        const decoded = atob(encryptedData);
        if (decoded.endsWith(key)) {
            return decoded.slice(0, -key.length);
        }
        return encryptedData; // Retorna original se não puder descriptografar ou chave incorreta
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        hashPassword: hashPassword,
        checkPassword: checkPassword,
        encryptData: encryptData, // Funções de criptografia de dados (placeholder)
        decryptData: decryptData, // Funções de descriptografia de dados (placeholder)
        // Outras funções de segurança podem ser adicionadas aqui
        isReady: () => isInitialized // Verifica se o módulo foi inicializado com sucesso
    };
})();