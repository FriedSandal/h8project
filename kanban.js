/**
 * kanban.js  –  SmartBoard
 * Renders columns & cards, handles HTML5 drag-and-drop
 */

import { state, getFilteredTasks, saveState, requestDelete, editTask, preselectColumn } from './app.js';

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function deadlineStatus(deadline) {
  if (!deadline) return null;
  const today  = new Date(); today.setHours(0,0,0,0);
  const due    = new Date(deadline + 'T00:00:00');
  const diffMs = due - today;
  const diffD  = Math.round(diffMs / 86400000);
  if (diffD < 0)   return { label: `${Math.abs(diffD)}d overdue`, cls: 'deadline-overdue' };
  if (diffD === 0) return { label: 'Due today',                    cls: 'deadline-soon' };
  if (diffD <= 3)  return { label: `${diffD}d left`,               cls: 'deadline-soon' };
  return { label: due.toLocaleDateString('en-US', { month:'short', day:'numeric' }), cls: 'deadline-ok' };
}

const AVATAR_PALETTE = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444',
  '#f97316','#10b981','#0ea5e9','#14b8a6',
];
const _avatarMap = {};
let   _avatarIdx = 0;
function avatarColor(name) {
  if (!_avatarMap[name]) _avatarMap[name] = AVATAR_PALETTE[_avatarIdx++ % AVATAR_PALETTE.length];
  return _avatarMap[name];
}
function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length > 1 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const PRIORITY_ICON = {
  critical: `<svg class="w-2.5 h-2.5" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>`,
  high:     `<svg class="w-2.5 h-2.5" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>`,
  medium:   `<svg class="w-2.5 h-2.5" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>`,
  low:      `<svg class="w-2.5 h-2.5" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>`,
};

/* ═══════════════════════════════════════════════
   CARD BUILDER
   FIX: buttons use pointer-events-none when hidden
        and suppress dragstart via mousedown
═══════════════════════════════════════════════ */
function buildCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.taskId = task.id;
  card.draggable = true;

  const dl = deadlineStatus(task.deadline);
  if (task.priority === 'critical' && dl?.cls === 'deadline-overdue') {
    card.classList.add('urgent-pulse');
  }

  const deadlineHtml = dl ? `
    <span class="deadline-chip ${dl.cls}">
      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/>
      </svg>
      ${dl.label}
    </span>` : '';

  const assigneeHtml = task.assignee ? `
    <div class="assignee-avatar" style="background:${avatarColor(task.assignee)}" title="${escHtml(task.assignee)}">
      ${initials(task.assignee)}
    </div>` : '';

  card.innerHTML = `
    <div class="card-actions">
      <button class="card-action-btn btn-edit" data-id="${task.id}" title="Edit task">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="card-action-btn btn-delete" data-id="${task.id}" title="Delete task">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
    <div class="card-badges">
      <span class="badge-priority priority-${task.priority}">
        ${PRIORITY_ICON[task.priority]} ${task.priority}
      </span>
      <span class="badge-cat cat-${task.category}">${task.category}</span>
    </div>
    <p class="card-title">${escHtml(task.title)}</p>
    ${task.desc ? `<p class="card-desc">${escHtml(task.desc)}</p>` : ''}
    <div class="card-footer">
      <div class="card-footer-left">${deadlineHtml}</div>
      ${assigneeHtml}
    </div>
  `;

  // ── FIX: prevent drag from starting when clicking buttons ──
  const editBtn   = card.querySelector('.btn-edit');
  const deleteBtn = card.querySelector('.btn-delete');

  // mousedown stops drag initiation on the card
  editBtn.addEventListener('mousedown',   e => e.stopPropagation());
  deleteBtn.addEventListener('mousedown', e => e.stopPropagation());

  // click fires the action
  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    editTask(task.id);
  });
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    requestDelete(task.id);
  });

  // dragstart must NOT fire when pointer is on a button
  card.addEventListener('dragstart', e => {
    if (e.target.closest('.card-action-btn')) {
      e.preventDefault();
      return;
    }
    onDragStart.call(card, e);
  });
  card.addEventListener('dragend', onDragEnd);

  return card;
}

