/**
 * RC Construções - Modelo de Cliente (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Define o modelo Sequelize para clientes.
 * Representa a estrutura da tabela 'clients' no banco de dados,
 * incluindo atributos, validações e associações com outros modelos.
 */

module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define('Client', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(150), // Nome completo do cliente
      allowNull: false,
      validate: {
        notEmpty: { msg: 'O nome do cliente não pode ser vazio.' },
        len: { args: [2, 150], msg: 'O nome deve ter entre 2 e 150 caracteres.' }
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { // Garante que cada e-mail seja único
        msg: 'Este e-mail já está cadastrado.'
      },
      validate: {
        isEmail: { msg: 'Formato de e-mail inválido.' },
        notEmpty: { msg: 'O e-mail não pode ser vazio.' }
      }
    },
    phone: {
      type: DataTypes.STRING(20), // Ex: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX
      allowNull: false,
      validate: {
        notEmpty: { msg: 'O telefone não pode ser vazio.' },
        // Regex de validação no frontend/controller é mais abrangente. Aqui, um básico.
        len: { args: [10, 20], msg: 'Telefone inválido.' } // Exemplo de validação de tamanho
      }
    },
    address: {
      type: DataTypes.STRING(255), // Endereço completo
      allowNull: true // Endereço é opcional
    },
    cpf: {
      type: DataTypes.STRING(14), // Ex: XXX.XXX.XXX-XX
      allowNull: true, // CPF é opcional
      unique: { // Garante que cada CPF seja único (se não for nulo)
        name: 'unique_cpf',
        msg: 'Este CPF já está cadastrado.'
      },
      validate: {
        // Validação de formato pode ser feita aqui.
        // A validação de dígitos verificadores é melhor no controller ou helper.
        len: { args: [11, 14], msg: 'CPF inválido.' }, // 11 para apenas dígitos, 14 com máscara
        is: { args: /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, msg: 'Formato de CPF inválido.' } // Aceita com ou sem máscara
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true // Clientes são ativos por padrão
    },
    // Timestamps automáticos (createdAt, updatedAt) configurados globalmente em backend/config/database.js
  }, {
    tableName: 'clients', // Nome explícito da tabela
    indexes: [ // Índices para otimizar buscas
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['cpf'], where: { cpf: { [DataTypes.Op.ne]: null } } } // Índice único apenas para CPF não nulo
    ],
    hooks: {
      // Exemplo de hook para limpar/normalizar dados antes de salvar
      beforeValidate: (client, options) => {
        if (client.email) {
          client.email = client.email.toLowerCase().trim(); // Normaliza e-mail
        }
        if (client.cpf) {
          client.cpf = client.cpf.replace(/\D/g, ''); // Remove máscara do CPF antes de salvar
          // Ou mantém a máscara se o padrão de validação esperar isso
        }
        // Se `phone` também tiver máscara, pode ser normalizado aqui
      }
    }
  });

  // Associações
  Client.associate = (models) => {
    // Um cliente pode ter muitos orçamentos
    Client.hasMany(models.Budget, {
      foreignKey: 'clientId',
      as: 'budgets'
    });

    // Um cliente pode ter muitos contratos
    Client.hasMany(models.Contract, {
      foreignKey: 'clientId',
      as: 'contracts'
    });

    // Um cliente pode ter muitas entradas financeiras (se houver essa relação direta)
    // Client.hasMany(models.Financial, {
    //   foreignKey: 'clientId',
    //   as: 'financialRecords'
    // });
  };

  return Client;
};