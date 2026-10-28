/**
 * analytics.js  –  SmartBoard
 * Renders stat counters and three Chart.js charts:
 *   1. Donut  – task status distribution
 *   2. Bar    – tasks by priority
 *   3. Horizontal bar – tasks per category
 */

import { state } from './app.js';

/* ═══════════════════════════════════════════════
   CHART INSTANCE CACHE  (destroy before re-create)
═══════════════════════════════════════════════ */
const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

/* ═══════════════════════════════════════════════
   THEME-AWARE COLORS
═══════════════════════════════════════════════ */
function themeColors() {
  const dark = document.documentElement.classList.contains('dark');
  return {
    text:    dark ? '#94a3b8' : '#64748b',
    grid:    dark ? '#253047' : '#e2e8f0',
    bg:      dark ? '#1e2535' : '#ffffff',
    tooltip: dark ? '#161b27' : '#f8fafc',
  };
}

const STATUS_COLORS = {
  'Backlog':     '#6366f1',
  'To Do':       '#3b82f6',
  'In Progress': '#f59e0b',
  'Review':      '#8b5cf6',
  'Done':        '#10b981',
};

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

const CATEGORY_COLORS = {
  frontend: '#8b5cf6',
  backend:  '#3b82f6',
  design:   '#ec4899',
  devops:   '#14b8a6',
  qa:       '#84cc16',
};

/* ═══════════════════════════════════════════════
   STAT COUNTERS
═══════════════════════════════════════════════ */
function renderStats() {
  const today = new Date(); today.setHours(0,0,0,0);

  const total      = state.tasks.length;
  const doneColIds = state.columns.filter(c => c.title.toLowerCase() === 'done').map(c => c.id);
  const inProgIds  = state.columns.filter(c => c.title.toLowerCase().includes('progress')).map(c => c.id);

  const done       = state.tasks.filter(t => doneColIds.includes(t.columnId)).length;
  const inProgress = state.tasks.filter(t => inProgIds.includes(t.columnId)).length;
  const overdue    = state.tasks.filter(t => {
    if (!t.deadline) return false;
    const due = new Date(t.deadline);
    return due < today && !doneColIds.includes(t.columnId);
  }).length;

  document.getElementById('statTotal').textContent      = total;
  document.getElementById('statDone').textContent       = done;
  document.getElementById('statInProgress').textContent = inProgress;
  document.getElementById('statOverdue').textContent    = overdue;
}

/* ═══════════════════════════════════════════════
   CHART 1 – STATUS DONUT
═══════════════════════════════════════════════ */
function renderStatusChart() {
  destroyChart('status');
  const tc = themeColors();

  const labels = state.columns.map(c => c.title);
  const data   = state.columns.map(c => state.tasks.filter(t => t.columnId === c.id).length);
  const bgColors = labels.map(l => STATUS_COLORS[l] || '#6b7280');

  const ctx = document.getElementById('statusChart');
  charts['status'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: tc.bg,
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tc.text, font: { size: 11 }, padding: 10, boxWidth: 10, boxHeight: 10 },
        },
        tooltip: {
          backgroundColor: tc.tooltip,
          titleColor: tc.text,
          bodyColor: tc.text,
          borderColor: tc.grid,
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total ? Math.round(ctx.parsed / total * 100) : 0;
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        },
      },
    },
  });
}

/* ═══════════════════════════════════════════════
   CHART 2 – PRIORITY BAR
═══════════════════════════════════════════════ */
function renderPriorityChart() {
  destroyChart('priority');
  const tc = themeColors();

  const priorities = ['critical', 'high', 'medium', 'low'];
  const data = priorities.map(p => state.tasks.filter(t => t.priority === p).length);

  const ctx = document.getElementById('priorityChart');
  charts['priority'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{
        label: 'Tasks',
        data,
        backgroundColor: priorities.map(p => PRIORITY_COLORS[p]),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tc.tooltip,
          titleColor: tc.text,
          bodyColor: tc.text,
          borderColor: tc.grid,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks:  { color: tc.text, font: { size: 11 } },
          grid:   { display: false },
          border: { color: tc.grid },
        },
        y: {
          ticks:  { color: tc.text, font: { size: 11 }, precision: 0 },
          grid:   { color: tc.grid },
          border: { color: tc.grid },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ═══════════════════════════════════════════════
   CHART 3 – CATEGORY HORIZONTAL BAR
═══════════════════════════════════════════════ */
function renderCategoryChart() {
  destroyChart('category');
  const tc = themeColors();

  const categories = Object.keys(CATEGORY_COLORS);
  const data = categories.map(cat => state.tasks.filter(t => t.category === cat).length);
  const labels = categories.map(c => c.charAt(0).toUpperCase() + c.slice(1));

  const ctx = document.getElementById('categoryChart');
  charts['category'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tasks',
        data,
        backgroundColor: categories.map(c => CATEGORY_COLORS[c]),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tc.tooltip,
          titleColor: tc.text,
          bodyColor: tc.text,
          borderColor: tc.grid,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks:  { color: tc.text, font: { size: 11 }, precision: 0 },
          grid:   { color: tc.grid },
          border: { color: tc.grid },
          beginAtZero: true,
        },
        y: {
          ticks:  { color: tc.text, font: { size: 11 } },
          grid:   { display: false },
          border: { color: tc.grid },
        },
      },
    },
  });
}

/* ═══════════════════════════════════════════════
   PUBLIC ENTRY POINT
═══════════════════════════════════════════════ */
export function renderAnalytics() {
  renderStats();
  renderStatusChart();
  renderPriorityChart();
  renderCategoryChart();
}
