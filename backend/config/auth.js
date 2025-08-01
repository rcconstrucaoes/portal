/**
 * RC Construções - Configuração de Autenticação (Backend)
 * Versão 5.1
 * * Este arquivo centraliza a configuração de segurança para JSON Web Tokens (JWT).
 * O JWT_SECRET é a informação mais crítica e NUNCA deve ser exposta publicamente.
 */

// 'dotenv' é uma biblioteca que carrega variáveis de ambiente de um arquivo .env
// para process.env. É a prática recomendada para gerenciar segredos.
require('dotenv').config();

module.exports = {
  /**
   * Chave Secreta do JWT.
   * Esta é a chave usada para assinar e verificar os tokens de autenticação.
   * Se alguém tiver acesso a esta chave, poderá gerar tokens válidos e comprometer o sistema.
   * * A chave é lida de uma variável de ambiente chamada 'JWT_SECRET'.
   * Se a variável não estiver definida, usamos um valor padrão para o ambiente de desenvolvimento.
   * * IMPORTANTE: Em produção, SEMPRE defina a variável de ambiente JWT_SECRET com uma
   * string longa, complexa e aleatória.
   */
  secret: process.env.JWT_SECRET || 'rc-construcoes-jwt-secret-development-2024-muito-seguro-e-longo', //

  /**
   * Tempo de Expiração do Token.
   * Define por quanto tempo um token de login será válido.
   * Formatos aceitos: '8h' (8 horas), '1d' (1 dia), '7d' (7 dias), etc.
   * Um tempo de expiração razoável equilibra segurança e usabilidade.
   */
  expiresIn: '8h', //

  /**
   * Permissões Disponíveis no Sistema.
   * Uma lista abrangente de todas as ações granulares que um usuário pode realizar.
   * Isso permite um controle de acesso baseado em papéis (RBAC) flexível.
   */
  availablePermissions: [ //
    'dashboard.view', //
    'clients.view', //
    'clients.create', //
    'clients.edit', //
    'clients.delete', //
    'contracts.view', //
    'contracts.create', //
    'contracts.edit', //
    'contracts.delete', //
    'budgets.view', //
    'budgets.create', //
    'budgets.edit', //
    'budgets.delete', //
    'budgets.approve', // // Permissão específica para aprovar orçamentos
    'financial.view', //
    'financial.edit', //
    'reports.view', //
    'reports.generate', //
    'users.manage', // // Gerenciamento de usuários
    'system.admin', // // Acesso total ao sistema (superusuário)
    'suppliers.view', // Nova permissão para fornecedores
    'suppliers.create', // Nova permissão para fornecedores
    'suppliers.edit', // Nova permissão para fornecedores
    'suppliers.delete', // Nova permissão para fornecedores
    'settings.manage', // Permissão para gerenciar configurações do sistema
    'logs.view', // Permissão para visualizar logs
    'metrics.view' // Permissão para visualizar métricas de desempenho
  ],

  /**
   * Papéis padrão do sistema e suas permissões associadas.
   * Define o conjunto de permissões para cada tipo de usuário.
   */
  defaultRoles: { //
    admin: { //
      name: 'Administrador', //
      permissions: ['system.admin'] // // Admin tem todas as permissões listadas em 'availablePermissions'
    },
    manager: { //
      name: 'Gerente', //
      permissions: [ //
        'dashboard.view', //
        'clients.view', 'clients.create', 'clients.edit', 'clients.delete', //
        'contracts.view', 'contracts.create', 'contracts.edit', 'contracts.delete', //
        'budgets.view', 'budgets.create', 'budgets.edit', 'budgets.delete', 'budgets.approve', //
        'financial.view', 'financial.edit', //
        'reports.view', 'reports.generate', //
        'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete' // Adicionado
      ]
    },
    financial: { // Novo papel para finanças
      name: 'Financeiro',
      permissions: [
        'dashboard.view',
        'financial.view', 'financial.edit',
        'budgets.view', 'budgets.approve',
        'reports.view', 'reports.generate'
      ]
    },
    user: { //
      name: 'Usuário Padrão', //
      permissions: [ //
        'dashboard.view', //
        'clients.view', //
        'contracts.view', //
        'budgets.view', 'budgets.create', 'budgets.edit' //
      ]
    },
    guest: { // Novo papel para visitantes/não autenticados (se aplicável)
      name: 'Convidado',
      permissions: [
        'dashboard.view' // Apenas ver o dashboard
      ]
    }
  },

  /**
   * Opções adicionais para a configuração do JWT.
   */
  jwtOptions: {
    algorithm: 'HS256' // Algoritmo de assinatura (geralmente HS256 ou RS256)
    // audience: 'rc-construcoes-app', // Opcional: audiência do token
    // issuer: 'rc-construcoes.com' // Opcional: emissor do token
  }
};