/**
 * RC Construções - Modelo de Contrato (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Define o modelo Sequelize para contratos.
 * Representa a estrutura da tabela 'contracts' no banco de dados,
 * incluindo atributos, validações e associações com outros modelos.
 */

module.exports = (sequelize, DataTypes) => {
  const Contract = sequelize.define('Contract', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { // Chave estrangeira para a tabela de Clientes
        model: 'clients', // Nome da tabela
        key: 'id'
      },
      onUpdate: 'CASCADE', // Atualiza o clientId no contrato se o cliente mudar de ID
      onDelete: 'RESTRICT'  // Impede a exclusão de cliente se houver contratos associados (ou 'SET NULL')
    },
    budgetId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Orçamento é opcional para um contrato
      references: { // Chave estrangeira para a tabela de Orçamentos
        model: 'budgets', // Nome da tabela
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL' // Define como NULL se o orçamento associado for excluído
    },
    title: {
      type: DataTypes.STRING(200), // Título do contrato
      allowNull: false,
      validate: {
        notEmpty: { msg: 'O título do contrato não pode ser vazio.' },
        len: { args: [5, 200], msg: 'O título deve ter entre 5 e 200 caracteres.' }
      }
    },
    terms: {
      type: DataTypes.TEXT, // Termos e condições do contrato
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Os termos e condições não podem ser vazios.' },
        len: { args: [10, 5000], msg: 'Os termos devem ter entre 10 e 5000 caracteres.' } // Exemplo de limite de tamanho
      }
    },
    value: {
      type: DataTypes.DECIMAL(12, 2), // Ex: 9999999999.99 (maior precisão para valores monetários)
      allowNull: false,
      validate: {
        isDecimal: { msg: 'O valor deve ser um número decimal válido.' },
        min: { args: [0.00], msg: 'O valor do contrato não pode ser negativo.' }
      }
    },
    startDate: {
      type: DataTypes.DATE, // Armazena a data e hora
      allowNull: false,
      validate: {
        isDate: { msg: 'A data de início deve ser uma data válida.' }
      }
    },
    endDate: {
      type: DataTypes.DATE, // Data de término prevista ou real
      allowNull: true, // Data de término pode ser opcional a princípio
      validate: {
        isDate: { msg: 'A data de término deve ser uma data válida.' },
        isAfterStartDate(value) { // Validação customizada
          if (value && this.startDate && value < this.startDate) {
            throw new Error('A data de término não pode ser anterior à data de início.');
          }
        }
      }
    },
    status: {
      type: DataTypes.ENUM('Ativo', 'Concluído', 'Suspenso', 'Cancelado'), // Status possíveis do contrato
      allowNull: false,
      defaultValue: 'Ativo',
      validate: {
        isIn: {
          args: [['Ativo', 'Concluído', 'Suspenso', 'Cancelado']],
          msg: 'Status do contrato inválido.'
        }
      }
    },
    // Timestamps automáticos (createdAt, updatedAt) configurados globalmente em backend/config/database.js
  }, {
    tableName: 'contracts', // Nome explícito da tabela
    indexes: [ // Índices para otimizar buscas
      { fields: ['clientId'] },
      { fields: ['budgetId'] },
      { fields: ['status'] }
    ],
    hooks: {
      // Exemplo de hook: Normalizar antes de validar/salvar
      beforeValidate: (contract, options) => {
        // Assegura que o valor monetário é um número antes da validação
        if (typeof contract.value === 'string') {
          contract.value = parseFloat(contract.value.replace(',', '.'));
        }
      },
      // Exemplo de hook: Lógica após a criação de um contrato
      afterCreate: (contract, options) => {
        // console.log(`Contrato ${contract.id} criado. Notificar módulo financeiro?`);
      }
    }
  });

  // Associações
  Contract.associate = (models) => {
    // Um contrato pertence a um cliente
    Contract.belongsTo(models.Client, {
      foreignKey: 'clientId',
      as: 'client'
    });

    // Um contrato pode pertencer a um orçamento (opcional)
    Contract.belongsTo(models.Budget, {
      foreignKey: 'budgetId',
      as: 'budget'
    });

    // Um contrato pode ter muitas entradas financeiras (pagamentos, recebimentos)
    // Se você tiver uma tabela separada para pagamentos/recebimentos vinculados a contratos
    // Contract.hasMany(models.Financial, {
    //   foreignKey: 'contractId',
    //   as: 'financialRecords'
    // });
  };

  return Contract;
};