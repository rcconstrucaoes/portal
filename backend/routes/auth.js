/**
 * RC Construções - Rotas de Autenticação (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Define todas as rotas relacionadas à autenticação:
 * - Login e logout
 * - Registro de usuários
 * - Recuperação e alteração de senha
 * - Verificação de email
 * - Gerenciamento de sessão
 */

const express = require('express');
const Yup = require('yup');

// Controllers
const AuthController = require('../controllers/AuthController');

// Middlewares
const { authenticate, authorize } = require('../middleware/auth'); // Middleware de autenticação e autorização
const { validateSchema, sanitizeXSS, validateBusinessRules } = require('../middleware/validator'); // Middleware de validação e sanitização
const { requestLogger, auditLogger } = require('../middleware/logger'); // Middleware de logger
const { loginLimiter, endpointLimiter } = require('../middleware/rateLimiter'); // Middlewares de rate limiting

const router = express.Router();

// Aplica middlewares globais para todas as rotas de autenticação
router.use(requestLogger()); // Log de todas as requisições HTTP


/**
 * POST /auth/register
 * Registra um novo usuário no sistema.
 * Não requer autenticação, mas tem validação de dados e rate limit.
 */
router.post('/register',
  endpointLimiter(10, 60 * 1000), // Máximo de 10 registros por IP por minuto
  sanitizeXSS(['name', 'username', 'email']), // Sanitiza dados de entrada
  validateSchema(
    Yup.object().shape({
      name: Yup.string().required(),
      username: Yup.string().required(),
      email: Yup.string().email().required(),
      password: Yup.string().required(),
      role: Yup.string().optional() // Opcional, será validado no controller
    }),
    'body'
  ),
  auditLogger('user_registered', 'user'), // Log de auditoria para registro
  AuthController.register
);

/**
 * POST /auth/login
 * Realiza o login do usuário, gerando um token JWT.
 * Aplica um rate limiter específico para logins para prevenir ataques de força bruta.
 */
router.post('/login',
  loginLimiter(), // Rate limit específico para login (mais restritivo)
  sanitizeXSS(['username']), // Sanitiza username/email de entrada
  validateSchema(
    Yup.object().shape({
      username: Yup.string().required(),
      password: Yup.string().required()
    }),
    'body'
  ),
  auditLogger('user_login_attempt', 'user'), // Log de auditoria para tentativas de login
  AuthController.login
);

/**
 * GET /auth/me
 * Obtém os detalhes do usuário autenticado a partir do token.
 * Requer um token JWT válido no cabeçalho Authorization.
 */
router.get('/me',
  authenticate(), // Middleware de autenticação
  auditLogger('user_profile_viewed', 'user'), // Log de auditoria
  AuthController.getMe
);

/**
 * PUT /auth/change-password
 * Permite que um usuário autenticado altere sua própria senha.
 * Requer o token JWT do usuário.
 */
router.put('/change-password',
  authenticate(), // Requer autenticação
  sanitizeXSS(['currentPassword', 'newPassword', 'confirmNewPassword']), // Sanitiza senhas
  validateSchema(
    Yup.object().shape({
      currentPassword: Yup.string().required(),
      newPassword: Yup.string().required(),
      confirmNewPassword: Yup.string().oneOf([Yup.ref('newPassword'), null], 'Senhas não conferem').required()
    }),
    'body'
  ),
  auditLogger('password_changed', 'user'), // Log de auditoria
  AuthController.changePassword
);

/**
 * POST /auth/logout
 * Invalida o token JWT do usuário (adicionando-o a uma blacklist).
 * Requer autenticação.
 */
router.post('/logout',
  authenticate(), // Requer autenticação
  auditLogger('user_logout', 'user'), // Log de auditoria
  // AuthController.logout // Se houver uma lógica de logout no controller para invalidar token no backend
  async (req, res) => { // Exemplo simplificado de logout inline
    // O middleware de autenticação já garantiu req.user e o token
    // O authMiddleware.addTokenToBlacklist() será chamado por aqui.
    try {
      const token = req.headers.authorization.split(' ')[1];
      // A vida útil do token é determinada por seu `exp` (expiration time) no payload JWT.
      // Para invalidá-lo no logout, precisamos de uma blacklist no Redis.
      const decoded = jwt.decode(token);
      const expiresInSeconds = decoded.exp - (Date.now() / 1000); // Tempo restante de vida do token

      if (expiresInSeconds > 0) {
        // Assume que o authMiddleware (singleton) tem o método addTokenToBlacklist
        require('../middleware/auth').addTokenToBlacklist(token, expiresInSeconds);
      }
      logger.info('Logout bem-sucedido', { userId: req.user.id, ip: req.ip, tokenExpiresIn: expiresInSeconds });
      return res.json({ success: true, message: 'Logout bem-sucedido' });
    } catch (error) {
      logger.error('Erro durante o logout', { userId: req.user.id, error: error.message, ip: req.ip });
      return res.status(500).json({ error: 'Erro interno do servidor ao fazer logout', code: 'SERVER_ERROR' });
    }
  }
);


/**
 * POST /auth/refresh-token
 * Gera um novo token de acesso usando um refresh token ou token expirado recente.
 * (Funcionalidade mais avançada, pode não ser necessária no início)
 */
// router.post('/refresh-token', AuthController.refreshToken);

/**
 * POST /auth/verify-token
 * Verifica a validade de um token JWT sem autenticar a rota.
 * Útil para o frontend verificar se um token ainda é válido sem fazer uma requisição completa.
 */
router.post('/verify-token',
  validateSchema(
    Yup.object().shape({
      token: Yup.string().required('Token é obrigatório')
    }),
    'body'
  ),
  AuthController.verifyToken
);


// Exporta o router para ser usado pelo aplicativo Express
module.exports = router;