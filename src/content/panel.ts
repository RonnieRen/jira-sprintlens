/**
 * panel.ts — Panel UI scaffold, board/sprint dropdowns, drag, open/close.
 *
 * Exposes:
 *   window.__JSR_OPEN__      — called by popup to open the panel
 *   window.__JSR_IS_OPEN__   — live getter for current open state
 *
 * NOTE: No imports from events.ts — that would create a circular dependency.
 * Instead, panel.ts exposes setters (setOnBoardChange, setOnSprintChange) that
 * events.ts calls during its init to register handlers.
 */

import { jsrEsc } from './config';
import { jsrFetchAllBoards, jsrDetectBoardFromUrl } from './api';
import { jsrSortSprintsByYearWeek,  } from './sprint-utils';
import type { JiraBoard, JiraSprint, GroupedSprints } from './types';

declare global {
  interface Window {
    __JSR_LOADED__?: boolean;
  }
}

// ── Guard: only initialize once per page ──────────────────────────────────────
if (window.__JSR_LOADED__) {
  // Already running — just re-expose the open function and bail out.
  // This path is taken when Chrome injects the script a second time.
  console.log('[JSR] already loaded, skipping re-init');
} else {
  window.__JSR_LOADED__ = true;
  init();
}

// ── Callbacks registered by events.ts to break circular dependency ────────────
type BoardChangeHandler  = (boardId: string) => void;
type SprintChangeHandler = (sprintId: string) => void;
let _onBoardChange:  BoardChangeHandler  = () => {};
let _onSprintChange: SprintChangeHandler = () => {};

export function setOnBoardChange(fn: BoardChangeHandler):  void { _onBoardChange  = fn; }
export function setOnSprintChange(fn: SprintChangeHandler): void { _onSprintChange = fn; }

// ── Panel state ───────────────────────────────────────────────────────────────
export let jsrPanelOpen              = false;
export let jsrAllBoards: JiraBoard[] = [];
export let jsrAllSprints: JiraSprint[] = [];
export let jsrSprintGrouped: GroupedSprints | null = null;
export let jsrSprintYearsLoaded: number[] = [];
export let jsrSelectedBoardId: string | null = null;
export let jsrSelectedSprintId: string | null = null;
export let jsrSelectedSprintName = '';

export function setAllSprints(s: JiraSprint[]):        void { jsrAllSprints = s; }
export function setSprintGrouped(g: GroupedSprints):   void { jsrSprintGrouped = g; }
export function setSprintInputPlaceholder(text: string): void {
  jsrSprintInput.placeholder = text;
  jsrSprintInput.disabled = false;
}
export function setSprintInputError(text: string): void {
  jsrSprintInput.placeholder = text;
}

// ── Lazy DOM refs (set inside init(), after overlay is appended) ──────────────
export let jsrSprintInput:    HTMLInputElement;
export let jsrSprintDropdown: HTMLDivElement;
let jsrBoardInput:    HTMLInputElement;
let jsrBoardDropdown: HTMLDivElement;
let jsrOverlay:       HTMLDivElement;

let jsrBoardSearchTimer: ReturnType<typeof setTimeout> | null = null;
let jsrBoardSearchRequestId = 0;

