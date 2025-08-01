// Initialize globally
window.ErrorTracking = new ErrorTrackingManager();
```

#### Backend Error Handling
```javascript
// backend/middleware/errorHandler.js
const logger = require('../config/logger');

class ErrorHandler {
  static handle(err, req, res, next) {
    // Log the error
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });

    // Send to external error tracking
    if (process.env.SENTRY_DSN) {
      require('@sentry/node').captureException(err, {
        user: {
          id: req.user?.id,
          email: req.user?.email
        },
        tags: {
          method: req.method,
          url: req.url
        }
      });
    }

    // Determine error response
    if (err.isOperational) {
      // Operational errors - safe to send to client
      res.status(err.statusCode || 500).json({
        error: err.message,
        code: err.code
      });
    } else {
      // Programming errors - don't leak details
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  static notFound(req, res, next) {
    const error = new Error(`Route ${req.originalUrl} not found`);
    error.statusCode = 404;
    error.isOperational = true;
    next(error);
  }
}

module.exports = ErrorHandler;
```

## 📊 Performance Monitoring

### 1. Frontend Performance

#### Web Vitals Tracking
```javascript
// js/core/performance-monitor.js
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.observers = [];
    this.isInitialized = false;
  }

  async init() {
    try {
      // Import Web Vitals library
      if (window.webVitals) {
        this.setupWebVitals();
      }
      
      // Setup custom performance monitoring
      this.setupCustomMetrics();
      this.setupNavigationTiming();
      this.setupResourceTiming();
      
      this.isInitialized = true;
      console.log('📊 Performance monitoring initialized');
    } catch (error) {
      console.error('❌ Performance monitoring failed to initialize:', error);
    }
  }

  setupWebVitals() {
    // Core Web Vitals
    window.webVitals.getCLS(this.sendMetric.bind(this));
    window.webVitals.getFID(this.sendMetric.bind(this));
    window.webVitals.getFCP(this.sendMetric.bind(this));
    window.webVitals.getLCP(this.sendMetric.bind(this));
    window.webVitals.getTTFB(this.sendMetric.bind(this));
  }

  setupCustomMetrics() {
    // App initialization time
    this.markEvent('app-init-start');
    
    // Page load performance
    window.addEventListener('load', () => {
      this.markEvent('app-init-end');
      this.measureDuration('app-initialization', 'app-init-start', 'app-init-end');
    });

    // Database operation timing
    this.setupDatabaseMetrics();
  }

  setupNavigationTiming() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.sendMetric({
          name: 'navigation_timing',
          value: {
            dns: navigation.domainLookupEnd - navigation.domainLookupStart,
            connect: navigation.connectEnd - navigation.connectStart,
            request: navigation.responseStart - navigation.requestStart,
            response: navigation.responseEnd - navigation.responseStart,
            dom: navigation.domContentLoadedEventEnd - navigation.responseEnd,
            load: navigation.loadEventEnd - navigation.loadEventStart
          }
        });
      }
    });
  }

  setupResourceTiming() {
    // Monitor slow resources
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 1000) { // Resources taking more than 1 second
          this.sendMetric({
            name: 'slow_resource',
            value: entry.duration,
            resource: entry.name,
            type: entry.initiatorType
          });
        }
      });
    });
    
    observer.observe({ entryTypes: ['resource'] });
    this.observers.push(observer);
  }

  setupDatabaseMetrics() {
    // Hook into Database operations
    if (window.Database) {
      const originalSave = window.Database.save;
      const originalGet = window.Database.get;
      const originalQuery = window.Database.query;

      window.Database.save = async function(...args) {
        const start = performance.now();
        try {
          const result = await originalSave.apply(this, args);
          window.PerformanceMonitor?.recordDatabaseOperation('save', performance.now() - start, true);
          return result;
        } catch (error) {
          window.PerformanceMonitor?.recordDatabaseOperation('save', performance.now() - start, false);
          throw error;
        }
      };

      window.Database.get = async function(...args) {
        const start = performance.now();
        try {
          const result = await originalGet.apply(this, args);
          window.PerformanceMonitor?.recordDatabaseOperation('get', performance.now() - start, true);
          return result;
        } catch (error) {
          window.PerformanceMonitor?.recordDatabaseOperation('get', performance.now() - start, false);
          throw error;
        }
      };
    }
  }

  recordDatabaseOperation(operation, duration, success) {
    this.sendMetric({
      name: 'database_operation',
      operation,
      duration,
      success,
      timestamp: Date.now()
    });
  }

  markEvent(name) {
    performance.mark(name);
  }

  measureDuration(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name)[0];
      this.sendMetric({
        name: 'custom_timing',
        metric: name,
        value: measure.duration
      });
    } catch (error) {
      console.warn('Failed to measure duration:', error);
    }
  }

  sendMetric(metric) {
    // Send to analytics endpoint
    this.sendToBackend(metric);
    
    // Store locally for dashboard
    this.storeMetric(metric);
    
    // Log performance issues
    if (this.isSlowMetric(metric)) {
      console.warn('🐌 Performance issue detected:', metric);
    }
  }

  async sendToBackend(metric) {
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...metric,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      });
    } catch (error) {
      console.warn('Failed to send metric to backend:', error);
    }
  }

  storeMetric(metric) {
    const key = `perf_${metric.name}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    stored.push({
      ...metric,
      timestamp: Date.now()
    });
    
    // Keep only last 100 entries
    if (stored.length > 100) {
      stored.splice(0, stored.length - 100);
    }
    
    localStorage.setItem(key, JSON.stringify(stored));
  }

  isSlowMetric(metric) {
    const thresholds = {
      'CLS': 0.1,
      'FID': 100,
      'LCP': 2500,
      'FCP': 1800,
      'TTFB': 800,
      'database_operation': 1000,
      'app-initialization': 3000
    };
    
    return metric.value > (thresholds[metric.name] || Infinity);
  }

  getPerformanceReport() {
    const report = {
      webVitals: {},
      customMetrics: {},
      issues: []
    };

    // Aggregate stored metrics
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('perf_')) {
        const metricName = key.replace('perf_', '');
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        
        if (data.length > 0) {
          const values = data.map(d => d.value).filter(v => typeof v === 'number');
          if (values.length > 0) {
            report.customMetrics[metricName] = {
              count: values.length,
              avg: values.reduce((a, b) => a + b, 0) / values.length,
              min: Math.min(...values),
              max: Math.max(...values),
              latest: data[data.length - 1]
            };
          }
        }
      }
    });

    return report;
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

window.PerformanceMonitor = new PerformanceMonitor();
```

### 2. Database Performance Monitoring

#### Query Performance Tracking
```javascript
// backend/middleware/dbMonitoring.js
const logger = require('../config/logger');
const promClient = require('prom-client');

// Metrics
const dbQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['query_type', 'table', 'status']
});

const dbConnectionsActive = new promClient.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

const dbQueryErrors = new promClient.Counter({
  name: 'database_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['error_type', 'table']
});

class DatabaseMonitor {
  static setupSequelizeHooks(sequelize) {
    // Hook into all queries
    sequelize.addHook('beforeQuery', (options) => {
      options.startTime = Date.now();
    });

    sequelize.addHook('afterQuery', (options, query) => {
      const duration = (Date.now() - options.startTime) / 1000;
      const queryType = this.getQueryType(query.sql);
      const table = this.extractTableName(query.sql);

      // Record metrics
      dbQueryDuration
        .labels(queryType, table, 'success')
        .observe(duration);

      // Log slow queries
      if (duration > 1) {
        logger.warn('Slow query detected', {
          duration,
          sql: query.sql,
          queryType,
          table
        });
      }

      // Performance logging
      logger.performance('database_query', duration, {
        queryType,
        table,
        sql: query.sql.substring(0, 100) + '...'
      });
    });

    sequelize.addHook('queryError', (error, options, query) => {
      const queryType = this.getQueryType(query.sql);
      const table = this.extractTableName(query.sql);

      dbQueryErrors
        .labels(error.name || 'unknown', table)
        .inc();

      logger.error('Database query error', {
        error: error.message,
        sql: query.sql,
        queryType,
        table
      });
    });

    // Monitor connection pool
    setInterval(() => {
      const pool = sequelize.connectionManager.pool;
      if (pool) {
        dbConnectionsActive.set(pool.size - pool.available);
        
        logger.info('Database connection pool status', {
          size: pool.size,
          available: pool.available,
          used: pool.size - pool.available,
          pending: pool.pending
        });
      }
    }, 30000);
  }

  static getQueryType(sql) {
    const query = sql.toLowerCase().trim();
    if (query.startsWith('select')) return 'select';
    if (query.startsWith('insert')) return 'insert';
    if (query.startsWith('update')) return 'update';
    if (query.startsWith('delete')) return 'delete';
    if (query.startsWith('create')) return 'create';
    if (query.startsWith('drop')) return 'drop';
    if (query.startsWith('alter')) return 'alter';
    return 'other';
  }

  static extractTableName(sql) {
    const matches = sql.match(/(?:from|into|update|join)\s+`?(\w+)`?/i);
    return matches ? matches[1] : 'unknown';
  }

  static getConnectionPoolStats(sequelize) {
    const pool = sequelize.connectionManager.pool;
    return {
      size: pool.size,
      available: pool.available,
      used: pool.size - pool.available,
      pending: pool.pending
    };
  }
}

module.exports = DatabaseMonitor;
```

## 📱 Real-time Monitoring Dashboard

### 1. Monitoring Page Template

#### monitoring.html
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monitoring - RC Construções</title>
    <link rel="stylesheet" href="../css/modern_main_css.css">
    <link rel="stylesheet" href="../css/components.css">
    <link rel="stylesheet" href="../css/dashboard.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div id="monitoring-content" class="page-monitoring">
        <div class="monitoring-header">
            <h2><i class="fas fa-chart-line"></i> System Monitoring</h2>
            <div class="monitoring-controls">
                <button class="btn btn-sm btn-ghost" id="refresh-btn">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
                <button class="btn btn-sm btn-ghost" id="auto-refresh-btn">
                    <i class="fas fa-play"></i> Auto Refresh
                </button>
                <select id="time-range" class="form-control">
                    <option value="5m">Last 5 minutes</option>
                    <option value="1h" selected>Last hour</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                </select>
            </div>
        </div>

        <!-- System Status -->
        <div class="status-grid">
            <div class="status-card" id="system-status">
                <div class="status-icon">
                    <i class="fas fa-server"></i>
                </div>
                <div class="status-info">
                    <h4>System Status</h4>
                    <span class="status-value" id="system-status-value">Checking...</span>
                </div>
                <div class="status-indicator" id="system-indicator"></div>
            </div>

            <div class="status-card" id="database-status">
                <div class="status-icon">
                    <i class="fas fa-database"></i>
                </div>
                <div class="status-info">
                    <h4>Database</h4>
                    <span class="status-value" id="database-status-value">Checking...</span>
                </div>
                <div class="status-indicator" id="database-indicator"></div>
            </div>

            <div class="status-card" id="api-status">
                <div class="status-icon">
                    <i class="fas fa-plug"></i>
                </div>
                <div class="status-info">
                    <h4>API Status</h4>
                    <span class="status-value" id="api-status-value">Checking...</span>
                </div>
                <div class="status-indicator" id="api-indicator"></div>
            </div>

            <div class="status-card" id="sync-status">
                <div class="status-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <div class="status-info">
                    <h4>Sync Status</h4>
                    <span class="status-value" id="sync-status-value">Checking...</span>
                </div>
                <div class="status-indicator" id="sync-indicator"></div>
            </div>
        </div>

        <!-- Performance Metrics -->
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-header">
                    <h4>Response Time</h4>
                    <span class="metric-value" id="response-time">-</span>
                </div>
                <canvas id="response-time-chart"></canvas>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <h4>Request Rate</h4>
                    <span class="metric-value" id="request-rate">-</span>
                </div>
                <canvas id="request-rate-chart"></canvas>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <h4>Error Rate</h4>
                    <span class="metric-value" id="error-rate">-</span>
                </div>
                <canvas id="error-rate-chart"></canvas>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <h4>Active Users</h4>
                    <span class="metric-value" id="active-users">-</span>
                </div>
                <canvas id="active-users-chart"></canvas>
            </div>
        </div>

        <!-- Alerts and Logs -->
        <div class="monitoring-bottom">
            <div class="alerts-section">
                <h4><i class="fas fa-exclamation-triangle"></i> Recent Alerts</h4>
                <div id="alerts-container" class="alerts-list">
                    <!-- Alerts will be populated here -->
                </div>
            </div>

            <div class="logs-section">
                <h4><i class="fas fa-file-alt"></i> Recent Logs</h4>
                <div id="logs-container" class="logs-list">
                    <!-- Logs will be populated here -->
                </div>
            </div>
        </div>
    </div>

    <script src="../js/core/monitoring.js"></script>
</body>
</html>
```

### 2. Monitoring JavaScript

#### monitoring.js
```javascript
// js/core/monitoring.js
class MonitoringDashboard {
  constructor() {
    this.charts = {};
    this.autoRefresh = false;
    this.refreshInterval = null;
    this.websocket = null;
  }

  async init() {
    try {
      this.setupEventListeners();
      this.initializeCharts();
      await this.loadInitialData();
      this.setupWebSocket();
      
      console.log('📊 Monitoring dashboard initialized');
    } catch (error) {
      console.error('❌ Failed to initialize monitoring dashboard:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshData();
    });

    document.getElementById('auto-refresh-btn').addEventListener('click', () => {
      this.toggleAutoRefresh();
    });

    document.getElementById('time-range').addEventListener('change', (e) => {
      this.changeTimeRange(e.target.value);
    });
  }

  initializeCharts() {
    const chartConfigs = {
      'response-time-chart': {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Response Time (ms)',
            data: [],
            borderColor: '#007BFF',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Milliseconds'
              }
            }
          }
        }
      },
      'request-rate-chart': {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Requests/sec',
            data: [],
            borderColor: '#28A745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            tension: 0.4
          }]
        }
      },
      'error-rate-chart': {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Errors/sec',
            data: [],
            borderColor: '#DC3545',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            tension: 0.4
          }]
        }
      },
      'active-users-chart': {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Active Users',
            data: [],
            borderColor: '#FFC107',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            tension: 0.4
          }]
        }
      }
    };

    Object.entries(chartConfigs).forEach(([id, config]) => {
      const ctx = document.getElementById(id).getContext('2d');
      this.charts[id] = new Chart(ctx, config);
    });
  }

  async loadInitialData() {
    await Promise.all([
      this.updateSystemStatus(),
      this.updateMetrics(),
      this.updateAlerts(),
      this.updateLogs()
    ]);
  }

  async updateSystemStatus() {
    try {
      const response = await fetch('/api/health');
      const health = await response.json();
      
      this.updateStatusCard('system', health.status, health.status);
      this.updateStatusCard('database', health.checks.database?.status || 'unknown', 
                           health.checks.database?.responseTime || '-');
      this.updateStatusCard('api', health.status, `${health.uptime.toFixed(0)}s uptime`);
      
      // Update sync status from cloud sync manager
      if (window.CloudSync) {
        const syncStatus = window.CloudSync.isOnline ? 'healthy' : 'offline';
        this.updateStatusCard('sync', syncStatus, window.CloudSync.lastSyncTime || 'Never');
      }
      
    } catch (error) {
      console.error('Failed to update system status:', error);
      this.updateStatusCard('system', 'error', 'Connection failed');
    }
  }

  updateStatusCard(type, status, value) {
    const statusValue = document.getElementById(`${type}-status-value`);
    const indicator = document.getElementById(`${type}-indicator`);
    
    if (statusValue) statusValue.textContent = value;
    
    if (indicator) {
      indicator.className = 'status-indicator';
      switch(status) {
        case 'healthy':
        case 'online':
          indicator.classList.add('status-healthy');
          break;
        case 'warning':
        case 'degraded':
          indicator.classList.add('status-warning');
          break;
        case 'error':
        case 'unhealthy':
        case 'offline':
          indicator.classList.add('status-error');
          break;
        default:
          indicator.classList.add('status-unknown');
      }
    }
  }

  async updateMetrics() {
    try {
      // Simulate metrics data (in real implementation, fetch from Prometheus/backend)
      const now = new Date();
      const timeLabels = Array.from({length: 20}, (_, i) => {
        const time = new Date(now.getTime() - (19 - i) * 60000);
        return time.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
      });

      // Response time data
      const responseTimeData = Array.from({length: 20}, () => 
        Math.random() * 500 + 100);
      this.updateChart('response-time-chart', timeLabels, responseTimeData);
      document.getElementById('response-time').textContent = 
        `${responseTimeData[responseTimeData.length - 1].toFixed(0)}ms`;

      // Request rate data
      const requestRateData = Array.from({length: 20}, () => 
        Math.random() * 10 + 5);
      this.updateChart('request-rate-chart', timeLabels, requestRateData);
      document.getElementById('request-rate').textContent = 
        `${requestRateData[requestRateData.length - 1].toFixed(1)}/sec`;

      // Error rate data
      const errorRateData = Array.from({length: 20}, () => 
        Math.random() * 2);
      this.updateChart('error-rate-chart', timeLabels, errorRateData);
      document.getElementById('error-rate').textContent = 
        `${errorRateData[errorRateData.length - 1].toFixed(2)}/sec`;

      // Active users data
      const activeUsersData = Array.from({length: 20}, () => 
        Math.floor(Math.random() * 50 + 10));
      this.updateChart('active-users-chart', timeLabels, activeUsersData);
      document.getElementById('active-users').textContent = 
        activeUsersData[activeUsersData.length - 1];

    } catch (error) {
      console.error('Failed to update metrics:', error);
    }
  }

  updateChart(chartId, labels, data) {
    const chart = this.charts[chartId];
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update('none');
    }
  }

  async updateAlerts() {
    const alertsContainer = document.getElementById('alerts-container');
    
    // Simulate alerts (in real implementation, fetch from AlertManager)
    const alerts = [
      {
        id: 1,
        severity: 'warning',
        message: 'High response time detected',
        timestamp: new Date(Date.now() - 300000),
        resolved: false
      },
      {
        id: 2,
        severity: 'info',
        message: 'Scheduled maintenance completed',
        timestamp: new Date(Date.now() - 3600000),
        resolved: true
      }
    ];

    alertsContainer.innerHTML = alerts.map(alert => `
      <div class="alert-item ${alert.resolved ? 'resolved' : alert.severity}">
        <div class="alert-icon">
          <i class="fas fa-${this.getAlertIcon(alert.severity)}"></i>
        </div>
        <div class="alert-content">
          <div class="alert-message">${alert.message}</div>
          <div class="alert-time">${this.formatTime(alert.timestamp)}</div>
        </div>
        <div class="alert-status">
          ${alert.resolved ? 'Resolved' : 'Active'}
        </div>
      </div>
    `).join('');
  }

  async updateLogs() {
    const logsContainer = document.getElementById('logs-container');
    
    // Simulate recent logs
    const logs = [
      {
        level: 'info',
        message: 'User login successful',
        timestamp: new Date(Date.now() - 120000),
        userId: 'user123'
      },
      {
        level: 'error',
        message: 'Database connection timeout',
        timestamp: new Date(Date.now() - 180000),
        service: 'database'
      },
      {
        level: 'warn',
        message: 'Slow query detected',
        timestamp: new Date(Date.now() - 240000),
        query: 'SELECT * FROM contracts...'
      }
    ];

    logsContainer.innerHTML = logs.map(log => `
      <div class="log-item ${log.level}">
        <div class="log-level">
          <i class="fas fa-${this.getLogIcon(log.level)}"></i>
          ${log.level.toUpperCase()}
        </div>
        <div class="log-content">
          <div class="log-message">${log.message}</div>
          <div class="log-time">${this.formatTime(log.timestamp)}</div>
        </div>
      </div>
    `).join('');
  }

  getAlertIcon(severity) {
    switch(severity) {
      case 'critical': return 'exclamation-circle';
      case 'warning': return 'exclamation-triangle';
      case 'info': return 'info-circle';
      default: return 'question-circle';
    }
  }

  getLogIcon(level) {
    switch(level) {
      case 'error': return 'times-circle';
      case 'warn': return 'exclamation-triangle';
      case 'info': return 'info-circle';
      case 'debug': return 'bug';
      default: return 'file-alt';
    }
  }

  format# 📊 Monitoring & Observability Guide - RC Construções

