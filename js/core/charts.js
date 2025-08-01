/**
 * RC Construções - Charts Module (Revisado e Aprimorado)
 * Gerencia a criação e configuração de gráficos Chart.js em todo o aplicativo.
 * Aprimorado para padronizar estilos, melhorar a funcionalidade e garantir robustez.
 */

(function() {
    'use strict';

    let logger;
    let utilsManager; // Para utilitários de dados, se necessário

    // Opções padrão para todos os gráficos, alinhadas com as variáveis CSS
    const DEFAULT_CHART_OPTIONS = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: {
                        family: 'Inter, sans-serif',
                        size: 14 // Tamanho de fonte padrão para legendas
                    },
                    color: '#4a5568', // --color-text
                    boxWidth: 20,
                    padding: 15
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(26, 58, 108, 0.9)', // --color-secondary com opacidade
                titleFont: {
                    family: 'Inter, sans-serif',
                    weight: 'bold',
                    size: 14
                },
                bodyFont: {
                    family: 'Inter, sans-serif',
                    size: 14
                },
                padding: 10,
                caretPadding: 5,
                cornerRadius: 8, // Bordas arredondadas para tooltips
                displayColors: true // Mostra a cor da série no tooltip
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: false, // Por padrão, o título do eixo Y pode ser definido por gráfico
                    font: {
                        family: 'Inter, sans-serif',
                        weight: 'bold',
                        size: 14
                    },
                    color: '#2d3748' // --color-dark
                },
                ticks: {
                    font: {
                        family: 'Inter, sans-serif',
                        size: 12
                    },
                    color: '#4a5568' // --color-text
                },
                grid: {
                    color: 'rgba(226, 232, 240, 0.5)', // --color-border com opacidade
                    drawBorder: false // Remove borda do grid
                }
            },
            x: {
                ticks: {
                    font: {
                        family: 'Inter, sans-serif',
                        size: 12
                    },
                    color: '#4a5568' // --color-text
                },
                grid: {
                    display: false, // Eixo X sem linhas de grid por padrão
                    drawBorder: false
                }
            }
        },
        animation: {
            duration: 1000, // Animação mais suave para os gráficos
            easing: 'easeInOutQuart'
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
                    setTimeout(checkGlobal, 50);
                }
            };
            checkGlobal();
        });
    }

    /**
     * Inicializa o módulo Charts.
     */
    async function init() {
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ChartsModule'));
            utilsManager = await waitForGlobal('UtilsManager'); // Se precisar de utilitários como formatadores
            
            // Verifica se Chart.js está disponível
            if (typeof Chart === 'undefined') {
                throw new Error('Chart.js não encontrado. Certifique-se de que lib/chart.js está carregado.');
            }
            logger.info('📊 Charts Module inicializado e Chart.js disponível.');
        } catch (error) {
            console.error('Erro crítico ao inicializar Charts Module:', error);
            (logger || console).error('Falha na inicialização do Charts Module. Gráficos podem não funcionar.');
        }
    }

    /**
     * Cria e retorna uma nova instância de gráfico Chart.js com opções padronizadas.
     * Este método pode ser usado por outros módulos (como dashboard.js) para criar seus gráficos.
     * @param {HTMLCanvasElement} canvasElement - O elemento canvas onde o gráfico será renderizado.
     * @param {string} type - O tipo de gráfico (e.g., 'line', 'bar', 'doughnut').
     * @param {Object} data - Os dados do gráfico.
     * @param {Object} [customOptions={}] - Opções customizadas para sobrescrever as opções padrão.
     * @returns {Chart|null} A instância do Chart.js ou null se houver erro.
     */
    function createChart(canvasElement, type, data, customOptions = {}) {
        if (!canvasElement || !canvasElement.getContext) {
            logger.error('Elemento canvas inválido para criar gráfico.');
            return null;
        }
        if (typeof Chart === 'undefined') {
            logger.error('Chart.js não está carregado. Não é possível criar gráfico.');
            return null;
        }

        const ctx = canvasElement.getContext('2d');
        
        // Combina as opções padrão com as customizadas
        // Deep merge pode ser necessário para opções complexas como 'scales' ou 'plugins'
        const mergedOptions = Chart.helpers.merge(DEFAULT_CHART_OPTIONS, customOptions);

        // Destroi qualquer instância anterior de gráfico no mesmo canvas para evitar conflitos
        if (Chart.getChart(canvasElement)) {
            Chart.getChart(canvasElement).destroy();
            logger.debug('Instância de gráfico existente destruída no canvas.', canvasElement.id);
        }

        try {
            const newChart = new Chart(ctx, {
                type: type,
                data: data,
                options: mergedOptions
            });
            logger.success(`Gráfico '${type}' criado com sucesso no canvas '${canvasElement.id || 'sem ID'}'.`);
            return newChart;
        } catch (error) {
            logger.error(`Erro ao criar gráfico '${type}' no canvas '${canvasElement.id || 'sem ID'}': ${error.message}`);
            return null;
        }
    }

    /**
     * Atualiza os dados de um gráfico existente.
     * @param {Chart} chartInstance - A instância do Chart.js a ser atualizada.
     * @param {Object} newData - Os novos dados para o gráfico.
     * @returns {boolean} True se a atualização for bem-sucedida, false caso contrário.
     */
    function updateChartData(chartInstance, newData) {
        if (!chartInstance || !newData) {
            logger.warn('Instância de gráfico ou novos dados inválidos para atualização.');
            return false;
        }
        try {
            chartInstance.data = newData;
            chartInstance.update(); // Redesenha o gráfico com os novos dados
            logger.info('Dados do gráfico atualizados com sucesso.');
            return true;
        } catch (error) {
            logger.error(`Erro ao atualizar dados do gráfico: ${error.message}`);
            return false;
        }
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        createChart: createChart,
        updateChartData: updateChartData,
        defaultOptions: DEFAULT_CHART_OPTIONS // Permite que outros módulos inspecionem ou estendam opções padrão
    };
})();