/**
 * RC Construções - Modelo Financeiro (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Define o modelo Sequelize para entradas financeiras (receitas e despesas).
 * Representa a estrutura da tabela 'financial' no banco de dados,
 * incluindo atributos, validações e associações com outros modelos.
 */

module.exports = (sequelize, DataTypes) => {
  const Financial = sequelize.define('Financial', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('Receita', 'Despesa'), // Tipo da transação
      allowNull: false,
      validate: {
        isIn: {
          args: [['Receita', 'Despesa']],
          msg: 'O tipo da transação deve ser Receita ou Despesa.'
        }
      }
    },
    description: {
      type: DataTypes.STRING(255), // Descrição da transação
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A descrição da transação não pode ser vazia.' },
        len: { args: [5, 255], msg: 'A descrição deve ter entre 5 e 255 caracteres.' }
      }
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2), // Valor da transação (ex: 9999999999.99)
      allowNull: false,
      validate: {
        isDecimal: { msg: 'O valor deve ser um número decimal válido.' },
        min: { args: [0.01], msg: 'O valor da transação deve ser positivo.' } // Mínimo 0.01 para evitar zero ou negativos
      }
    },
    date: {
      type: DataTypes.DATE, // Data da transação
      allowNull: false,
      validate: {
        isDate: { msg: 'A data da transação deve ser uma data válida.' }
      }
    },
    category: {
      type: DataTypes.STRING(100), // Categoria da transação (ex: 'Material', 'Salário', 'Aluguel')
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A categoria não pode ser vazia.' },
        len: { args: [2, 100], msg: 'A categoria deve ter entre 2 e 100 caracteres.' }
      }
    },
    referenceId: {
      type: DataTypes.UUID, // ID de referência para linkar a outros registros (ex: orçamento, contrato)
      allowNull: true, // Opcional
      defaultValue: DataTypes.UUIDV4 // Gera UUID se não fornecido
    },
    // Timestamps automáticos (createdAt, updatedAt) configurados globalmente em backend/config/database.js
  }, {
    tableName: 'financial', // Nome explícito da tabela
    indexes: [ // Índices para otimizar buscas
      { fields: ['type'] },
      { fields: ['category'] },
      { fields: ['date'] },
      { fields: ['referenceId'] }
    ],
    hooks: {
      // Exemplo de hook: Normalizar antes de validar/salvar
      beforeValidate: (financial, options) => {
        // Assegura que o valor monetário é um número antes da validação
        if (typeof financial.amount === 'string') {
          financial.amount = parseFloat(financial.amount.replace(',', '.'));
        }
      },
      // Exemplo de hook: Lógica após a criação de uma entrada financeira
      afterCreate: (financial, options) => {
        // console.log(`Entrada financeira ${financial.id} (${financial.type}: ${financial.amount}) criada.`);
        // Emitir evento para dashboard, relatórios, etc.
      }
    }
  });

  // Associações
  Financial.associate = (models) => {
    // Uma entrada financeira pode pertencer a um cliente (se a lógica de negócio permitir)
    // Financial.belongsTo(models.Client, {
    //   foreignKey: 'clientId',
    //   as: 'client'
    // });

    // Uma entrada financeira pode pertencer a um contrato (se for um pagamento de contrato)
    // Financial.belongsTo(models.Contract, {
    //   foreignKey: 'contractId',
    //   as: 'contract'
    // });

    // Uma entrada financeira pode pertencer a um orçamento (se for um recebimento de orçamento)
    // Financial.belongsTo(models.Budget, {
    //   foreignKey: 'budgetId',
    //   as: 'budget'
    // });
  };

  return Financial;
};