/**
 * RC Construções - Validation Manager (Revisado e Aprimorado)
 * Módulo central para validação de dados em todo o aplicativo.
 * Fornece um conjunto de funções de validação reutilizáveis para garantir a integridade dos dados.
 * Aprimorado para robustez, mensagens de erro claras e integração com o SystemLogger.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let isInitialized = false;

    // Regex comuns para validação
    const REGEX = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|:;"'<>,.?/~`]).{8,}$/, // Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial
        cpf: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
        phone: /^\(\d{2}\)\s\d{4,5}-\d{4}$/, // (XX) XXXX-XXXX ou (XX) XXXXX-XXXX
        date: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        numeric: /^\d+$/,
        alphanumeric: /^[a-zA-Z0-9]+$/
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
     * Inicializa o ValidationManager.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('ValidationManager já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ValidationManager'));
            logger.info('⚖️ Módulo de Validação inicializado.');
            isInitialized = true;
            logger.success('✅ ValidationManager disponível globalmente');
        } catch (e) {
            console.error('Falha ao obter SystemLogger no ValidationManager. Usando console fallback.', e);
            logger = console; // Fallback para console
            isInitialized = false; // Falha na inicialização completa
        }
    }

    /**
     * Valida um endereço de e-mail.
     * @param {string} email - O endereço de e-mail a ser validado.
     * @returns {boolean} True se o e-mail for válido, false caso contrário.
     */
    function validateEmail(email) {
        const isValid = typeof email === 'string' && REGEX.email.test(email);
        if (!isValid) {
            logger.warn(`Validação de E-mail falhou: '${email}' é inválido.`);
        } else {
            logger.debug(`Validação de E-mail bem-sucedida: '${email}'.`);
        }
        return isValid;
    }

    /**
     * Valida uma senha.
     * Requer mínimo de 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial.
     * @param {string} password - A senha a ser validada.
     * @returns {boolean} True se a senha for válida, false caso contrário.
     */
    function validatePassword(password) {
        const isValid = typeof password === 'string' && REGEX.password.test(password);
        if (!isValid) {
            logger.warn(`Validação de Senha falhou: A senha não atende aos requisitos.`);
            logger.debug(`Requisitos: Mín. 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial.`);
        } else {
            logger.debug(`Validação de Senha bem-sucedida.`);
        }
        return isValid;
    }

    /**
     * Valida um nome de usuário.
     * @param {string} username - O nome de usuário a ser validado.
     * @param {number} minLength - Comprimento mínimo.
     * @param {number} maxLength - Comprimento máximo.
     * @returns {boolean} True se o nome de usuário for válido.
     */
    function validateUsername(username, minLength = 3, maxLength = 20) {
        const isValid = typeof username === 'string' &&
                        username.length >= minLength &&
                        username.length <= maxLength &&
                        REGEX.alphanumeric.test(username); // Ou outro regex mais flexível
        if (!isValid) {
            logger.warn(`Validação de Nome de Usuário falhou: '${username}' é inválido.`);
            logger.debug(`Requisitos: ${minLength}-${maxLength} caracteres alfanuméricos.`);
        } else {
            logger.debug(`Validação de Nome de Usuário bem-sucedida: '${username}'.`);
        }
        return isValid;
    }

    /**
     * Valida um número de CPF.
     * Realiza validação de formato e dígitos verificadores.
     * @param {string} cpf - O CPF a ser validado (pode estar formatado ou não).
     * @returns {boolean} True se o CPF for válido, false caso contrário.
     */
    function validateCPF(cpf) {
        if (typeof cpf !== 'string') {
            logger.warn('Validação de CPF falhou: Entrada não é uma string.', cpf);
            return false;
        }

        const cleanedCpf = cpf.replace(/\D/g, ''); // Remove caracteres não numéricos

        if (cleanedCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanedCpf)) {
            // Verifica tamanho e CPFs com todos os dígitos iguais
            logger.warn(`Validação de CPF falhou: '${cpf}' - Tamanho inválido ou dígitos repetidos.`);
            return false;
        }

        let sum = 0;
        let remainder;

        // Validação do primeiro dígito
        for (let i = 1; i <= 9; i++) {
            sum = sum + parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
        }
        remainder = (sum * 10) % 11;
        if ((remainder === 10) || (remainder === 11)) remainder = 0;
        if (remainder !== parseInt(cleanedCpf.substring(9, 10))) {
            logger.warn(`Validação de CPF falhou: '${cpf}' - Primeiro dígito verificador inválido.`);
            return false;
        }

        sum = 0;
        // Validação do segundo dígito
        for (let i = 1; i <= 10; i++) {
            sum = sum + parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
        }
        remainder = (sum * 10) % 11;
        if ((remainder === 10) || (remainder === 11)) remainder = 0;
        if (remainder !== parseInt(cleanedCpf.substring(10, 11))) {
            logger.warn(`Validação de CPF falhou: '${cpf}' - Segundo dígito verificador inválido.`);
            return false;
        }

        logger.debug(`Validação de CPF bem-sucedida: '${cpf}'.`);
        return true;
    }

    /**
     * Valida um número de telefone.
     * @param {string} phone - O telefone a ser validado (pode estar formatado ou não).
     * @returns {boolean} True se o telefone for válido.
     */
    function validatePhone(phone) {
        if (typeof phone !== 'string') {
            logger.warn('Validação de Telefone falhou: Entrada não é uma string.', phone);
            return false;
        }
        // Limpa e testa o regex (pode ser o formatado ou apenas dígitos)
        const cleaned = phone.replace(/\D/g, '');
        const isValid = cleaned.length >= 10 && cleaned.length <= 11; // Min 10 (c/ DDD) e max 11 (c/ 9º dígito)
        
        if (!isValid) {
            logger.warn(`Validação de Telefone falhou: '${phone}' é inválido. Esperado 10 ou 11 dígitos.`);
        } else {
            logger.debug(`Validação de Telefone bem-sucedida: '${phone}'.`);
        }
        return isValid;
    }

    /**
     * Valida se um valor é um número (inteiro ou float).
     * @param {any} value - O valor a ser validado.
     * @returns {boolean} True se for um número, false caso contrário.
     */
    function validateNumber(value) {
        const isValid = typeof value === 'number' && !isNaN(value);
        if (!isValid) {
            logger.warn(`Validação de Número falhou: '${value}' não é um número válido.`);
        } else {
            logger.debug(`Validação de Número bem-sucedida: '${value}'.`);
        }
        return isValid;
    }

    /**
     * Valida se uma string não está vazia ou contém apenas espaços em branco.
     * @param {string} str - A string a ser validada.
     * @returns {boolean} True se a string não estiver vazia.
     */
    function validateNotEmpty(str) {
        const isValid = typeof str === 'string' && str.trim().length > 0;
        if (!isValid) {
            logger.warn(`Validação de String Vazia falhou: A string está vazia ou contém apenas espaços.`);
        } else {
            logger.debug(`Validação de String Vazia bem-sucedida.`);
        }
        return isValid;
    }

    /**
     * Valida se uma data está em um formato específico (YYYY-MM-DD).
     * @param {string} dateString - A string da data.
     * @returns {boolean} True se a data for válida e no formato YYYY-MM-DD.
     */
    function validateDateFormat(dateString) {
        const isValid = typeof dateString === 'string' && REGEX.date.test(dateString) && !isNaN(new Date(dateString).getTime());
        if (!isValid) {
            logger.warn(`Validação de Formato de Data falhou: '${dateString}' é inválido ou não está no formato YYYY-MM-DD.`);
        } else {
            logger.debug(`Validação de Formato de Data bem-sucedida: '${dateString}'.`);
        }
        return isValid;
    }


    // Retorna a API pública do módulo
    return {
        init: init,
        validateEmail: validateEmail,
        validatePassword: validatePassword,
        validateUsername: validateUsername,
        validateCPF: validateCPF,
        validatePhone: validatePhone,
        validateNumber: validateNumber,
        validateNotEmpty: validateNotEmpty,
        validateDateFormat: validateDateFormat,
        isReady: () => isInitialized // Indica se o módulo foi inicializado
    };
})();