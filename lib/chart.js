/*!
 * Chart.js Simplified v1.0 - RC Construções
 * Implementação básica dos gráficos mais usados
 */
(function(global) {
    'use strict';

    // Chart.js Simplified Implementation
    class Chart {
        constructor(ctx, config) {
            this.ctx = ctx;
            this.canvas = ctx.canvas;
            this.config = config;
            this.data = config.data || {};
            this.options = config.options || {};
            this.type = config.type;
            
            this.width = this.canvas.width;
            this.height = this.canvas.height;
            this.centerX = this.width / 2;
            this.centerY = this.height / 2;
            
            this.colors = [
                '#FF6B35', '#00D2FF', '#FFD700', '#3742FA', '#00E676',
                '#FF4757', '#7B68EE', '#FF6347', '#40E0D0', '#DA70D6'
            ];
            
            this.render();
        }

        render() {
            this.clear();
            
            switch (this.type) {
                case 'line':
                    this.renderLineChart();
                    break;
                case 'bar':
                    this.renderBarChart();
                    break;
                case 'doughnut':
                case 'pie':
                    this.renderDoughnutChart();
                    break;
                case 'polarArea':
                    this.renderPolarChart();
                    break;
                case 'radar':
                    this.renderRadarChart();
                    break;
                default:
                    console.warn('Chart type not supported:', this.type);
            }
            
            if (this.options.plugins?.legend?.display !== false) {
                this.renderLegend();
            }
        }

        clear() {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }

        renderLineChart() {
            const { labels, datasets } = this.data;
            if (!labels || !datasets) return;

            const padding = 60;
            const chartWidth = this.width - 2 * padding;
            const chartHeight = this.height - 2 * padding - 40; // Space for legend
            
            // Calculate max value for scaling
            const allValues = datasets.flatMap(d => d.data);
            const maxValue = Math.max(...allValues);
            const minValue = Math.min(...allValues, 0);
            const range = maxValue - minValue;
            
            // Draw grid
            this.ctx.strokeStyle = '#3A3F58';
            this.ctx.lineWidth = 1;
            
            // Horizontal grid lines
            for (let i = 0; i <= 5; i++) {
                const y = padding + (chartHeight / 5) * i;
                this.ctx.beginPath();
                this.ctx.moveTo(padding, y);
                this.ctx.lineTo(padding + chartWidth, y);
                this.ctx.stroke();
                
                // Y-axis labels
                const value = maxValue - (range / 5) * i;
                this.ctx.fillStyle = '#B0B3B8';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(this.formatValue(value), padding - 10, y + 4);
            }
            
            // Vertical grid lines
            const stepX = chartWidth / (labels.length - 1);
            for (let i = 0; i < labels.length; i++) {
                const x = padding + stepX * i;
                this.ctx.beginPath();
                this.ctx.moveTo(x, padding);
                this.ctx.lineTo(x, padding + chartHeight);
                this.ctx.stroke();
                
                // X-axis labels
                this.ctx.fillStyle = '#B0B3B8';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(labels[i], x, this.height - 20);
            }
            
            // Draw datasets
            datasets.forEach((dataset, datasetIndex) => {
                const color = dataset.borderColor || this.colors[datasetIndex % this.colors.length];
                this.ctx.strokeStyle = color;
                this.ctx.fillStyle = dataset.backgroundColor || this.hexToRgba(color, 0.2);
                this.ctx.lineWidth = dataset.borderWidth || 2;
                
                // Draw line
                this.ctx.beginPath();
                dataset.data.forEach((value, index) => {
                    const x = padding + stepX * index;
                    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
                    
                    if (index === 0) {
                        this.ctx.moveTo(x, y);
                    } else {
                        this.ctx.lineTo(x, y);
                    }
                });
                this.ctx.stroke();
                
                // Fill area if specified
                if (dataset.fill) {
                    this.ctx.lineTo(padding + stepX * (dataset.data.length - 1), padding + chartHeight);
                    this.ctx.lineTo(padding, padding + chartHeight);
                    this.ctx.closePath();
                    this.ctx.fill();
                }
                
                // Draw points
                dataset.data.forEach((value, index) => {
                    const x = padding + stepX * index;
                    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
                    
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, dataset.pointRadius || 4, 0, 2 * Math.PI);
                    this.ctx.fill();
                });
            });
        }

        renderBarChart() {
            const { labels, datasets } = this.data;
            if (!labels || !datasets) return;

            const padding = 60;
            const chartWidth = this.width - 2 * padding;
            const chartHeight = this.height - 2 * padding - 40;
            
            const allValues = datasets.flatMap(d => d.data);
            const maxValue = Math.max(...allValues);
            const barWidth = chartWidth / labels.length * 0.8;
            const barSpacing = chartWidth / labels.length * 0.2;
            
            // Draw grid and axes (similar to line chart)
            this.ctx.strokeStyle = '#3A3F58';
            this.ctx.lineWidth = 1;
            
            for (let i = 0; i <= 5; i++) {
                const y = padding + (chartHeight / 5) * i;
                this.ctx.beginPath();
                this.ctx.moveTo(padding, y);
                this.ctx.lineTo(padding + chartWidth, y);
                this.ctx.stroke();
                
                const value = maxValue - (maxValue / 5) * i;
                this.ctx.fillStyle = '#B0B3B8';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(this.formatValue(value), padding - 10, y + 4);
            }
            
            // Draw bars
            datasets.forEach((dataset, datasetIndex) => {
                const color = dataset.backgroundColor || this.colors[datasetIndex % this.colors.length];
                
                dataset.data.forEach((value, index) => {
                    const barHeight = (value / maxValue) * chartHeight;
                    const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
                    const y = padding + chartHeight - barHeight;
                    
                    this.ctx.fillStyle = Array.isArray(color) ? color[index] : color;
                    this.ctx.fillRect(x, y, barWidth, barHeight);
                    
                    // Draw border if specified
                    if (dataset.borderColor) {
                        this.ctx.strokeStyle = dataset.borderColor;
                        this.ctx.lineWidth = dataset.borderWidth || 1;
                        this.ctx.strokeRect(x, y, barWidth, barHeight);
                    }
                });
            });
            
            // X-axis labels
            labels.forEach((label, index) => {
                const x = padding + index * (barWidth + barSpacing) + barSpacing / 2 + barWidth / 2;
                this.ctx.fillStyle = '#B0B3B8';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(label, x, this.height - 20);
            });
        }

        renderDoughnutChart() {
            const { labels, datasets } = this.data;
            if (!labels || !datasets || !datasets[0]) return;

            const dataset = datasets[0];
            const total = dataset.data.reduce((sum, value) => sum + value, 0);
            const radius = Math.min(this.width, this.height) / 2 - 40;
            const innerRadius = this.type === 'doughnut' ? radius * 0.6 : 0;
            
            let currentAngle = -Math.PI / 2; // Start at top
            
            dataset.data.forEach((value, index) => {
                const sliceAngle = (value / total) * 2 * Math.PI;
                const color = dataset.backgroundColor?.[index] || this.colors[index % this.colors.length];
                
                // Draw slice
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(this.centerX, this.centerY, radius, currentAngle, currentAngle + sliceAngle);
                if (innerRadius > 0) {
                    this.ctx.arc(this.centerX, this.centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
                } else {
                    this.ctx.lineTo(this.centerX, this.centerY);
                }
                this.ctx.closePath();
                this.ctx.fill();
                
                // Draw border
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                
                currentAngle += sliceAngle;
            });
        }

        renderPolarChart() {
            const { labels, datasets } = this.data;
            if (!labels || !datasets || !datasets[0]) return;

            const dataset = datasets[0];
            const maxValue = Math.max(...dataset.data);
            const radius = Math.min(this.width, this.height) / 2 - 40;
            const angleStep = (2 * Math.PI) / dataset.data.length;
            
            // Draw grid circles
            this.ctx.strokeStyle = '#3A3F58';
            this.ctx.lineWidth = 1;
            for (let i = 1; i <= 5; i++) {
                this.ctx.beginPath();
                this.ctx.arc(this.centerX, this.centerY, (radius / 5) * i, 0, 2 * Math.PI);
                this.ctx.stroke();
            }
            
            // Draw segments
            dataset.data.forEach((value, index) => {
                const segmentRadius = (value / maxValue) * radius;
                const startAngle = angleStep * index - Math.PI / 2;
                const endAngle = angleStep * (index + 1) - Math.PI / 2;
                const color = dataset.backgroundColor?.[index] || this.colors[index % this.colors.length];
                
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(this.centerX, this.centerY, segmentRadius, startAngle, endAngle);
                this.ctx.lineTo(this.centerX, this.centerY);
                this.ctx.closePath();
                this.ctx.fill();
                
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            });
        }

        renderRadarChart() {
            const { labels, datasets } = this.data;
            if (!labels || !datasets) return;

            const radius = Math.min(this.width, this.height) / 2 - 60;
            const angleStep = (2 * Math.PI) / labels.length;
            
            // Find max value across all datasets
            const allValues = datasets.flatMap(d => d.data);
            const maxValue = Math.max(...allValues);
            
            // Draw grid
            this.ctx.strokeStyle = '#3A3F58';
            this.ctx.lineWidth = 1;
            
            // Draw concentric polygons
            for (let i = 1; i <= 5; i++) {
                const gridRadius = (radius / 5) * i;
                this.ctx.beginPath();
                for (let j = 0; j < labels.length; j++) {
                    const angle = angleStep * j - Math.PI / 2;
                    const x = this.centerX + Math.cos(angle) * gridRadius;
                    const y = this.centerY + Math.sin(angle) * gridRadius;
                    
                    if (j === 0) {
                        this.ctx.moveTo(x, y);
                    } else {
                        this.ctx.lineTo(x, y);
                    }
                }
                this.ctx.closePath();
                this.ctx.stroke();
            }
            
            // Draw axis lines and labels
            for (let i = 0; i < labels.length; i++) {
                const angle = angleStep * i - Math.PI / 2;
                const x = this.centerX + Math.cos(angle) * radius;
                const y = this.centerY + Math.sin(angle) * radius;
                
                this.ctx.beginPath();
                this.ctx.moveTo(this.centerX, this.centerY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
                
                // Draw labels
                const labelX = this.centerX + Math.cos(angle) * (radius + 20);
                const labelY = this.centerY + Math.sin(angle) * (radius + 20);
                this.ctx.fillStyle = '#B0B3B8';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(labels[i], labelX, labelY);
            }
            
            // Draw datasets
            datasets.forEach((dataset, datasetIndex) => {
                const color = dataset.borderColor || this.colors[datasetIndex % this.colors.length];
                const fillColor = dataset.backgroundColor || this.hexToRgba(color, 0.2);
                
                // Draw filled area
                this.ctx.fillStyle = fillColor;
                this.ctx.beginPath();
                dataset.data.forEach((value, index) => {
                    const angle = angleStep * index - Math.PI / 2;
                    const pointRadius = (value / maxValue) * radius;
                    const x = this.centerX + Math.cos(angle) * pointRadius;
                    const y = this.centerY + Math.sin(angle) * pointRadius;
                    
                    if (index === 0) {
                        this.ctx.moveTo(x, y);
                    } else {
                        this.ctx.lineTo(x, y);
                    }
                });
                this.ctx.closePath();
                this.ctx.fill();
                
                // Draw border
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = dataset.borderWidth || 2;
                this.ctx.stroke();
                
                // Draw points
                dataset.data.forEach((value, index) => {
                    const angle = angleStep * index - Math.PI / 2;
                    const pointRadius = (value / maxValue) * radius;
                    const x = this.centerX + Math.cos(angle) * pointRadius;
                    const y = this.centerY + Math.sin(angle) * pointRadius;
                    
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
                    this.ctx.fill();
                });
            });
        }

        renderLegend() {
            const legendY = this.height - 30;
            const { datasets } = this.data;
            
            if (!datasets) return;
            
            let totalWidth = 0;
            const legendItems = datasets.map((dataset, index) => {
                const color = dataset.borderColor || dataset.backgroundColor || this.colors[index % this.colors.length];
                const label = dataset.label || `Dataset ${index + 1}`;
                
                this.ctx.font = '12px Arial';
                const textWidth = this.ctx.measureText(label).width;
                const itemWidth = 20 + textWidth + 20; // icon + text + spacing
                
                totalWidth += itemWidth;
                
                return { color, label, width: itemWidth };
            });
            
            let startX = (this.width - totalWidth) / 2;
            
            legendItems.forEach(item => {
                // Draw color box
                this.ctx.fillStyle = item.color;
                this.ctx.fillRect(startX, legendY - 8, 12, 12);
                
                // Draw label
                this.ctx.fillStyle = '#B0B3B8';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(item.label, startX + 16, legendY + 2);
                
                startX += item.width;
            });
        }

        update() {
            this.render();
        }

        destroy() {
            this.clear();
            this.ctx = null;
            this.canvas = null;
            this.config = null;
            this.data = null;
            this.options = null;
        }

        formatValue(value) {
            if (typeof value === 'number') {
                if (value >= 1000) {
                    return 'R$ ' + (value / 1000).toFixed(1) + 'k';
                }
                return 'R$ ' + value.toFixed(0);
            }
            return value;
        }

        hexToRgba(hex, alpha) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            if (!result) return hex;
            
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
    }

    // Chart.js Defaults
    Chart.defaults = {
        responsive: true,
        maintainAspectRatio: false,
        font: {
            family: 'Inter, sans-serif',
            size: 12
        },
        color: '#B0B3B8',
        borderColor: '#3A3F58',
        backgroundColor: '#1A1A2E',
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        }
    };

    // Register Chart globally
    if (typeof module === 'object' && module.exports) {
        module.exports = Chart;
    } else {
        global.Chart = Chart;
    }

})(typeof window !== 'undefined' ? window : this);