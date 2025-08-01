/**
 * RC Construções - Módulo de Demonstração (Revisado e Aprimorado)
 * Este módulo é responsável por popular o banco de dados local com dados de demonstração.
 * Útil para desenvolvimento, testes e apresentações sem a necessidade de um backend ativo.
 * Aprimorado para ser robusto, funcional e integrado com outros módulos de dados.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let clientsModule;
    let budgetsModule;
    let contractsModule;
    let financialModule;
    let authManager;
    let utilsManager; // Para gerar IDs únicos ou formatar dados
    let securityManager; // Para hash de senhas de usuários de demonstração

    const DEMO_CONFIG = {
        numberOfClients: 10,
        numberOfBudgetsPerClient: 3,
        numberOfContractsPerClient: 2,
        numberOfFinancialEntries: 50,
        demoUser: {
            username: 'demo@rc.com',
            password: 'DemoPassword123!',
            role: 'admin'
        }
    };

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
     * Inicializa o Módulo de Demonstração.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('DemoModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            clientsModule = await waitForGlobal('ClientsModule');
            budgetsModule = await waitForGlobal('BudgetsModule');
            contractsModule = await waitForGlobal('ContractsModule');
            financialModule = await waitForGlobal('FinancialModule');
            authManager = await waitForGlobal('AuthManager');
            utilsManager = await waitForGlobal('UtilsManager');
            securityManager = await waitForGlobal('SecurityManager');

            logger.info('🧪 Módulo de Demonstração inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar DemoModule:', error);
            (logger || console).error('Falha na inicialização do DemoModule. Dados de demonstração podem não ser carregados.');
        }
    }

    /**
     * Popula o banco de dados local com dados de demonstração.
     * @returns {Promise<void>}
     */
    async function populateDemoData() {
        logger.info('Populando o banco de dados com dados de demonstração...');
        try {
            if (databaseInstance.isFallback()) {
                logger.warn('Não é possível popular dados de demonstração: Banco de dados em modo fallback (localStorage).');
                // Poderíamos popular o localStorage diretamente aqui se necessário.
                // Mas para o propósito de Dexie.js, é melhor evitar.
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Modo Offline Ativo', 'Dados de demonstração não serão carregados no modo offline para evitar conflitos. Conecte-se e recarregue a página.', 'info');
                }
                return;
            }

            // Limpar dados existentes antes de popular (opcional, mas bom para demos limpas)
            await clearDemoData();

            // 1. Criar usuário de demonstração
            await createDemoUser();

            // 2. Criar clientes de demonstração
            const demoClients = await createDemoClients();

            // 3. Criar orçamentos para cada cliente
            for (const client of demoClients) {
                await createDemoBudgets(client.id);
            }

            // 4. Criar contratos para alguns clientes/orçamentos
            await createDemoContracts(demoClients);

            // 5. Criar entradas financeiras
            await createDemoFinancialEntries();

            logger.success('✅ Dados de demonstração populados com sucesso!');
            // Opcional: Recarregar o dashboard após popular os dados
            if (window.dashboardModule && typeof window.dashboardModule.loadDashboardPage === 'function') {
                window.dashboardModule.loadDashboardPage();
            } else {
                logger.warn('Módulo Dashboard não disponível para recarregar após demo data.');
            }
        } catch (error) {
            logger.error(`Erro ao popular dados de demonstração: ${error.message}`);
            if (typeof Swal !== 'undefined') {
                Swal.fire('Erro na Demonstração', `Falha ao carregar dados de demonstração: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Cria o usuário de demonstração.
     * @returns {Promise<void>}
     */
    async function createDemoUser() {
        logger.info('Criando usuário de demonstração...');
        try {
            // Verifica se o usuário já existe
            const existingUser = await databaseInstance.table('users').where('username').equals(DEMO_CONFIG.demoUser.username).first();
            if (existingUser) {
                logger.debug('Usuário de demonstração já existe.');
                return;
            }

            // Hash da senha do usuário de demonstração
            const hashedPassword = await securityManager.hashPassword(DEMO_CONFIG.demoUser.password);

            const user = {
                username: DEMO_CONFIG.demoUser.username,
                email: DEMO_CONFIG.demoUser.username,
                passwordHash: hashedPassword,
                role: DEMO_CONFIG.demoUser.role,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                permissions: ['dashboard_access', 'clients_view', 'clients_manage', 'budgets_view', 'budgets_manage', 'contracts_view', 'contracts_manage', 'financial_view', 'financial_manage']
            };
            await databaseInstance.table('users').add(user);
            logger.success('Usuário de demonstração criado: ' + DEMO_CONFIG.demoUser.username);
        } catch (error) {
            logger.error(`Erro ao criar usuário de demonstração: ${error.message}`);
        }
    }

    /**
     * Cria clientes de demonstração.
     * @returns {Promise<Array<Object>>} Lista de clientes criados.
     */
    async function createDemoClients() {
        logger.info('Criando clientes de demonstração...');
        const clients = [];
        for (let i = 0; i < DEMO_CONFIG.numberOfClients; i++) {
            const client = {
                name: `Cliente Demo ${i + 1}`,
                email: `cliente${i + 1}@email.com`,
                phone: utilsManager.formatPhone(`9${Math.floor(100000000 + Math.random() * 900000000)}`), // Gera um número de 9 dígitos + 9
                address: `${i + 1} Rua Exemplo, Bairro Demo`,
                cpf: utilsManager.formatCPF(`${Math.floor(100000000 + Math.random() * 900000000)}${Math.floor(10 + Math.random() * 90)}`),
                createdAt: Date.now() - (i * 86400000), // Datas regressivas
                updatedAt: Date.now(),
                syncStatus: 0 // Assumindo que dados de demo são 'sincronizados'
            };
            const id = await clientsModule.add(client); // Usar o módulo de clientes
            if (id) clients.push({ ...client, id });
        }
        logger.success(`${clients.length} clientes de demonstração criados.`);
        return clients;
    }

    /**
     * Cria orçamentos de demonstração para um cliente.
     * @param {number} clientId - ID do cliente.
     * @returns {Promise<void>}
     */
    async function createDemoBudgets(clientId) {
        logger.info(`Criando orçamentos para o cliente ${clientId}...`);
        const statuses = ['Pendente', 'Aprovado', 'Rejeitado'];
        for (let i = 0; i < DEMO_CONFIG.numberOfBudgetsPerClient; i++) {
            const amount = parseFloat((Math.random() * 10000 + 1000).toFixed(2));
            const budget = {
                clientId: clientId,
                title: `Orçamento de Obra ${i + 1} - Cliente ${clientId}`,
                description: `Detalhes para a construção de ${['uma casa', 'um escritório', 'um galpão'][Math.floor(Math.random() * 3)]}.`,
                amount: amount,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                createdAt: Date.now() - (i * 7 * 86400000), // Semanas atrás
                updatedAt: Date.now(),
                syncStatus: 0
            };
            await budgetsModule.add(budget); // Usar o módulo de orçamentos
        }
    }

    /**
     * Cria contratos de demonstração para alguns clientes/orçamentos.
     * @param {Array<Object>} clients - Clientes de demonstração.
     * @returns {Promise<void>}
     */
    async function createDemoContracts(clients) {
        logger.info('Criando contratos de demonstração...');
        const statuses = ['Ativo', 'Concluído', 'Suspenso'];
        for (const client of clients.slice(0, 5)) { // Apenas para os primeiros 5 clientes
            const budgets = await budgetsModule.getAll();
            const clientBudgets = budgets.filter(b => b.clientId === client.id && b.status === 'Aprovado');

            for (let i = 0; i < DEMO_CONFIG.numberOfContractsPerClient; i++) {
                const associatedBudget = clientBudgets[i % clientBudgets.length]; // Reusa orçamentos aprovados
                if (!associatedBudget) continue;

                const startDate = Date.now() - (Math.random() * 90 * 86400000); // 3 meses atrás
                const endDate = startDate + (Math.random() * 180 * 86400000); // Mais 6 meses

                const contract = {
                    clientId: client.id,
                    budgetId: associatedBudget.id,
                    title: `Contrato de Obra ${associatedBudget.title}`,
                    terms: `Termos padrão para ${associatedBudget.title}.`,
                    value: associatedBudget.amount * 1.05, // 5% a mais que o orçamento
                    startDate: startDate,
                    endDate: endDate,
                    status: statuses[Math.floor(Math.random() * statuses.length)],
                    createdAt: Date.now() - (i * 15 * 86400000),
                    updatedAt: Date.now(),
                    syncStatus: 0
                };
                await contractsModule.add(contract); // Usar o módulo de contratos
            }
        }
    }

    /**
     * Cria entradas financeiras de demonstração.
     * @returns {Promise<void>}
     */
    async function createDemoFinancialEntries() {
        logger.info('Criando entradas financeiras de demonstração...');
        const types = ['Receita', 'Despesa'];
        const categories = ['Material', 'Mão de Obra', 'Aluguel', 'Serviço', 'Administrativo'];

        for (let i = 0; i < DEMO_CONFIG.numberOfFinancialEntries; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const amount = parseFloat((Math.random() * 5000 + 100).toFixed(2));
            const date = Date.now() - (Math.random() * 365 * 86400000); // Último ano

            const entry = {
                type: type,
                description: `${type === 'Receita' ? 'Pagamento' : 'Custo'} de ${categories[Math.floor(Math.random() * categories.length)]}`,
                amount: amount,
                date: date,
                category: categories[Math.floor(Math.random() * categories.length)],
                referenceId: utilsManager.generateUniqueId(), // ID de referência
                createdAt: Date.now(),
                updatedAt: Date.now(),
                syncStatus: 0
            };
            await financialModule.add(entry); // Usar o módulo financeiro
        }
    }

    /**
     * Limpa todos os dados de demonstração do banco de dados local.
     * @returns {Promise<void>}
     */
    async function clearDemoData() {
        logger.info('Limpando dados de demonstração...');
        try {
            await databaseInstance.table('users').clear(); // Cuidado ao limpar users! Pode remover o admin.
            await databaseInstance.table('clients').clear();
            await databaseInstance.table('budgets').clear();
            await databaseInstance.table('contracts').clear();
            await databaseInstance.table('financial').clear();
            // Limpa o usuário de demonstração se ele for o único
            // Ou apenas remove os dados gerados pelo demo
            
            logger.success('Dados de demonstração limpos com sucesso!');
        } catch (error) {
            logger.error(`Erro ao limpar dados de demonstração: ${error.message}`);
            if (typeof Swal !== 'undefined') {
                Swal.fire('Erro ao Limpar Dados', `Falha ao limpar dados de demonstração: ${error.message}`, 'error');
            }
        }
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        populate: populateDemoData,
        clear: clearDemoData,
        config: DEMO_CONFIG // Expõe a configuração para referência externa
    };
})();