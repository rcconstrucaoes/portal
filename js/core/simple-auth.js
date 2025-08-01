/**
 * Sistema de Autenticação Simples
 * Verifica se o usuário está logado e aplica permissões
 */

(function() {
    'use strict';

    const AuthSystem = {
        currentUser: null,

        init() {
            this.checkAuth();
            this.setupLogout();
        },

        checkAuth() {
            const savedUser = localStorage.getItem('rcUser');
            
            if (!savedUser) {
                // Redireciona para login se não estiver logado
                window.location.href = 'login.html';
                return;
            }

            try {
                this.currentUser = JSON.parse(savedUser);
                this.showUserInfo();
                this.applyPermissions();
            } catch (e) {
                localStorage.removeItem('rcUser');
                window.location.href = 'login.html';
            }
        },

        applyPermissions() {
            if (!this.currentUser) return;

            const menuItems = document.querySelectorAll('.nav-item');
            menuItems.forEach(item => {
                const link = item.querySelector('a');
                if (!link) return;

                const href = link.getAttribute('href');
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

                if (permission && !this.currentUser.permissions.includes(permission)) {
                    item.style.display = 'none';
                } else if (permission) {
                    item.style.display = 'block';
                }
            });
        },

        showUserInfo() {
            // Remove info existente
            const existingInfo = document.getElementById('userInfo');
            if (existingInfo) existingInfo.remove();

            // Cria nova info do usuário
            const userInfoHTML = `
                <div id="userInfo" style="
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #2c3e50;
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 5px;
                    z-index: 1000;
                    font-size: 0.9rem;
                ">
                    <span>${this.currentUser.name} (${this.currentUser.type})</span>
                    <button id="logoutBtn" style="
                        background: #e74c3c;
                        color: white;
                        border: none;
                        padding: 0.25rem 0.5rem;
                        border-radius: 3px;
                        cursor: pointer;
                        margin-left: 0.5rem;
                        font-size: 0.8rem;
                    ">Sair</button>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', userInfoHTML);
        },

        setupLogout() {
            // Delega o evento para o botão de logout
            document.addEventListener('click', (e) => {
                if (e.target.id === 'logoutBtn' || e.target.closest('.logout-item')) {
                    e.preventDefault();
                    this.logout();
                }
            });
        },

        logout() {
            localStorage.removeItem('rcUser');
            window.location.href = 'login.html';
        },

        getCurrentUser() {
            return this.currentUser;
        },

        hasPermission(permission) {
            return this.currentUser && this.currentUser.permissions.includes(permission);
        }
    };

    // Inicializa quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AuthSystem.init());
    } else {
        AuthSystem.init();
    }

    // Expõe globalmente
    window.AuthSystem = AuthSystem;

})();

