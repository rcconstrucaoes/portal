/**
 * RC Construções - Controller de Autenticação (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Lida com o registro (cadastro) e a autenticação (login) de usuários.
 * Gerencia sessões, tokens JWT e validações de segurança.
 * Aprimorado para ser mais seguro, robusto e com logs detalhados.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Usado para comparar senhas, hashing é feito no modelo User
const Yup = require('yup');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const authConfig = require('../config/auth');
const logger = require('../config/logger'); // Logger do backend

// =======================================================================
// Middlewares de Validação (usando Yup) - Podem ser movidos para middleware/validator.js
// =======================================================================

// Schema de validação para REGISTRO de usuário
const registerSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome não pode exceder 100 caracteres')
    .required('Nome é obrigatório'),
  username: Yup.string()
    .min(3, 'Nome de usuário deve ter pelo menos 3 caracteres')
    .max(50, 'Nome de usuário não pode exceder 50 caracteres')
    .required('Nome de usuário é obrigatório'),
  email: Yup.string()
    .email('E-mail inválido')
    .required('E-mail é obrigatório'),
  password: Yup.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .matches(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .matches(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .matches(/\d/, 'Senha deve conter pelo menos um número')
    .matches(/[!@#$%^&*()_+={}[\]|:;"'<>,.?/~`]/, 'Senha deve conter pelo menos um caractere especial')
    .required('Senha é obrigatória'),
  role: Yup.string() //
    .oneOf(Object.keys(authConfig.defaultRoles), 'Papel inválido') //
    .default('user') // - Papel padrão 'user'
});

// Schema de validação para LOGIN de usuário
const loginSchema = Yup.object().shape({
  username: Yup.string().required('Nome de usuário/e-mail é obrigatório'),
  password: Yup.string().required('Senha é obrigatória')
});

// Schema de validação para ALTERAÇÃO de Senha
const changePasswordSchema = Yup.object().shape({
  currentPassword: Yup.string().required('Senha atual é obrigatória'),
  newPassword: Yup.string()
    .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
    .matches(/[a-z]/, 'Nova senha deve conter pelo menos uma letra minúscula')
    .matches(/[A-Z]/, 'Nova senha deve conter pelo menos uma letra maiúscula')
    .matches(/\d/, 'Nova senha deve conter pelo menos um número')
    .matches(/[!@#$%^&*()_+={}[\]|:;"'<>,.?/~`]/, 'Nova senha deve conter pelo menos um caractere especial')
    .required('Nova senha é obrigatória'),
  confirmNewPassword: Yup.string()
    .oneOf([Yup.ref('newPassword'), null], 'Confirmação de nova senha não corresponde')
    .required('Confirmação de nova senha é obrigatória')
});


// =======================================================================
// Rate Limiting para Login (proteção contra força bruta)
// =======================================================================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // - 15 minutos
  max: 5, // - Máximo 5 tentativas por IP dentro da janela de tempo
  message: { //
    error: 'Muitas tentativas de login. Por favor, tente novamente mais tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Adiciona cabeçalhos RateLimit-* na resposta
  legacyHeaders: false,  // Desabilita cabeçalhos X-RateLimit-*
  // Key generator pode ser customizado para rastrear por username/email também
  keyGenerator: (req) => req.ip // - Chave baseada no IP por padrão
});

class AuthController {
  /**
   * Middleware para aplicar o rate limiter de login.
   * Deve ser usado diretamente na rota de login.
   */
  static applyLoginLimiter() {
    return loginLimiter;
  }

  /**
   * Método para REGISTRAR um novo usuário.
   * Rota: POST /auth/register
   */
  async register(req, res) {
    try {
      // Validação dos dados da requisição
      const validatedData = await registerSchema.validate(req.body, { abortEarly: false });

      // Verifica se o e-mail ou nome de usuário já existe
      const existingUser = await User.findOne({
        where: {
          [User.sequelize.Op.or]: [
            { email: validatedData.email },
            { username: validatedData.username }
          ]
        }
      });

      if (existingUser) {
        logger.warn('Tentativa de registro com email ou username já existente', {
          email: validatedData.email,
          username: validatedData.username,
          ip: req.ip
        });
        return res.status(409).json({
          error: 'E-mail ou nome de usuário já cadastrado',
          code: 'DUPLICATE_USER'
        });
      }

      // Atribui permissões ao usuário com base no papel defaultRoles
      const userPermissions = authConfig.defaultRoles[validatedData.role || 'user'].permissions;

      // Cria o novo usuário
      const newUser = await User.create({
        name: validatedData.name,
        username: validatedData.username,
        email: validatedData.email,
        password: validatedData.password, // O hash da senha será feito no hook do modelo User
        role: validatedData.role || 'user',
        permissions: userPermissions, // Armazena as permissões no usuário
        isActive: true
      });

      // Gera JWT para o novo usuário (opcional, pode-se exigir login após registro)
      const token = jwt.sign(
        { id: newUser.id, role: newUser.role, permissions: newUser.permissions },
        authConfig.secret,
        { expiresIn: authConfig.expiresIn }
      );

      logger.info('Novo usuário registrado com sucesso', { userId: newUser.id, role: newUser.role, ip: req.ip });

      return res.status(201).json({
        message: 'Usuário registrado com sucesso',
        user: {
          id: newUser.id,
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          permissions: newUser.permissions
        },
        token
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação do registro de usuário', {
          errors: error.errors.map(err => err.message),
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Dados de registro inválidos',
          messages: error.errors.map(err => err.message),
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro no registro de usuário', {
        error: error.message,
        stack: error.stack,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao registrar usuário',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Método para AUTENTICAR um usuário (LOGIN).
   * Rota: POST /auth/login
   */
  async login(req, res) {
    try {
      // Validação dos dados de login
      const validatedData = await loginSchema.validate(req.body, { abortEarly: false });
      const { username, password } = validatedData;

      // Tenta encontrar o usuário por username ou email
      const user = await User.findOne({
        where: {
          [User.sequelize.Op.or]: [
            { username: username },
            { email: username }
          ]
        }
      });

      if (!user) {
        logger.warn('Tentativa de login falha: Usuário não encontrado', { username, ip: req.ip });
        return res.status(401).json({
          error: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Verifica se a conta está ativa
      if (!user.isActive) {
        logger.warn('Tentativa de login falha: Usuário inativo', { userId: user.id, username, ip: req.ip });
        return res.status(401).json({
          error: 'Conta de usuário inativa',
          code: 'USER_INACTIVE'
        });
      }

      // Compara a senha fornecida com o hash armazenado
      const passwordMatches = await bcrypt.compare(password, user.passwordHash); //

      if (!passwordMatches) {
        logger.warn('Tentativa de login falha: Senha incorreta', { userId: user.id, username, ip: req.ip });
        return res.status(401).json({
          error: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Gera o JSON Web Token (JWT)
      const token = jwt.sign(
        { id: user.id, role: user.role, permissions: user.permissions },
        authConfig.secret, //
        { expiresIn: authConfig.expiresIn } //
      );

      // Loga o sucesso do login
      logger.info('Usuário logado com sucesso', { userId: user.id, role: user.role, ip: req.ip });

      return res.json({
        message: 'Login bem-sucedido',
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        },
        token
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação do login', {
          errors: error.errors.map(err => err.message),
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Dados de login inválidos',
          messages: error.errors.map(err => err.message),
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro no login', {
        error: error.message,
        stack: error.stack,
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao tentar login',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Método para ALTERAR a senha de um usuário autenticado.
   * Rota: PUT /auth/change-password
   * Requer autenticação (middleware JWT).
   */
  async changePassword(req, res) {
    try {
      // Validação dos dados de alteração de senha
      const validatedData = await changePasswordSchema.validate(req.body, { abortEarly: false });
      const { currentPassword, newPassword } = validatedData;

      // req.user é injetado pelo middleware JWT (contém id, role, permissions do usuário logado)
      const user = await User.findByPk(req.user.id);

      if (!user) {
        logger.error('Erro de segurança: Usuário autenticado não encontrado no DB para mudança de senha', { userId: req.user.id, ip: req.ip });
        return res.status(404).json({
          error: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verifica se a senha atual fornecida corresponde ao hash armazenado
      const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash); //

      if (!passwordMatches) {
        logger.security('Tentativa de alteração de senha com senha atual incorreta', { //
          userId: user.id,
          ip: req.ip
        });
        return res.status(400).json({ //
          error: 'Senha atual incorreta',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Atualiza a senha. O hash da nova senha será feito no hook do modelo User.
      await user.update({ password: newPassword }); //

      logger.auth('Senha alterada com sucesso', { //
        userId: user.id,
        ip: req.ip
      });

      return res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        logger.warn('Falha na validação da alteração de senha', {
          errors: error.errors.map(err => err.message),
          ip: req.ip
        });
        return res.status(400).json({ //
          error: 'Falha na validação',
          messages: error.errors.map(err => err.message),
          code: 'VALIDATION_ERROR'
        });
      }
      logger.error('Erro ao alterar senha', { //
        error: error.message,
        stack: error.stack,
        userId: req.user ? req.user.id : 'unknown',
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao alterar senha',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Método para obter detalhes do usuário autenticado.
   * Rota: GET /auth/me
   * Requer autenticação.
   */
  async getMe(req, res) {
    try {
      // req.user é injetado pelo middleware JWT
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['passwordHash', 'createdAt', 'updatedAt'] } // Exclui campos sensíveis
      });

      if (!user) {
        logger.warn('Erro de autenticação: Token JWT válido, mas usuário não encontrado no DB', { userId: req.user.id, ip: req.ip });
        return res.status(404).json({
          error: 'Dados do usuário não encontrados',
          code: 'USER_NOT_FOUND'
        });
      }

      logger.debug('Dados do usuário autenticado obtidos', { userId: user.id, ip: req.ip });
      return res.json({
        user: user
      });
    } catch (error) {
      logger.error('Erro ao obter dados do usuário autenticado', {
        error: error.message,
        stack: error.stack,
        userId: req.user ? req.user.id : 'unknown',
        ip: req.ip
      });
      return res.status(500).json({
        error: 'Erro interno do servidor ao obter dados do usuário',
        code: 'SERVER_ERROR'
      });
    }
  }

  /**
   * Método para verificar a validade de um token (sem retornar dados do usuário).
   * Rota: POST /auth/verify-token
   * Útil para middleware ou para frontend verificar validade antes de fazer outras requisições.
   */
  async verifyToken(req, res) {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token não fornecido', code: 'TOKEN_MISSING' });
    }

    try {
      jwt.verify(token, authConfig.secret);
      return res.json({ valid: true, message: 'Token é válido' });
    } catch (error) {
      logger.warn('Verificação de token falha', { error: error.message, tokenSnippet: token.substring(0, 30) + '...', ip: req.ip });
      return res.status(401).json({ valid: false, error: 'Token inválido ou expirado', code: 'INVALID_OR_EXPIRED_TOKEN' });
    }
  }
}

module.exports = new AuthController();