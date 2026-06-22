/**
 * events.ts — Board/sprint change handlers and report generation.
 * All DOM queries are deferred until initEvents() is called, after panel DOM exists.
 */

import { jsrEsc } from './config';
import {
  jsrFetchAllSprints,
  jsrFetchSprintMembers,
  jsrFetchCurrentUser,
  jsrFetchSprintReport,
  jsrFetchSprintIssues,
} from './api';
import {
  jsrSortSprintsByYearWeek,
  jsrGroupSprintsByYear,
  jsrFindPrevSprint,
  jsrFindNextSprint,
} from './sprint-utils';
import { jsrAnalyzeIssues } from './analysis';
import { jsrRenderReport } from './render';
import {
  jsrAllSprints,
  jsrSelectedSprintName,
  jsrResetSprintDropdown,
  jsrSprintInput,
  setAllSprints,
  setSprintGrouped,
  setSprintInputPlaceholder,
  setSprintInputError,
  setOnBoardChange,
  setOnSprintChange,
} from './panel';

// ── Board change ──────────────────────────────────────────────────────────────

export async function onBoardChange(boardId: string): Promise<void> {
  (document.getElementById('jsr-generate') as HTMLButtonElement).disabled = true;
  jsrResetSprintDropdown();
  (document.getElementById('jsr-assignee') as HTMLSelectElement).innerHTML =
    '<option value="">Select sprint first</option>';
  if (!boardId) return;

  jsrSprintInput.disabled = false;
  jsrSprintInput.placeholder = 'Loading sprints...';
  try {
    const raw = await jsrFetchAllSprints(boardId);
    const sorted = jsrSortSprintsByYearWeek(raw);
    setAllSprints(sorted);
    setSprintGrouped(jsrGroupSprintsByYear(sorted));
    setSprintInputPlaceholder(`Search ${sorted.length} sprints...`);
  } catch (e) {
    setSprintInputError('Error loading sprints');
    console.error('[JSR]', e);
  }
}

// ── Sprint change ─────────────────────────────────────────────────────────────

export async function onSprintChange(sprintId: string): Promise<void> {
  const assigneeSel = document.getElementById('jsr-assignee') as HTMLSelectElement;
  const genBtn      = document.getElementById('jsr-generate') as HTMLButtonElement;
  if (!sprintId) {
    assigneeSel.innerHTML = '<option value="">Select sprint first</option>';
    genBtn.disabled = true;
    return;
  }
  assigneeSel.innerHTML = '<option value="">Loading members...</option>';
  genBtn.disabled = true;
  try {
    const [members, me] = await Promise.all([
      jsrFetchSprintMembers(sprintId),
      jsrFetchCurrentUser(),
    ]);
    const myId   = me.accountId ?? me.name;
    const myName = me.displayName ?? me.name ?? 'Me';
    assigneeSel.innerHTML =
      `<option value="">All members</option><option value="${jsrEsc(myName)}" selected>${jsrEsc(myName)} ⭐ (me)</option>`;
    members
      .filter((u) => (u.accountId ?? u.name) !== myId)
      .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''))
      .forEach((u) => {
        const n = u.displayName ?? u.name ?? u.accountId ?? '';
        assigneeSel.innerHTML += `<option value="${jsrEsc(n)}">${jsrEsc(n)}</option>`;
      });
  } catch (e) {
    console.warn('[JSR] Failed to load sprint members:', e);
    try {
      const me = await jsrFetchCurrentUser();
      const myName = me.displayName ?? me.name ?? 'Me';
      assigneeSel.innerHTML =
        `<option value="">All members</option><option value="${jsrEsc(myName)}" selected>${jsrEsc(myName)} ⭐ (me)</option>`;
    } catch (_) {
      assigneeSel.innerHTML = '<option value="">All members</option>';
    }
  }
  genBtn.disabled = false;
}

// ── Generate report ───────────────────────────────────────────────────────────

async function handleGenerate(): Promise<void> {
  const boardId    = (document.getElementById('jsr-board-value') as HTMLInputElement).value;
  const sprintId   = (document.getElementById('jsr-sprint-value') as HTMLInputElement).value;
  const assignee   = (document.getElementById('jsr-assignee') as HTMLSelectElement).value;
  const sprintName = jsrSelectedSprintName || sprintId;
  const reportDiv  = document.getElementById('jsr-report')!;
  const genBtn     = document.getElementById('jsr-generate') as HTMLButtonElement;
  if (!boardId || !sprintId) return;

  genBtn.disabled = true;
  reportDiv.innerHTML =
    '<div class="jsr-loading"><div class="spinner"></div><br>Fetching sprint data...</div>';

  const showCarriedInvalid = (
    document.getElementById('jsr-show-carried-invalid') as HTMLInputElement
  ).checked;

  try {
    const nextSprint = jsrFindNextSprint(sprintId, jsrAllSprints);
    const prevSprint = jsrFindPrevSprint(sprintId, jsrAllSprints);
    const [sprintReport, issues, nextIssues, prevIssues] = await Promise.all([
      jsrFetchSprintReport(boardId, sprintId).catch(() => null),
      jsrFetchSprintIssues(sprintId, assignee),
      nextSprint ? jsrFetchSprintIssues(nextSprint.id, null) : Promise.resolve([]),
      prevSprint ? jsrFetchSprintIssues(prevSprint.id, null) : Promise.resolve([]),
    ]);
    console.log(
      `[JSR] next sprint: ${nextSprint?.name ?? 'none'}, prev sprint: ${prevSprint?.name ?? 'none'}`
    );

    if (!issues.length) {
      reportDiv.innerHTML =
        '<div class="jsr-loading">No issues found for selected sprint/assignee.</div>';
      genBtn.disabled = false;
      return;
    }

    const analysis = jsrAnalyzeIssues(issues, sprintReport, sprintId, nextIssues, prevIssues);
    jsrRenderReport(analysis, sprintName, assignee, showCarriedInvalid);
  } catch (e) {
    reportDiv.innerHTML = `<div class="jsr-loading" style="color:#FF5630">❌ ${jsrEsc((e as Error).message)}</div>`;
    console.error('[JSR]', e);
  }
  genBtn.disabled = false;
}

// ── Wire up all events — called after panel DOM is ready ─────────────────────

export function initEvents(): void {
  const genBtn = document.getElementById('jsr-generate') as HTMLButtonElement;
  genBtn.onclick = () => { void handleGenerate(); };

  // Register board/sprint change handlers via setters (avoids circular import)
  setOnBoardChange((id) => { void onBoardChange(id); });
  setOnSprintChange((id) => { void onSprintChange(id); });
}
