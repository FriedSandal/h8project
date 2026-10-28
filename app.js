/**
 * app.js  –  SmartBoard entry point
 * Manages: state, localStorage, seed data, filter/search,
 *           modal wiring, theme toggle, analytics trigger
 */

import { renderBoard, initDragDrop } from './kanban.js';
import { renderAnalytics }           from './analytics.js';

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
export const state = {
  columns: [],
  tasks:   [],
  filters: { priority: '', category: '', member: '', search: '' },
  sortBy:  'priority',
  darkMode: true,
};

/* ═══════════════════════════════════════════════
   SEED DATA
═══════════════════════════════════════════════ */
const SEED_COLUMNS = [
  { id: 'backlog',     title: 'Backlog',     color: '#6366f1' },
  { id: 'todo',        title: 'To Do',       color: '#3b82f6' },
  { id: 'inprogress',  title: 'In Progress', color: '#f59e0b' },
  { id: 'review',      title: 'Review',      color: '#8b5cf6' },
  { id: 'done',        title: 'Done',        color: '#10b981' },
];

const today  = new Date();
const d = (offset) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split('T')[0];
};

const SEED_TASKS = [
  { id:'t1',  title:'Set up CI/CD pipeline',         desc:'Configure GitHub Actions workflow',           priority:'critical', category:'devops',    columnId:'inprogress', deadline: d(-2),  assignee:'Alex',    created: d(-10) },
  { id:'t2',  title:'Design system tokens',           desc:'Define color, spacing, and type scales',     priority:'high',     category:'design',    columnId:'todo',       deadline: d(3),   assignee:'Sara',    created: d(-8)  },
  { id:'t3',  title:'Auth module – OAuth2',           desc:'Integrate Google and GitHub OAuth',          priority:'high',     category:'backend',   columnId:'inprogress', deadline: d(1),   assignee:'Raj',     created: d(-6)  },
  { id:'t4',  title:'Dashboard component',            desc:'Build the main dashboard view in React',     priority:'medium',   category:'frontend',  columnId:'todo',       deadline: d(5),   assignee:'Alex',    created: d(-5)  },
  { id:'t5',  title:'Unit tests – auth service',      desc:'Achieve 80% coverage on auth module',       priority:'medium',   category:'qa',        columnId:'backlog',    deadline: d(7),   assignee:'Mia',     created: d(-4)  },
  { id:'t6',  title:'Database schema migration',      desc:'Migrate user table to v3 schema',            priority:'critical', category:'backend',   columnId:'review',     deadline: d(0),   assignee:'Raj',     created: d(-9)  },
  { id:'t7',  title:'Landing page redesign',          desc:'Update hero section with new branding',      priority:'low',      category:'design',    columnId:'todo',       deadline: d(14),  assignee:'Sara',    created: d(-3)  },
  { id:'t8',  title:'API rate limiting',              desc:'Implement token bucket algorithm',           priority:'high',     category:'backend',   columnId:'backlog',    deadline: d(6),   assignee:'Raj',     created: d(-2)  },
  { id:'t9',  title:'Accessibility audit',            desc:'Run axe-core and fix critical issues',       priority:'medium',   category:'qa',        columnId:'backlog',    deadline: d(8),   assignee:'Mia',     created: d(-1)  },
  { id:'t10', title:'Docker Compose setup',           desc:'Multi-container local dev environment',      priority:'high',     category:'devops',    columnId:'done',       deadline: d(-5),  assignee:'Alex',    created: d(-15) },
  { id:'t11', title:'Figma component library',        desc:'Publish shared component library',           priority:'medium',   category:'design',    columnId:'done',       deadline: d(-3),  assignee:'Sara',    created: d(-12) },
  { id:'t12', title:'E2E tests with Playwright',      desc:'Write smoke tests for checkout flow',        priority:'high',     category:'qa',        columnId:'review',     deadline: d(2),   assignee:'Mia',     created: d(-4)  },
  { id:'t13', title:'Notification microservice',      desc:'Email + push via AWS SNS',                   priority:'medium',   category:'backend',   columnId:'backlog',    deadline: d(10),  assignee:'Raj',     created: d(-1)  },
  { id:'t14', title:'Performance profiling',          desc:'Identify and fix render bottlenecks',        priority:'low',      category:'frontend',  columnId:'todo',       deadline: d(12),  assignee:'Alex',    created: d(-2)  },
  { id:'t15', title:'Kubernetes deployment',          desc:'Deploy to EKS staging cluster',              priority:'critical', category:'devops',    columnId:'todo',       deadline: d(-1),  assignee:'Alex',    created: d(-7)  },
];

