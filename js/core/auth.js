/**
 * RC Construções - Auth Manager (Revisado e Aprimorado)
 * Gerencia todas as funcionalidades de autenticação de usuário, incluindo login, logout,
 * registro, verificação de sessão e gestão de tokens.
 * Aprimorado para ser mais seguro, robusto e integrado com outros módulos core.
 */

(function() {
    'use strict';

    let logger;
    let settingsManager;
    let securityManager;
    let databaseInstance; // Para interagir com a tabela de usuários
    let validationManager; // Para validação de credenciais
    let eventHandler; // Para disparar eventos de autenticação

    const AUTH_CONFIG = {
        maxLoginAttempts: 5, // Número máximo de tentativas de login falhas
        sessionTimeout: 30 * 60 * 1000, // 30 minutos de inatividade para expiração da sessão
        tokenKey: 'rc_auth_token', // Chave para armazenar o token JWT no localStorage/sessionStorage
        userKey: 'rc_current_user', // Chave para armazenar dados do usuário no sessionStorage
        loginAttemptsKey: 'rc_login_attempts', // Chave para rastrear tentativas de login
        backendEndpoints: {
            login: '/api/auth/login',
            logout: '/api/auth/logout',
            register: '/api/auth/register',
            // refresh: '/api/auth/refresh_token' // Exemplo para refresh de token
        },
        // Tipo de armazenamento para o token e dados do usuário ('localStorage' ou 'sessionStorage')
        // sessionStorage é mais seguro contra ataques XSS persistentes, mas a sessão não persiste entre abas/reinícios.
        storageType: 'sessionStorage' 
    };

    let currentUser = null; // Usuário autenticado atualmente
    let sessionTimer = null; // Timer para o controle de inatividade da sessão

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
                    setTimeout(checkGlobal, 50);
                }
            };
            checkGlobal();
        });
    }

    /**
     * Inicializa o AuthManager, carregando dependências e verificando sessão.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('AuthManager'));
            settingsManager = await waitForGlobal('SettingsManager');
            securityManager = await waitForGlobal('SecurityManager');
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            validationManager = await waitForGlobal('ValidationManager');
            eventHandler = await waitForGlobal('SystemEventHandler'); // Usar o SystemEventHandler

            logger.info('🔐 AuthManager criado');
            logger.info(`⚙️ Max tentativas: ${AUTH_CONFIG.maxLoginAttempts}`);
            logger.info(`⏰ Timeout sessão: ${AUTH_CONFIG.sessionTimeout}ms`);

            // Tenta carregar o usuário e token do armazenamento ao iniciar
            loadSession();

            // Configura o timer de inatividade se um usuário já estiver logado
            if (currentUser) {
                startSessionTimer();
            }

            // Adiciona listeners para eventos de interação do usuário para resetar o timer
            ['click', 'keypress', 'mousemove', 'scroll'].forEach(eventType => {
                document.addEventListener(eventType, resetSessionTimer);
            });

            // Listener para evento de expiração de autenticação de outros módulos (ex: AdvancedSync)
            eventHandler.on('authExpired', handleAuthExpired);

            logger.success('✅ AuthManager inicializado com sucesso');
        } catch (error) {
            console.error('Erro crítico ao inicializar AuthManager:', error);
            // Fallback para console.error se o logger não estiver pronto
            (logger || console).error('Falha na inicialização do AuthManager. Autenticação pode não funcionar.');
        }
    }

    /**
     * Carrega a sessão do usuário e o token do armazenamento.
     */
    function loadSession() {
        try {
            const storedUser = getStorage().getItem(AUTH_CONFIG.userKey);
            const storedToken = getStorage().getItem(AUTH_CONFIG.tokenKey);

            if (storedUser && storedToken) {
                currentUser = JSON.parse(storedUser);
                setToken(storedToken); // Define o token (que também pode validá-lo ou refresh)
                logger.info(`Sessão carregada para o usuário: ${currentUser.username}`);
                eventHandler.emit('userLoggedIn', currentUser);
            } else {
                logger.info('Nenhuma sessão ativa encontrada no armazenamento.');
            }
        } catch (e) {
            logger.error('Erro ao carregar sessão do armazenamento:', e);
            clearSession(); // Limpa dados corrompidos
        }
    }

    /**
     * Inicia o timer de inatividade da sessão.
     */
    function startSessionTimer() {
        if (sessionTimer) {
            clearTimeout(sessionTimer);
        }
        sessionTimer = setTimeout(forceLogout, AUTH_CONFIG.sessionTimeout);
        logger.debug(`Timer de sessão iniciado/resetado para ${AUTH_CONFIG.sessionTimeout / 60000} minutos.`);
    }

    /**
     * Reseta o timer de inatividade da sessão.
     */
    function resetSessionTimer() {
        if (currentUser) { // Apenas reseta se houver um usuário logado
            startSessionTimer();
        }
    }

    /**
     * Força o logout do usuário por inatividade.
     */
    function forceLogout() {
        logger.warn('Sessão expirada por inatividade. Realizando logout forçado.');
        logoutUser('inactivity');
        // Opcional: Notificar o usuário
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Sessão Expirada',
                text: 'Sua sessão expirou devido à inatividade. Por favor, faça login novamente.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
        }
    }

    /**
     * Obtém o objeto de armazenamento (localStorage ou sessionStorage).
     * @returns {Storage}
     */
    function getStorage() {
        return AUTH_CONFIG.storageType === 'localStorage' ? localStorage : sessionStorage;
    }

    /**
     * Realiza o processo de login do usuário.
     * @param {string} username - Nome de usuário.
     * @param {string} password - Senha.
     * @returns {Promise<boolean>} True se o login for bem-sucedido, false caso contrário.
     */
    async function loginUser(username, password) {
        logger.info(`Tentando login para o usuário: ${username}`);

        if (!validationManager.validateEmail(username) && !validationManager.validateUsername(username)) {
            logger.warn('Login falhou: Nome de usuário/email inválido.');
            eventHandler.emit('loginFailed', { reason: 'invalid_credentials' });
            return false;
        }

        let loginAttempts = parseInt(getStorage().getItem(AUTH_CONFIG.loginAttemptsKey) || '0');
        if (loginAttempts >= AUTH_CONFIG.maxLoginAttempts) {
            logger.error(`Login bloqueado para ${username}: Excedeu o número máximo de tentativas.`);
            eventHandler.emit('loginBlocked', { username });
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Acesso Bloqueado',
                    text: `Você excedeu o número de tentativas de login. Tente novamente mais tarde.`,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
            return false;
        }

        try {
            // Tenta autenticar via backend API
            const response = await fetch(AUTH_CONFIG.backendEndpoints.login, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const { user, token } = await response.json();
                
                // Validação e armazenamento seguros
                if (!user || !token) {
                    throw new Error('Resposta de login inválida: faltam usuário ou token.');
                }

                // Armazenar no IndexedDB a última tentativa de login bem-sucedida
                // Ou apenas na sessão/localStorage se preferir.
                getStorage().setItem(AUTH_CONFIG.userKey, JSON.stringify(user));
                setToken(token);
                currentUser = user;
                
                // Limpa o contador de tentativas de login
                getStorage().removeItem(AUTH_CONFIG.loginAttemptsKey);
                startSessionTimer(); // Inicia o timer da sessão
                
                logger.success(`Usuário ${username} logado com sucesso!`);
                eventHandler.emit('userLoggedIn', currentUser);
                return true;
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
                logger.warn(`Login falhou para ${username}: ${errorData.message || 'Credenciais inválidas.'}`);
                
                loginAttempts++;
                getStorage().setItem(AUTH_CONFIG.loginAttemptsKey, loginAttempts.toString());
                
                eventHandler.emit('loginFailed', { username, attempts: loginAttempts, reason: errorData.message });
                return false;
            }
        } catch (error) {
            logger.error(`Erro durante o processo de login: ${error.message}`);
            // Em caso de erro de rede ou servidor, incrementa tentativas localmente
            loginAttempts++;
            getStorage().setItem(AUTH_CONFIG.loginAttemptsKey, loginAttempts.toString());
            eventHandler.emit('loginError', { username, error: error.message });
            return false;
        }
    }

    /**
     * Realiza o processo de registro de um novo usuário.
     * @param {Object} userData - Dados do usuário para registro (e.g., username, email, password).
     * @returns {Promise<boolean>} True se o registro for bem-sucedido, false caso contrário.
     */
    async function registerUser(userData) {
        logger.info(`Tentando registrar novo usuário: ${userData.username}`);

        // Exemplo de validação de dados antes de enviar
        if (!validationManager.validateEmail(userData.email) || !validationManager.validatePassword(userData.password)) {
            logger.warn('Registro falhou: Dados de usuário inválidos.');
            eventHandler.emit('registrationFailed', { reason: 'invalid_data' });
            return false;
        }
        
        try {
            // Hash da senha no cliente antes de enviar (opcional, mas recomendado para segurança)
            // Certifique-se que o bcrypt.min.js está carregado e que 'dcodeIO.bcrypt' é o nome global
            const hashedPassword = await securityManager.hashPassword(userData.password);
            
            const response = await fetch(AUTH_CONFIG.backendEndpoints.register, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...userData, passwordHash: hashedPassword, password: undefined }) // Envia hash, não a senha em texto claro
            });

            if (response.ok) {
                const result = await response.json();
                logger.success(`Usuário ${userData.username} registrado com sucesso!`);
                eventHandler.emit('userRegistered', result.user);
                return true;
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
                logger.warn(`Registro falhou para ${userData.username}: ${errorData.message}`);
                eventHandler.emit('registrationFailed', { username: userData.username, reason: errorData.message });
                return false;
            }
        } catch (error) {
            logger.error(`Erro durante o processo de registro: ${error.message}`);
            eventHandler.emit('registrationError', { error: error.message });
            return false;
        }
    }

    /**
     * Realiza o logout do usuário.
     * @param {string} [reason='manual'] - Motivo do logout (e.g., 'manual', 'inactivity', 'token_expired').
     */
    async function logoutUser(reason = 'manual') {
        logger.info(`Realizando logout do usuário (Motivo: ${reason})...`);
        try {
            // Opcional: Notificar o backend sobre o logout para invalidar o token no servidor
            // await fetch(AUTH_CONFIG.backendEndpoints.logout, {
            //     method: 'POST',
            //     headers: { 'Authorization': `Bearer ${getToken()}` }
            // });
            logger.debug('Logout no backend (se implementado) notificado.');
        } catch (error) {
            logger.warn(`Erro ao notificar logout para o backend: ${error.message}. Continuando logout local.`);
        } finally {
            clearSession();
            logger.success('Usuário deslogado com sucesso!');
            eventHandler.emit('userLoggedOut', { reason });
            // Opcional: Redirecionar para a página de login
            // window.location.href = 'login.html';
        }
    }

    /**
     * Limpa todos os dados da sessão (token e usuário) do armazenamento.
     */
    function clearSession() {
        getStorage().removeItem(AUTH_CONFIG.tokenKey);
        getStorage().removeItem(AUTH_CONFIG.userKey);
        currentUser = null;
        if (sessionTimer) {
            clearTimeout(sessionTimer);
            sessionTimer = null;
        }
        logger.debug('Sessão limpa do armazenamento local.');
    }

    /**
     * Verifica se o usuário está autenticado e se o token é válido.
     * @returns {boolean} True se autenticado e token válido, false caso contrário.
     */
    function isAuthenticated() {
        const token = getToken();
        if (!token || !currentUser) {
            return false;
        }
        // Opcional: Implementar validação do token (expiração, assinatura)
        // Isso geralmente é feito no SecurityManager ou por uma biblioteca JWT.
        try {
            // Exemplo: const decodedToken = securityManager.decodeToken(token);
            // if (decodedToken.exp < Date.now() / 1000) {
            //     logger.warn('Token expirado localmente.');
            //     clearSession();
            //     return false;
            // }
        } catch (e) {
            logger.error('Erro ao validar token:', e);
            clearSession();
            return false;
        }
        return true;
    }

    /**
     * Obtém o token JWT armazenado.
     * @returns {string|null} O token JWT ou null.
     */
    function getToken() {
        return getStorage().getItem(AUTH_CONFIG.tokenKey);
    }

    /**
     * Armazena o token JWT.
     * @param {string} token - O token JWT a ser armazenado.
     */
    function setToken(token) {
        getStorage().setItem(AUTH_CONFIG.tokenKey, token);
        logger.debug('Token JWT armazenado.');
    }

    /**
     * Obtém os dados do usuário autenticado.
     * @returns {Object|null} Objeto do usuário ou null.
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Lida com eventos de autenticação expirada, forçando o logout.
     */
    function handleAuthExpired() {
        logger.warn('Evento "authExpired" recebido. Forçando logout.');
        logoutUser('token_expired');
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Sessão Expirada',
                text: 'Sua sessão expirou ou suas credenciais são inválidas. Por favor, faça login novamente.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        login: loginUser,
        register: registerUser,
        logout: logoutUser,
        isAuthenticated: isAuthenticated,
        getToken: getToken,
        getCurrentUser: getCurrentUser,
        // Expor configurações para uso em testes ou depuração
        config: AUTH_CONFIG
    };
})();