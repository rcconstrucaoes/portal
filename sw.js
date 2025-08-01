/**
 * RC Construções - Service Worker (Revisado e Aprimorado)
 * Gerencia o caching de assets para funcionalidade offline e melhora de performance.
 * Implementa estratégias de cache, atualização de service worker e notificação ao usuário.
 */

// Define o nome do cache e os arquivos a serem pré-cacheados.
// A versão do cache deve ser atualizada em cada nova implantação para forçar a atualização dos assets.
const CACHE_VERSION = 'rc-construcoes-cache-v5.1.0'; // Atualize esta versão em cada deploy
const STATIC_CACHE_NAME = CACHE_VERSION + '_static';
const DYNAMIC_CACHE_NAME = CACHE_VERSION + '_dynamic';

// Lista de arquivos a serem pré-cacheados na instalação.
// Certifique-se de que estes caminhos estão corretos e existem na sua aplicação.
const ASSETS_TO_PRECACHE = [
  './', // Caches o index.html na raiz
  './index.html',
  './login.html',
  './pwa_manifest.json',
  './css/modern_main_css.css',
  './css/components.css',
  './css/dashboard.css',
  './css/forms.css',
  './css/notifications.css',
  './assets/images/logo-rc.png',
  './assets/images/favicon.ico',
  './assets/images/icon-144.png',
  './assets/images/icon-192.png',
  './assets/images/icon-384.png',
  './assets/images/icon-512.png',
  './js/init_system_js.js',
  './js/modern_app_js.js',
  './js/core/auth.js',
  './js/core/charts.js',
  './js/core/cloud-sync.js',
  './js/core/data-versioning.js',
  './js/core/database.js',
  './js/core/logger.js',
  './js/core/performance-monitor.js',
  './js/core/security.js',
  './js/core/settings.js',
  './js/core/utils.js',
  './js/dashboard-enhancements.js',
  './js/modules/budgets.js',
  './js/modules/clients.js',
  './js/modules/contracts.js',
  './js/modules/dashboard.js',
  './js/modules/demo.js',
  './js/modules/financial.js',
  './js/modules/import-export.js',
  './js/modules/pdf.js',
  './js/modules/reports.js',
  './js/modules/suppliers.js',
  './js/utils/analytics.js',
  './js/utils/conflict-resolver.js',
  './js/utils/error-handler.js',
  './js/utils/schema-migration.js',
  // Bibliotecas de terceiros (se não forem carregadas de CDN ou para garantir offline)
  './lib/dexie.min.js',
  './lib/bcrypt.min.js',
  './lib/jspdf.js',
  './lib/papaparse.min.js',
  './lib/chart.js',
  './lib/sweetalert2.min.js',
  './lib/web-vitals.min.js',
  // CDN's usados que você pode querer cachear ou não, dependendo da sua estratégia
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css'
];

// URLs ou domínios que não devem ser cacheados (ex: APIs de backend, CDNs externos muito voláteis)
const DONT_CACHE_URLS = [
  '/api/', // Não cachear requisições para sua própria API
  'chrome-extension://' // Ignorar URLs de extensões do Chrome
];

// Assume-se que o SystemLogger existe ou que logamos no console para Service Worker
const swLogger = {
  log: (...args) => console.log('[SW]', ...args),
  info: (...args) => console.info('[SW]', ...args),
  warn: (...args) => console.warn('[SW]', ...args),
  error: (...args) => console.error('[SW]', ...args)
};

// =======================================================================================
// ETAPA DE INSTALAÇÃO (INSTALL)
// Ocorre quando o Service Worker é registrado ou atualizado pela primeira vez.
// =======================================================================================
self.addEventListener('install', (event) => {
  swLogger.info(`Service Worker ${CACHE_VERSION} instalado.`);
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        swLogger.info('Pré-caching assets estáticos...');
        // Adiciona todos os assets essenciais ao cache durante a instalação
        return cache.addAll(ASSETS_TO_PRECACHE.filter(url => !DONT_CACHE_URLS.some(exclude => url.includes(exclude))));
      })
      .then(() => self.skipWaiting()) // Força o novo SW a ativar imediatamente
      .catch((error) => {
        swLogger.error('Falha no pré-caching durante a instalação:', error);
      })
  );
});