/* ═══════════════════════════════════════════════
   PERSISTENCE
═══════════════════════════════════════════════ */
export function saveState() {
  localStorage.setItem('sb_columns', JSON.stringify(state.columns));
  localStorage.setItem('sb_tasks',   JSON.stringify(state.tasks));
}

function loadState() {
  const cols  = localStorage.getItem('sb_columns');
  const tasks = localStorage.getItem('sb_tasks');
  state.columns = cols  ? JSON.parse(cols)  : SEED_COLUMNS.map(c => ({...c}));
  state.tasks   = tasks ? JSON.parse(tasks) : SEED_TASKS.map(t => ({...t}));
}

/* ═══════════════════════════════════════════════
   FILTERING & SORTING
═══════════════════════════════════════════════ */
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function getFilteredTasks(columnId) {
  const { priority, category, member, search } = state.filters;
  let tasks = state.tasks.filter(t => t.columnId === columnId);

  if (priority) tasks = tasks.filter(t => t.priority === priority);
  if (category) tasks = tasks.filter(t => t.category === category);
  if (member)   tasks = tasks.filter(t => t.assignee?.toLowerCase().includes(member.toLowerCase()));
  if (search)   tasks = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.desc || '').toLowerCase().includes(search.toLowerCase())
  );

  // Sort
  tasks = [...tasks].sort((a, b) => {
    if (state.sortBy === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (state.sortBy === 'deadline') {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    if (state.sortBy === 'created') return (a.created || '').localeCompare(b.created || '');
    if (state.sortBy === 'title')   return a.title.localeCompare(b.title);
    return 0;
  });

  return tasks;
}

export function getAllFilteredTasks() {
  return state.columns.flatMap(col => getFilteredTasks(col.id));
}

/* ═══════════════════════════════════════════════
   MEMBER LIST (for filter dropdown)
═══════════════════════════════════════════════ */
function refreshMemberFilter() {
  const members = [...new Set(state.tasks.map(t => t.assignee).filter(Boolean))].sort();
  const sel = document.getElementById('filterMember');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Members</option>';
  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    if (m === cur) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ═══════════════════════════════════════════════
   CUSTOM DROPDOWN HELPERS
═══════════════════════════════════════════════ */

// Config for each custom dropdown in the modal
const DROPDOWN_CONFIGS = {
  priority: {
    triggerId: 'priorityTrigger',
    labelId:   'priorityLabel',
    menuId:    'priorityMenu',
    inputId:   'taskPriority',
    wrapperId: 'priorityDropdown',
  },
  category: {
    triggerId: 'categoryTrigger',
    labelId:   'categoryLabel',
    menuId:    'categoryMenu',
    inputId:   'taskCategory',
    wrapperId: 'categoryDropdown',
  },
  column: {
    triggerId: 'columnTrigger',
    labelId:   'columnLabel',
    menuId:    'columnMenu',
    inputId:   'taskColumn',
    wrapperId: 'columnDropdown',
  },
};

let _dropdownsInited = false;

function setDropdownValue(key, value, label) {
  const cfg = DROPDOWN_CONFIGS[key];
  document.getElementById(cfg.inputId).value   = value;
  document.getElementById(cfg.labelId).textContent = label;
  // Mark selected option
  const menu = document.getElementById(cfg.menuId);
  menu.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.value === value);
  });
}

function closeAllDropdowns() {
  Object.values(DROPDOWN_CONFIGS).forEach(cfg => {
    document.getElementById(cfg.wrapperId)?.classList.remove('open');
  });
}