/* ═══════════════════════════════════════════════
   COLUMN BUILDER
═══════════════════════════════════════════════ */
function buildColumn(col) {
  const allCount     = state.tasks.filter(t => t.columnId === col.id).length;
  const filteredTasks = getFilteredTasks(col.id);

  const wrapper = document.createElement('div');
  wrapper.className = 'kanban-column';
  wrapper.dataset.colId = col.id;

  // Top accent bar
  const accent = document.createElement('div');
  accent.className = 'col-accent';
  accent.style.background = col.color;

  // Header
  const header = document.createElement('div');
  header.className = 'column-header';
  header.innerHTML = `
    <div class="col-header-left">
      <span class="col-dot" style="background:${col.color}"></span>
      <span class="column-title">${escHtml(col.title)}</span>
      <span class="column-count">${allCount}</span>
    </div>
    <button class="col-add-btn btn-add-to-col" data-col="${col.id}" title="Add task here">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    </button>
  `;

  // Body (drop zone)
  const body = document.createElement('div');
  body.className = 'column-body';
  body.dataset.colId = col.id;

  if (filteredTasks.length === 0) {
    body.innerHTML = `<div class="empty-col-hint">
      <svg class="w-8 h-8 mx-auto mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="1.5"/>
        <path d="M12 8v8M8 12h8" stroke-width="1.5"/>
      </svg>
      Drop tasks here
    </div>`;
  } else {
    filteredTasks.forEach(t => body.appendChild(buildCard(t)));
  }

  // quick-add
  header.querySelector('.btn-add-to-col').addEventListener('click', () => {
    document.getElementById('openAddTask').click();
    setTimeout(() => preselectColumn(col.id), 60);
  });

  // drag listeners on body
  body.addEventListener('dragover',  onBodyDragOver);
  body.addEventListener('dragleave', onBodyDragLeave);
  body.addEventListener('drop',      onBodyDrop);

  wrapper.appendChild(accent);
  wrapper.appendChild(header);
  wrapper.appendChild(body);
  return wrapper;
}

/* ═══════════════════════════════════════════════
   ADD COLUMN BUTTON
═══════════════════════════════════════════════ */
function buildAddColumnBtn() {
  const btn = document.createElement('button');
  btn.className = 'add-column-btn';
  btn.title = 'Add column';
  btn.innerHTML = `
    <svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
      <path stroke-linecap="round" d="M12 5v14M5 12h14"/>
    </svg>
    <span style="font-size:11px;letter-spacing:.04em">Column</span>
  `;
  btn.addEventListener('click', addColumn);
  return btn;
}

function addColumn() {
  const title = prompt('New column name:');
  if (!title?.trim()) return;
  const palette = ['#6366f1','#3b82f6','#f59e0b','#8b5cf6','#10b981','#ef4444','#ec4899','#06b6d4'];
  const color   = palette[state.columns.length % palette.length];
  state.columns.push({ id: 'col_' + Date.now(), title: title.trim(), color });
  saveState();
  renderBoard();
}

/* ═══════════════════════════════════════════════
   RENDER BOARD
═══════════════════════════════════════════════ */
export function renderBoard() {
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = '';
  state.columns.forEach(col => board.appendChild(buildColumn(col)));
  board.appendChild(buildAddColumnBtn());
}

export function initDragDrop() { /* listeners attached per-render */ }

/* ═══════════════════════════════════════════════
   DRAG & DROP  (column-body based)
═══════════════════════════════════════════════ */
let dragTaskId   = null;
let placeholder  = null;

function makePlaceholder() {
  const el = document.createElement('div');
  el.className = 'drag-placeholder';
  return el;
}

function onDragStart(e) {
  dragTaskId = this.dataset.taskId;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragTaskId);
  placeholder = makePlaceholder();
}

function onDragEnd(e) {
  this.classList.remove('dragging');
  placeholder?.remove();
  placeholder = null;
  document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('dragging'));
}

function onBodyDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const body = this;
  body.closest('.kanban-column').classList.add('drag-over');
  if (!placeholder) placeholder = makePlaceholder();

  const after = getDragAfter(body, e.clientY);
  const existing = body.querySelector('.drag-placeholder');
  const ph = existing || placeholder;
  if (!body.contains(ph)) body.appendChild(ph);

  if (after == null) {
    body.appendChild(ph);
  } else {
    body.insertBefore(ph, after);
  }
}

function onBodyDragLeave(e) {
  const col = this.closest('.kanban-column');
  if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
}

function onBodyDrop(e) {
  e.preventDefault();
  const targetColId = this.dataset.colId;
  placeholder?.remove(); placeholder = null;
  document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));

  if (!dragTaskId) return;
  const idx = state.tasks.findIndex(t => t.id === dragTaskId);
  if (idx === -1) return;

  state.tasks[idx].columnId = targetColId;
  dragTaskId = null;

  saveState();
  renderBoard();
  if (!document.getElementById('analyticsPanel').classList.contains('hidden')) {
    import('./analytics.js').then(({ renderAnalytics }) => renderAnalytics());
  }
}

function getDragAfter(container, y) {
  const cards = [...container.querySelectorAll('.task-card:not(.dragging)')];
  return cards.reduce((closest, child) => {
    const box    = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}
