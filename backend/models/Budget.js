/**
 * RC Construções - Modelo de Orçamento (Backend)
 * Versão 5.1 - Revisado e Aprimorado
 *
 * Define o modelo Sequelize para orçamentos.
 * Representa a estrutura da tabela 'budgets' no banco de dados,
 * incluindo atributos, validações e associações com outros modelos.
 */

module.exports = (sequelize, DataTypes) => {
  const Budget = sequelize.define('Budget', {
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
      onUpdate: 'CASCADE', // Atualiza o clientId no orçamento se o cliente mudar de ID
      onDelete: 'CASCADE'  // Exclui orçamentos se o cliente for excluído
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'O título do orçamento não pode ser vazio.' },
        len: { args: [3, 100], msg: 'O título deve ter entre 3 e 100 caracteres.' }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true // Descrição é opcional
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2), // Ex: 12345678.99
      allowNull: false,
      validate: {
        isDecimal: { msg: 'O valor deve ser um número decimal válido.' },
        min: { args: [0.00], msg: 'O valor do orçamento não pode ser negativo.' }
      }
    },
    status: {
      type: DataTypes.ENUM('Pendente', 'Aprovado', 'Rejeitado', 'Cancelado'), // Status possíveis do orçamento
      allowNull: false,
      defaultValue: 'Pendente',
      validate: {
        isIn: {
          args: [['Pendente', 'Aprovado', 'Rejeitado', 'Cancelado']],
          msg: 'Status do orçamento inválido.'
        }
      }
    },
    // Timestamps automáticos (createdAt, updatedAt) configurados globalmente em backend/config/database.js
  }, {
    tableName: 'budgets', // Nome explícito da tabela
    // hooks: { // Exemplo de hook, se necessário
    //   beforeCreate: (budget, options) => {
    //     // Lógica antes de criar
    //   },
    //   afterUpdate: (budget, options) => {
    //     // Lógica após atualizar
    //   }
    // }
  });

  // Associações
  Budget.associate = (models) => {
    // Um orçamento pertence a um cliente
    Budget.belongsTo(models.Client, {
      foreignKey: 'clientId',
      as: 'client'
    });

    // Um orçamento pode ter um ou mais contratos associados (se você controlar assim)
    // Se um contrato 'usa' um orçamento, então o Contrato tem budgetId
    // Budget.hasMany(models.Contract, {
    //   foreignKey: 'budgetId',
    //   as: 'contracts'
    // });
  };

  return Budget;
};