function initCustomDropdowns() {
  if (_dropdownsInited) return;
  _dropdownsInited = true;

  Object.entries(DROPDOWN_CONFIGS).forEach(([key, cfg]) => {
    const trigger = document.getElementById(cfg.triggerId);
    const menu    = document.getElementById(cfg.menuId);
    const wrapper = document.getElementById(cfg.wrapperId);

    // Toggle open/close
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) wrapper.classList.add('open');
    });

    // Option click — only static options (priority/category); column is dynamic
    menu.addEventListener('click', e => {
      const opt = e.target.closest('.custom-select-option');
      if (!opt) return;
      setDropdownValue(key, opt.dataset.value, opt.textContent.trim());
      wrapper.classList.remove('open');
    });
  });

  // Click outside closes all
  document.addEventListener('click', closeAllDropdowns);
}

function populateColumnDropdown(selectedId) {
  const cfg  = DROPDOWN_CONFIGS.column;
  const menu = document.getElementById(cfg.menuId);
  menu.innerHTML = '';
  state.columns.forEach(col => {
    const opt = document.createElement('div');
    opt.className = 'custom-select-option';
    opt.dataset.value = col.id;
    opt.innerHTML = `<span class="cso-dot" style="background:${col.color}"></span>${col.title}`;
    menu.appendChild(opt);
  });
  const firstCol = state.columns[0];
  const target   = state.columns.find(c => c.id === selectedId) || firstCol;
  if (target) setDropdownValue('column', target.id, target.title);
}

/* ═══════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════ */
let pendingDeleteId = null;

function openModal(task = null) {
  const modal   = document.getElementById('taskModal');
  const form    = document.getElementById('taskForm');
  const titleEl = document.getElementById('modalTitle');

  initCustomDropdowns();
  populateColumnDropdown(task?.columnId || state.columns[0]?.id);

  if (task) {
    titleEl.textContent = 'Edit Task';
    document.getElementById('taskId').value       = task.id;
    document.getElementById('taskTitle').value    = task.title;
    document.getElementById('taskDesc').value     = task.desc    || '';
    document.getElementById('taskDeadline').value = task.deadline || '';
    document.getElementById('taskAssignee').value = task.assignee || '';

    const PRIORITY_LABELS = { critical:'Critical', high:'High', medium:'Medium', low:'Low' };
    setDropdownValue('priority', task.priority, PRIORITY_LABELS[task.priority]);

    const CATEGORY_LABELS = { frontend:'Frontend', backend:'Backend', design:'Design', devops:'DevOps', qa:'QA' };
    setDropdownValue('category', task.category, CATEGORY_LABELS[task.category]);

    setDropdownValue('column', task.columnId,
      state.columns.find(c => c.id === task.columnId)?.title || '');
  } else {
    titleEl.textContent = 'New Task';
    form.reset();
    document.getElementById('taskId').value = '';
    setDropdownValue('priority', 'medium', 'Medium');
    setDropdownValue('category', 'frontend', 'Frontend');
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  closeAllDropdowns();
  document.getElementById('taskModal').classList.add('hidden');
}

function handleFormSubmit(e) {
  e.preventDefault();
  const id       = document.getElementById('taskId').value;
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const category = document.getElementById('taskCategory').value;
  const deadline = document.getElementById('taskDeadline').value;
  const assignee = document.getElementById('taskAssignee').value.trim();
  const columnId = document.getElementById('taskColumn').value;

  if (!title) return;

  if (id) {
    // Edit
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      state.tasks[idx] = { ...state.tasks[idx], title, desc, priority, category, deadline, assignee, columnId };
    }
  } else {
    // New
    state.tasks.push({
      id: 't' + Date.now(),
      title, desc, priority, category, deadline, assignee, columnId,
      created: new Date().toISOString().split('T')[0],
    });
  }

  saveState();
  refreshMemberFilter();
  renderBoard();
  if (!document.getElementById('analyticsPanel').classList.contains('hidden')) {
    renderAnalytics();
  }
  closeModal();
}

/* ═══════════════════════════════════════════════
   DELETE
═══════════════════════════════════════════════ */
export function requestDelete(taskId) {
  pendingDeleteId = taskId;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function confirmDeleteTask() {
  if (!pendingDeleteId) return;
  state.tasks = state.tasks.filter(t => t.id !== pendingDeleteId);
  pendingDeleteId = null;
  document.getElementById('confirmModal').classList.add('hidden');
  saveState();
  refreshMemberFilter();
  renderBoard();
  if (!document.getElementById('analyticsPanel').classList.contains('hidden')) {
    renderAnalytics();
  }
}

/* ═══════════════════════════════════════════════
   PUBLIC HELPERS (used by kanban.js)
═══════════════════════════════════════════════ */
export function editTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) openModal(task);
}

