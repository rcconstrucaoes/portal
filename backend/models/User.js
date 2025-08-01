/**
 * RC Construções - Modelo User (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Define o modelo Sequelize para usuários do sistema.
 * Inclui autenticação, autorização, perfis de acesso,
 * controle de sessão e auditoria de atividades.
 */

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs'); // Para hashing de senhas
const authConfig = require('../config/auth'); // Para acessar o segredo do bcrypt e roles/permissões
const logger = require('../config/logger'); // Logger do backend

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Verifica se a senha fornecida está correta comparando com o hash armazenado.
     * @param {string} password - A senha em texto claro.
     * @returns {Promise<boolean>} True se a senha corresponder, false caso contrário.
     */
    async checkPassword(password) {
      try {
        if (!this.passwordHash) {
          logger.warn('Tentativa de verificar senha para usuário sem passwordHash.', { userId: this.id });
          return false;
        }
        return await bcrypt.compare(password, this.passwordHash);
      } catch (error) {
        logger.error('Erro ao verificar senha', {
          error: error.message,
          userId: this.id
        });
        return false;
      }
    }

    /**
     * Verifica se o usuário tem uma permissão específica.
     * Considera 'system.admin' como permissão universal.
     * @param {string|Array<string>} permission - A permissão ou array de permissões a verificar.
     * @returns {boolean} True se o usuário tem a(s) permissão(ões).
     */
    hasPermission(permission) {
      if (!this.permissions || !Array.isArray(this.permissions)) {
        logger.debug(`Usuário ${this.id} sem permissões definidas.`);
        return false;
      }

      // Admins têm todas as permissões
      if (this.permissions.includes('system.admin')) {
        return true;
      }

      // Se for um array de permissões, verifica se possui TODAS
      if (Array.isArray(permission)) {
        return permission.every(p => this.permissions.includes(p));
      }

      // Se for uma única permissão
      return this.permissions.includes(permission);
    }
  }

  User.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Nome não pode ser vazio.' },
        len: { args: [2, 100], msg: 'Nome deve ter entre 2 e 100 caracteres.' }
      }
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: { msg: 'Este nome de usuário já está em uso.' },
      validate: {
        notEmpty: { msg: 'Nome de usuário não pode ser vazio.' },
        len: { args: [3, 50], msg: 'Nome de usuário deve ter entre 3 e 50 caracteres.' }
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: 'Este e-mail já está cadastrado.' },
      validate: {
        isEmail: { msg: 'Formato de e-mail inválido.' },
        notEmpty: { msg: 'E-mail não pode ser vazio.' }
      }
    },
    passwordHash: {
      type: DataTypes.STRING(255), // Armazena o hash da senha
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Hash de senha não pode ser vazio.' }
      }
    },
    // Campo 'password' é virtual, usado apenas para hashing via hook
    password: {
      type: DataTypes.VIRTUAL,
      set(value) {
        this.setDataValue('password', value); // Define o valor virtual
      },
      validate: {
        // As validações de complexidade de senha são geralmente feitas no controller (Yup)
        // Mas podem ser replicadas aqui para segurança extra no modelo.
        // ex: len: { args: [8, 255], msg: 'Senha deve ter no mínimo 8 caracteres.' }
      }
    },
    role: {
      type: DataTypes.ENUM(...Object.keys(authConfig.defaultRoles)), // 'admin', 'manager', 'user', 'financial', 'guest'
      allowNull: false,
      defaultValue: 'user', // Papel padrão
      validate: {
        isIn: {
          args: [Object.keys(authConfig.defaultRoles)],
          msg: 'Papel de usuário inválido.'
        }
      }
    },
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING), // Armazena as permissões do usuário como um array de strings
      allowNull: false,
      defaultValue: [],
      get() { // Getter para garantir que sempre retorne um array válido
        const rawValue = this.getDataValue('permissions');
        return Array.isArray(rawValue) ? rawValue : [];
      },
      set(value) { // Setter para garantir que as permissões sejam válidas
        if (!Array.isArray(value)) {
          throw new Error('Permissões devem ser um array.');
        }
        // Opcional: Validar cada permissão contra authConfig.availablePermissions
        const validPermissions = value.filter(p => authConfig.availablePermissions.includes(p));
        if (validPermissions.length !== value.length) {
          logger.warn('Tentativa de atribuir permissões inválidas a usuário.', { userId: this.id, invalidPermissions: value.filter(p => !authConfig.availablePermissions.includes(p)) });
        }
        this.setDataValue('permissions', validPermissions);
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true // Usuário ativo por padrão
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false // E-mail não verificado por padrão
    },
    lastLogin: {
      type: DataTypes.DATE, // Último login do usuário
      allowNull: true
    },
    lockedUntil: {
      type: DataTypes.DATE, // Data até a qual a conta está bloqueada (brute force)
      allowNull: true
    },
    loginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0 // Contador de tentativas de login falhas
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Timestamps automáticos (createdAt, updatedAt) configurados globalmente em backend/config/database.js
  }, {
    sequelize, // Passa a instância do Sequelize
    tableName: 'users', // Nome explícito da tabela
    indexes: [ // Índices para otimizar buscas
      { unique: true, fields: ['username'] },
      { unique: true, fields: ['email'] },
      { fields: ['role'] },
      { fields: ['isActive'] }
    ],
    hooks: {
      // Hook para hashear a senha antes de criar um novo usuário
      beforeCreate: async (user, options) => {
        if (user.password) {
          user.passwordHash = await bcrypt.hash(user.password, authConfig.bcryptRounds); // Usa rounds do authConfig
          logger.debug('Senha hasheada antes da criação do usuário.', { userId: user.id || 'novo' });
        }
        // Atribui permissões padrão baseadas no papel, se não foram explicitamente definidas
        if (!user.permissions || user.permissions.length === 0) {
          user.permissions = authConfig.defaultRoles[user.role]?.permissions || [];
          logger.debug(`Permissões padrão atribuídas ao usuário ${user.username} com papel ${user.role}.`);
        }
      },
      // Hook para hashear a senha antes de atualizar um usuário
      beforeUpdate: async (user, options) => {
        // Apenas hasheia se a senha virtual 'password' foi definida (ou seja, foi alterada)
        if (user.changed('password')) {
          user.passwordHash = await bcrypt.hash(user.password, authConfig.bcryptRounds);
          logger.debug('Senha hasheada antes da atualização do usuário.', { userId: user.id });
        }
        // Revalida ou normaliza permissões se o papel foi alterado ou permissões diretamente
        if (user.changed('role') || user.changed('permissions')) {
            const currentRolePermissions = authConfig.defaultRoles[user.role]?.permissions || [];
            // Garante que o usuário não tenha permissões que não existem na lista global ou na sua role
            user.permissions = user.permissions.filter(p => authConfig.availablePermissions.includes(p) && currentRolePermissions.includes(p));
            // Ou se admin, atribui todas as permissoes
            if (user.role === 'admin') {
                user.permissions = authConfig.availablePermissions;
            }
            logger.debug(`Permissões do usuário ${user.username} normalizadas após atualização.`);
        }
      },
      // Hook para remover a senha virtual após a busca (para não ser serializada por acidente)
      afterFind: (user, options) => {
        if (user && user.password) {
          delete user.dataValues.password;
        }
      }
    }
  });

  // Associações
  User.associate = (models) => {
    // Um usuário pode ter muitos clientes (se ele for o criador/gerente do cliente)
    // User.hasMany(models.Client, {
    //   foreignKey: 'createdByUserId',
    //   as: 'clients'
    // });
    // Um usuário pode ter muitos orçamentos, contratos, etc.
  };

  return User;
};