## 📋 Visão Geral

Este guia apresenta a estratégia completa de monitoramento, logging e observabilidade para o sistema RC Construções. O sistema implementa uma arquitetura robusta de monitoramento que permite acompanhar a saúde, performance e uso da aplicação em tempo real.

## 🏗️ Arquitetura de Monitoramento

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │────│    Prometheus   │────│     Grafana     │
│   (Metrics)     │    │   (Collection)  │    │  (Visualization)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Logs       │    │   AlertManager  │    │    Dashboards   │
│   (Winston)     │    │   (Alerting)    │    │   (Reports)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📈 Métricas e KPIs

### 1. Métricas de Aplicação

#### Performance Metrics
- **Response Time**: Tempo de resposta das APIs
- **Throughput**: Requisições por segundo
- **Error Rate**: Taxa de erros por endpoint
- **Database Response Time**: Tempo de resposta do banco

#### Business Metrics
- **User Activity**: Usuários ativos por período
- **Feature Usage**: Uso de funcionalidades específicas
- **Data Growth**: Crescimento de dados (clientes, contratos)
- **Sync Performance**: Performance da sincronização

#### System Metrics
- **CPU Usage**: Uso de processador
- **Memory Usage**: Uso de memória
- **Disk Usage**: Uso de disco
- **Network I/O**: Tráfego de rede