// ── Main init ─────────────────────────────────────────────────────────────────
function init(): void {
  console.log('%c[JSR] Jira SprintLens loaded ✅', 'color:#36B37E;font-weight:bold');

  // Build overlay HTML
  jsrOverlay = document.createElement('div') as HTMLDivElement;
  jsrOverlay.id = 'jsr-overlay';
  jsrOverlay.innerHTML = `
    <div id="jsr-panel">
      <div id="jsr-panel-header">
        <h2>
          <img src="${chrome.runtime.getURL('icons/icon48.png')}" width="28" height="28"
               alt="SprintLens" style="vertical-align:middle;margin-right:8px;border-radius:6px">
          Jira SprintLens
        </h2>
        <button id="jsr-close">✕</button>
      </div>
      <div class="jsr-form" id="jsr-form">
        <label>Board
          <div class="jsr-search-wrap" id="jsr-board-wrap">
            <input type="text" class="jsr-search-input" id="jsr-board-input"
                   placeholder="Search boards..." autocomplete="off">
            <button class="jsr-search-clear" id="jsr-board-clear">✕</button>
            <div class="jsr-dropdown" id="jsr-board-dropdown"></div>
            <input type="hidden" id="jsr-board-value">
          </div>
        </label>
        <label>Sprint
          <div class="jsr-sprint-wrap" id="jsr-sprint-wrap">
            <input type="text" class="jsr-sprint-input" id="jsr-sprint-input"
                   placeholder="Select board first" autocomplete="off" disabled>
            <button class="jsr-sprint-clear" id="jsr-sprint-clear">✕</button>
            <div id="jsr-sprint-dropdown"></div>
            <input type="hidden" id="jsr-sprint-value">
          </div>
        </label>
        <label>Assignee
          <select id="jsr-assignee"><option value="">All members</option></select>
        </label>
        <label style="flex-direction:row;align-items:center;gap:6px;cursor:pointer;
                      font-size:12px;font-weight:600;color:#6B778C;
                      text-transform:uppercase;letter-spacing:.5px">
          <input type="checkbox" id="jsr-show-carried-invalid" style="width:14px;height:14px;cursor:pointer">
          Show Carried-Over Invalid Bugs
        </label>
        <label>&nbsp;
          <button class="jsr-btn jsr-btn-primary" id="jsr-generate" disabled>Generate Report</button>
        </label>
      </div>
      <div id="jsr-report"></div>
    </div>
  `;
  document.body.appendChild(jsrOverlay);

  // Cache DOM refs (safe now — overlay is in the DOM)
  jsrBoardInput    = document.getElementById('jsr-board-input')    as HTMLInputElement;
  jsrBoardDropdown = document.getElementById('jsr-board-dropdown') as HTMLDivElement;
  jsrSprintInput   = document.getElementById('jsr-sprint-input')   as HTMLInputElement;
  jsrSprintDropdown = document.getElementById('jsr-sprint-dropdown') as HTMLDivElement;

  // Wire up all events
  wireOverlayEvents();
  initDrag();
  wireBoardDropdown();
  wireSprintDropdown();

  // Listen for open requests from the popup via chrome.runtime.onMessage.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'jsr_open' && !jsrPanelOpen) void jsrOpenPanel();
  });
}

// ── Panel open / close ────────────────────────────────────────────────────────

export function jsrClosePanel(): void {
  jsrPanelOpen = false;
  jsrOverlay.classList.remove('active');
  document.getElementById('jsr-board-dropdown')?.classList.remove('open');
  document.getElementById('jsr-sprint-dropdown')?.classList.remove('open');
  jsrBoardInput?.blur();
  jsrSprintInput?.blur();
  const panel = document.getElementById('jsr-panel');
  if (panel) panel.style.cssText = '';
}

export async function jsrOpenPanel(): Promise<void> {
  jsrPanelOpen = true;
  jsrOverlay.classList.add('active');

  document.getElementById('jsr-report')!.innerHTML = '';
  jsrBoardInput.value = '';
  document.getElementById('jsr-board-wrap')!.classList.remove('has-value');
  (document.getElementById('jsr-board-value') as HTMLInputElement).value = '';
  jsrResetSprintDropdown();
  (document.getElementById('jsr-assignee') as HTMLSelectElement).innerHTML =
    '<option value="">Select sprint first</option>';
  (document.getElementById('jsr-generate') as HTMLButtonElement).disabled = true;
  jsrSelectedBoardId = null;

  jsrBoardInput.placeholder = 'Loading boards...';
  const requestId = ++jsrBoardSearchRequestId;
  try {
    jsrAllBoards = await jsrFetchAllBoards();
    if (requestId !== jsrBoardSearchRequestId || !jsrPanelOpen) return;
    jsrBoardInput.placeholder = `Search ${jsrAllBoards.length} boards...`;

    const detectedId = jsrDetectBoardFromUrl();
    if (detectedId) {
      const match = jsrAllBoards.find((b) => String(b.id) === detectedId);
      if (match) { jsrSelectBoard(String(match.id), match.name); return; }
    }

    try {
      chrome.storage.local.get('jsr_last_board', (result) => {
        const saved = result?.['jsr_last_board'] as { id: string; name: string } | undefined;
        if (!saved) {
          try {
            const raw = localStorage.getItem('jsr_last_board');
            if (raw) {
              const { id } = JSON.parse(raw) as { id: string };
              const match = jsrAllBoards.find((b) => String(b.id) === String(id));
              if (match) jsrSelectBoard(String(match.id), match.name);
            }
          } catch (_) { /* ignore */ }
          return;
        }
        const match = jsrAllBoards.find((b) => String(b.id) === String(saved.id));
        if (match) jsrSelectBoard(String(match.id), match.name);
      });
    } catch (_) { /* ignore */ }
  } catch (e) {
    jsrBoardInput.placeholder = 'Error loading boards';
    console.error('[JSR]', e);
  }
}