// =======================================================================================
// ETAPA DE ATIVAÇÃO (ACTIVATE)
// Ocorre quando um novo Service Worker assume o controle da página.
// Limpa caches antigos e gerencia atualizações.
// =======================================================================================
self.addEventListener('activate', (event) => {
  swLogger.info(`Service Worker ${CACHE_VERSION} ativado.`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Deleta caches que não correspondem à versão atual
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('rc-construcoes-cache-') && !cacheName.includes(CACHE_VERSION)) {
            swLogger.info('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Permite que o SW atual controle as páginas abertas
  );
});

// =======================================================================================
// ETAPA DE REQUISIÇÃO (FETCH)
// Intercepta todas as requisições de rede.
// =======================================================================================
self.addEventListener('fetch', (event) => {
  // Ignora requisições POST para não interferir com envios de dados para a API
  if (event.request.method !== 'GET') {
    return;
  }

  // Verifica se a URL deve ser ignorada do cache
  if (DONT_CACHE_URLS.some(exclude => event.request.url.includes(exclude))) {
    //swLogger.debug('Não cacheando URL (excluída):', event.request.url);
    return fetchAndCache(event.request, DYNAMIC_CACHE_NAME); // Busca da rede e pode cachear se for uma API dinâmica
  }

  // Estratégia de Cache: Cache-First, Network-Fallback
  // Tenta responder do cache primeiro. Se não encontrar, vai para a rede.
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          //swLogger.debug('Servindo do cache:', event.request.url);
          // Opcional: Atualiza o cache em segundo plano (stale-while-revalidate)
          // fetchAndCache(event.request, DYNAMIC_CACHE_NAME);
          return response;
        }
        // Se não encontrou no cache, vai para a rede e depois cacheia
        //swLogger.debug('Buscando da rede e cacheando:', event.request.url);
        return fetchAndCache(event.request, DYNAMIC_CACHE_NAME);
      })
      .catch((error) => {
        swLogger.error('Erro no Service Worker durante o fetch:', error);
        // Em caso de falha de rede e não há cache, pode servir uma página offline
        // return caches.match('/offline.html'); // Se você tiver uma página offline
        return new Response('<h1>Você está offline</h1>', { headers: { 'Content-Type': 'text/html' } });
      })
  );
});


/**
 * Função auxiliar para buscar da rede e armazenar no cache.
 * @param {Request} request - A requisição a ser buscada.
 * @param {string} cacheName - O nome do cache para armazenar a resposta.
 * @returns {Promise<Response>} A resposta da rede.
 */
function fetchAndCache(request, cacheName) {
  return fetch(request)
    .then((networkResponse) => {
      // Verifica se a resposta é válida para cache
      // (status 200, não é opaca se for de outra origem, e não é um cabeçalho de extensão)
      if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque' || request.url.startsWith('chrome-extension://')) {
        //swLogger.debug('Não cacheando resposta inválida ou opaca/extensão:', request.url, networkResponse?.status);
        return networkResponse;
      }

      const responseToCache = networkResponse.clone(); // Clona a resposta para poder usá-la e cacheá-la
      caches.open(cacheName)
        .then((cache) => {
          cache.put(request, responseToCache)
            .then(() => {
              //swLogger.debug('Cacheado com sucesso:', request.url);
            })
            .catch((error) => {
              swLogger.error(`Erro ao cachear ${request.url}:`, error);
            });
        })
        .catch((error) => {
          swLogger.error('Erro ao abrir cache para put:', error);
        });
      return networkResponse;
    })
    .catch((error) => {
      swLogger.error(`Falha na busca de rede para ${request.url}:`, error);
      throw error; // Propaga o erro para o evento fetch principal
    });
}

// =======================================================================================
// ETAPA DE MENSAGEM (MESSAGE)
// Ocorre quando uma mensagem é postada para o Service Worker (ex: de uma página).
// =======================================================================================
self.addEventListener('message', (event) => {
  swLogger.info('Mensagem recebida do cliente:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting(); // Força a ativação do novo Service Worker
    swLogger.info('SKIP_WAITING acionado. Novo Service Worker deve ativar.');
  }
  // Outros tipos de mensagem podem ser tratados aqui (ex: limpar cache, re-sync)
});

// =======================================================================================
// NOTIFICAÇÃO DE NOVA VERSÃO (OPCIONAL)
// Implementação para avisar o usuário quando uma nova versão da PWA está disponível.
// Isso geralmente é feito no frontend (main.js ou similar), mas o SW pode ajudar.
// =======================================================================================
// Exemplo:
// self.addEventListener('controllerchange', () => {
//   // Dispara uma notificação para o cliente quando um novo SW assume o controle
//   swLogger.info('Um novo Service Worker está assumindo o controle.');
//   self.clients.matchAll().then(clients => {
//     clients.forEach(client => {
//       client.postMessage({ type: 'NEW_VERSION_AVAILABLE', message: 'Uma nova versão do app está disponível. Recarregue a página!' });
//     });
//   });
// });