### 2. Health Checks

#### Endpoint de Saúde
```javascript
// backend/routes/health.js
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

router.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
        checks: {}
    };

    try {
        // Database Check
        health.checks.database = await checkDatabase();
        
        // Redis Check
        health.checks.redis = await checkRedis();
        
        // External APIs Check
        health.checks.external = await checkExternalAPIs();
        
        // Memory Check
        health.checks.memory = checkMemoryUsage();
        
        // Disk Check
        health.checks.disk = await checkDiskSpace();

        // Determine overall status
        const allHealthy = Object.values(health.checks)
            .every(check => check.status === 'healthy');
            
        health.status = allHealthy ? 'healthy' : 'degraded';
        
        const statusCode = allHealthy ? 200 : 503;
        res.status(statusCode).json(health);
        
    } catch (error) {
        logger.error('Health check failed:', error);
        health.status = 'unhealthy';
        health.error = error.message;
        res.status(503).json(health);
    }
});

async function checkDatabase() {
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        const responseTime = Date.now() - start;
        
        return {
            status: 'healthy',
            responseTime: `${responseTime}ms`,
            message: 'Database connection successful'
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            message: 'Database connection failed'
        };
    }
}

async function checkRedis() {
    try {
        const start = Date.now();
        await redis.ping();
        const responseTime = Date.now() - start;
        
        return {
            status: 'healthy',
            responseTime: `${responseTime}ms`,
            message: 'Redis connection successful'
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            message: 'Redis connection failed'
        };
    }
}

function checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    const memoryUsagePercent = (usedMem / totalMem) * 100;
    
    return {
        status: memoryUsagePercent < 90 ? 'healthy' : 'warning',
        usage: `${memoryUsagePercent.toFixed(2)}%`,
        details: {
            heapUsed: `${Math.round(usedMem / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(totalMem / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
        }
    };
}