// ── Overlay / close button ────────────────────────────────────────────────────

function wireOverlayEvents(): void {
  jsrOverlay.addEventListener('click', (e) => {
    if (e.target === jsrOverlay) jsrClosePanel();
  });
  document.getElementById('jsr-close')!.addEventListener('click', (e) => {
    e.stopPropagation();
    jsrClosePanel();
  });
}

// ── Drag to reposition ────────────────────────────────────────────────────────

function initDrag(): void {
  const panel  = document.getElementById('jsr-panel')!;
  const header = document.getElementById('jsr-panel-header')!;
  let dragging = false, startX = 0, startY = 0, originLeft = 0, originTop = 0;

  header.addEventListener('mousedown', (e) => {
    if ((e.target as Element).closest('#jsr-close')) return;
    e.preventDefault();
    dragging = true;
    header.classList.add('dragging');
    const rect = panel.getBoundingClientRect();
    panel.style.position = 'absolute';
    panel.style.margin   = '0';
    panel.style.left     = rect.left + 'px';
    panel.style.top      = rect.top  + 'px';
    startX = e.clientX; startY = e.clientY;
    originLeft = rect.left; originTop = rect.top;
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    panel.style.left = Math.max(0, Math.min(window.innerWidth  - panel.offsetWidth,  originLeft + e.clientX - startX)) + 'px';
    panel.style.top  = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, originTop  + e.clientY - startY)) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    header.classList.remove('dragging');
  });
}

// ── Board dropdown ────────────────────────────────────────────────────────────

