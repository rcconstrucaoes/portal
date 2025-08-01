/**
 * RC Construções - Settings Manager (Revisado e Aprimorado)
 * Gerencia as configurações persistentes do aplicativo, armazenando-as localmente (localStorage).
 * Aprimorado para robustez, configuração dinâmica e integração com o SystemLogger.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let isInitialized = false;

    const SETTINGS_KEY = 'rc_app_settings'; // Chave no localStorage para as configurações

    // Configurações padrão do aplicativo
    const DEFAULT_SETTINGS = {
        theme: 'light', // 'light' ou 'dark'
        language: 'pt-BR',
        notificationsEnabled: true,
        offlineModeEnabled: true,
        lastSyncTimestamp: 0, // Timestamp da última sincronização geral
        dashboard: {
            defaultDateRange: '30-days', // '7-days', '30-days', '90-days', 'custom'
            showQuickSummary: true,
            showRecentActivities: true
        },
        // Configurações de sincronização (se não estiverem no CloudSync dedicado)
        sync: {
            autoSync: true,
            syncFrequencyMinutes: 5,
            wifiOnly: true
        },
        // Outras configurações específicas do usuário ou do aplicativo
        // deviceId: 'gerado_automaticamente' // Exemplo, gerenciado pelo CloudSync ou AdvancedSync
    };
    let currentSettings = { ...DEFAULT_SETTINGS }; // Clone para não modificar o padrão

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
     * Inicializa o SettingsManager.
     * Carrega as configurações salvas ou usa as padrão.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('SettingsManager já está inicializado. Ignorando.');
            return;
        }

        // Tenta obter o logger. Se falhar, usa console.
        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('SettingsManager'));
            logger.info('⚙️ SettingsManager inicializado.');
        } catch (e) {
            console.error('Falha ao obter SystemLogger no SettingsManager. Usando console fallback.', e);
            logger = console; // Fallback para console
        }
        
        try {
            await loadSettings(); // Tenta carregar configurações existentes
            isInitialized = true;
            logger.success(`✅ SettingsManager disponível globalmente com ${Object.keys(currentSettings).length} configurações.`);
        } catch (error) {
            logger.error(`Erro ao inicializar SettingsManager: ${error.message}. Usando configurações padrão.`);
            isInitialized = false; // Indica falha na inicialização completa
        }
    }

    /**
     * Carrega as configurações do localStorage.
     * Mescla com as configurações padrão para garantir que todos os campos existam.
     * @returns {Promise<void>}
     */
    async function loadSettings() {
        try {
            const savedSettings = localStorage.getItem(SETTINGS_KEY);
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                // Mescla as configurações salvas com as padrão.
                // Isso garante que novas configurações padrão sejam adicionadas se o schema evoluir.
                currentSettings = deepMerge(DEFAULT_SETTINGS, parsedSettings);
                logger.info('Configurações carregadas do localStorage.', currentSettings);
            } else {
                logger.info('Nenhuma configuração salva encontrada. Usando configurações padrão.', DEFAULT_SETTINGS);
                await saveSettings(); // Salva as configurações padrão para iniciar
            }
        } catch (e) {
            logger.error('Erro ao carregar ou parsear configurações do localStorage:', e);
            logger.warn('Recuperando para configurações padrão devido a erro de carregamento.');
            currentSettings = { ...DEFAULT_SETTINGS }; // Volta para o padrão
        }
    }

    /**
     * Salva as configurações atuais no localStorage.
     * @returns {Promise<void>}
     */
    async function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
            logger.info('Configurações salvas no localStorage.');
        } catch (e) {
            logger.error('Erro ao salvar configurações no localStorage:', e);
            // Pode acontecer se o localStorage estiver cheio ou com problemas de segurança
        }
    }

    /**
     * Obtém o valor de uma configuração específica.
     * @param {string} key - A chave da configuração (pode ser aninhada, ex: 'dashboard.theme').
     * @returns {any} O valor da configuração ou undefined se não for encontrada.
     */
    function getSetting(key) {
        if (!isInitialized) {
            logger.warn('SettingsManager não inicializado. Retornando valor padrão ou undefined para:', key);
            // Tenta obter do padrão se não inicializado, para não quebrar módulos que chamam cedo.
            return getValueByKeyPath(DEFAULT_SETTINGS, key);
        }
        const value = getValueByKeyPath(currentSettings, key);
        logger.debug(`Obtendo configuração '${key}':`, value);
        return value;
    }

    /**
     * Define o valor de uma configuração específica.
     * Salva as configurações após a alteração.
     * @param {string} key - A chave da configuração (pode ser aninhada, ex: 'dashboard.theme').
     * @param {any} value - O novo valor para a configuração.
     * @returns {Promise<boolean>} True se a configuração foi definida com sucesso.
     */
    async function setSetting(key, value) {
        if (!isInitialized) {
            logger.error('SettingsManager não inicializado. Não é possível definir a configuração:', key, value);
            return false;
        }
        setValueByKeyPath(currentSettings, key, value);
        await saveSettings();
        logger.info(`Configuração '${key}' atualizada para:`, value);
        return true;
    }

    /**
     * Redefine uma ou todas as configurações para os valores padrão.
     * @param {string} [key] - Opcional. A chave da configuração a ser redefinida. Se omitido, redefine tudo.
     * @returns {Promise<void>}
     */
    async function resetSetting(key) {
        if (!isInitialized) {
            logger.error('SettingsManager não inicializado. Não é possível redefinir configurações.');
            return;
        }
        if (key) {
            const defaultValue = getValueByKeyPath(DEFAULT_SETTINGS, key);
            if (defaultValue !== undefined) {
                setValueByKeyPath(currentSettings, key, defaultValue);
                logger.info(`Configuração '${key}' redefinida para o padrão:`, defaultValue);
            } else {
                logger.warn(`Não foi possível redefinir '${key}': Nenhuma configuração padrão encontrada para esta chave.`);
            }
        } else {
            currentSettings = { ...DEFAULT_SETTINGS };
            logger.info('Todas as configurações redefinidas para o padrão.');
        }
        await saveSettings();
    }

    /**
     * Helper: Obtém um valor de um objeto dado um caminho de chave (ex: 'obj.prop.subprop').
     * @param {Object} obj - Objeto a ser percorrido.
     * @param {string} path - Caminho da chave.
     * @returns {any} Valor encontrado ou undefined.
     */
    function getValueByKeyPath(obj, path) {
        return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
    }

    /**
     * Helper: Define um valor em um objeto dado um caminho de chave.
     * @param {Object} obj - Objeto a ser modificado.
     * @param {string} path - Caminho da chave.
     * @param {any} value - Valor a ser definido.
     */
    function setValueByKeyPath(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length; i++) {
            if (i === parts.length - 1) {
                current[parts[i]] = value;
            } else {
                if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
                    current[parts[i]] = {};
                }
                current = current[parts[i]];
            }
        }
    }

    /**
     * Helper: Mescla profundamente dois objetos.
     * Usado para mesclar configurações padrão com configurações salvas.
     * @param {Object} target - Objeto alvo (geralmente o padrão).
     * @param {Object} source - Objeto fonte (geralmente o salvo).
     * @returns {Object} Novo objeto mesclado.
     */
    function deepMerge(target, source) {
        const output = { ...target };
        if (target && typeof target === 'object' && source && typeof source === 'object') {
            Object.keys(source).forEach(key => {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key]) {
                    output[key] = deepMerge(target[key], source[key]);
                } else {
                    output[key] = source[key];
                }
            });
        }
        return output;
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        getSetting: getSetting,
        setSetting: setSetting,
        resetSetting: resetSetting,
        getAllSettings: () => ({ ...currentSettings }), // Retorna uma cópia das configurações atuais
        isReady: () => isInitialized // Verifica se o módulo foi inicializado com sucesso
    };
})();