module.exports = router;
```

## 📊 Prometheus Configuration

### 1. Prometheus Setup

#### prometheus.yml
```yaml
# monitoring/config/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # RC Construções Application
  - job_name: 'rc-construcoes-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
    scrape_interval: 5s
    scrape_timeout: 3s

  # Nginx Metrics
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']

  # PostgreSQL Metrics
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis Metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Node Exporter (System Metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # Docker Metrics
  - job_name: 'docker'
    static_configs:
      - targets: ['cadvisor:8080']
```

### 2. Application Metrics

#### Metrics Middleware
```javascript
// backend/middleware/metrics.js
const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'rc-construcoes'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Custom Metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeUsers = new promClient.Gauge({
  name: 'active_users_total',
  help: 'Number of active users'
});

const databaseConnections = new promClient.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

const syncOperations = new promClient.Counter({
  name: 'sync_operations_total',
  help: 'Total number of sync operations',
  labelNames: ['type', 'status']
});

const businessMetrics = {
  clients: new promClient.Gauge({
    name: 'business_clients_total',
    help: 'Total number of clients'
  }),
  contracts: new promClient.Gauge({
    name: 'business_contracts_total',
    help: 'Total number of contracts',
    labelNames: ['status']
  }),
  revenue: new promClient.Gauge({
    name: 'business_revenue_total',
    help: 'Total revenue in current period'
  })
};

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeUsers);
register.registerMetric(databaseConnections);
register.registerMetric(syncOperations);
Object.values(businessMetrics).forEach(metric => register.registerMetric(metric));

