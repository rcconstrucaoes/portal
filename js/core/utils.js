/**
 * RC Construções - Módulo de Utilitários Globais (Revisado e Aprimorado)
 * Contém funções utilitárias gerais para formatação, manipulação de dados,
 * operações assíncronas (debounce/throttle), e helpers diversos.
 * Aprimorado para ser robusto, eficiente e integrado com o SystemLogger.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let isInitialized = false;

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
     * Inicializa o UtilsManager.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('UtilsManager já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('UtilsManager'));
            logger.info('🛠️ Módulo de Utilitários inicializado.');
            isInitialized = true;
        } catch (e) {
            console.error('Falha ao obter SystemLogger no UtilsManager. Usando console fallback.', e);
            logger = console; // Fallback para console
            isInitialized = false; // Falha na inicialização completa
        }
    }

    // --- FORMATAÇÃO ---

    /**
     * Formata um número de CPF (xxx.xxx.xxx-xx).
     * @param {string} cpf - O CPF a ser formatado.
     * @returns {string} O CPF formatado ou uma string vazia se a entrada for inválida.
     */
    function formatCPF(cpf) {
        if (!cpf || typeof cpf !== 'string') {
            logger.warn('formatCPF: Entrada inválida. Esperado string.', cpf);
            return '';
        }
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11) {
            logger.warn(`formatCPF: CPF '${cpf}' possui tamanho inválido após limpeza.`, cleaned);
            return cpf; // Retorna o original se não for um CPF completo
        }
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    /**
     * Formata um número de telefone para (xx) xxxxx-xxxx ou (xx) xxxx-xxxx.
     * @param {string} phone - O telefone a ser formatado.
     * @returns {string} O telefone formatado ou uma string vazia.
     */
    function formatPhone(phone) {
        if (!phone || typeof phone !== 'string') {
            logger.warn('formatPhone: Entrada inválida. Esperado string.', phone);
            return '';
        }
        const cleaned = phone.replace(/\D/g, '');
        const { length } = cleaned;

        if (length === 10) { // (XX) XXXX-XXXX
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        } else if (length === 11) { // (XX) XXXXX-XXXX
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else {
            logger.warn(`formatPhone: Telefone '${phone}' possui tamanho inválido após limpeza.`, cleaned);
            return phone; // Retorna o original se não for um telefone válido
        }
    }

    /**
     * Formata um número como moeda (ex: R$ 1.234,56).
     * @param {number} amount - O valor numérico.
     * @param {string} currencyCode - Código da moeda (ex: 'BRL', 'USD').
     * @param {string} locale - Locale para formatação (ex: 'pt-BR', 'en-US').
     * @returns {string} O valor formatado como moeda.
     */
    function formatCurrency(amount, currencyCode = 'BRL', locale = 'pt-BR') {
        if (typeof amount !== 'number' || isNaN(amount)) {
            logger.warn('formatCurrency: Entrada inválida. Esperado um número.', amount);
            return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(0);
        }
        try {
            return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(amount);
        } catch (error) {
            logger.error(`Erro ao formatar moeda '${amount}': ${error.message}`);
            return amount.toFixed(2); // Fallback simples
        }
    }

    /**
     * Formata uma data para o formato especificado.
     * @param {Date | string | number} dateInput - A data (objeto Date, string ou timestamp).
     * @param {string} format - Formato desejado (ex: 'DD/MM/YYYY', 'YYYY-MM-DD HH:mm:ss').
     * @returns {string} A data formatada.
     */
    function formatDate(dateInput, format = 'YYYY-MM-DD') {
        let dateObj = new Date(dateInput);

        if (isNaN(dateObj.getTime())) {
            logger.warn('formatDate: Entrada de data inválida.', dateInput);
            return 'Data Inválida';
        }

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');

        let formattedDate = format;
        formattedDate = formattedDate.replace(/YYYY/g, year);
        formattedDate = formattedDate.replace(/MM/g, month);
        formattedDate = formattedDate.replace(/DD/g, day);
        formattedDate = formattedDate.replace(/HH/g, hours);
        formattedDate = formattedDate.replace(/mm/g, minutes);
        formattedDate = formattedDate.replace(/ss/g, seconds);

        return formattedDate;
    }

    /**
     * Capitaliza a primeira letra de uma string.
     * @param {string} str - A string de entrada.
     * @returns {string} A string com a primeira letra capitalizada.
     */
    function capitalizeFirstLetter(str) {
        if (typeof str !== 'string' || str.length === 0) {
            logger.warn('capitalizeFirstLetter: Entrada inválida. Esperado string não vazia.', str);
            return '';
        }
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // --- GERAÇÃO DE IDS ---

    /**
     * Gera um ID único simples (UUID v4 padrão).
     * @returns {string} Um UUID v4.
     */
    function generateUniqueId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // --- UTILITÁRIOS DE FUNÇÃO ---

    /**
     * Retorna uma nova função que, quando invocada, executa a função original
     * no máximo uma vez a cada `limit` milissegundos.
     * @param {Function} func - A função a ser limitada.
     * @param {number} limit - O limite de tempo em milissegundos.
     * @returns {Function} A função limitada.
     */
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Retorna uma nova função que, quando invocada, executa a função original
     * somente depois que um certo tempo `delay` em milissegundos passar desde a última invocação.
     * @param {Function} func - A função a ser atrasada.
     * @param {number} delay - O atraso em milissegundos.
     * @returns {Function} A função com debounce.
     */
    function debounce(func, delay) {
        let timeout;
        return function() {
            const args = arguments;
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // --- HELPERS DE LOCAL/SESSION STORAGE ---

    /**
     * Obtém um item do LocalStorage com tratamento de erro.
     * @param {string} key - A chave do item.
     * @returns {any|null} O item parseado ou null.
     */
    function getLocalStorageItem(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            logger.error(`Erro ao obter item '${key}' do LocalStorage: ${error.message}`);
            return null;
        }
    }

    /**
     * Define um item no LocalStorage com tratamento de erro.
     * @param {string} key - A chave do item.
     * @param {any} value - O valor a ser salvo.
     * @returns {boolean} True se salvo com sucesso, false caso contrário.
     */
    function setLocalStorageItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error(`Erro ao salvar item '${key}' no LocalStorage: ${error.message}`);
            return false;
        }
    }

    // --- DOWNLOAD ---

    /**
     * Inicia o download de um arquivo CSV a partir de um array de objetos.
     * Requer a biblioteca PapaParse (window.Papa).
     * @param {Array<object>} data - Os dados a serem convertidos e baixados.
     * @param {string} filename - O nome do arquivo a ser salvo (ex: 'dados_exportados.csv').
     */
    async function downloadCSV(data, filename = 'export.csv') {
        if (!data || data.length === 0) {
            logger.warn("downloadCSV: Nenhum dado fornecido para exportar como CSV.");
            return;
        }
        try {
            const Papa = await waitForGlobal('Papa'); // Espera por PapaParse
            if (!Papa || typeof Papa.unparse !== 'function') {
                throw new Error("A biblioteca PapaParse não está carregada ou funcional.");
            }
            const csv = Papa.unparse(data);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            document.body.appendChild(link); // Anexa ao DOM temporariamente
            link.click();
            document.body.removeChild(link); // Remove após o clique
            logger.info(`Arquivo CSV '${filename}' gerado e download iniciado.`);
        } catch (error) {
            logger.error(`Erro ao gerar e baixar CSV: ${error.message}`);
        }
    }

    // Retorna a API pública do módulo UtilsManager
    return {
        init: init,
        formatCPF: formatCPF,
        formatPhone: formatPhone,
        formatCurrency: formatCurrency,
        formatDate: formatDate,
        capitalizeFirstLetter: capitalizeFirstLetter,
        generateUniqueId: generateUniqueId,
        throttle: throttle,
        debounce: debounce,
        getLocalStorageItem: getLocalStorageItem,
        setLocalStorageItem: setLocalStorageItem,
        downloadCSV: downloadCSV,
        isReady: () => isInitialized // Verifica se o módulo foi inicializado
    };
})();