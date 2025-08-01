/**
 * RC Construções - Middleware de Validação (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Este middleware implementa validação robusta para:
 * - Validação de dados de entrada (body, query, params) usando Yup.
 * - Sanitização de dados contra XSS.
 * - Validação de uploads de arquivo.
 * - Validação específica para documentos (CPF, CNPJ, CEP).
 * - Validação de regras de negócio.
 */

const Yup = require('yup');
const validator = require('validator'); // Para validações utilitárias como isEmail, isURL
const xss = require('xss'); // Para sanitização contra XSS
const multer = require('multer'); // Para uploads de arquivos
const path = require('path');
const crypto = require('crypto'); // Para gerar nomes de arquivo únicos

const logger = require('../config/logger'); // Logger do backend

class ValidatorMiddleware {
  constructor() {
    // Configurações de XSS
    this.xssOptions = {
      whiteList: { // Tags HTML permitidas (muito restritivo por padrão)
        p: [], br: [], strong: [], em: [], u: [],
        a: ['href', 'title', 'target'],
        b: [], i: [], ul: [], ol: [], li: [],
        span: ['class', 'style'],
        div: ['class', 'style']
      },
      stripIgnoreTag: true, // Remove tags não permitidas
      stripIgnoreTagBody: ['script', 'iframe', 'object', 'embed', 'style'], // Remove o corpo de tags específicas
      onIgnoreTagAttr: (tag, name, value, is>=) => { // Customiza o que fazer com atributos ignorados
        if (name.startsWith('on')) return ''; // Remove atributos de evento (onclick, onerror)
        if (name === 'style' && !value.includes('font-size')) return ''; // Remove estilos complexos
        return value;
      }
    };

    // Regex patterns comuns (podem ser centralizados em um arquivo de constantes)
    this.patterns = {
      cpf: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
      cnpj: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
      cep: /^\d{5}-\d{3}$/,
      phone: /^\(\d{2}\)\s\d{4,5}-\d{4}$/,
      date: /^\d{4}-\d{2}-\d{2}$/ // YYYY-MM-DD
    };
  }

  /**
   * Middleware de validação de esquema usando Yup.
   * Valida req.body, req.query, req.params com base em um schema fornecido.
   * @param {Object} schema - O schema Yup a ser usado para validação.
   * @param {string} type - Tipo de validação ('body', 'query', 'params').
   * @param {boolean} abortEarly - Se deve abortar a validação no primeiro erro.
   * @returns {Function} Middleware Express.
   */
  validateSchema(schema, type, abortEarly = false) {
    return async (req, res, next) => {
      try {
        const dataToValidate = req[type];
        req[type] = await schema.validate(dataToValidate, { abortEarly });
        next();
      } catch (error) {
        if (error.name === 'ValidationError') {
          logger.warn(`Falha na validação de ${type}:`, {
            errors: error.errors,
            input: req[type],
            ip: req.ip,
            userId: req.user?.id
          });
          return res.status(400).json({
            error: `Dados de ${type} inválidos`,
            messages: error.errors,
            code: 'VALIDATION_ERROR'
          });
        }
        logger.error(`Erro inesperado no middleware de validação de ${type}:`, {
          error: error.message,
          stack: error.stack,
          ip: req.ip,
          userId: req.user?.id
        });
        return res.status(500).json({
          error: 'Erro interno do servidor na validação',
          code: 'SERVER_ERROR'
        });
      }
    };
  }

  /**
   * Middleware de sanitização contra XSS.
   * Aplica a sanitização a campos de string no body da requisição.
   * @param {Array<string>} fieldsToSanitize - Nomes dos campos no body a serem sanitizados.
   * @returns {Function} Middleware Express.
   */
  sanitizeXSS(fieldsToSanitize) {
    return (req, res, next) => {
      if (!req.body) return next();

      fieldsToSanitize.forEach(field => {
        if (typeof req.body[field] === 'string') {
          req.body[field] = xss(req.body[field], this.xssOptions);
        }
      });
      next();
    };
  }