// Middleware function
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
      
    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
}

// Business metrics update functions
function updateBusinessMetrics() {
  // This would be called periodically or on data changes
  // Example implementation:
  setInterval(async () => {
    try {
      const clientCount = await db.query('SELECT COUNT(*) FROM clients');
      businessMetrics.clients.set(parseInt(clientCount.rows[0].count));
      
      const contractsByStatus = await db.query(`
        SELECT status, COUNT(*) as count 
        FROM contracts 
        GROUP BY status
      `);
      
      contractsByStatus.rows.forEach(row => {
        businessMetrics.contracts.labels(row.status).set(parseInt(row.count));
      });
      
      // Update other business metrics...
    } catch (error) {
      console.error('Error updating business metrics:', error);
    }
  }, 30000); // Update every 30 seconds
}

module.exports = {
  metricsMiddleware,
  register,
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    activeUsers,
    databaseConnections,
    syncOperations,
    businessMetrics
  },
  updateBusinessMetrics
};
```

## 🚨 Alert Rules

### 1. Prometheus Alerts

#### alerts.yml
```yaml
# monitoring/config/alerts.yml
groups:
  - name: rc-construcoes-alerts
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
          service: rc-construcoes
        annotations:
          summary: "Alta taxa de erro na aplicação RC Construções"
          description: "Taxa de erro de {{ $value }} requisições/seg nos últimos 5 minutos"

      # High Response Time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
          service: rc-construcoes
        annotations:
          summary: "Tempo de resposta elevado"
          description: "95% das requisições estão levando mais de 2 segundos"

      # Database Down
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
          service: database
        annotations:
          summary: "Banco de dados indisponível"
          description: "O banco de dados PostgreSQL está fora do ar"

      # Redis Down
      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
          service: redis
        annotations:
          summary: "Redis indisponível"
          description: "O serviço Redis está fora do ar"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
          service: system
        annotations:
          summary: "Uso de memória elevado"
          description: "Uso de memória está em {{ $value | humanizePercentage }}"

      # High Disk Usage
      - alert: HighDiskUsage
        expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.8
        for: 5m
        labels:
          severity: warning
          service: system
        annotations:
          summary: "Uso de disco elevado"
          description: "Uso de disco está em {{ $value | humanizePercentage }}"

      # Sync Failures
      - alert: SyncFailures
        expr: rate(sync_operations_total{status="failed"}[10m]) > 0.1
        for: 5m
        labels:
          severity: warning
          service: sync
        annotations:
          summary: "Falhas na sincronização"
          description: "{{ $value }} falhas de sincronização por segundo"

      # Low Active Users (Business Alert)
      - alert: LowActiveUsers
        expr: active_users_total < 1
        for: 10m
        labels:
          severity: info
          service: business
        annotations:
          summary: "Baixa atividade de usuários"
          description: "Apenas {{ $value }} usuários ativos no sistema"