function wireBoardDropdown(): void {
  function positionDropdown(): void {
    const rect = jsrBoardInput.getBoundingClientRect();
    jsrBoardDropdown.style.top   = rect.bottom + 'px';
    jsrBoardDropdown.style.left  = rect.left   + 'px';
    jsrBoardDropdown.style.width = rect.width  + 'px';
  }

  function renderDropdown(filter: string): void {
    const query   = filter.toLowerCase().trim();
    const matched = query ? jsrAllBoards.filter((b) => b.name.toLowerCase().includes(query)) : jsrAllBoards;
    if (!matched.length) {
      jsrBoardDropdown.innerHTML = `<div class="jsr-dropdown-empty">${query ? `No boards matching "${jsrEsc(filter)}"` : 'No boards found'}</div>`;
    } else {
      let html = `<div class="jsr-dropdown-count">${matched.length} of ${jsrAllBoards.length} boards</div>`;
      matched.forEach((b) => {
        const type = b.type === 'scrum' ? 'Scrum' : b.type === 'kanban' ? 'Kanban' : b.type || '';
        html += `<div class="jsr-dropdown-item" data-id="${b.id}" data-name="${jsrEsc(b.name)}">${jsrEsc(b.name)}<span class="jsr-board-type">${type}</span></div>`;
      });
      jsrBoardDropdown.innerHTML = html;
    }
    positionDropdown();
    jsrBoardDropdown.classList.add('open');
  }

  function refreshAfterDelay(delay = 1000): void {
    if (jsrBoardSearchTimer) clearTimeout(jsrBoardSearchTimer);
    const requestId = ++jsrBoardSearchRequestId;
    jsrBoardSearchTimer = setTimeout(async () => {
      const query = jsrBoardInput.value.trim();
      jsrBoardDropdown.innerHTML = '<div class="jsr-dropdown-empty">Refreshing boards...</div>';
      positionDropdown();
      jsrBoardDropdown.classList.add('open');
      try {
        const boards = await jsrFetchAllBoards(query);
        if (requestId !== jsrBoardSearchRequestId) return;
        jsrAllBoards = boards;
        jsrBoardInput.placeholder = `Search ${jsrAllBoards.length} boards...`;
        renderDropdown(jsrBoardInput.value);
      } catch (e) {
        if (requestId !== jsrBoardSearchRequestId) return;
        jsrBoardDropdown.innerHTML = '<div class="jsr-dropdown-empty">Error loading boards</div>';
        console.error('[JSR]', e);
      }
    }, delay);
  }

  jsrBoardInput.addEventListener('focus', () => {
    if (jsrAllBoards.length) renderDropdown(jsrBoardInput.value);
    else refreshAfterDelay(0);
  });
  jsrBoardInput.addEventListener('input', () => {
    renderDropdown(jsrBoardInput.value);
    refreshAfterDelay();
    if (jsrSelectedBoardId) {
      jsrSelectedBoardId = null;
      (document.getElementById('jsr-board-value') as HTMLInputElement).value = '';
      jsrResetSprintDropdown();
      (document.getElementById('jsr-generate') as HTMLButtonElement).disabled = true;
    }
  });
  jsrBoardDropdown.addEventListener('click', (e) => {
    const item = (e.target as Element).closest('.jsr-dropdown-item') as HTMLElement | null;
    if (item) jsrSelectBoard(item.dataset['id']!, item.dataset['name']!);
  });
  jsrBoardInput.addEventListener('keydown', (e) => {
    const items  = jsrBoardDropdown.querySelectorAll<HTMLElement>('.jsr-dropdown-item');
    const active = jsrBoardDropdown.querySelector<HTMLElement>('.jsr-dropdown-item.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = active ? active.nextElementSibling : items[0];
      if (next instanceof HTMLElement && next.classList.contains('jsr-dropdown-item')) {
        active?.classList.remove('active'); next.classList.add('active');
        next.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = active?.previousElementSibling;
      if (prev instanceof HTMLElement && prev.classList.contains('jsr-dropdown-item')) {
        active!.classList.remove('active'); prev.classList.add('active');
        prev.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) jsrSelectBoard(active.dataset['id']!, active.dataset['name']!);
    } else if (e.key === 'Escape') {
      jsrBoardDropdown.classList.remove('open');
    }
  });
  document.addEventListener('click', (e) => {
    if (!document.getElementById('jsr-board-wrap')!.contains(e.target as Node))
      jsrBoardDropdown.classList.remove('open');
  });
  (document.getElementById('jsr-board-clear') as HTMLButtonElement).onclick = (e) => {
    e.stopPropagation();
    jsrSelectBoard('', '');
    jsrBoardInput.focus();
  };
}

export function jsrSelectBoard(id: string, name: string): void {
  if (jsrBoardSearchTimer) clearTimeout(jsrBoardSearchTimer);
  jsrBoardSearchRequestId++;
  (document.getElementById('jsr-board-value') as HTMLInputElement).value = id;
  jsrBoardInput.value = name;
  document.getElementById('jsr-board-wrap')!.classList.toggle('has-value', !!id);
  jsrBoardDropdown.classList.remove('open');
  jsrSelectedBoardId = id;
  if (id && name) {
    try { chrome.storage.local.set({ jsr_last_board: { id, name } }); } catch (_) {
      try { localStorage.setItem('jsr_last_board', JSON.stringify({ id, name })); } catch (_) { /* ignore */ }
    }
  }
  _onBoardChange(id);
}

// ── Sprint dropdown ───────────────────────────────────────────────────────────

function wireSprintDropdown(): void {
  function positionDropdown(): void {
    const rect = jsrSprintInput.getBoundingClientRect();
    jsrSprintDropdown.style.top   = rect.bottom + 'px';
    jsrSprintDropdown.style.left  = rect.left   + 'px';
    jsrSprintDropdown.style.width = Math.max(rect.width, 340) + 'px';
  }

  function renderYear(year: number): void {
    if (jsrSprintYearsLoaded.includes(year)) return;
    jsrSprintYearsLoaded.push(year);
    const sprints = jsrSprintGrouped?.groups.get(year) ?? [];
    let html = `<div class="jsr-sprint-year-header">📅 ${year}</div>`;
    sprints.forEach((sp) => {
      const dot   = sp.state === 'active' ? '<span class="jsr-sprint-active-dot"></span>' : '';
      const dates = sp.startDate
        ? `${new Date(sp.startDate).toLocaleDateString()} ~ ${sp.endDate ? new Date(sp.endDate).toLocaleDateString() : '...'}`
        : '';
      html += `<div class="jsr-sprint-item" data-id="${sp.id}" data-name="${jsrEsc(sp.name)}">
        <span>${dot}${jsrEsc(sp.name)}</span>
        <span class="jsr-sprint-meta">${dates}</span>
      </div>`;
    });
    jsrSprintDropdown.querySelector('.jsr-sprint-load-more')?.remove();
    jsrSprintDropdown.insertAdjacentHTML('beforeend', html);
    const years = jsrSprintGrouped?.years ?? [];
    const nextYearIdx = years.indexOf(year) + 1;
    if (nextYearIdx < years.length) {
      jsrSprintDropdown.insertAdjacentHTML('beforeend',
        `<div class="jsr-sprint-load-more" data-year="${years[nextYearIdx]}">↓ Load ${years[nextYearIdx]} sprints...</div>`
      );
    }
  }

  function renderDropdown(filter: string): void {
    const query = filter.toLowerCase().trim();
    if (query) {
      const matched = jsrAllSprints.filter((sp) => sp.name.toLowerCase().includes(query));
      let html = matched.length
        ? `<div class="jsr-dropdown-count">${matched.length} sprints found</div>`
        : `<div class="jsr-dropdown-empty">No sprints matching "${jsrEsc(filter)}"</div>`;
      jsrSortSprintsByYearWeek([...matched]).forEach((sp) => {
        const dot   = sp.state === 'active' ? '<span class="jsr-sprint-active-dot"></span>' : '';
        const dates = sp.startDate
          ? `${new Date(sp.startDate).toLocaleDateString()} ~ ${sp.endDate ? new Date(sp.endDate).toLocaleDateString() : '...'}`
          : '';
        html += `<div class="jsr-sprint-item" data-id="${sp.id}" data-name="${jsrEsc(sp.name)}">
          <span>${dot}${jsrEsc(sp.name)}</span><span class="jsr-sprint-meta">${dates}</span>
        </div>`;
      });
      jsrSprintDropdown.innerHTML = html;
    } else {
      jsrSprintDropdown.innerHTML = '';
      jsrSprintYearsLoaded = [];
      if (jsrSprintGrouped?.years.length) {
        renderYear(jsrSprintGrouped.years[0]);
      } else if (jsrAllSprints.length) {
        jsrAllSprints.forEach((sp) => {
          const dot = sp.state === 'active' ? '<span class="jsr-sprint-active-dot"></span>' : '';
          jsrSprintDropdown.innerHTML += `<div class="jsr-sprint-item" data-id="${sp.id}" data-name="${jsrEsc(sp.name)}"><span>${dot}${jsrEsc(sp.name)}</span></div>`;
        });
      } else {
        jsrSprintDropdown.innerHTML = '<div class="jsr-dropdown-empty">No sprints found</div>';
      }
    }
    positionDropdown();
    jsrSprintDropdown.classList.add('open');
  }

  jsrSprintInput.addEventListener('focus', () => {
    if (jsrAllSprints.length) renderDropdown(jsrSprintInput.value);
  });
  jsrSprintInput.addEventListener('input', () => {
    renderDropdown(jsrSprintInput.value);
    if (jsrSelectedSprintId) {
      jsrSelectedSprintId = null;
      (document.getElementById('jsr-sprint-value') as HTMLInputElement).value = '';
      (document.getElementById('jsr-assignee') as HTMLSelectElement).innerHTML =
        '<option value="">Select sprint first</option>';
      (document.getElementById('jsr-generate') as HTMLButtonElement).disabled = true;
    }
  });
  jsrSprintDropdown.addEventListener('click', (e) => {
    const item = (e.target as Element).closest('.jsr-sprint-item') as HTMLElement | null;
    if (item) { jsrSelectSprint(item.dataset['id']!, item.dataset['name']!); return; }
    const loadMore = (e.target as Element).closest('.jsr-sprint-load-more') as HTMLElement | null;
    if (loadMore) {
      const year = parseInt(loadMore.dataset['year']!, 10);
      loadMore.outerHTML = '<div class="jsr-sprint-loading-more">Loading...</div>';
      renderYear(year);
      jsrSprintDropdown.querySelector('.jsr-sprint-loading-more')?.remove();
    }
  });
  jsrSprintDropdown.addEventListener('scroll', () => {
    if (
      !jsrSprintInput.value.trim() &&
      jsrSprintDropdown.scrollTop + jsrSprintDropdown.clientHeight >= jsrSprintDropdown.scrollHeight - 30
    ) {
      (jsrSprintDropdown.querySelector('.jsr-sprint-load-more') as HTMLElement | null)?.click();
    }
  });
  jsrSprintInput.addEventListener('keydown', (e) => {
    const items  = jsrSprintDropdown.querySelectorAll<HTMLElement>('.jsr-sprint-item');
    const active = jsrSprintDropdown.querySelector<HTMLElement>('.jsr-sprint-item.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = active
        ? (active.nextElementSibling instanceof HTMLElement && active.nextElementSibling.classList.contains('jsr-sprint-item') ? active.nextElementSibling : null)
        : items[0];
      if (next) { active?.classList.remove('active'); next.classList.add('active'); next.scrollIntoView({ block: 'nearest' }); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (active) {
        let prev = active.previousElementSibling;
        while (prev && !(prev instanceof HTMLElement && prev.classList.contains('jsr-sprint-item')))
          prev = prev.previousElementSibling;
        if (prev instanceof HTMLElement) { active.classList.remove('active'); prev.classList.add('active'); prev.scrollIntoView({ block: 'nearest' }); }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) jsrSelectSprint(active.dataset['id']!, active.dataset['name']!);
    } else if (e.key === 'Escape') {
      jsrSprintDropdown.classList.remove('open');
    }
  });
  document.addEventListener('click', (e) => {
    if (!document.getElementById('jsr-sprint-wrap')!.contains(e.target as Node))
      jsrSprintDropdown.classList.remove('open');
  });
  (document.getElementById('jsr-sprint-clear') as HTMLButtonElement).onclick = (e) => {
    e.stopPropagation();
    jsrSelectSprint('', '');
    jsrSprintInput.focus();
  };
}

export function jsrResetSprintDropdown(): void {
  jsrSprintInput.value = '';
  jsrSprintInput.placeholder = 'Select board first';
  jsrSprintInput.disabled = true;
  document.getElementById('jsr-sprint-wrap')!.classList.remove('has-value');
  (document.getElementById('jsr-sprint-value') as HTMLInputElement).value = '';
  jsrSprintDropdown.classList.remove('open');
  jsrSprintDropdown.innerHTML = '';
  jsrSelectedSprintId   = null;
  jsrSelectedSprintName = '';
  jsrAllSprints         = [];
  jsrSprintGrouped      = null;
  jsrSprintYearsLoaded  = [];
}

export function jsrSelectSprint(id: string, name: string): void {
  jsrSprintInput.value = name;
  (document.getElementById('jsr-sprint-value') as HTMLInputElement).value = id;
  document.getElementById('jsr-sprint-wrap')!.classList.toggle('has-value', !!id);
  jsrSprintDropdown.classList.remove('open');
  jsrSelectedSprintId   = id;
  jsrSelectedSprintName = name;
  _onSprintChange(id);
}
