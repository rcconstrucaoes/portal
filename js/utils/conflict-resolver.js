/**
 * RC Construções - Módulo de Resolução de Conflitos (Revisado e Aprimorado)
 * Gerencia a detecção e resolução de conflitos de dados durante a sincronização.
 * Implementa diferentes estratégias de resolução (ex: Last-Write Wins).
 * Projetado para ser robusto, configurável e integrado com o SystemLogger.
 */

(function() {
    'use strict';

    let logger; // Variável para a instância do logger
    let isInitialized = false;

    // Estratégias de resolução de conflito
    const CONFLICT_STRATEGIES = {
        LAST_WRITE_WINS: 'lastWriteWins', // O registro com o timestamp de última modificação mais recente vence
        CLIENT_WINS: 'clientWins',       // A versão do cliente sempre vence (útil para dados primários do cliente)
        SERVER_WINS: 'serverWins',       // A versão do servidor sempre vence (útil para dados autoritativos do servidor)
        MERGE_MANUAL: 'mergeManual'      // Conflito é sinalizado para resolução manual (mais complexo)
    };

    const CONFLICT_RESOLVER_CONFIG = {
        defaultStrategy: CONFLICT_STRATEGIES.LAST_WRITE_WINS,
        timestampField: 'updatedAt' // Campo usado para determinar a "última escrita"
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
     * Inicializa o Módulo de Resolução de Conflitos.
     * @returns {Promise<void>}
     */
    async function init() {
        if (isInitialized) {
            console.warn('ConflictResolver já está inicializado. Ignorando.');
            return;
        }

        try {
            logger = await waitForGlobal('SystemLogger').then(sl => sl.getAppLogger('ConflictResolver'));
            logger.info('⚔️ Módulo de Resolução de Conflitos inicializado.');
            isInitialized = true;
        } catch (e) {
            console.error('Erro crítico ao inicializar ConflictResolver:', e);
            (logger || console).error('Falha na inicialização do ConflictResolver. Conflitos de dados podem não ser resolvidos.');
            isInitialized = false;
        }
    }

    /**
     * Resolve um conflito entre duas versões de um registro.
     * @param {Object} localRecord - O registro existente localmente.
     * @param {Object} remoteRecord - O registro recebido do servidor/outro cliente.
     * @param {string} [strategy] - A estratégia a ser usada (padrão: CONFLICT_RESOLVER_CONFIG.defaultStrategy).
     * @returns {Object} O registro resolvido.
     */
    function resolveConflict(localRecord, remoteRecord, strategy = CONFLICT_RESOLVER_CONFIG.defaultStrategy) {
        if (!isInitialized) {
            logger.error('ConflictResolver não inicializado. Não é possível resolver conflitos.');
            return localRecord; // Retorna o local como fallback
        }

        // Se um dos registros não existe, não há conflito real, apenas uma adição/atualização simples
        if (!localRecord) {
            logger.debug('Resolução: Nenhum registro local, retornando o remoto.');
            return remoteRecord;
        }
        if (!remoteRecord) {
            logger.debug('Resolução: Nenhum registro remoto, retornando o local.');
            return localRecord;
        }

        logger.info(`Conflito detectado para registro ID: ${localRecord.id || 'N/A'}. Estratégia: ${strategy}.`);
        logger.debug('Local:', localRecord);
        logger.debug('Remoto:', remoteRecord);

        let resolvedRecord = localRecord; // Por padrão, o local vence se nenhuma estratégia for aplicada

        switch (strategy) {
            case CONFLICT_STRATEGIES.LAST_WRITE_WINS:
                resolvedRecord = resolveLastWriteWins(localRecord, remoteRecord);
                break;
            case CONFLICT_STRATEGIES.CLIENT_WINS:
                resolvedRecord = localRecord;
                logger.warn('Resolução de conflito: Versão do CLIENTE venceu por estratégia CLIENT_WINS.');
                break;
            case CONFLICT_STRATEGIES.SERVER_WINS:
                resolvedRecord = remoteRecord;
                logger.warn('Resolução de conflito: Versão do SERVIDOR venceu por estratégia SERVER_WINS.');
                break;
            case CONFLICT_STRATEGIES.MERGE_MANUAL:
                // Para resolução manual, você pode emitir um evento
                eventHandler.emit('conflict:manualResolutionNeeded', { localRecord, remoteRecord });
                logger.warn('Resolução de conflito: Resolução MANUAL necessária. Sinalizando para o usuário.');
                // Pode retornar uma versão combinada com flags, ou o local, e aguardar input do usuário
                resolvedRecord = { ...localRecord, ...remoteRecord, _conflict: true }; // Exemplo simples de flag
                break;
            default:
                logger.warn(`Estratégia de conflito desconhecida: '${strategy}'. Usando Last-Write Wins como fallback.`);
                resolvedRecord = resolveLastWriteWins(localRecord, remoteRecord);
                break;
        }

        logger.info('Conflito resolvido. Resultado:', resolvedRecord);
        eventHandler.emit('conflict:resolved', { localRecord, remoteRecord, resolvedRecord, strategy });
        return resolvedRecord;
    }

    /**
     * Estratégia: Last-Write Wins. O registro com o timestamp de última modificação mais recente vence.
     * @param {Object} localRecord - Registro local.
     * @param {Object} remoteRecord - Registro remoto.
     * @returns {Object} O registro que venceu.
     */
    function resolveLastWriteWins(localRecord, remoteRecord) {
        const localTimestamp = localRecord[CONFLICT_RESOLVER_CONFIG.timestampField] || 0;
        const remoteTimestamp = remoteRecord[CONFLICT_RESOLVER_CONFIG.timestampField] || 0;

        if (remoteTimestamp > localTimestamp) {
            logger.debug(`Last-Write Wins: Versão remota (${new Date(remoteTimestamp).toISOString()}) é mais recente.`);
            return remoteRecord;
        } else if (localTimestamp > remoteTimestamp) {
            logger.debug(`Last-Write Wins: Versão local (${new Date(localTimestamp).toISOString()}) é mais recente.`);
            return localRecord;
        } else {
            // Se os timestamps são iguais, pode ser o mesmo registro ou um conflito real simultâneo.
            // Por padrão, pode-se escolher o remoto, ou tentar um merge simples.
            // Para simplicidade, vamos dar preferência ao remoto se os timestamps forem idênticos.
            logger.debug('Last-Write Wins: Timestamps são iguais. Preferindo versão remota.');
            return remoteRecord; // Ou { ...localRecord, ...remoteRecord } para um merge superficial
        }
    }

    /**
     * Atualiza a configuração do módulo.
     * @param {Object} newConfig - Novas configurações a serem aplicadas.
     */
    function updateConfig(newConfig) {
        Object.assign(CONFLICT_RESOLVER_CONFIG, newConfig);
        logger.info('Configuração do ConflictResolver atualizada:', CONFLICT_RESOLVER_CONFIG);
    }

    // Expõe a API pública do módulo
    return {
        init: init,
        resolve: resolveConflict,
        updateConfig: updateConfig,
        STRATEGIES: CONFLICT_STRATEGIES, // Expõe as constantes de estratégia
        isReady: () => isInitialized
    };
})();