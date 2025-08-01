/**
 * RC Construções - Sistema de Login
 * Gerencia autenticação e autorização de usuários
 * Tipos de usuário: admin, financeiro, tecnico
 */

(function() {
    'use strict';

    // Usuários pré-definidos para demonstração
    const USERS = {
        'admin': {
            username: 'admin',
            password: 'admin123',
            type: 'admin',
            name: 'Administrador',
            permissions: ['dashboard', 'clientes', 'orcamentos', 'contratos', 'financeiro', 'relatorios', 'configuracoes', 'fornecedores', 'importar']
        },
        'financeiro': {
            username: 'financeiro',
            password: 'fin123',
            type: 'financeiro',
            name: 'Usuário Financeiro',
            permissions: ['dashboard', 'clientes', 'orcamentos', 'contratos', 'financeiro', 'relatorios']
        },
        'tecnico': {
            username: 'tecnico',
            password: 'tec123',
            type: 'tecnico',
            name: 'Usuário Técnico',
            permissions: ['dashboard', 'clientes', 'orcamentos', 'contratos', 'fornecedores']
        }
    };

    const LoginSystem = {
        currentUser: null,
        initialized: false,

        /**
         * Inicializa o sistema de login
         */
        init() {
            if (this.initialized) return;
            
            try {
                this.checkExistingSession();
                this.createLoginModal();
                this.bindEvents();
                this.initialized = true;
            } catch (error) {
                console.error('Erro ao inicializar sistema de login:', error);
            }
        },

        /**
         * Verifica se existe uma sessão ativa
         */
        checkExistingSession() {
            try {
                const savedUser = localStorage.getItem('rcUser');
                if (savedUser) {
                    this.currentUser = JSON.parse(savedUser);
                    this.showMainInterface();
                } else {
                    this.showLoginModal();
                }
            } catch (e) {
                localStorage.removeItem('rcUser');
                this.showLoginModal();
            }
        },

        /**
         * Cria o modal de login
         */
        createLoginModal() {
            // Remove modal existente se houver
            const existingModal = document.getElementById('loginModal');
            if (existingModal) {
                existingModal.remove();
            }

            const modalHTML = `
                <div id="loginModal" class="login-modal" style="display: none;">
                    <div class="login-modal-content">
                        <div class="login-header">
                            <div class="login-logo-placeholder">RC</div>
                            <h2>RC Construções</h2>
                            <p>Sistema de Gestão</p>
                        </div>
                        <form id="loginForm" class="login-form">
                            <div class="form-group">
                                <label for="username">Usuário:</label>
                                <input type="text" id="username" name="username" required>
                            </div>
                            <div class="form-group">
                                <label for="password">Senha:</label>
                                <input type="password" id="password" name="password" required>
                            </div>
                            <button type="submit" class="login-btn">Entrar</button>
                            <div id="loginError" class="login-error" style="display: none;"></div>
                        </form>
                        <div class="login-demo-users">
                            <h4>Usuários de Demonstração:</h4>
                            <div class="demo-user-list">
                                <div class="demo-user" data-username="admin" data-password="admin123">
                                    <strong>Admin:</strong> admin / admin123
                                </div>
                                <div class="demo-user" data-username="financeiro" data-password="fin123">
                                    <strong>Financeiro:</strong> financeiro / fin123
                                </div>
                                <div class="demo-user" data-username="tecnico" data-password="tec123">
                                    <strong>Técnico:</strong> tecnico / tec123
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.addLoginStyles();
        },

        /**
         * Adiciona estilos CSS para o modal de login
         */
        addLoginStyles() {
            // Remove estilos existentes se houver
            const existingStyles = document.getElementById('loginStyles');
            if (existingStyles) {
                existingStyles.remove();
            }

            const styleElement = document.createElement('style');
            styleElement.id = 'loginStyles';
            styleElement.textContent = `
                .login-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                }

                .login-modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    width: 90%;
                    max-width: 400px;
                    text-align: center;
                }

                .login-header {
                    margin-bottom: 2rem;
                }

                .login-logo-placeholder {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 1rem;
                    background: #3498db;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    font-size: 2rem;
                    font-weight: bold;
                }

                .login-header h2 {
                    color: #2c3e50;
                    margin: 0.5rem 0;
                }

                .login-header p {
                    color: #7f8c8d;
                    margin: 0;
                }

                .login-form {
                    text-align: left;
                }

                .form-group {
                    margin-bottom: 1rem;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    color: #2c3e50;
                    font-weight: bold;
                }

                .form-group input {
                    width: 100%;
                    padding: 0.75rem;
                    border: 2px solid #bdc3c7;
                    border-radius: 5px;
                    font-size: 1rem;
                    box-sizing: border-box;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: #3498db;
                }

                .login-btn {
                    width: 100%;
                    padding: 0.75rem;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    font-size: 1rem;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.3s;
                }

                .login-btn:hover {
                    background: #2980b9;
                }

                .login-error {
                    background: #e74c3c;
                    color: white;
                    padding: 0.5rem;
                    border-radius: 5px;
                    margin-top: 1rem;
                    text-align: center;
                }

                .login-demo-users {
                    margin-top: 2rem;
                    padding-top: 1rem;
                    border-top: 1px solid #ecf0f1;
                }

                .login-demo-users h4 {
                    color: #2c3e50;
                    margin-bottom: 1rem;
                }

                .demo-user {
                    background: #ecf0f1;
                    padding: 0.5rem;
                    margin: 0.5rem 0;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background 0.3s;
                    text-align: left;
                }

                .demo-user:hover {
                    background: #d5dbdb;
                }

                .user-info {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #2c3e50;
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 5px;
                    z-index: 1000;
                }

                .logout-btn {
                    background: #e74c3c;
                    color: white;
                    border: none;
                    padding: 0.25rem 0.5rem;
                    border-radius: 3px;
                    cursor: pointer;
                    margin-left: 0.5rem;
                }

                .logout-btn:hover {
                    background: #c0392b;
                }
            `;
            document.head.appendChild(styleElement);
        },

        /**
         * Vincula eventos do sistema de login
         */
        bindEvents() {
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin();
                });
            }

            // Eventos dos usuários de demonstração
            const demoUsers = document.querySelectorAll('.demo-user');
            demoUsers.forEach(user => {
                user.addEventListener('click', () => {
                    const username = user.dataset.username;
                    const password = user.dataset.password;
                    const usernameInput = document.getElementById('username');
                    const passwordInput = document.getElementById('password');
                    
                    if (usernameInput && passwordInput) {
                        usernameInput.value = username;
                        passwordInput.value = password;
                    }
                });
            });
        },

        /**
         * Processa o login
         */
        handleLogin() {
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const errorDiv = document.getElementById('loginError');

            if (!usernameInput || !passwordInput || !errorDiv) {
                console.error('Elementos do formulário não encontrados');
                return;
            }

            const username = usernameInput.value;
            const password = passwordInput.value;

            if (this.authenticate(username, password)) {
                this.currentUser = USERS[username];
                localStorage.setItem('rcUser', JSON.stringify(this.currentUser));
                this.hideLoginModal();
                this.showMainInterface();
                this.showUserInfo();
            } else {
                errorDiv.textContent = 'Usuário ou senha incorretos!';
                errorDiv.style.display = 'block';
            }
        },

        /**
         * Autentica o usuário
         */
        authenticate(username, password) {
            const user = USERS[username];
            return user && user.password === password;
        },

        /**
         * Mostra o modal de login
         */
        showLoginModal() {
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        },

        /**
         * Esconde o modal de login
         */
        hideLoginModal() {
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        },

        /**
         * Mostra a interface principal
         */
        showMainInterface() {
            const app = document.getElementById('app');
            if (app) {
                app.style.display = 'block';
                this.applyPermissions();
            }
        },

        /**
         * Aplica permissões baseadas no tipo de usuário
         */
        applyPermissions() {
            if (!this.currentUser) return;

            const menuItems = document.querySelectorAll('.sidebar a');
            menuItems.forEach(item => {
                const href = item.getAttribute('href');
                let permission = '';

                // Mapeia URLs para permissões
                if (href === '#dashboard') permission = 'dashboard';
                else if (href === '#clientes') permission = 'clientes';
                else if (href === '#orcamentos') permission = 'orcamentos';
                else if (href === '#contratos') permission = 'contratos';
                else if (href === '#financeiro') permission = 'financeiro';
                else if (href === '#relatorios') permission = 'relatorios';
                else if (href === '#configuracoes') permission = 'configuracoes';
                else if (href === '#fornecedores') permission = 'fornecedores';
                else if (href === '#importar') permission = 'importar';

                const parentLi = item.closest('li');
                if (permission && !this.currentUser.permissions.includes(permission)) {
                    if (parentLi) parentLi.style.display = 'none';
                } else {
                    if (parentLi) parentLi.style.display = 'block';
                }
            });
        },

        /**
         * Mostra informações do usuário logado
         */
        showUserInfo() {
            const existingInfo = document.getElementById('userInfo');
            if (existingInfo) existingInfo.remove();

            const userInfoHTML = `
                <div id="userInfo" class="user-info">
                    <span>${this.currentUser.name} (${this.currentUser.type})</span>
                    <button class="logout-btn" onclick="LoginSystem.logout()">Sair</button>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', userInfoHTML);
        },

        /**
         * Faz logout do usuário
         */
        logout() {
            this.currentUser = null;
            localStorage.removeItem('rcUser');
            const userInfo = document.getElementById('userInfo');
            if (userInfo) userInfo.remove();
            
            const app = document.getElementById('app');
            if (app) app.style.display = 'none';
            
            this.showLoginModal();
        },

        /**
         * Retorna o usuário atual
         */
        getCurrentUser() {
            return this.currentUser;
        },

        /**
         * Verifica se o usuário tem uma permissão específica
         */
        hasPermission(permission) {
            return this.currentUser && this.currentUser.permissions.includes(permission);
        }
    };

    // Expõe o sistema de login globalmente
    window.LoginSystem = LoginSystem;

    // Inicializa quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => LoginSystem.init(), 100);
        });
    } else {
        setTimeout(() => LoginSystem.init(), 100);
    }

})();

