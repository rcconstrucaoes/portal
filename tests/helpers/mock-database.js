/**
 * RC Construções - Mock de Banco de Dados para Testes (Revisado e Aprimorado)
 * Fornece um mock para o módulo de banco de dados (Database/Dexie.js) e modelos Sequelize.
 * Permite que testes de frontend e backend simulem operações de DB sem um DB real.
 */

// Importa os dados de teste (fixtures)
const mockUsers = require('../fixtures/users.json');
const mockClients = require('../fixtures/clients.json');
const mockBudgets = require('../fixtures/budgets.json');
const mockContracts = require('../fixtures/contracts.json');
// Adicione outras fixtures conforme necessário

class MockDatabase {
  constructor() {
    // Dados em memória que simulam as tabelas do IndexedDB/Sequelize
    this.data = {
      users: [],
      clients: [],
      budgets: [],
      contracts: [],
      financial: [],
      suppliers: [],
      logs: [] // Se o modelo Log for usado
      // Adicione outras tabelas conforme seus modelos
    };

    // Mapeamento de nomes de modelos para suas tabelas de dados internas
    this.modelToTableMap = {
      User: 'users',
      Client: 'clients',
      Budget: 'budgets',
      Contract: 'contracts',
      Financial: 'financial',
      Supplier: 'suppliers',
      Log: 'logs'
    };

    // Simula a instância sequelize para compatibilidade com o backend
    this.sequelize = {
      Op: { // Operadores Sequelize
        or: 'Op.or',
        gte: 'Op.gte',
        lte: 'Op.lte',
        iLike: 'Op.iLike',
        ne: 'Op.ne'
      },
      transaction: async () => ({ // Simula transações
        commit: async () => { console.log('Mock DB: Transaction committed.'); },
        rollback: async () => { console.log('Mock DB: Transaction rolled back.'); }
      })
    };

    // Simula os modelos Sequelize com métodos de consulta básicos
    this.models = {};
    this.setupMockModels();

    this.resetData(); // Popula os dados iniciais dos mocks
    console.log('--- MockDatabase: Inicializado para testes ---');
  }

