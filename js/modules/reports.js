/**
 * RC Construções - Módulo de Relatórios (Revisado e Aprimorado)
 * Gerencia a geração de diversos tipos de relatórios a partir dos dados do sistema.
 * Inclui agregação de dados, filtros, cache de relatórios e integração para exportação (PDF).
 * Aprimorado para ser robusto, flexível e modular.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance;
    let utilsManager;
    let eventHandler;
    let pdfModule; // Para exportar relatórios em PDF
    let chartsModule; // Para gerar gráficos embutidos no relatório, se necessário

    // Módulos de dados necessários para buscar informações
    let financialModule;
    let clientsModule;
    let budgetsModule;
    let contractsModule;
    let usersModule; // Se precisar de dados de usuários para relatórios

    const REPORT_CONFIG = {
        cacheDuration: 5 * 60 * 1000, // Duração do cache de relatório em milissegundos (5 minutos)
        supportedReportTypes: ['financial', 'client', 'budget', 'contract', 'user'], // Tipos principais de relatório
        // Mapeamento de subtipos para funções de geração de relatório
        subtypes: {
            financial: {
                monthly_summary: 'Resumo Mensal Financeiro',
                category_breakdown: 'Análise por Categoria',
                cash_flow: 'Fluxo de Caixa'
            },
            client: {
                active_clients: 'Clientes Ativos',
                new_clients_by_period: 'Novos Clientes por Período'
            },
            budget: {
                status_summary: 'Resumo de Orçamentos por Status',
                value_distribution: 'Distribuição de Valores de Orçamentos'
            },
            contract: {
                status_summary: 'Resumo de Contratos por Status',
                value_distribution: 'Distribuição de Valores de Contratos'
            }
        }
    };

    const reportCache = new Map(); // Cache em memória para relatórios gerados

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
     * Inicializa o Módulo de Relatórios.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ReportsModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            utilsManager = await waitForGlobal('UtilsManager');
            eventHandler = await waitForGlobal('SystemEventHandler');
            pdfModule = await waitForGlobal('PDFModule').catch(() => null); // PDF é opcional
            chartsModule = await waitForGlobal('ChartsModule').catch(() => null); // Charts é opcional

            // Módulos de dados que serão utilizados
            financialModule = await waitForGlobal('FinancialModule');
            clientsModule = await waitForGlobal('ClientsModule');
            budgetsModule = await waitForGlobal('BudgetsModule');
            contractsModule = await waitForGlobal('ContractsModule');
            // usersModule = await waitForGlobal('UsersModule').catch(() => null); // Se houver um UsersModule separado

            logger.info('📈 Módulo de Relatórios inicializado.');
        } catch (error) {
            console.error('Erro crítico ao inicializar ReportsModule:', error);
            (logger || console).error('Falha na inicialização do ReportsModule. Funcionalidades de relatório podem não estar disponíveis.');
        }
    }

    /**
     * Classe base para tipos de relatório específicos.
     * Implementa lógica comum de geração e validação.
     */
    class BaseReportGenerator {
        constructor(reportType) {
            this.type = reportType;
        }

        /**
         * Gera o relatório. Deve ser sobrescrito pelas subclasses.
         * @param {string} subtype - Subtipo específico do relatório (ex: 'monthly_summary').
         * @param {Object} filters - Filtros a serem aplicados (ex: { startDate, endDate, category }).
         * @returns {Promise<Object>} Dados do relatório gerado.
         */
        async generate(subtype, filters) {
            logger.error(`Método 'generate' não implementado para o tipo de relatório '${this.type}' e subtipo '${subtype}'.`);
            throw new Error(`Método 'generate' não implementado para o tipo de relatório '${this.type}'.`);
        }

        /**
         * Valida os filtros para um relatório. Pode ser sobrescrito.
         * @param {Object} filters - Filtros a serem validados.
         * @returns {boolean} True se os filtros são válidos.
         */
        validateFilters(filters) {
            if (filters.startDate && !utilsManager.formatDate(filters.startDate, 'YYYY-MM-DD')) {
                logger.warn(`Filtro de data de início inválido: ${filters.startDate}`);
                return false;
            }
            if (filters.endDate && !utilsManager.formatDate(filters.endDate, 'YYYY-MM-DD')) {
                logger.warn(`Filtro de data de término inválido: ${filters.endDate}`);
                return false;
            }
            if (filters.startDate && filters.endDate && new Date(filters.startDate) > new Date(filters.endDate)) {
                logger.warn('Data de início do filtro é posterior à data de término.');
                return false;
            }
            return true;
        }

        /**
         * Adiciona dados do relatório ao cache.
         * @param {string} cacheKey - Chave do cache.
         * @param {Object} data - Dados do relatório.
         */
        addToCache(cacheKey, data) {
            reportCache.set(cacheKey, { data: data, timestamp: Date.now() });
            logger.debug(`Relatório adicionado ao cache: ${cacheKey}`);
        }
    }

    // --- Implementações de Relatórios Específicos ---

    class FinancialReports extends BaseReportGenerator {
        constructor() {
            super('financial');
        }

        async generate(subtype, filters) {
            if (!financialModule) throw new Error('FinancialModule não está disponível para gerar relatórios financeiros.');
            if (!this.validateFilters(filters)) throw new Error('Filtros de relatório financeiro inválidos.');

            logger.info(`Gerando relatório financeiro: ${subtype} com filtros:`, filters);
            let entries = await financialModule.getAll(filters);

            switch (subtype) {
                case 'monthly_summary':
                    return this.generateMonthlySummary(entries, filters);
                case 'category_breakdown':
                    return this.generateCategoryBreakdown(entries, filters);
                case 'cash_flow':
                    return this.generateCashFlow(entries, filters);
                default:
                    throw new Error(`Subtipo de relatório financeiro desconhecido: ${subtype}`);
            }
        }

        generateMonthlySummary(transactions, filters) {
            const summary = transactions.reduce((acc, tx) => {
                const date = new Date(tx.date);
                const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!acc[monthYear]) {
                    acc[monthYear] = { revenue: 0, expense: 0, balance: 0 };
                }
                if (tx.type === 'Receita') {
                    acc[monthYear].revenue += tx.amount;
                } else {
                    acc[monthYear].expense += tx.amount;
                }
                acc[monthYear].balance = acc[monthYear].revenue - acc[monthYear].expense;
                return acc;
            }, {});

            const sortedMonths = Object.keys(summary).sort();
            const result = sortedMonths.map(month => ({
                month,
                revenue: summary[month].revenue,
                expense: summary[month].expense,
                balance: summary[month].balance,
                formattedRevenue: utilsManager.formatCurrency(summary[month].revenue),
                formattedExpense: utilsManager.formatCurrency(summary[month].expense),
                formattedBalance: utilsManager.formatCurrency(summary[month].balance)
            }));
            logger.debug('Resumo Mensal Financeiro gerado:', result);
            return result;
        }

        generateCategoryBreakdown(transactions, filters) {
            const breakdown = transactions.reduce((acc, tx) => {
                if (!acc[tx.category]) {
                    acc[tx.category] = { revenue: 0, expense: 0, net: 0 };
                }
                if (tx.type === 'Receita') {
                    acc[tx.category].revenue += tx.amount;
                } else {
                    acc[tx.category].expense += tx.amount;
                }
                acc[tx.category].net = acc[tx.category].revenue - acc[tx.category].expense;
                return acc;
            }, {});

            const result = Object.keys(breakdown).map(category => ({
                category,
                revenue: breakdown[category].revenue,
                expense: breakdown[category].expense,
                net: breakdown[category].net,
                formattedRevenue: utilsManager.formatCurrency(breakdown[category].revenue),
                formattedExpense: utilsManager.formatCurrency(breakdown[category].expense),
                formattedNet: utilsManager.formatCurrency(breakdown[category].net)
            }));
            logger.debug('Análise por Categoria gerada:', result);
            return result;
        }

        generateCashFlow(transactions, filters) {
            const flow = transactions.reduce((acc, tx) => {
                const date = utilsManager.formatDate(tx.date, 'YYYY-MM-DD');
                if (!acc[date]) {
                    acc[date] = { date, dailyRevenue: 0, dailyExpense: 0, dailyNet: 0 };
                }
                if (tx.type === 'Receita') {
                    acc[date].dailyRevenue += tx.amount;
                } else {
                    acc[date].dailyExpense += tx.amount;
                }
                acc[date].dailyNet = acc[date].dailyRevenue - acc[date].dailyExpense;
                return acc;
            }, {});

            const sortedDates = Object.keys(flow).sort();
            const result = sortedDates.map(date => ({
                date,
                dailyRevenue: flow[date].dailyRevenue,
                dailyExpense: flow[date].dailyExpense,
                dailyNet: flow[date].dailyNet,
                formattedDailyRevenue: utilsManager.formatCurrency(flow[date].dailyRevenue),
                formattedDailyExpense: utilsManager.formatCurrency(flow[date].dailyExpense),
                formattedDailyNet: utilsManager.formatCurrency(flow[date].dailyNet)
            }));
            logger.debug('Fluxo de Caixa gerado:', result);
            return result;
        }
    }

    class ClientReports extends BaseReportGenerator {
        constructor() {
            super('client');
        }

        async generate(subtype, filters) {
            if (!clientsModule) throw new Error('ClientsModule não está disponível para gerar relatórios de clientes.');
            if (!this.validateFilters(filters)) throw new Error('Filtros de relatório de cliente inválidos.');

            logger.info(`Gerando relatório de clientes: ${subtype} com filtros:`, filters);
            let clients = await clientsModule.getAll();

            switch (subtype) {
                case 'active_clients':
                    // Exemplo: Filtra clientes que têm contratos ativos ou orçamentos aprovados
                    // Para isso, precisaríamos dos módulos de contratos/orçamentos também
                    const activeContracts = await contractsModule.getAll({ status: 'Ativo' });
                    const clientIdsWithActiveContracts = new Set(activeContracts.map(c => c.clientId));
                    const activeClients = clients.filter(c => clientIdsWithActiveContracts.has(c.id));
                    return activeClients.map(c => ({
                        name: c.name,
                        email: c.email,
                        phone: c.phone,
                        status: 'Ativo' // Status inferido
                    }));
                case 'new_clients_by_period':
                    const newClients = clients.filter(c => {
                        const createdAt = new Date(c.createdAt).getTime();
                        return (!filters.startDate || createdAt >= new Date(filters.startDate).getTime()) &&
                               (!filters.endDate || createdAt <= new Date(filters.endDate).getTime());
                    });
                    const result = newClients.map(c => ({
                        name: c.name,
                        email: c.email,
                        createdAt: utilsManager.formatDate(c.createdAt, 'DD/MM/YYYY')
                    }));
                    logger.debug('Novos clientes por período gerado:', result);
                    return result;
                default:
                    throw new Error(`Subtipo de relatório de cliente desconhecido: ${subtype}`);
            }
        }
    }
    
    // Adicione outras classes de relatório (BudgetReports, ContractReports, UserReports) aqui,
    // seguindo o mesmo padrão de herdar de BaseReportGenerator e implementar o método `generate`.
    // Exemplo:
    // class BudgetReports extends BaseReportGenerator { ... }
    // class ContractReports extends BaseReportGenerator { ... }

    // --- Gerenciador Principal de Relatórios ---
    class ReportManager {
        constructor() {
            this.generators = {
                financial: new FinancialReports(),
                client: new ClientReports(),
                // Adicione instâncias de outros geradores de relatório aqui
                // budget: new BudgetReports(),
                // contract: new ContractReports()
            };
        }

        /**
         * Gera um relatório específico.
         * Primeiro verifica o cache, se não estiver disponível, gera e armazena.
         * @param {string} type - Tipo principal do relatório (ex: 'financial').
         * @param {string} subtype - Subtipo do relatório (ex: 'monthly_summary').
         * @param {Object} [filters={}] - Filtros a serem aplicados ao relatório.
         * @returns {Promise<Object>} Dados do relatório gerado.
         */
        async generateReport(type, subtype, filters = {}) {
            if (!logger) throw new Error('Logger não disponível no ReportManager.');
            if (!this.generators[type]) {
                logger.error(`Tipo de relatório desconhecido: ${type}`);
                throw new Error(`Tipo de relatório desconhecido: ${type}`);
            }

            const cacheKey = this.getCacheKey(type, subtype, filters);
            const cachedReport = reportCache.get(cacheKey);

            if (cachedReport && Date.now() - cachedReport.timestamp < REPORT_CONFIG.cacheDuration) {
                logger.info(`Retornando relatório '${type}/${subtype}' do cache.`);
                return cachedReport.data;
            }

            logger.info(`Gerando novo relatório: ${type}/${subtype} com filtros:`, filters);
            try {
                const reportData = await this.generators[type].generate(subtype, filters);
                this.addToCache(cacheKey, reportData); // Adiciona ao cache
                eventHandler.emit('report:generated', { type, subtype, filters, data: reportData });
                return reportData;
            } catch (error) {
                logger.error(`❌ Erro ao gerar relatório [${type}/${subtype}]: ${error.message}`, error);
                eventHandler.emit('report:error', { type, subtype, filters, error: error.message });
                throw error; // Propaga o erro para que a UI possa exibi-lo
            }
        }

        /**
         * Obtém uma lista dos tipos de relatório e seus subtipos disponíveis.
         * @returns {Object} Estrutura dos relatórios disponíveis.
         */
        getAvailableReports() {
            // Retorna uma cópia da estrutura para evitar modificações externas
            return { ...REPORT_CONFIG.subtypes };
        }

        /**
         * Constrói uma chave única para o cache de relatórios.
         * @param {string} type - Tipo do relatório.
         * @param {string} subtype - Subtipo do relatório.
         * @param {Object} filters - Filtros usados.
         * @returns {string} Chave única.
         */
        getCacheKey(type, subtype, filters) {
            try {
                // Converte os filtros em uma string ordenada para garantir consistência na chave
                const filterString = Object.keys(filters).sort().map(key => `${key}:${JSON.stringify(filters[key])}`).join('|');
                return `${type}-${subtype}-${filterString}`;
            } catch (e) {
                logger.warn(`Erro ao gerar cache key para filtros complexos. Usando fallback.`, filters);
                return `${type}-${subtype}`; // Fallback para filtros não-serializáveis
            }
        }

        /**
         * Adiciona dados do relatório ao cache.
         * @param {string} cacheKey - Chave do cache.
         * @param {Object} data - Dados do relatório.
         */
        addToCache(cacheKey, data) {
            reportCache.set(cacheKey, { data: data, timestamp: Date.now() });
            logger.debug(`Relatório adicionado ao cache: ${cacheKey}`);
        }

        /**
         * Limpa o cache de relatórios.
         */
        clearCache() {
            reportCache.clear();
            logger.info('Cache de relatórios limpo.');
            eventHandler.emit('report:cacheCleared');
        }

        /**
         * Exporta um relatório gerado para PDF.
         * Requer que o `PDFModule` esteja disponível.
         * @param {string} type - Tipo do relatório.
         * @param {string} subtype - Subtipo do relatório.
         * @param {Object} filters - Filtros do relatório.
         * @returns {Promise<void>}
         */
        async exportReportToPdf(type, subtype, filters = {}) {
            if (!pdfModule) {
                logger.error('PDFModule não disponível para exportar relatório. Certifique-se de que está inicializado.');
                eventHandler.emit('report:exportError', { type, subtype, format: 'pdf', error: 'PDFModule not available' });
                return;
            }
            logger.info(`Exportando relatório '${type}/${subtype}' para PDF.`);

            try {
                const reportData = await this.generateReport(type, subtype, filters); // Gera/obtem do cache
                
                // Converte os dados do relatório para o formato esperado pelo generateTablePdf
                let headers = [];
                let body = [];
                let pdfTitle = `Relatório: ${type} - ${REPORT_CONFIG.subtypes[type][subtype] || subtype}`;

                // Exemplo de como formatar dados para PDF (adapte para cada tipo/subtipo)
                if (type === 'financial' && subtype === 'monthly_summary') {
                    headers = ['Mês', 'Receita', 'Despesa', 'Balanço'];
                    body = reportData.map(row => [
                        row.month,
                        row.formattedRevenue,
                        row.formattedExpense,
                        row.formattedBalance
                    ]);
                } else if (type === 'financial' && subtype === 'category_breakdown') {
                    headers = ['Categoria', 'Receita', 'Despesa', 'Líquido'];
                    body = reportData.map(row => [
                        row.category,
                        row.formattedRevenue,
                        row.formattedExpense,
                        row.formattedNet
                    ]);
                } else if (type === 'client' && subtype === 'active_clients') {
                    headers = ['Nome', 'E-mail', 'Telefone', 'Status'];
                    body = reportData.map(row => [row.name, row.email, row.phone, row.status]);
                } else {
                    logger.warn(`Formato de exportação para ${type}/${subtype} não definido. Exportando dados brutos.`);
                    // Fallback: tenta exportar JSON como uma coluna se não houver um formatador específico
                    headers = ['Dados'];
                    body = reportData.map(row => [JSON.stringify(row, null, 2)]);
                    pdfTitle = `${pdfTitle} (Dados Brutos)`;
                }

                const filename = `${type}_${subtype}_${utilsManager.formatDate(Date.now(), 'YYYYMMDD')}.pdf`;
                await pdfModule.generateTable(pdfTitle, headers, body, filename);
                logger.success(`Relatório '${type}/${subtype}' exportado com sucesso para PDF.`);

            } catch (error) {
                logger.error(`Erro ao exportar relatório para PDF: ${error.message}`, error);
                eventHandler.emit('report:exportError', { type, subtype, format: 'pdf', error: error.message });
            }
        }
    }

    // Instancia o gerenciador de relatórios
    const reportManagerInstance = new ReportManager();

    // Expõe a API pública do módulo
    return {
        init: init,
        generate: reportManagerInstance.generateReport.bind(reportManagerInstance), // Bind para manter o 'this'
        getAvailableReports: reportManagerInstance.getAvailableReports.bind(reportManagerInstance),
        clearCache: reportManagerInstance.clearCache.bind(reportManagerInstance),
        exportToPdf: reportManagerInstance.exportReportToPdf.bind(reportManagerInstance)
    };
})();