```

### 2. AlertManager Configuration

#### alertmanager.yml
```yaml
# monitoring/config/alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@rc-construcoes.com'
  smtp_auth_username: 'alerts@rc-construcoes.com'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      repeat_interval: 30m
    - match:
        severity: warning
      receiver: 'warning-alerts'
      repeat_interval: 2h
    - match:
        severity: info
      receiver: 'info-alerts'
      repeat_interval: 24h

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://webhook-endpoint/alert'

  - name: 'critical-alerts'
    email_configs:
      - to: 'admin@rc-construcoes.com'
        subject: '[CRÍTICO] {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alerta: {{ .Annotations.summary }}
          Descrição: {{ .Annotations.description }}
          Severity: {{ .Labels.severity }}
          Horário: {{ .StartsAt }}
          {{ end }}
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts-critical'
        title: 'Alerta Crítico - RC Construções'
        text: |
          {{ range .Alerts }}
          🚨 *{{ .Annotations.summary }}*
          {{ .Annotations.description }}
          {{ end }}

  - name: 'warning-alerts'
    email_configs:
      - to: 'dev-team@rc-construcoes.com'
        subject: '[WARNING] {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alerta: {{ .Annotations.summary }}
          Descrição: {{ .Annotations.description }}
          {{ end }}

  - name: 'info-alerts'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts-info'
        text: |
          {{ range .Alerts }}
          ℹ️ {{ .Annotations.summary }}
          {{ end }}
