/**
 * RC Construções - Módulo de Geração de PDF (Revisado e Aprimorado)
 * Gerencia a criação e exportação de documentos PDF usando a biblioteca jspdf.js.
 * Permite gerar relatórios, orçamentos e outros documentos diretamente do aplicativo.
 * Aprimorado para ser robusto, funcional e integrado com outros módulos.
 */

(function() {
    'use strict';

    let logger;
    let databaseInstance; // Para buscar dados
    let utilsManager; // Para formatação de datas, moedas, etc.
    let eventHandler; // Para disparar eventos de sucesso/erro
    let jspdfLib; // Referência à biblioteca jspdf

    const PDF_CONFIG = {
        defaultFont: 'helvetica',
        defaultFontSize: 10,
        defaultTextColor: '#2d3748', // Cor escura padrão (de --color-dark)
        headerColor: '#1a3a6c', // Cor secundária (de --color-secondary)
        primaryColor: '#f58220', // Cor primária (de --color-primary)
        logoPath: 'assets/images/logo-rc.png', // Caminho para o logo da empresa
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        // Outras configurações como tamanho da página, orientação
        pageFormat: 'a4', // 'a4', 'letter', etc.
        pageOrientation: 'portrait' // 'portrait' ou 'landscape'
    };

    // Formatos de tabela padrão para jspdf-autotable (se estiver usando)
    // Se o seu jspdf.js não for a versão UMD com autotable embutido, você precisaria de um plugin
    const DEFAULT_TABLE_STYLES = {
        theme: 'striped', // 'striped', 'grid', 'plain'
        headStyles: { fillColor: [26, 58, 108], textColor: 255, fontStyle: 'bold' }, // Azul escuro, branco
        bodyStyles: { textColor: [74, 85, 104] }, // Cor de texto padrão
        alternateRowStyles: { fillColor: [247, 250, 252] }, // Cor clara, quase branco
        startY: PDF_CONFIG.margins.top + 30 // Posição inicial da tabela
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
     * Inicializa o Módulo PDF.
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('PDFModule'));
            databaseInstance = await waitForGlobal('Database').then(db => db.getInstance());
            utilsManager = await waitForGlobal('UtilsManager');
            eventHandler = await waitForGlobal('SystemEventHandler');

            // Espera pela biblioteca jsPDF, que geralmente é exposta como 'jspdf' ou no objeto global 'window.jspdf'
            jspdfLib = await Promise.race([
                waitForGlobal('jspdf').then(lib => lib.jsPDF), // Para o caso de jspdf.umd.min.js
                waitForGlobal('jsPDF'), // Para o caso de ser o objeto global direto
                new Promise((_, reject) => setTimeout(() => reject(new Error('jspdf.js timeout')), 3000))
            ]);

            if (!jspdfLib || typeof jspdfLib !== 'function') {
                throw new Error('jspdf.js não encontrado ou não funcional. Certifique-se de que está carregado e exposto globalmente.');
            }
            logger.info('📄 Módulo PDF inicializado e jspdf.js disponível.');
        } catch (error) {
            console.error('Erro crítico ao inicializar PDFModule:', error);
            (logger || console).error('Falha na inicialização do PDFModule. Geração de PDF pode não estar disponível.');
        }
    }

    /**
     * Adiciona cabeçalho e rodapé padrão ao PDF.
     * @param {jsPDF} doc - Instância do jsPDF.
     * @param {string} title - Título do documento.
     */
    function addStandardHeaderAndFooter(doc, title) {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Cabeçalho
            doc.setFont(PDF_CONFIG.defaultFont, 'bold');
            doc.setFontSize(PDF_CONFIG.defaultFontSize + 4);
            doc.setTextColor(PDF_CONFIG.headerColor.split(',').map(Number) || 0); // Converte para RGB array ou 0 (black)

            doc.text(title, PDF_CONFIG.margins.left, PDF_CONFIG.margins.top / 2 + 5);

            // Adiciona logo da empresa (se o caminho estiver correto e a imagem existir)
            if (PDF_CONFIG.logoPath) {
                try {
                    const img = new Image();
                    img.src = PDF_CONFIG.logoPath;
                    // Tentar adicionar imagem. Pode precisar de Promise para carregar
                    // doc.addImage(img, 'PNG', doc.internal.pageSize.width - PDF_CONFIG.margins.right - 20, PDF_CONFIG.margins.top / 2 - 5, 20, 20); // Ajuste tamanho e pos
                } catch (e) {
                    logger.warn(`Não foi possível carregar o logo em ${PDF_CONFIG.logoPath}: ${e.message}`);
                }
            }
            
            doc.setDrawColor(PDF_CONFIG.primaryColor.split(',').map(Number) || 0); // Cor da linha
            doc.line(PDF_CONFIG.margins.left, PDF_CONFIG.margins.top / 2 + 8, doc.internal.pageSize.width - PDF_CONFIG.margins.right, PDF_CONFIG.margins.top / 2 + 8);


            // Rodapé
            doc.setFont(PDF_CONFIG.defaultFont, 'normal');
            doc.setFontSize(PDF_CONFIG.defaultFontSize - 2);
            doc.setTextColor(PDF_CONFIG.defaultTextColor.split(',').map(Number) || 0);
            const footerText = `Página ${i} de ${pageCount}`;
            doc.text(footerText, doc.internal.pageSize.width - PDF_CONFIG.margins.right, doc.internal.pageSize.height - PDF_CONFIG.margins.bottom / 2);
            
            // Data de geração no rodapé
            doc.text(`Gerado em: ${utilsManager.formatDate(Date.now(), 'DD/MM/YYYY HH:mm')}`, PDF_CONFIG.margins.left, doc.internal.pageSize.height - PDF_CONFIG.margins.bottom / 2);
        }
    }

    /**
     * Gera um PDF básico a partir de um título e conteúdo.
     * @param {string} title - Título do PDF.
     * @param {string} content - Conteúdo em texto.
     * @param {string} filename - Nome do arquivo PDF.
     * @returns {Promise<void>}
     */
    async function generateBasicPdf(title, content, filename = 'documento.pdf') {
        if (!jspdfLib) {
            logger.error('jspdf.js não está carregado. Não é possível gerar PDF.');
            eventHandler.emit('pdf:error', { type: 'basic', error: 'jspdf.js not loaded' });
            return;
        }
        logger.info(`Gerando PDF básico: '${title}'`);

        const doc = new jspdfLib.jsPDF({
            orientation: PDF_CONFIG.pageOrientation,
            unit: 'mm',
            format: PDF_CONFIG.pageFormat
        });

        addStandardHeaderAndFooter(doc, title);

        doc.setFont(PDF_CONFIG.defaultFont, 'normal');
        doc.setFontSize(PDF_CONFIG.defaultFontSize);
        doc.setTextColor(PDF_CONFIG.defaultTextColor.split(',').map(Number) || 0);
        doc.text(content, PDF_CONFIG.margins.left, PDF_CONFIG.margins.top + 10, { maxWidth: doc.internal.pageSize.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right });

        try {
            doc.save(filename);
            logger.success(`PDF '${filename}' gerado com sucesso.`);
            eventHandler.emit('pdf:generated', { filename, type: 'basic' });
        } catch (error) {
            logger.error(`Erro ao salvar PDF básico: ${error.message}`);
            eventHandler.emit('pdf:error', { type: 'basic', error: error.message });
        }
    }

    /**
     * Gera um relatório em PDF a partir de dados tabulares.
     * Requer o plugin 'jspdf-autotable' (se não estiver embutido no seu jspdf.js, adicione separadamente).
     * @param {string} title - Título do relatório.
     * @param {Array<string>} headers - Cabeçalhos da tabela.
     * @param {Array<Array<any>>} data - Dados da tabela.
     * @param {string} filename - Nome do arquivo PDF.
     * @param {Object} [options={}] - Opções adicionais para a tabela (startY, theme, etc.).
     * @returns {Promise<void>}
     */
    async function generateTablePdf(title, headers, data, filename = 'relatorio.pdf', options = {}) {
        if (!jspdfLib) {
            logger.error('jspdf.js não está carregado. Não é possível gerar PDF com tabela.');
            eventHandler.emit('pdf:error', { type: 'table', error: 'jspdf.js not loaded' });
            return;
        }
        if (typeof jspdfLib.autoTable === 'undefined') {
             logger.error('Plugin jspdf-autotable não encontrado. Não é possível gerar PDF com tabela.');
             eventHandler.emit('pdf:error', { type: 'table', error: 'jspdf-autotable plugin missing' });
             return;
        }

        logger.info(`Gerando PDF de tabela: '${title}'`);

        const doc = new jspdfLib.jsPDF({
            orientation: PDF_CONFIG.pageOrientation,
            unit: 'mm',
            format: PDF_CONFIG.pageFormat
        });

        addStandardHeaderAndFooter(doc, title);

        const tableOptions = utilsManager.deepMerge(DEFAULT_TABLE_STYLES, options);
        // Ajusta startY para não colidir com o cabeçalho padrão
        tableOptions.startY = tableOptions.startY || PDF_CONFIG.margins.top + 25;

        // Adiciona a tabela
        jspdfLib.autoTable(doc, {
            head: [headers],
            body: data,
            ...tableOptions,
            didDrawPage: (dataHook) => {
                // Se o cabeçalho/rodapé não for adicionado por `addStandardHeaderAndFooter`,
                // você pode adicioná-lo aqui para cada página.
                // Mas como já é tratado, este hook pode ser usado para outras coisas.
            }
        });

        try {
            doc.save(filename);
            logger.success(`PDF de tabela '${filename}' gerado com sucesso.`);
            eventHandler.emit('pdf:generated', { filename, type: 'table' });
        } catch (error) {
            logger.error(`Erro ao salvar PDF com tabela: ${error.message}`);
            eventHandler.emit('pdf:error', { type: 'table', error: error.message });
        }
    }


    /**
     * Gera um PDF de um orçamento específico.
     * @param {number} budgetId - ID do orçamento.
     * @returns {Promise<void>}
     */
    async function generateBudgetPdf(budgetId) {
        logger.info(`Gerando PDF para Orçamento (ID: ${budgetId}).`);
        if (!databaseInstance) {
            logger.error('Database não disponível para buscar dados do orçamento.');
            eventHandler.emit('pdf:error', { type: 'budget', error: 'Database not available' });
            return;
        }
        try {
            const budget = await databaseInstance.table('budgets').get(budgetId);
            if (!budget) {
                logger.warn(`Orçamento (ID: ${budgetId}) não encontrado para gerar PDF.`);
                eventHandler.emit('pdf:error', { type: 'budget', error: 'Budget not found' });
                return;
            }
            
            // Assumindo que você pode querer informações do cliente também
            const client = await databaseInstance.table('clients').get(budget.clientId);

            const doc = new jspdfLib.jsPDF({
                orientation: PDF_CONFIG.pageOrientation,
                unit: 'mm',
                format: PDF_CONFIG.pageFormat
            });
            
            addStandardHeaderAndFooter(doc, `Orçamento #${budget.id}`);

            let yPos = PDF_CONFIG.margins.top + 25; // Posição inicial após o cabeçalho

            doc.setFont(PDF_CONFIG.defaultFont, 'bold');
            doc.setFontSize(PDF_CONFIG.defaultFontSize + 2);
            doc.text(`Título: ${budget.title}`, PDF_CONFIG.margins.left, yPos);
            yPos += 7;

            doc.setFont(PDF_CONFIG.defaultFont, 'normal');
            doc.setFontSize(PDF_CONFIG.defaultFontSize);
            doc.text(`Status: ${budget.status}`, PDF_CONFIG.margins.left, yPos);
            yPos += 7;
            doc.text(`Valor: ${utilsManager.formatCurrency(budget.amount)}`, PDF_CONFIG.margins.left, yPos);
            yPos += 7;
            doc.text(`Data de Criação: ${utilsManager.formatDate(budget.createdAt, 'DD/MM/YYYY')}`, PDF_CONFIG.margins.left, yPos);
            yPos += 10;

            if (client) {
                doc.setFont(PDF_CONFIG.defaultFont, 'bold');
                doc.setFontSize(PDF_CONFIG.defaultFontSize + 1);
                doc.text('Dados do Cliente:', PDF_CONFIG.margins.left, yPos);
                yPos += 7;
                doc.setFont(PDF_CONFIG.defaultFont, 'normal');
                doc.setFontSize(PDF_CONFIG.defaultFontSize);
                doc.text(`Nome: ${client.name}`, PDF_CONFIG.margins.left, yPos);
                yPos += 7;
                doc.text(`E-mail: ${client.email}`, PDF_CONFIG.margins.left, yPos);
                yPos += 7;
                doc.text(`Telefone: ${client.phone}`, PDF_CONFIG.margins.left, yPos);
                yPos += 10;
            }

            doc.setFont(PDF_CONFIG.defaultFont, 'bold');
            doc.setFontSize(PDF_CONFIG.defaultFontSize + 1);
            doc.text('Descrição:', PDF_CONFIG.margins.left, yPos);
            yPos += 7;
            doc.setFont(PDF_CONFIG.defaultFont, 'normal');
            doc.setFontSize(PDF_CONFIG.defaultFontSize);
            doc.text(budget.description || 'Nenhuma descrição fornecida.', PDF_CONFIG.margins.left, yPos, { maxWidth: doc.internal.pageSize.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right });

            // Adicione mais detalhes do orçamento ou tabela de itens se aplicável.

            const filename = `orcamento_${budget.id}.pdf`;
            doc.save(filename);
            logger.success(`PDF do orçamento '${filename}' gerado com sucesso.`);
            eventHandler.emit('pdf:generated', { filename, type: 'budget', budgetId });

        } catch (error) {
            logger.error(`Erro ao gerar PDF do orçamento (ID: ${budgetId}): ${error.message}`, error);
            eventHandler.emit('pdf:error', { type: 'budget', budgetId, error: error.message });
        }
    }


    // Expõe a API pública do módulo
    return {
        init: init,
        generateBasic: generateBasicPdf,
        generateTable: generateTablePdf,
        generateBudgetPdf: generateBudgetPdf, // Método específico para orçamentos
        config: PDF_CONFIG // Expõe a configuração para uso externo
    };
})();