/** Called by column quick-add after the modal opens */
export function preselectColumn(colId) {
  const col = state.columns.find(c => c.id === colId);
  if (col) {
    populateColumnDropdown(colId);
  }
}

/* ═══════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════ */
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  document.getElementById('moonIcon').classList.toggle('hidden',  dark);
  document.getElementById('sunIcon').classList.toggle('hidden',  !dark);
  state.darkMode = dark;
  localStorage.setItem('sb_theme', dark ? 'dark' : 'light');
  // Re-render charts with updated colors if panel open
  if (!document.getElementById('analyticsPanel').classList.contains('hidden')) {
    renderAnalytics();
  }
}

/* ═══════════════════════════════════════════════
   PROJECT NAME EDIT
═══════════════════════════════════════════════ */
function initProjectNameEdit() {
  const el = document.getElementById('projectName');
  el.addEventListener('click', () => {
    const cur = el.textContent;
    const input = document.createElement('input');
    input.type = 'text'; input.value = cur;
    input.className = 'form-input';
    input.style.cssText = 'width:140px;padding:2px 8px;font-size:13px;display:inline-block';
    el.replaceWith(input);
    input.focus(); input.select();
    const finish = () => {
      const span = document.createElement('span');
      span.id = 'projectName';
      span.className = el.className;
      span.textContent = input.value || cur;
      span.title = 'Click to rename';
      input.replaceWith(span);
      localStorage.setItem('sb_project', span.textContent);
      initProjectNameEdit();   // re-bind
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') finish(); });
  });
}

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Restore theme
  const savedTheme = localStorage.getItem('sb_theme');
  const dark = savedTheme !== 'light';
  applyTheme(dark);

  // Restore project name
  const savedProject = localStorage.getItem('sb_project');
  if (savedProject) document.getElementById('projectName').textContent = savedProject;

  refreshMemberFilter();
  renderBoard();
  initDragDrop();
  initProjectNameEdit();

  /* ---- Event listeners ---- */

  // Add task
  document.getElementById('openAddTask').addEventListener('click', () => openModal());

  // Modal close
  document.getElementById('closeModal').addEventListener('click',  closeModal);
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.getElementById('taskModal').addEventListener('click', e => {
    if (e.target === document.getElementById('taskModal')) closeModal();
  });

  // Form submit
  document.getElementById('taskForm').addEventListener('submit', handleFormSubmit);

  // Delete confirm/cancel
  document.getElementById('confirmDelete').addEventListener('click', confirmDeleteTask);
  const closeDel = () => {
    pendingDeleteId = null;
    document.getElementById('confirmModal').classList.add('hidden');
  };
  document.getElementById('cancelDelete').addEventListener('click', closeDel);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDel);

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => applyTheme(!state.darkMode));

  // Analytics toggle
  document.getElementById('toggleAnalytics').addEventListener('click', () => {
    const panel = document.getElementById('analyticsPanel');
    const hidden = panel.classList.toggle('hidden');
    if (!hidden) renderAnalytics();
  });

  // Filters
  document.getElementById('filterPriority').addEventListener('change', e => {
    state.filters.priority = e.target.value; renderBoard();
  });
  document.getElementById('filterCategory').addEventListener('change', e => {
    state.filters.category = e.target.value; renderBoard();
  });
  document.getElementById('filterMember').addEventListener('change', e => {
    state.filters.member = e.target.value; renderBoard();
  });
  document.getElementById('sortBy').addEventListener('change', e => {
    state.sortBy = e.target.value; renderBoard();
  });

  // Search
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.search = e.target.value;
      renderBoard();
    }, 180);
  });

  // Clear filters
  document.getElementById('clearFilters').addEventListener('click', () => {
    state.filters = { priority: '', category: '', member: '', search: '' };
    document.getElementById('filterPriority').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterMember').value   = '';
    document.getElementById('searchInput').value    = '';
    renderBoard();
  });
});