```

## 📈 Grafana Dashboards

### 1. Main Dashboard

#### RC Construções Overview Dashboard
```json
{
  "dashboard": {
    "id": null,
    "title": "RC Construções - Overview",
    "tags": ["rc-construcoes", "overview"],
    "timezone": "America/Sao_Paulo",
    "refresh": "30s",
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "panels": [
      {
        "id": 1,
        "title": "System Health",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "up{job=\"rc-construcoes-backend\"}",
            "legendFormat": "Backend"
          },
          {
            "expr": "up{job=\"postgres\"}",
            "legendFormat": "Database"
          },
          {
            "expr": "up{job=\"redis\"}",
            "legendFormat": "Redis"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {"mode": "thresholds"},
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "green", "value": 1}
              ]
            },
            "mappings": [
              {"options": {"0": {"text": "Down"}}, "type": "value"},
              {"options": {"1": {"text": "Up"}}, "type": "value"}
            ]
          }
        }
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 6, "y": 0},
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests/sec",
            "min": 0
          }
        ]
      },
      {
        "id": 3,
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "Seconds",
            "min": 0
          }
        ]
      },
      {
        "id": 4,
        "title": "Error Rate",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"4..\"}[5m])",
            "legendFormat": "4xx errors"
          },
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ],
        "yAxes": [
          {
            "label": "Errors/sec",
            "min": 0
          }
        ]
      },
      {
        "id": 5,
        "title": "Business Metrics",
        "type": "stat",
        "gridPos": {"h": 6, "w": 24, "x": 0, "y": 16},
        "targets": [
          {
            "expr": "business_clients_total",
            "legendFormat": "Total Clients"
          },
          {
            "expr": "sum(business_contracts_total)",
            "legendFormat": "Total Contracts"
          },
          {
            "expr": "business_revenue_total",
            "legendFormat": "Revenue (BRL)"
          },
          {
            "expr": "active_users_total",
            "legendFormat": "Active Users"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {"mode": "palette-classic"},
            "unit": "short"
          },
          "overrides": [
            {
              "matcher": {"id": "byName", "options": "Revenue (BRL)"},
              "properties": [
                {"id": "unit", "value": "currencyBRL"}
              ]
            }
          ]
        }
      }
    ]
  }
}
```

### 2. Performance Dashboard

#### performance-dashboard.json
```json
{
  "dashboard": {
    "title": "RC Construções - Performance",
    "panels": [
      {
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "100 - (avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "CPU Usage %"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100",
            "legendFormat": "Memory Usage %"
          }
        ]
      },
      {
        "title": "Database Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "postgres_stat_database_tup_inserted",
            "legendFormat": "Inserts"
          },
          {
            "expr": "postgres_stat_database_tup_updated",
            "legendFormat": "Updates"
          },
          {
            "expr": "postgres_stat_database_tup_deleted",
            "legendFormat": "Deletes"
          }
        ]
      },
      {
        "title": "Network I/O",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(node_network_receive_bytes_total[5m])",
            "legendFormat": "Network In"
          },
          {
            "expr": "rate(node_network_transmit_bytes_total[5m])",
            "legendFormat": "Network Out"
          }
        ]
      }
    ]
  }
}
```

## 📝 Logging Strategy

### 1. Log Levels and Structure

#### Winston Configuration (já implementado)
```javascript
// backend/config/logger.js - Melhorado
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: 'rc-construcoes',
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version,
      ...meta
    });
  })
);