  /**
   * Middleware de validação e armazenamento de upload de arquivo.
   * Configura o Multer e valida tipos/tamanhos.
   * @param {Object} options - Opções de upload (ex: { fieldName: 'file', maxSize: 5MB, allowedMimes: ['image/jpeg'] }).
   * @returns {Function} Middleware Express (Multer).
   */
  validateUpload(options) {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads'); // Diretório de upload
    // Cria o diretório de uploads se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const fileExtension = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtension}`);
      }
    });

    const upload = multer({
      storage: storage,
      limits: {
        fileSize: options.maxSize || 5 * 1024 * 1024 // Padrão 5MB
      },
      fileFilter: (req, file, cb) => {
        if (options.allowedMimes && !options.allowedMimes.includes(file.mimetype)) {
          logger.warn('Upload de arquivo: Tipo de arquivo não permitido', {
            filename: file.originalname,
            mimetype: file.mimetype,
            allowed: options.allowedMimes
          });
          return cb(new Error('Tipo de arquivo não permitido.'), false);
        }
        cb(null, true);
      }
    });

    return upload.single(options.fieldName || 'file'); // Retorna o middleware Multer
  }

  // =======================================================================
  // Validações Específicas de Documentos/Dados
  // =======================================================================

  /**
   * Valida se uma string é um CPF válido.
   * @param {string} cpf - O CPF (pode ter máscara).
   * @returns {boolean} True se o CPF é válido.
   */
  isValidCPF(cpf) {
    if (!cpf || typeof cpf !== 'string') return false;
    const cleanedCpf = cpf.replace(/\D/g, ''); // Remove tudo que não é dígito

    if (cleanedCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanedCpf)) {
      return false; // CPF deve ter 11 dígitos e não pode ter todos os dígitos iguais
    }

    let sum = 0;
    let remainder;
    for (let i = 1; i <= 9; i++) sum += parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanedCpf.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanedCpf.substring(10, 11))) return false;

    return true;
  }

  /**
   * Valida se uma string é um CNPJ válido.
   * @param {string} cnpj - O CNPJ (pode ter máscara).
   * @returns {boolean} True se o CNPJ é válido.
   */
  isValidCNPJ(cnpj) {
    if (!cnpj || typeof cnpj !== 'string') return false;
    const cleanedCnpj = cnpj.replace(/\D/g, '');

    if (cleanedCnpj.length !== 14 || /^(\d)\1+$/.test(cleanedCnpj)) return false;

    let size = cleanedCnpj.length - 2;
    let numbers = cleanedCnpj.substring(0, size);
    const digits = cleanedCnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(i - 1)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    numbers = cleanedCnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(i - 1)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
  }

  /**
   * Valida se uma string é um CEP válido (apenas formato).
   * @param {string} cep - O CEP (pode ter máscara).
   * @returns {boolean} True se o CEP é válido.
   */
  isValidCEP(cep) {
    if (!cep || typeof cep !== 'string') return false;
    return this.patterns.cep.test(cep);
  }

  // =======================================================================
  // Regras de Negócio Personalizadas
  // =======================================================================
  /**
   * Middleware para validar regras de negócio complexas.
   * Pode ser usado para validações que dependem de múltiplos campos
   * ou do estado do banco de dados (ex: verificar disponibilidade de agendamento).
   * @param {string} ruleName - Nome da regra de negócio a ser validada.
   * @returns {Function} Middleware Express.
   */
  validateBusinessRules(ruleName) {
    return async (req, res, next) => {
      try {
        const rule = this.businessRules[ruleName];
        if (!rule) {
          logger.warn(`Regra de negócio '${ruleName}' não encontrada.`);
          return next(); // Ou lançar um erro, dependendo da política
        }

        const { valid, message } = await rule(req); // Regra deve ser uma função assíncrona
        if (!valid) {
          logger.warn(`Validação de regra de negócio falhou: ${ruleName} - ${message}`, {
            input: req.body,
            userId: req.user?.id
          });
          return res.status(400).json({
            error: message,
            code: `BUSINESS_RULE_VIOLATION_${ruleName.toUpperCase()}`
          });
        }
        next();
      } catch (error) {
        logger.error(`Erro ao validar regra de negócio '${ruleName}': ${error.message}`, {
          error: error.stack,
          ip: req.ip
        });
        return res.status(500).json({
          error: 'Erro interno do servidor ao validar regras de negócio',
          code: 'SERVER_ERROR'
        });
      }
    };
  }

  // Definições de regras de negócio
  businessRules = {
    // Exemplo: 'budget_amount_positive': (req) => { return { valid: req.body.amount > 0, message: 'O valor do orçamento deve ser positivo' }; },
    'contract_dates_valid': async (req) => {
        if (!req.body.startDate || !req.body.endDate) {
            return { valid: true }; // Se as datas não foram fornecidas, a validação de schema já deve ter cuidado
        }
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);
        if (endDate <= startDate) {
            return { valid: false, message: 'A data de término deve ser posterior à data de início.' };
        }
        return { valid: true };
    },
    'unique_email_on_update': async (req) => {
      // Exemplo de regra que verifica duplicidade de email em update, precisa de acesso ao modelo
      // const { id } = req.params;
      // const { email } = req.body;
      // if (email) {
      //   const existingUser = await User.findOne({ where: { email, id: { [Op.ne]: id } } });
      //   if (existingUser) return { valid: false, message: 'Este e-mail já está em uso por outro usuário.' };
      // }
      return { valid: true };
    }
  };
}

// Exporta uma instância singleton do middleware de validação
module.exports = new ValidatorMiddleware();

// Exporta o handler de erros do Celebrate/Joi se você ainda o usa em outras partes
// const { errors: celebrateErrors } = require('celebrate');
// module.exports.celebrateErrorHandler = celebrateErrors(); // Adicione este handler no final do pipeline de middleware do Express