  /**
   * Configura os modelos mockados para imitar a API do Sequelize.
   */
  setupMockModels() {
    for (const modelName in this.modelToTableMap) {
      const tableName = this.modelToTableMap[modelName];
      this.models[modelName] = {
        findByPk: async (id, options = {}) => {
          console.log(`Mock DB: ${modelName}.findByPk(${id})`);
          const record = this.data[tableName].find(r => r.id === parseInt(id, 10));
          if (!record) return null;
          // Simula associações (muito básico)
          if (options.include && record) {
            const result = { ...record
            };
            for (const inc of options.include) {
              if (inc.model && inc.as) {
                const associatedTableName = this.modelToTableMap[inc.model.name];
                if (associatedTableName) {
                  // Assume relação 1:N (um para muitos) onde o 'as' é o nome da coleção
                  // Ou 1:1 onde 'as' é o nome do objeto
                  // Aqui, estamos simplificando para belongsTo onde a FK está no registro atual
                  if (modelName === 'Budget' && associatedTableName === 'clients' && record.clientId) {
                    result[inc.as] = this.data.clients.find(c => c.id === record.clientId);
                  } else if (modelName === 'Contract' && associatedTableName === 'clients' && record.clientId) {
                    result[inc.as] = this.data.clients.find(c => c.id === record.clientId);
                  } else if (modelName === 'Contract' && associatedTableName === 'budgets' && record.budgetId) {
                    result[inc.as] = this.data.budgets.find(b => b.id === record.budgetId);
                  }
                  // Adicione mais simulações de include aqui
                }
              }
            }
            return result;
          }
          return record;
        },
        findOne: async (options = {}) => {
          console.log(`Mock DB: ${modelName}.findOne(${JSON.stringify(options.where)})`);
          // Implementa lógica básica de `where`
          const records = this.data[tableName].filter(record => {
            if (!options.where) return true;
            for (const key in options.where) {
              const value = options.where[key];
              if (typeof value === 'object' && value.hasOwnProperty(this.sequelize.Op.or)) {
                // Handle Op.or
                const orConditions = value[this.sequelize.Op.or];
                const orMatch = orConditions.some(cond => {
                  for (const orKey in cond) {
                    const orValue = cond[orKey];
                    if (typeof orValue === 'object' && orValue.hasOwnProperty(this.sequelize.Op.iLike)) {
                      // Handle Op.iLike
                      return record[orKey] && record[orKey].toLowerCase().includes(orValue[this.sequelize.Op.iLike].replace(/%/g, '').toLowerCase());
                    } else if (typeof orValue === 'object' && orValue.hasOwnProperty(this.sequelize.Op.ne)) {
                        return record[orKey] !== orValue[this.sequelize.Op.ne];
                    }else {
                      return record[orKey] === orValue;
                    }
                  }
                  return false;
                });
                if (!orMatch) return false;
              } else if (typeof value === 'object' && value.hasOwnProperty(this.sequelize.Op.gte)) {
                if (record[key] < value[this.sequelize.Op.gte]) return false;
              } else if (typeof value === 'object' && value.hasOwnProperty(this.sequelize.Op.lte)) {
                if (record[key] > value[this.sequelize.Op.lte]) return false;
              } else if (typeof value === 'object' && value.hasOwnProperty(this.sequelize.Op.iLike)) {
                // Handle Op.iLike
                if (!record[key] || !record[key].toLowerCase().includes(value[this.sequelize.Op.iLike].replace(/%/g, '').toLowerCase())) return false;
              }
              else if (record[key] !== value) {
                return false;
              }
            }
            return true;
          });
          return records[0] || null; // Retorna o primeiro ou null
        },
        findAll: async (options = {}) => {
          console.log(`Mock DB: ${modelName}.findAll(${JSON.stringify(options.where || {})})`);
          let records = this.data[tableName].filter(record => {
            if (!options.where) return true;
            for (const key in options.where) {
              const value = options.where[key];
              if (typeof value === 'object' && value.hasOwnProperty(this.sequelize.Op.or)) {
                // Handle Op.or
                const orConditions = value[this.sequelize.Op.or];
                const orMatch = orConditions.some(cond => {
                  for (const orKey in cond) {
                    const orValue = cond[orKey];
                    if (typeof orValue === 'object' && orValue.hasOwnProperty(this.sequelize.Op.iLike)) {
                      return record[orKey] && record[orKey].toLowerCase().includes(orValue[this.sequelize.Op.iLike].replace(/%/g, '').toLowerCase());
                    } else if (typeof orValue === 'object' && orValue.hasOwnProperty(this.sequelize.Op.ne)) {
                        return record[orKey] !== orValue[this.sequelize.Op.ne];
                    } else {
                      return record[orKey] === orValue;
                    }
                  }
                  return false;
                });
                if (!orMatch) return false;
              } else if (typeof value === 'object' && value.hasOwnProperty(this.sequelize.Op.gte)) {
                if (record[key] < value[this.sequelize.Op.gte]) return false;
              } else if (typeof value === 'object' && value.hasOwnProperty(this.sequelize.Op.lte)) {
                if (record[key] > value[this.sequelize.Op.lte]) return false;
              } else if (typeof value === 'object' && value.hasOwnProperty(this.sequelize.Op.iLike)) {
                  if (!record[key] || !record[key].toLowerCase().includes(value[this.sequelize.Op.iLike].replace(/%/g, '').toLowerCase())) return false;
              }
              else if (record[key] !== value) {
                return false;
              }
            }
            return true;
          });

          // Simula ordenação
          if (options.order && options.order.length > 0) {
            records.sort((a, b) => {
              const [key, order] = options.order[0];
              if (a[key] < b[key]) return order === 'ASC' ? -1 : 1;
              if (a[key] > b[key]) return order === 'ASC' ? 1 : -1;
              return 0;
            });
          }

          // Simula paginação (limit e offset)
          if (options.limit !== undefined && options.offset !== undefined) {
            records = records.slice(options.offset, options.offset + options.limit);
          }
          
          // Simula associações (para hasMany/belongsTo em findAll)
          if (options.include && records.length > 0) {
            // Isso é mais complexo para simular corretamente em um mock simples.
            // Para hasMany, você precisaria de uma lógica de busca secundária.
            // Para testes mais complexos, pode-se pre-populate os includes ou usar uma lib de mock DB.
          }

          return records;
        },
        findAndCountAll: async (options = {}) => {
          console.log(`Mock DB: ${modelName}.findAndCountAll(${JSON.stringify(options.where || {})})`);
          const allMatchingRecords = await this.models[modelName].findAll({
            where: options.where,
            order: options.order
          }); // Pega todos os registros que casam a query sem limit/offset

          const count = allMatchingRecords.length;
          const rows = allMatchingRecords.slice(options.offset, options.offset + options.limit);
          return { count, rows };
        },
        create: async (data) => {
          console.log(`Mock DB: ${modelName}.create(${JSON.stringify(data)})`);
          const newId = Math.max(0, ...this.data[tableName].map(r => r.id)) + 1;
          const newRecord = { ...data,
            id: newId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          this.data[tableName].push(newRecord);
          // Simula hooks bcrypt para User
          if (modelName === 'User' && newRecord.password) {
            newRecord.passwordHash = `mock_hashed_${newRecord.password}`;
            delete newRecord.password; // Remove virtual field
          }
          return newRecord;
        },
        update: async (data, options) => {
          console.log(`Mock DB: ${modelName}.update(${JSON.stringify(data)}, ${JSON.stringify(options.where)})`);
          const recordsToUpdate = this.data[tableName].filter(record => {
            if (!options.where) return false; // Deve ter where clause para update
            for (const key in options.where) {
              if (record[key] !== options.where[key]) return false;
            }
            return true;
          });

          recordsToUpdate.forEach(record => {
            Object.assign(record, data, {
              updatedAt: new Date()
            });
             // Simula hooks bcrypt para User
            if (modelName === 'User' && data.password) {
              record.passwordHash = `mock_hashed_${data.password}`;
              delete data.password; // Remove virtual field
            }
          });
          return [recordsToUpdate.length]; // Sequelize retorna [numAffectedRows]
        },
        destroy: async (options) => {
          console.log(`Mock DB: ${modelName}.destroy(${JSON.stringify(options.where)})`);
          const initialLength = this.data[tableName].length;
          this.data[tableName] = this.data[tableName].filter(record => {
            if (!options.where) return true; // Se não tem where, nada é destruído
            for (const key in options.where) {
              if (record[key] !== options.where[key]) return true; // Mantém se não corresponder à condição
            }
            return false; // Destrói se corresponder à condição
          });
          return initialLength - this.data[tableName].length; // Retorna número de linhas afetadas
        },
        count: async (options = {}) => {
          console.log(`Mock DB: ${modelName}.count(${JSON.stringify(options.where || {})})`);
          const records = await this.models[modelName].findAll(options);
          return records.length;
        },
        sum: async (field, options = {}) => {
            console.log(`Mock DB: ${modelName}.sum(${field}, ${JSON.stringify(options.where || {})})`);
            const records = await this.models[modelName].findAll(options);
            const total = records.reduce((acc, record) => acc + (record[field] || 0), 0);
            return total;
        },
        upsert: async (data, options) => {
          console.log(`Mock DB: ${modelName}.upsert(${JSON.stringify(data)})`);
          const existing = this.data[tableName].find(r => r.id === data.id);
          if (existing) {
            Object.assign(existing, data, { updatedAt: new Date() });
            return [existing, false]; // [record, created=false]
          } else {
            const newRecord = { ...data, createdAt: new Date(), updatedAt: new Date() };
            this.data[tableName].push(newRecord);
            return [newRecord, true]; // [record, created=true]
          }
        },
        max: async (field, options) => {
          console.log(`Mock DB: ${modelName}.max(${field})`);
          const records = await this.models[modelName].findAll(options);
          if (records.length === 0) return null;
          return Math.max(...records.map(r => r[field] || 0));
        }
      };
    }
  }

  /**
   * Reseta os dados do mock para o estado inicial das fixtures.
   */
  resetData() {
    this.data.users = JSON.parse(JSON.stringify(mockUsers)); // Deep copy para evitar mutação
    this.data.clients = JSON.parse(JSON.stringify(mockClients));
    this.data.budgets = JSON.parse(JSON.stringify(mockBudgets));
    this.data.contracts = JSON.parse(JSON.stringify(mockContracts));
    this.data.financial = []; // Exemplo: Financial pode começar vazio ou com outra fixture
    this.data.suppliers = []; // Supondo que você tem um modelo Supplier
    this.data.logs = []; // Supondo que você tem um modelo Log
    console.log('Mock DB: Dados resetados para fixtures iniciais.');
  }

  /**
   * Simula o método .table() do Dexie.js para uso no frontend.
   * @param {string} tableName - Nome da tabela.
   * @returns {Object} Um objeto com métodos simulados para a tabela.
   */
  table(tableName) {
    if (!this.data[tableName]) {
      console.warn(`Mock DB: Tabela '${tableName}' não existe no mock. Criando array vazio.`);
      this.data[tableName] = [];
    }
    const tableData = this.data[tableName];

    return {
      add: async (item) => {
        console.log(`Mock DB: Table '${tableName}'.add(${JSON.stringify(item)})`);
        const newId = Math.max(0, ...tableData.map(r => r.id || 0)) + 1;
        const newItem = { ...item,
          id: newId,
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now()
        };
        tableData.push(newItem);
        return newId;
      },
      get: async (id) => {
        console.log(`Mock DB: Table '${tableName}'.get(${id})`);
        return tableData.find(r => r.id === parseInt(id, 10));
      },
      toArray: async () => {
        console.log(`Mock DB: Table '${tableName}'.toArray()`);
        return [...tableData];
      }, // Retorna uma cópia
      update: async (id, updates) => {
        console.log(`Mock DB: Table '${tableName}'.update(${id}, ${JSON.stringify(updates)})`);
        const index = tableData.findIndex(r => r.id === parseInt(id, 10));
        if (index > -1) {
          Object.assign(tableData[index], updates, {
            updatedAt: Date.now()
          });
          return 1; // Simula 1 registro atualizado
        }
        return 0;
      },
      delete: async (id) => {
        console.log(`Mock DB: Table '${tableName}'.delete(${id})`);
        const initialLength = tableData.length;
        this.data[tableName] = tableData.filter(r => r.id !== parseInt(id, 10));
        return initialLength - this.data[tableName].length;
      },
      where: (key) => ({
        equals: (value) => {
          console.log(`Mock DB: Table '${tableName}'.where('${key}').equals('${value}')`);
          const results = tableData.filter(r => r[key] === value);
          return { toArray: async () => results };
        },
        // Adicione outros métodos de consulta Dexie.js como .below(), .above(), .startsWith(), etc.
      }),
      filter: (predicate) => { // Simula o .filter() do Dexie
        console.log(`Mock DB: Table '${tableName}'.filter(...)`);
        const results = tableData.filter(predicate);
        return { toArray: async () => results };
      },
      bulkPut: async (items) => { // Simula bulkPut para sincronização
        console.log(`Mock DB: Table '${tableName}'.bulkPut(${items.length} items)`);
        const updatedIds = [];
        for (const item of items) {
            const existingIndex = tableData.findIndex(r => r.id === item.id);
            if (existingIndex > -1) {
                Object.assign(tableData[existingIndex], item, { updatedAt: Date.now() });
            } else {
                tableData.push({ ...item, createdAt: item.createdAt || Date.now(), updatedAt: item.updatedAt || Date.now() });
            }
            updatedIds.push(item.id);
        }
        return updatedIds; // Retorna IDs dos itens processados
      },
      clear: async () => {
        console.log(`Mock DB: Table '${tableName}'.clear()`);
        this.data[tableName].length = 0; // Limpa o array
      }
    };
  }
}

module.exports = new MockDatabase();