// Enhanced transports
const transports = [
  // Console (development)
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'development' 
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      : structuredFormat
  }),

  // Application logs
  new DailyRotateFile({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: structuredFormat,
    level: 'info'
  }),

  // Error logs
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: structuredFormat,
    level: 'error'
  }),

  // Audit logs (user actions)
  new DailyRotateFile({
    filename: 'logs/audit-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '90d',
    format: structuredFormat,
    level: 'info'
  })
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports
});

// Helper methods for specific log types
logger.audit = (action, userId, details) => {
  logger.info('User action', {
    type: 'audit',
    action,
    userId,
    details,
    ip: details.ip,
    userAgent: details.userAgent
  });
};

logger.business = (event, data) => {
  logger.info('Business event', {
    type: 'business',
    event,
    data
  });
};

logger.performance = (operation, duration, metadata) => {
  logger.info('Performance metric', {
    type: 'performance',
    operation,
    duration,
    metadata
  });
};

module.exports = logger;
```

### 2. Log Aggregation

#### ELK Stack Configuration (Optional)
```yaml
# monitoring/elk/docker-compose.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    ports:
      - "5044:5044"
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

## 🔍 Error Tracking

### 1. Sentry Integration

#### Frontend Error Tracking
```javascript
// js/core/error-tracking.js
class ErrorTrackingManager {
  constructor() {
    this.isInitialized = false;
    this.errors = [];
    this.maxErrors = 100;
  }

  async init() {
    try {
      if (window.Sentry) {
        window.Sentry.init({
          dsn: 'YOUR_SENTRY_DSN',
          environment: window.location.hostname === 'localhost' ? 'development' : 'production',
          integrations: [
            new window.Sentry.Integrations.BrowserTracing(),
          ],
          tracesSampleRate: 0.1,
          beforeSend: (event) => {
            // Filter out non-critical errors
            if (event.exception) {
              const error = event.exception.values[0];
              if (error.type === 'ChunkLoadError') {
                return null; // Ignore chunk loading errors
              }
            }
            return event;
          }
        });
        
        this.isInitialized = true;
        console.log('✅ Error tracking initialized');
      } else {
        // Fallback to local error collection
        this.setupLocalErrorTracking();
      }
    } catch (error) {
      console.warn('⚠️ Error tracking initialization failed:', error);
      this.setupLocalErrorTracking();
    }
  }

  setupLocalErrorTracking() {
    window.addEventListener('error', (event) => {
      this.captureError(event.error, {
        type: 'javascript',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(event.reason, {
        type: 'promise_rejection'
      });
    });
  }

  captureError(error, context = {}) {
    const errorData = {
      id: 'error-' + Date.now() + '-' + Math.random().toString(36).substring(2),
      timestamp: new Date().toISOString(),
      message: error.message || error,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: window.Auth?.getCurrentUser()?.id,
      context
    };

    if (this.isInitialized && window.Sentry) {
      window.Sentry.captureException(error, {
        tags: context,
        user: {
          id: window.Auth?.getCurrentUser()?.id,
          email: window.Auth?.getCurrentUser()?.email
        }
      });
    } else {
      // Store locally
      this.errors.push(errorData);
      if (this.errors.length > this.maxErrors) {
        this.errors.shift();
      }
      
      // Try to send to backend
      this.sendErrorToBackend(errorData);
    }

    console.error('🔥 Error captured:', errorData);
  }

  async sendErrorToBackend(errorData) {
    try {