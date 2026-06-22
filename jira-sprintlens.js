/**
 * Jira SprintLens — Chrome Extension Content Script
 *
 * After installing the extension, navigate to a Jira page and click the extension icon.
 */
;(function () {
  'use strict';

  // Guard against duplicate injection — panel is opened explicitly by popup.js via __JSR_OPEN__
  if (window.__JSR_LOADED__) {
    return;
  }
  window.__JSR_LOADED__ = true;

  // ─────────────────────────────────────────────
  // CONFIG — adjust to match your Jira instance
  // ─────────────────────────────────────────────
  const CONFIG = {
    bugTypeNames: ['Bug', 'bug', 'Defect'],
    doneStatusNames: ['Done', 'Closed', 'Resolved'],
    storyPointFields: [
      'story_points',
      'customfield_10016',
      'customfield_10028',
      'customfield_10004',
    ],
    maxResults: 200,
  };

  // ─────────────────────────────────────────────
  // STYLES — injected as a <style> element
  // ─────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'jsr-styles';
  style.textContent = `

#jsr-overlay {
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(9,30,66,.54); display: none;
      align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    #jsr-overlay.active { display: flex; }

    #jsr-panel {
      background: #fff; border-radius: 12px; width: 920px; max-width: 94vw;
      max-height: 88vh; overflow: hidden; padding: 0;
      box-shadow: 0 8px 40px rgba(9,30,66,.25);
      display: flex; flex-direction: column;
    }
    #jsr-panel-header {
      padding: 24px 28px 16px; border-bottom: 1px solid #EBECF0;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    #jsr-panel-header h2 { margin: 0; font-size: 20px; color: #172B4D; }
    #jsr-close {
      background: none; border: none; font-size: 22px; color: #6B778C;
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    #jsr-close:hover { background: #EBECF0; }

    .jsr-form { padding: 20px 28px; display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end; flex-shrink: 0; }
    .jsr-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12px;
      font-weight: 600; color: #6B778C; text-transform: uppercase; letter-spacing: .5px; }
    .jsr-form select, .jsr-form input {
      padding: 8px 12px; border: 2px solid #DFE1E6; border-radius: 6px;
      font-size: 14px; color: #172B4D; min-width: 180px; background: #FAFBFC;
      transition: border-color .15s;
    }
    .jsr-form select:focus, .jsr-form input:focus { border-color: #2684FF; outline: none; background: #fff; }
    .jsr-btn {
      padding: 8px 20px; border: none; border-radius: 6px; font-size: 14px;
      font-weight: 600; cursor: pointer; transition: background .15s;
    }
    .jsr-btn-primary { background: #0052CC; color: #fff; }
    .jsr-btn-primary:hover { background: #0065FF; }
    .jsr-btn-primary:disabled { background: #B3D4FF; cursor: not-allowed; }
    .jsr-btn-secondary { background: #EBECF0; color: #42526E; }
    .jsr-btn-secondary:hover { background: #DFE1E6; }

    #jsr-report { padding: 0 28px 28px; flex: 1; overflow-y: auto; min-height: 0; }
    .jsr-loading { text-align: center; padding: 40px; color: #6B778C; font-size: 14px; }
    .jsr-loading .spinner {
      display: inline-block; width: 28px; height: 28px; border: 3px solid #DFE1E6;
      border-top-color: #0052CC; border-radius: 50%;
      animation: jsr-spin .7s linear infinite; margin-bottom: 12px;
    }
    @keyframes jsr-spin { to { transform: rotate(360deg); } }

    .jsr-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
    .jsr-stat-card {
      background: #F4F5F7; border-radius: 8px; padding: 16px; text-align: center;
      border-left: 4px solid #DFE1E6;
    }
    .jsr-stat-card .num { font-size: 28px; font-weight: 700; color: #172B4D; }
    .jsr-stat-card .lbl { font-size: 12px; color: #6B778C; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
    .jsr-stat-card.green  { border-left-color: #36B37E; }
    .jsr-stat-card.red    { border-left-color: #FF5630; }
    .jsr-stat-card.blue   { border-left-color: #0052CC; }
    .jsr-stat-card.orange { border-left-color: #FF991F; }
    .jsr-stat-card.purple { border-left-color: #6554C0; }
    .jsr-stat-card.teal   { border-left-color: #00B8D9; }

    .jsr-table-wrap { overflow-x: auto; margin-top: 16px; }
    .jsr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .jsr-table th {
      text-align: left; padding: 10px 12px; background: #F4F5F7;
      color: #6B778C; font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: .5px;
      border-bottom: 2px solid #DFE1E6; position: sticky; top: 0;
    }
    .jsr-table td { padding: 10px 12px; border-bottom: 1px solid #EBECF0; color: #172B4D; }
    .jsr-table tr:hover td { background: #F4F5F7; }
    .jsr-tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; }
    .jsr-tag-done    { background: #E3FCEF; color: #006644; }
    .jsr-tag-todo    { background: #DEEBFF; color: #0747A6; }
    .jsr-tag-inprog  { background: #EAE6FF; color: #403294; }
    .jsr-tag-bug     { background: #FFEBE6; color: #BF2600; }
    .jsr-tag-added   { background: #FFF0B3; color: #FF8B00; }
    .jsr-tag-devdone { background: #E3FCEF; color: #006644; }
    .jsr-row-devdone td { background: #E3FCEF; }

    .jsr-section-title {
      font-size: 15px; font-weight: 700; color: #172B4D;
      margin: 24px 0 8px; padding-bottom: 8px; border-bottom: 2px solid #EBECF0;
    }
    .jsr-export-bar { display: flex; gap: 8px; margin-top: 20px; justify-content: flex-end; }

    /* ── Searchable Dropdown ── */
    .jsr-search-wrap { position: relative; }
    .jsr-search-wrap input.jsr-search-input {
      width: 100%; box-sizing: border-box; min-width: 240px;
      padding: 8px 32px 8px 12px;
    }
    .jsr-search-clear {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: none; border: none; font-size: 16px; color: #6B778C;
      cursor: pointer; padding: 0 4px; display: none; line-height: 1;
    }
    .jsr-search-clear:hover { color: #FF5630; }
    .jsr-search-wrap.has-value .jsr-search-clear { display: block; }
    .jsr-dropdown {
      position: fixed; z-index: 100001;
      background: #fff; border: 2px solid #2684FF; border-top: none;
      border-radius: 0 0 6px 6px; max-height: 280px; overflow-y: auto;
      box-shadow: 0 4px 12px rgba(9,30,66,.15); display: none;
    }
    .jsr-dropdown.open { display: block; }
    .jsr-dropdown-item {
      padding: 8px 12px; cursor: pointer; font-size: 13px; color: #172B4D;
      border-bottom: 1px solid #F4F5F7; transition: background .1s;
    }
    .jsr-dropdown-item:hover, .jsr-dropdown-item.active { background: #DEEBFF; }
    .jsr-dropdown-item .jsr-board-type {
      font-size: 11px; color: #6B778C; margin-left: 6px;
    }
    .jsr-dropdown-empty {
      padding: 16px 12px; text-align: center; color: #6B778C; font-size: 13px;
    }
    .jsr-dropdown-count {
      padding: 6px 12px; font-size: 11px; color: #6B778C; background: #F4F5F7;
      border-bottom: 1px solid #EBECF0; position: sticky; top: 0;
    }

    /* ── Sprint Dropdown ── */
    .jsr-sprint-wrap { position: relative; }
    .jsr-sprint-wrap input.jsr-sprint-input {
      width: 100%; box-sizing: border-box; min-width: 260px;
      padding: 8px 32px 8px 12px;
    }
    .jsr-sprint-clear {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: none; border: none; font-size: 16px; color: #6B778C;
      cursor: pointer; padding: 0 4px; display: none; line-height: 1;
    }
    .jsr-sprint-clear:hover { color: #FF5630; }
    .jsr-sprint-wrap.has-value .jsr-sprint-clear { display: block; }
    #jsr-sprint-dropdown {
      position: fixed; z-index: 100001;
      background: #fff; border: 2px solid #2684FF; border-top: none;
      border-radius: 0 0 6px 6px; max-height: 320px; overflow-y: auto;
      box-shadow: 0 4px 12px rgba(9,30,66,.15); display: none;
    }
    #jsr-sprint-dropdown.open { display: block; }
    .jsr-sprint-year-header {
      padding: 8px 12px; font-size: 12px; font-weight: 700; color: #0052CC;
      background: #DEEBFF; position: sticky; top: 0; z-index: 1;
      border-bottom: 1px solid #B3D4FF;
    }
    .jsr-sprint-item {
      padding: 8px 12px; cursor: pointer; font-size: 13px; color: #172B4D;
      border-bottom: 1px solid #F4F5F7; transition: background .1s;
      display: flex; align-items: center; justify-content: space-between;
    }
    .jsr-sprint-item:hover, .jsr-sprint-item.active { background: #DEEBFF; }
    .jsr-sprint-item .jsr-sprint-meta {
      font-size: 11px; color: #6B778C; white-space: nowrap; margin-left: 12px;
    }
    .jsr-sprint-item .jsr-sprint-active-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: #36B37E; margin-right: 6px; flex-shrink: 0;
    }
    .jsr-sprint-load-more {
      padding: 10px 12px; text-align: center; font-size: 12px; color: #0052CC;
      cursor: pointer; background: #F4F5F7; border-top: 1px solid #EBECF0;
    }
    .jsr-sprint-load-more:hover { background: #DEEBFF; }
    .jsr-sprint-loading-more {
      padding: 10px 12px; text-align: center; font-size: 12px; color: #6B778C;
    }
  `;
  document.head.appendChild(style);

  // ─────────────────────────────────────────────
  // JIRA API HELPERS
  // ─────────────────────────────────────────────

  const baseUrl = window.location.origin;

  async function jiraGet(path) {
    const res = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Jira API ${res.status}: ${path}`);
    return res.json();
  }

  async function fetchAllBoards(name = '') {
    let all = [];
    let startAt = 0;
    const nameParam = name ? `&name=${encodeURIComponent(name)}` : '';
    while (true) {
      const data = await jiraGet(`/rest/agile/1.0/board?maxResults=100&startAt=${startAt}${nameParam}`);
      const values = data.values || [];
      all = all.concat(values);
      if (data.isLast !== false && startAt + values.length >= (data.total || all.length)) break;
      startAt += values.length;
      if (!values.length) break; // safety
    }
    return all;
  }

  function detectBoardFromUrl() {
    const url = window.location.href;
    // https://xxx.atlassian.net/jira/software/projects/XXX/boards/123
    let m = url.match(/\/boards\/(\d+)/);
    if (m) return m[1];
    // https://xxx.atlassian.net/secure/RapidBoard.jspa?rapidView=123
    m = url.match(/[?&]rapidView=(\d+)/);
    if (m) return m[1];
    return null;
  }

  async function fetchAllSprints(boardId) {
    let all = [];
    let startAt = 0;
    const maxResults = 50;
    while (true) {
      const data = await jiraGet(
        `/rest/agile/1.0/board/${boardId}/sprint?maxResults=${maxResults}&state=active,closed&startAt=${startAt}`
      );
      const values = data.values || [];
      all = all.concat(values);
      console.log(`[JSR] fetchAllSprints page startAt=${startAt} got=${values.length} total_so_far=${all.length} isLast=${data.isLast}`);
      // Stop when: last page flagged, fewer results than page size, or empty result
      if (data.isLast === true || values.length < maxResults || !values.length) break;
      startAt += values.length;
    }
    console.log(`[JSR] fetchAllSprints done, total=${all.length} sprints`);
    return all;
  }

  /**
   * Parse sprint naming, supports three formats:
   *   <prefix>_PI<year><end_week>_W<start_week>/<end_week>
   *     e.g.: XX_PI2625_W21/22   → { year:2026, piEndWeek:25, startWeek:21, endWeek:22 }
   *   <prefix>_PI<year>W<end_week>_W<start_week>&<end_week>
   *     e.g.: XX_PI26W26_W21&22  → { year:2026, piEndWeek:26, startWeek:21, endWeek:22 }
   *   <prefix>_PI<year>W<week>  (legacy format / fallback)
   *     e.g.: XX_PI26W3         → { year:2026, piEndWeek:3,  startWeek:3,  endWeek:3  }
   */
  function parseSprintName(name) {
    // Latest format: XX_PI2625_W21/22
    const compact = name.match(/\w_PI(\d{2})(\d{2})_W(\d{1,2})\/(\d{1,2})/i);
    if (compact) {
      return {
        year:       parseInt(compact[1], 10) + 2000,
        piEndWeek:  parseInt(compact[2], 10),
        startWeek:  parseInt(compact[3], 10),
        endWeek:    parseInt(compact[4], 10),
      };
    }
    // Full format: XX_PI26W26_W21&22
    const full = name.match(/\w_PI(\d{2,4})W(\d{1,2})_W(\d{1,2})&(\d{1,2})/i);
    if (full) {
      let year = parseInt(full[1], 10);
      if (year < 100) year += 2000;
      return {
        year,
        piEndWeek:  parseInt(full[2], 10),
        startWeek:  parseInt(full[3], 10),
        endWeek:    parseInt(full[4], 10),
      };
    }
    // Short format: XX_PI26W3
    const short = name.match(/\w_PI(\d{2,4})W(\d{1,2})/i);
    if (short) {
      let year = parseInt(short[1], 10);
      if (year < 100) year += 2000;
      const w = parseInt(short[2], 10);
      return { year, piEndWeek: w, startWeek: w, endWeek: w };
    }
    return null;
  }

  /**
   * Sorting rules (all descending):
   *   1. year descending
   *   2. piEndWeek descending (PI end week)
   *   3. startWeek descending (sprint start week)
   *   4. endWeek descending (sprint end week)
   *   Unparseable sprints are sorted by startDate descending at the end
   */
  function sortSprintsByYearWeek(sprints) {
    return [...sprints].sort((a, b) => {
      const pa = parseSprintName(a.name);
      const pb = parseSprintName(b.name);
      if (pa && pb) {
        if (pa.year       !== pb.year)       return pb.year       - pa.year;
        if (pa.piEndWeek  !== pb.piEndWeek)  return pb.piEndWeek  - pa.piEndWeek;
        if (pa.startWeek  !== pb.startWeek)  return pb.startWeek  - pa.startWeek;
        return pb.endWeek - pa.endWeek;
      }
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      return new Date(b.startDate || 0) - new Date(a.startDate || 0);
    });
  }

  function findPrevSprint(sprintId) {
    const current = allSprints.find((sp) => String(sp.id) === String(sprintId));
    if (!current) return null;

    const currentStart = current.startDate ? new Date(current.startDate).getTime() : NaN;
    if (Number.isFinite(currentStart)) {
      const earlier = allSprints
        .filter((sp) => String(sp.id) !== String(sprintId) && sp.startDate)
        .filter((sp) => new Date(sp.startDate).getTime() < currentStart)
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      if (earlier.length) return earlier[0];
    }

    const index = allSprints.findIndex((sp) => String(sp.id) === String(sprintId));
    return index >= 0 && index < allSprints.length - 1 ? allSprints[index + 1] : null;
  }

  function findNextSprint(sprintId) {
    const current = allSprints.find((sp) => String(sp.id) === String(sprintId));
    if (!current) return null;

    const currentStart = current.startDate ? new Date(current.startDate).getTime() : NaN;
    if (Number.isFinite(currentStart)) {
      const later = allSprints
        .filter((sp) => String(sp.id) !== String(sprintId) && sp.startDate)
        .filter((sp) => new Date(sp.startDate).getTime() > currentStart)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      if (later.length) return later[0];
    }

    const index = allSprints.findIndex((sp) => String(sp.id) === String(sprintId));
    return index > 0 ? allSprints[index - 1] : null;
  }

  function groupSprintsByYear(sprints) {
    const groups = new Map(); // year → sprints[]
    const noYear = [];
    for (const sp of sprints) {
      const parsed = parseSprintName(sp.name);
      if (parsed) {
        if (!groups.has(parsed.year)) groups.set(parsed.year, []);
        groups.get(parsed.year).push({ ...sp, _parsed: parsed });
      } else {
        noYear.push(sp);
      }
    }
    const years = Array.from(groups.keys()).sort((a, b) => b - a);
    console.log(`[JSR] groupSprintsByYear years=${JSON.stringify(years)}, noYear=${noYear.length}`);
    return { years, groups, noYear };
  }

  async function fetchSprintReport(boardId, sprintId) {
    return jiraGet(`/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=${boardId}&sprintId=${sprintId}`);
  }

  let storyPointFieldsPromise = null;

  async function detectStoryPointFields() {
    if (!storyPointFieldsPromise) {
      storyPointFieldsPromise = jiraGet('/rest/api/2/field')
        .then((fields) => {
          const detected = fields
            .filter((field) => /story\s*points?/i.test(field.name || ''))
            .map((field) => field.id);
          CONFIG.storyPointFields = [...new Set([...detected, ...CONFIG.storyPointFields])];
          console.log(`[JSR] story point fields=${JSON.stringify(CONFIG.storyPointFields)}`);
        })
        .catch((e) => {
          console.warn('[JSR] Failed to detect story point fields, using configured fallbacks:', e);
        });
    }
    return storyPointFieldsPromise;
  }

  async function fetchSprintIssues(sprintId, assignee) {
    await detectStoryPointFields();
    let jql = `sprint = ${sprintId}`;
    if (assignee) jql += ` AND assignee = "${assignee}"`;
    let allIssues = [];
    let startAt = 0;
    while (true) {
      const data = await jiraGet(
        `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.maxResults}&startAt=${startAt}&fields=summary,status,issuetype,assignee,priority,created,resolutiondate,${CONFIG.storyPointFields.join(',')}&expand=changelog`
      );
      allIssues = allIssues.concat(data.issues || []);
      if (startAt + data.maxResults >= data.total) break;
      startAt += data.maxResults;
    }
    return allIssues;
  }

  async function fetchCurrentUser() {
    return jiraGet('/rest/api/2/myself');
  }

  async function fetchSprintMembers(sprintId) {
    const data = await jiraGet(
      `/rest/api/2/search?jql=${encodeURIComponent(`sprint = ${sprintId}`)}&maxResults=200&startAt=0&fields=assignee`
    );
    const seen = new Map();
    for (const issue of data.issues || []) {
      const a = issue.fields?.assignee;
      if (a && !seen.has(a.accountId || a.name)) {
        seen.set(a.accountId || a.name, a);
      }
    }
    return Array.from(seen.values());
  }

  // ─────────────────────────────────────────────
  // ANALYSIS ENGINE
  // ─────────────────────────────────────────────
  function analyzeIssues(issues, sprintReport, sprintId, nextSprintIssues = [], prevSprintIssues = []) {
    const addedKeys = new Set();
    if (sprintReport?.contents?.issueKeysAddedDuringSprint) {
      Object.keys(sprintReport.contents.issueKeysAddedDuringSprint).forEach((k) => addedKeys.add(k));
    }

    const isBug = (issue) =>
      CONFIG.bugTypeNames.some(
        (n) => n.toLowerCase() === (issue.fields?.issuetype?.name || '').toLowerCase()
      );

    // Strictly "Done" status only (not Resolved/Obsolete)
    const isStrictlyDone = (issue) => {
      const statusName = (issue.fields?.status?.name || '').toLowerCase();
      return statusName === 'done';
    };

    const isDone = (issue) =>
      CONFIG.doneStatusNames.some(
        (n) => n.toLowerCase() === (issue.fields?.status?.name || '').toLowerCase()
      ) || issue.fields?.status?.statusCategory?.key === 'done';

    const isInvalidBug = (issue) => {
      const statusName = (issue.fields?.status?.name || '').toLowerCase();
      return statusName === 'obsolete' || statusName === 'resolved';
    };

    // A carried-over invalid bug: it's Obsolete/Resolved AND was not created in this sprint.
    // This covers bugs dragged across multiple sprints — regardless of whether the prev sprint
    // query returned them (Jira JQL may exclude issues that were moved out of a closed sprint).
    const prevIssuesByKey = new Map(prevSprintIssues.map((i) => [i.key, i]));
    const isCarriedOverInvalidBug = (issue) => {
      if (!isInvalidBug(issue)) return false;
      // If it exists in prev sprint issues, definitely carried over
      if (prevIssuesByKey.has(issue.key)) return true;
      // If created before this sprint started, it's not new to this sprint → carried over
      if (sprintStartDate && issue.fields?.created) {
        return new Date(issue.fields.created) < sprintStartDate;
      }
      return false;
    };

    const getIssueStoryPoints = (issue) => {
      for (const f of CONFIG.storyPointFields) {
        const v = issue.fields?.[f];
        if (v != null && v !== '' && Number.isFinite(Number(v))) return Number(v);
      }
      return null;
    };

    const getReportStoryPoints = (reportIssue) => {
      const values = [
        reportIssue?.currentEstimateStatistic?.statFieldValue?.value,
        reportIssue?.currentEstimateStatistic?.value,
        reportIssue?.estimateStatistic?.statFieldValue?.value,
        reportIssue?.estimateStatistic?.value,
      ];
      const value = values.find((v) => v != null && v !== '' && Number.isFinite(Number(v)));
      return value == null ? null : Number(value);
    };

    const reportPointsByKey = new Map();
    for (const value of Object.values(sprintReport?.contents || {})) {
      if (!Array.isArray(value)) continue;
      for (const reportIssue of value) {
        const sp = getReportStoryPoints(reportIssue);
        if (reportIssue?.key && sp != null && !reportPointsByKey.has(reportIssue.key)) {
          reportPointsByKey.set(reportIssue.key, sp);
        }
      }
    }

    const nextIssuesByKey = new Map(nextSprintIssues.map((issue) => [issue.key, issue]));

    const wasAddedDuringSprint = (issue) => {
      if (addedKeys.has(issue.key)) return true;
      const sprint = sprintReport?.sprint;
      if (!sprint?.startDate) return false;
      const sprintStart = new Date(sprint.startDate);
      const changelog = issue.changelog?.histories || [];
      for (const h of changelog) {
        for (const item of h.items || []) {
          if (item.field === 'Sprint' && item.toString?.includes(String(sprintId))) {
            if (new Date(h.created) > sprintStart) return true;
          }
        }
      }
      return false;
    };

    let planned = 0, completed = 0, incomplete = 0, addedMidSprint = 0;
    let totalBugs = 0, bugsFixed = 0, bugsOpen = 0, newBugsCreated = 0, invalidBugs = 0, carriedOverInvalidBugs = 0;
    let totalSP = 0, plannedSP = 0, completedSP = 0, spCompletionBase = 0;
    let tasksWithSP = 0, completedTasksWithSP = 0;

    // Sprint start date for "new bugs created" detection
    const sprintStartDate = sprintReport?.sprint?.startDate
      ? new Date(sprintReport.sprint.startDate)
      : null;

    const rows = issues.map((issue) => {
      const bug = isBug(issue);
      const done = isDone(issue);
      const added = wasAddedDuringSprint(issue);
      const sp = reportPointsByKey.get(issue.key) ?? getIssueStoryPoints(issue) ?? 0;
      const carryOverBaseSP = sp;
      const nextIssue = nextIssuesByKey.get(issue.key);
      const remainingSP = nextIssue ? getIssueStoryPoints(nextIssue) : null;
      const carriedOver = !done && remainingSP != null;
      const devCompletedSP = carriedOver ? Math.min(carryOverBaseSP, Math.max(0, carryOverBaseSP - remainingSP)) : 0;
      const devDoneTestPending = carriedOver && carryOverBaseSP > 0 && remainingSP === 0;
      const effectiveDone = done || devDoneTestPending;
      const creditedSP = done ? sp : devCompletedSP;

      const carriedOverInvalid = bug && isCarriedOverInvalidBug(issue);

      if (carriedOverInvalid) {
        // Exclude entirely from completion rate and all ticket/SP counters
        carriedOverInvalidBugs++;
      } else {
        totalSP += sp;
        if (!added) plannedSP += sp;
        completedSP += creditedSP;
        spCompletionBase += carriedOver ? carryOverBaseSP : sp;
        if (sp > 0) {
          tasksWithSP++;
          if (effectiveDone) completedTasksWithSP++;
        }
        if (added) addedMidSprint++;
        else planned++;
        if (effectiveDone) completed++;
        else incomplete++;
        if (bug) {
          totalBugs++;
          // New bugs: created after sprint start
          if (sprintStartDate && issue.fields?.created && new Date(issue.fields.created) >= sprintStartDate) {
            newBugsCreated++;
          }
          if (isInvalidBug(issue)) {
            invalidBugs++;
          } else if (isStrictlyDone(issue) || devDoneTestPending) {
            bugsFixed++;
          } else {
            bugsOpen++;
          }
        }
      }

      return {
        key: issue.key,
        summary: issue.fields?.summary || '',
        type: issue.fields?.issuetype?.name || '',
        typeIcon: issue.fields?.issuetype?.iconUrl || '',
        status: issue.fields?.status?.name || '',
        statusCategory: issue.fields?.status?.statusCategory?.key || '',
        priority: issue.fields?.priority?.name || '',
        priorityIcon: issue.fields?.priority?.iconUrl || '',
        assignee: issue.fields?.assignee?.displayName || 'Unassigned',
        sp, carryOverBaseSP, remainingSP, creditedSP, isBug: bug, isDone: done, isAdded: added,
        isCarriedOver: carriedOver, isDevDoneTestPending: devDoneTestPending,
        isInvalidBug: isInvalidBug(issue),
        isCarriedOverInvalidBug: carriedOverInvalid,
        created: issue.fields?.created,
        resolved: issue.fields?.resolutiondate,
      };
    });

    return {
      summary: {
        total: issues.length, planned, addedMidSprint, completed, incomplete,
        totalBugs, bugsFixed, bugsOpen, newBugsCreated, invalidBugs, carriedOverInvalidBugs,
        totalSP, plannedSP, completedSP, spCompletionBase,
        tasksWithSP, completedTasksWithSP,
        completionRate: issues.length ? ((completed / issues.length) * 100).toFixed(1) : '0',
        taskCompletionRate: tasksWithSP ? ((completedTasksWithSP / tasksWithSP) * 100).toFixed(1) : 'N/A',
        spCompletionRate: spCompletionBase ? ((completedSP / spCompletionBase) * 100).toFixed(1) : 'N/A',
      },
      rows,
    };
  }

  // ─────────────────────────────────────────────
  // UI RENDERING
  // ─────────────────────────────────────────────
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderReport(analysis, sprintName, assigneeName, showCarriedInvalid = false) {
    const s = analysis.summary;
    const who = assigneeName || 'All Members';
    const percentage = (value) => value === 'N/A' ? value : `${value}%`;

    let html = `
      <div class="jsr-section-title">📊 Sprint Report: ${esc(sprintName)} — ${esc(who)}</div>
      <div class="jsr-stats">
        <div class="jsr-stat-card blue"><div class="num">${s.total}</div><div class="lbl">Total Tickets</div></div>
        <div class="jsr-stat-card blue"><div class="num">${s.planned}</div><div class="lbl">Planned</div></div>
        <div class="jsr-stat-card orange"><div class="num">${s.addedMidSprint}</div><div class="lbl">Added Mid-Sprint</div></div>
        <div class="jsr-stat-card green"><div class="num">${s.completed}</div><div class="lbl">Completed</div></div>
        <div class="jsr-stat-card red"><div class="num">${s.incomplete}</div><div class="lbl">Incomplete</div></div>
        <div class="jsr-stat-card green"><div class="num">${percentage(s.completionRate)}</div><div class="lbl">Completion Rate</div></div>
      </div>
      <div class="jsr-stats">
        <div class="jsr-stat-card red"><div class="num">${s.totalBugs}</div><div class="lbl">Total Bugs</div></div>
        <div class="jsr-stat-card orange"><div class="num">${s.newBugsCreated}</div><div class="lbl">New Bugs Created</div></div>
        <div class="jsr-stat-card green"><div class="num">${s.bugsFixed}</div><div class="lbl">Bugs Fixed</div></div>
        <div class="jsr-stat-card red"><div class="num">${s.bugsOpen}</div><div class="lbl">Bugs Open</div></div>
        <div class="jsr-stat-card teal"><div class="num">${s.invalidBugs}</div><div class="lbl">Invalid / Duplicated</div></div>
        ${showCarriedInvalid ? `<div class="jsr-stat-card" style="border-left-color:#97A0AF"><div class="num">${s.carriedOverInvalidBugs}</div><div class="lbl">Carried-Over Invalid</div></div>` : ''}
        <div class="jsr-stat-card purple"><div class="num">${s.totalSP}</div><div class="lbl">Total Story Points</div></div>
        <div class="jsr-stat-card blue"><div class="num">${s.plannedSP}</div><div class="lbl">Planned Story Points</div></div>
        <div class="jsr-stat-card teal"><div class="num">${s.completedSP}</div><div class="lbl">Completed Story Points</div></div>
        <div class="jsr-stat-card blue"><div class="num">${s.spCompletionBase}</div><div class="lbl">SP Completion Base</div></div>
        <div class="jsr-stat-card purple"><div class="num">${percentage(s.spCompletionRate)}</div><div class="lbl">SP Completion Rate</div></div>
        <div class="jsr-stat-card green"><div class="num">${percentage(s.taskCompletionRate)}</div><div class="lbl">Task Complete Rate</div></div>
      </div>
    `;

    html += `
      <div class="jsr-section-title">📋 Issue Details</div>
      <div class="jsr-table-wrap">
        <table class="jsr-table">
          <thead><tr>
            <th>Key</th><th>Type</th><th>Summary</th><th>Status</th>
            <th>Priority</th><th>Assignee</th><th>SP</th><th>Credited SP</th><th>Tags</th>
          </tr></thead><tbody>
    `;
    for (const r of analysis.rows) {
      // Skip carried-over invalid bugs unless checkbox is checked
      if (r.isCarriedOverInvalidBug && !showCarriedInvalid) continue;

      const statusTag = r.statusCategory === 'done' ? 'jsr-tag-done'
        : r.statusCategory === 'indeterminate' ? 'jsr-tag-inprog' : 'jsr-tag-todo';
      let tags = '';
      if (r.isBug) tags += '<span class="jsr-tag jsr-tag-bug">Bug</span> ';
      if (r.isAdded) tags += '<span class="jsr-tag jsr-tag-added">Added</span> ';
      if (r.isCarriedOver) tags += `<span class="jsr-tag jsr-tag-added">Carry-over Base: ${r.carryOverBaseSP}, Remaining SP: ${r.remainingSP}</span> `;
      if (r.isDevDoneTestPending) tags += '<span class="jsr-tag jsr-tag-devdone">Development Done / Testing Pending</span> ';
      if (r.isCarriedOverInvalidBug) tags += '<span class="jsr-tag" style="background:#F4F5F7;color:#6B778C">Carried-Over Invalid</span> ';

      html += `<tr class="${r.isDevDoneTestPending ? 'jsr-row-devdone' : ''}">
        <td><a href="${baseUrl}/browse/${r.key}" target="_blank" style="color:#0052CC;text-decoration:none;font-weight:600">${r.key}</a></td>
        <td>${r.typeIcon ? `<img src="${r.typeIcon}" width="16" style="vertical-align:middle;margin-right:4px">` : ''}${esc(r.type)}</td>
        <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.summary)}">${esc(r.summary)}</td>
        <td><span class="jsr-tag ${statusTag}">${esc(r.status)}</span></td>
        <td>${r.priorityIcon ? `<img src="${r.priorityIcon}" width="16" style="vertical-align:middle;margin-right:4px">` : ''}${esc(r.priority)}</td>
        <td>${esc(r.assignee)}</td>
        <td style="text-align:center">${r.sp || '-'}</td>
        <td style="text-align:center">${r.creditedSP || '-'}</td>
        <td>${tags || '-'}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;

    html += `
      <div class="jsr-export-bar">
        <button class="jsr-btn jsr-btn-secondary" id="jsr-export-csv">⬇ Export CSV</button>
        <button class="jsr-btn jsr-btn-secondary" id="jsr-export-html">⬇ Export HTML</button>
        <button class="jsr-btn jsr-btn-secondary" id="jsr-export-pdf">⬇ Export PDF</button>
      </div>
    `;

    document.getElementById('jsr-report').innerHTML = html;
    document.getElementById('jsr-export-csv').onclick = () => exportCSV(analysis, sprintName, who);
    document.getElementById('jsr-export-html').onclick = () => exportHTML(analysis, sprintName, who);
    document.getElementById('jsr-export-pdf').onclick = () => exportPDF(sprintName);
  }

  // ─────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────
  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCSV(analysis, sprintName, who) {
    const s = analysis.summary;
    const percentage = (value) => value === 'N/A' ? value : `${value}%`;
    let csv = '\uFEFF'; // BOM for Excel CJK compatibility
    csv += `Sprint Report: ${sprintName} — ${who}\n`;
    csv += `Total,${s.total},Planned,${s.planned},Added,${s.addedMidSprint},Completed,${s.completed},Incomplete,${s.incomplete}\n`;
    csv += `Bugs Total,${s.totalBugs},New Bugs Created,${s.newBugsCreated},Bugs Fixed,${s.bugsFixed},Bugs Open,${s.bugsOpen},Invalid/Duplicated Bugs,${s.invalidBugs}\n`;
    csv += `Story Points,${s.totalSP},Planned Story Points,${s.plannedSP},Completed Story Points,${s.completedSP},SP Completion Base,${s.spCompletionBase},SP Completion Rate,${percentage(s.spCompletionRate)}\n`;
    csv += `Tasks With Story Points,${s.tasksWithSP},Completed Tasks With Story Points,${s.completedTasksWithSP},Task Complete Rate,${percentage(s.taskCompletionRate)}\n`;
    csv += `Ticket Completion Rate,${percentage(s.completionRate)}\n\n`;
    csv += `Key,Type,Summary,Status,Priority,Assignee,Story Points,Carry-over Base Story Points,Credited Story Points,Remaining Story Points,Is Bug,Added Mid-Sprint,Development Done Testing Pending\n`;
    for (const r of analysis.rows) {
      csv += `${r.key},${r.type},"${r.summary.replace(/"/g, '""')}",${r.status},${r.priority},${r.assignee},${r.sp},${r.carryOverBaseSP},${r.creditedSP},${r.remainingSP ?? ''},${r.isBug},${r.isAdded},${r.isDevDoneTestPending}\n`;
    }
    downloadFile(`sprintlens-${sprintName}.csv`, csv, 'text/csv');
  }

  function buildExportHTML(sprintName, { autoPrint = false } = {}) {
    const content = document.getElementById('jsr-report').innerHTML;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sprint Report: ${esc(sprintName)}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:960px;margin:40px auto;padding:0 20px;color:#172B4D}
      ${style.textContent.replace(/#jsr-trigger[\s\S]*?#jsr-overlay\.active\s*\{[^}]*\}/g, '')}
      .jsr-export-bar{display:none}
      @media print {
        body{max-width:none;margin:0;padding:0}
        .jsr-table-wrap{overflow:visible}
        .jsr-table{font-size:10px}
        .jsr-stat-card{break-inside:avoid}
        tr{break-inside:avoid}
      }
    </style></head><body>
    <h1 style="color:#0052CC">Jira SprintLens</h1>
    <p style="color:#6B778C">Generated: ${new Date().toLocaleString()}</p>
    ${content}
    ${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250))<\\/script>' : ''}
    </body></html>`;
  }

  function exportHTML(analysis, sprintName, who) {
    const html = buildExportHTML(sprintName);
    downloadFile(`sprintlens-${sprintName}.html`, html, 'text/html');
  }

  function exportPDF(sprintName) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to export PDF.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildExportHTML(sprintName, { autoPrint: true }));
    printWindow.document.close();
  }

  // ─────────────────────────────────────────────
  // UI SCAFFOLD
  // ─────────────────────────────────────────────
  // Modal
  const overlay = document.createElement('div');
  overlay.id = 'jsr-overlay';
  overlay.innerHTML = `
    <div id="jsr-panel">
      <div id="jsr-panel-header">
        <h2><img src="${chrome.runtime.getURL('icons/icon48.png')}" width="28" height="28" style="vertical-align:middle;margin-right:8px;border-radius:6px">Jira SprintLens</h2>
        <button id="jsr-close">✕</button>
      </div>
      <div class="jsr-form" id="jsr-form">
        <label>Board
          <div class="jsr-search-wrap" id="jsr-board-wrap">
            <input type="text" class="jsr-search-input" id="jsr-board-input" placeholder="Search boards..." autocomplete="off">
            <button class="jsr-search-clear" id="jsr-board-clear">✕</button>
            <div class="jsr-dropdown" id="jsr-board-dropdown"></div>
            <input type="hidden" id="jsr-board-value">
          </div>
        </label>
        <label>Sprint
          <div class="jsr-sprint-wrap" id="jsr-sprint-wrap">
            <input type="text" class="jsr-sprint-input" id="jsr-sprint-input" placeholder="Select board first" autocomplete="off" disabled>
            <button class="jsr-sprint-clear" id="jsr-sprint-clear">✕</button>
            <div id="jsr-sprint-dropdown"></div>
            <input type="hidden" id="jsr-sprint-value">
          </div>
        </label>
        <label>Assignee
          <select id="jsr-assignee"><option value="">All members</option></select>
        </label>
        <label style="flex-direction:row;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:600;color:#6B778C;text-transform:uppercase;letter-spacing:.5px">
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
  document.body.appendChild(overlay);

  // ─────────────────────────────────────────────
  // EVENT BINDING
  // ─────────────────────────────────────────────
  let panelOpen = false;
  const openOverlay = () => { panelOpen = true; overlay.classList.add('active'); };
  const closePanel  = () => {
    panelOpen = false;
    overlay.classList.remove('active');
    document.getElementById('jsr-board-dropdown')?.classList.remove('open');
    document.getElementById('jsr-sprint-dropdown')?.classList.remove('open');
    document.getElementById('jsr-board-input')?.blur();
    document.getElementById('jsr-sprint-input')?.blur();
  };

  //─ Board search state ──
  let allBoards = [];
  let selectedBoardId = null;
  let boardSearchTimer = null;
  let boardSearchRequestId = 0;

  function positionDropdown() {
    const input = document.getElementById('jsr-board-input');
    const dropdown = document.getElementById('jsr-board-dropdown');
    const rect = input.getBoundingClientRect();
    dropdown.style.top = rect.bottom + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
  }

  function renderBoardDropdown(filter) {
    const dropdown = document.getElementById('jsr-board-dropdown');
    const query = (filter || '').toLowerCase().trim();
    const matched = query
      ? allBoards.filter((b) => b.name.toLowerCase().includes(query))
      : allBoards;

    if (!matched.length) {
      dropdown.innerHTML = `<div class="jsr-dropdown-empty">${query ? 'No boards matching "' + esc(filter) + '"' : 'No boards found'}</div>`;
    } else {
      let html = `<div class="jsr-dropdown-count">${matched.length} of ${allBoards.length} boards</div>`;
      matched.forEach((b) => {
        const typeLabel = b.type === 'scrum' ? 'Scrum' : b.type === 'kanban' ? 'Kanban' : b.type || '';
        html += `<div class="jsr-dropdown-item" data-id="${b.id}" data-name="${esc(b.name)}">
          ${esc(b.name)}<span class="jsr-board-type">${typeLabel}</span>
        </div>`;
      });
      dropdown.innerHTML = html;
    }
    positionDropdown();
    dropdown.classList.add('open');
  }

  function selectBoard(id, name) {
    const input = document.getElementById('jsr-board-input');
    const wrap = document.getElementById('jsr-board-wrap');
    const dropdown = document.getElementById('jsr-board-dropdown');
    clearTimeout(boardSearchTimer);
    boardSearchRequestId++;
    document.getElementById('jsr-board-value').value = id || '';
    input.value = name || '';
    wrap.classList.toggle('has-value', !!id);
    dropdown.classList.remove('open');
    selectedBoardId = id;
    // Remember the most recently selected board
    if (id && name) {
      try { chrome.storage.local.set({ jsr_last_board: { id, name } }); } catch (_) {
        try { localStorage.setItem('jsr_last_board', JSON.stringify({ id, name })); } catch (_) {}
      }
    }
    onBoardChange(id);
  }

  function refreshBoardsAfterDelay(delay = 1000) {
    clearTimeout(boardSearchTimer);
    const requestId = ++boardSearchRequestId;
    boardSearchTimer = setTimeout(async () => {
      const query = boardInput.value.trim();
      boardDropdown.innerHTML = '<div class="jsr-dropdown-empty">Refreshing boards...</div>';
      positionDropdown();
      boardDropdown.classList.add('open');

      try {
        const boards = await fetchAllBoards(query);
        if (requestId !== boardSearchRequestId) return;
        allBoards = boards;
        boardInput.placeholder = `Search ${allBoards.length} boards...`;
        renderBoardDropdown(boardInput.value);
      } catch (e) {
        if (requestId !== boardSearchRequestId) return;
        boardDropdown.innerHTML = '<div class="jsr-dropdown-empty">Error loading boards</div>';
        console.error('[JSR]', e);
      }
    }, delay);
  }

  async function openPanel() {
    openOverlay();
    document.getElementById('jsr-report').innerHTML = '';
    const input = document.getElementById('jsr-board-input');
    input.value = '';
    document.getElementById('jsr-board-wrap').classList.remove('has-value');
    document.getElementById('jsr-board-value').value = '';
    resetSprintDropdown();
    document.getElementById('jsr-assignee').innerHTML = '<option value="">Select sprint first</option>';
    document.getElementById('jsr-generate').disabled = true;
    selectedBoardId = null;

    input.placeholder = 'Loading boards...';
    const requestId = ++boardSearchRequestId;
    try {
      allBoards = await fetchAllBoards();
      if (requestId !== boardSearchRequestId || !panelOpen) return;
      input.placeholder = `Search ${allBoards.length} boards...`;

      // Priority: detect board from URL
      const detectedId = detectBoardFromUrl();
      if (detectedId) {
        const match = allBoards.find((b) => String(b.id) === detectedId);
        if (match) {
          selectBoard(String(match.id), match.name);
          return;
        }
      }
      // Fallback: restore previously selected board
      try {
        chrome.storage.local.get('jsr_last_board', (result) => {
          const saved = result?.jsr_last_board;
          if (!saved) {
            // fallback to localStorage
            try {
              const raw = localStorage.getItem('jsr_last_board');
              if (raw) {
                const { id, name } = JSON.parse(raw);
                const match = allBoards.find((b) => String(b.id) === String(id));
                if (match) selectBoard(String(match.id), match.name);
              }
            } catch (_) {}
            return;
          }
          const match = allBoards.find((b) => String(b.id) === String(saved.id));
          if (match) selectBoard(String(match.id), match.name);
        });
      } catch (_) {}
    } catch (e) {
      input.placeholder = 'Error loading boards';
      console.error('[JSR]', e);
    }
  }

  // Expose for reuse on repeated execution (extension icon click via popup.js)
  window.__JSR_OPEN__ = openPanel;
  Object.defineProperty(window, '__JSR_IS_OPEN__', { get: () => panelOpen });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });
  document.getElementById('jsr-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closePanel();
  });

  // ── Board search events ──
  const boardInput = document.getElementById('jsr-board-input');
  const boardDropdown = document.getElementById('jsr-board-dropdown');

  boardInput.addEventListener('focus', () => {
    if (allBoards.length) renderBoardDropdown(boardInput.value);
    else refreshBoardsAfterDelay(0);
  });
  boardInput.addEventListener('input', () => {
    renderBoardDropdown(boardInput.value);
    refreshBoardsAfterDelay();
    // If text is modified while a board is selected, clear the selection
    if (selectedBoardId) {
      selectedBoardId = null;
      document.getElementById('jsr-board-value').value = '';
      resetSprintDropdown();
      document.getElementById('jsr-generate').disabled = true;
    }
  });
  boardDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.jsr-dropdown-item');
    if (item) selectBoard(item.dataset.id, item.dataset.name);
  });
  // Keyboard navigation support
  boardInput.addEventListener('keydown', (e) => {
    const items = boardDropdown.querySelectorAll('.jsr-dropdown-item');
    const active = boardDropdown.querySelector('.jsr-dropdown-item.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = active ? active.nextElementSibling : items[0];
      if (next?.classList.contains('jsr-dropdown-item')) {
        active?.classList.remove('active');
        next.classList.add('active');
        next.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = active?.previousElementSibling;
      if (prev?.classList.contains('jsr-dropdown-item')) {
        active.classList.remove('active');
        prev.classList.add('active');
        prev.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) selectBoard(active.dataset.id, active.dataset.name);
    } else if (e.key === 'Escape') {
      boardDropdown.classList.remove('open');
    }
  });
  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!document.getElementById('jsr-board-wrap').contains(e.target)) {
      boardDropdown.classList.remove('open');
    }
  });

  document.getElementById('jsr-board-clear').onclick = (e) => {
    e.stopPropagation();
    selectBoard('', '');
    boardInput.focus();
  };

  // ── Sprint dropdown state ──
  let allSprints = [];
  let sprintGrouped = null; // { years, groups, noYear }
  let sprintYearsLoaded = []; // which years are currently rendered
  let selectedSprintId = null;
  let selectedSprintName = '';

  const sprintInput = document.getElementById('jsr-sprint-input');
  const sprintDropdown = document.getElementById('jsr-sprint-dropdown');

  function resetSprintDropdown() {
    sprintInput.value = '';
    sprintInput.placeholder = 'Select board first';
    sprintInput.disabled = true;
    document.getElementById('jsr-sprint-wrap').classList.remove('has-value');
    document.getElementById('jsr-sprint-value').value = '';
    sprintDropdown.classList.remove('open');
    sprintDropdown.innerHTML = '';
    selectedSprintId = null;
    selectedSprintName = '';
    allSprints = [];
    sprintGrouped = null;
    sprintYearsLoaded = [];
  }

  function positionSprintDropdown() {
    const rect = sprintInput.getBoundingClientRect();
    sprintDropdown.style.top = rect.bottom + 'px';
    sprintDropdown.style.left = rect.left + 'px';
    sprintDropdown.style.width = Math.max(rect.width, 340) + 'px';
  }

  function renderSprintYear(year) {
    if (sprintYearsLoaded.includes(year)) return;
    sprintYearsLoaded.push(year);
    const sprints = sprintGrouped.groups.get(year) || [];

    let html = `<div class="jsr-sprint-year-header">📅 ${year}</div>`;
    sprints.forEach((sp) => {
      const active = sp.state === 'active' ? '<span class="jsr-sprint-active-dot"></span>' : '';
      const dates = sp.startDate
        ? `${new Date(sp.startDate).toLocaleDateString()} ~ ${sp.endDate ? new Date(sp.endDate).toLocaleDateString() : '...'}`
        : '';
      html += `<div class="jsr-sprint-item" data-id="${sp.id}" data-name="${esc(sp.name)}">
        <span>${active}${esc(sp.name)}</span>
        <span class="jsr-sprint-meta">${dates}</span>
      </div>`;
    });

    // Check if there are earlier years available to load
    const nextYearIdx = sprintGrouped.years.indexOf(year) + 1;
    // Remove old load-more button
    const oldMore = sprintDropdown.querySelector('.jsr-sprint-load-more');
    if (oldMore) oldMore.remove();

    sprintDropdown.insertAdjacentHTML('beforeend', html);

    if (nextYearIdx < sprintGrouped.years.length) {
      const nextYear = sprintGrouped.years[nextYearIdx];
      sprintDropdown.insertAdjacentHTML('beforeend',
        `<div class="jsr-sprint-load-more" data-year="${nextYear}">↓ Load ${nextYear} sprints...</div>`
      );
    }
  }

  function renderSprintDropdown(filter) {
    const query = (filter || '').toLowerCase().trim();

    if (query) {
      // Search mode: show matches across all years
      const matched = allSprints.filter((sp) => sp.name.toLowerCase().includes(query));
      let html = '';
      if (!matched.length) {
        html = `<div class="jsr-dropdown-empty">No sprints matching "${esc(filter)}"</div>`;
      } else {
        html = `<div class="jsr-dropdown-count">${matched.length} sprints found</div>`;
        // Sort by year/week descending
        const sorted = sortSprintsByYearWeek([...matched]);
        sorted.forEach((sp) => {
          const active = sp.state === 'active' ? '<span class="jsr-sprint-active-dot"></span>' : '';
          const dates = sp.startDate
            ? `${new Date(sp.startDate).toLocaleDateString()} ~ ${sp.endDate ? new Date(sp.endDate).toLocaleDateString() : '...'}`
            : '';
          html += `<div class="jsr-sprint-item" data-id="${sp.id}" data-name="${esc(sp.name)}">
            <span>${active}${esc(sp.name)}</span>
            <span class="jsr-sprint-meta">${dates}</span>
          </div>`;
        });
      }
      sprintDropdown.innerHTML = html;
    } else {
      // Browse mode: group by year, show only the current year by default
      sprintDropdown.innerHTML = '';
      sprintYearsLoaded = [];
      if (sprintGrouped && sprintGrouped.years.length) {
        renderSprintYear(sprintGrouped.years[0]); // Most recent year
      } else if (allSprints.length) {
        // No sprints in XX_PI format
        allSprints.forEach((sp) => {
          const active = sp.state === 'active' ? '<span class="jsr-sprint-active-dot"></span>' : '';
          sprintDropdown.innerHTML += `<div class="jsr-sprint-item" data-id="${sp.id}" data-name="${esc(sp.name)}">
            <span>${active}${esc(sp.name)}</span>
          </div>`;
        });
      } else {
        sprintDropdown.innerHTML = '<div class="jsr-dropdown-empty">No sprints found</div>';
      }
    }

    positionSprintDropdown();
    sprintDropdown.classList.add('open');
  }

  function selectSprint(id, name) {
    sprintInput.value = name || '';
    document.getElementById('jsr-sprint-value').value = id || '';
    document.getElementById('jsr-sprint-wrap').classList.toggle('has-value', !!id);
    sprintDropdown.classList.remove('open');
    selectedSprintId = id;
    selectedSprintName = name;
    onSprintChange(id);
  }

  // Sprint dropdown events
  sprintInput.addEventListener('focus', () => {
    if (allSprints.length) renderSprintDropdown(sprintInput.value);
  });
  sprintInput.addEventListener('input', () => {
    renderSprintDropdown(sprintInput.value);
    if (selectedSprintId) {
      selectedSprintId = null;
      document.getElementById('jsr-sprint-value').value = '';
      document.getElementById('jsr-assignee').innerHTML = '<option value="">Select sprint first</option>';
      document.getElementById('jsr-generate').disabled = true;
    }
  });
  sprintDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.jsr-sprint-item');
    if (item) {
      selectSprint(item.dataset.id, item.dataset.name);
      return;
    }
    const loadMore = e.target.closest('.jsr-sprint-load-more');
    if (loadMore) {
      const year = parseInt(loadMore.dataset.year, 10);
      loadMore.outerHTML = '<div class="jsr-sprint-loading-more">Loading...</div>';
      renderSprintYear(year);
      // Remove loading indicator
      const loadingEl = sprintDropdown.querySelector('.jsr-sprint-loading-more');
      if (loadingEl) loadingEl.remove();
    }
  });
  // Scroll to load more
  sprintDropdown.addEventListener('scroll', () => {
    const el = sprintDropdown;
    // If scrolled near the bottom and not in search mode
    if (!sprintInput.value.trim() && el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
      const loadMore = el.querySelector('.jsr-sprint-load-more');
      if (loadMore) loadMore.click();
    }
  });
  // Keyboard navigation
  sprintInput.addEventListener('keydown', (e) => {
    const items = sprintDropdown.querySelectorAll('.jsr-sprint-item');
    const active = sprintDropdown.querySelector('.jsr-sprint-item.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = active
        ? (active.nextElementSibling?.classList.contains('jsr-sprint-item') ? active.nextElementSibling : null)
        : items[0];
      if (next) { active?.classList.remove('active'); next.classList.add('active'); next.scrollIntoView({ block: 'nearest' }); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (active) {
        let prev = active.previousElementSibling;
        while (prev && !prev.classList.contains('jsr-sprint-item')) prev = prev.previousElementSibling;
        if (prev) { active.classList.remove('active'); prev.classList.add('active'); prev.scrollIntoView({ block: 'nearest' }); }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) selectSprint(active.dataset.id, active.dataset.name);
    } else if (e.key === 'Escape') {
      sprintDropdown.classList.remove('open');
    }
  });
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!document.getElementById('jsr-sprint-wrap').contains(e.target)) {
      sprintDropdown.classList.remove('open');
    }
  });
  document.getElementById('jsr-sprint-clear').onclick = (e) => {
    e.stopPropagation();
    selectSprint('', '');
    sprintInput.focus();
  };

  async function onBoardChange(boardId) {
    const assigneeSel = document.getElementById('jsr-assignee');
    document.getElementById('jsr-generate').disabled = true;
    resetSprintDropdown();
    assigneeSel.innerHTML = '<option value="">Select sprint first</option>';

    if (!boardId) return;

    sprintInput.disabled = false;
    sprintInput.placeholder = 'Loading sprints...';

    try {
      const rawSprints = await fetchAllSprints(boardId);
      allSprints = sortSprintsByYearWeek(rawSprints);
      sprintGrouped = groupSprintsByYear(allSprints);
      sprintInput.placeholder = `Search ${allSprints.length} sprints...`;
    } catch (e) {
      sprintInput.placeholder = 'Error loading sprints';
      console.error('[JSR]', e);
    }
  };

  async function onSprintChange(sprintId) {
    const assigneeSel = document.getElementById('jsr-assignee');
    const genBtn = document.getElementById('jsr-generate');

    if (!sprintId) {
      assigneeSel.innerHTML = '<option value="">Select sprint first</option>';
      genBtn.disabled = true;
      return;
    }

    assigneeSel.innerHTML = '<option value="">Loading members...</option>';
    genBtn.disabled = true;

    try {
      const [members, me] = await Promise.all([fetchSprintMembers(sprintId), fetchCurrentUser()]);
      const myId = me.accountId || me.name;
      const myName = me.displayName || me.name || 'Me';

      assigneeSel.innerHTML = '<option value="">All members</option>';
      assigneeSel.innerHTML += `<option value="${esc(myName)}" selected>${esc(myName)} ⭐ (me)</option>`;

      const others = members
        .filter((u) => (u.accountId || u.name) !== myId)
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      others.forEach((u) => {
        const name = u.displayName || u.name || u.accountId;
        assigneeSel.innerHTML += `<option value="${esc(name)}">${esc(name)}</option>`;
      });
    } catch (e) {
      console.warn('[JSR] Failed to load sprint members:', e);
      try {
        const me = await fetchCurrentUser();
        const myName = me.displayName || me.name || 'Me';
        assigneeSel.innerHTML = '<option value="">All members</option>';
        assigneeSel.innerHTML += `<option value="${esc(myName)}" selected>${esc(myName)} ⭐ (me)</option>`;
      } catch (_) {
        assigneeSel.innerHTML = '<option value="">All members</option>';
      }
    }
    genBtn.disabled = false;
  }

  document.getElementById('jsr-generate').onclick = async function () {
    const boardId = document.getElementById('jsr-board-value').value;
    const sprintId = document.getElementById('jsr-sprint-value').value;
    const assignee = document.getElementById('jsr-assignee').value;
    const sprintName = selectedSprintName || sprintId;
    const reportDiv = document.getElementById('jsr-report');

    if (!boardId || !sprintId) return;

    this.disabled = true;
    reportDiv.innerHTML = '<div class="jsr-loading"><div class="spinner"></div><br>Fetching sprint data...</div>';

    const showCarriedInvalid = document.getElementById('jsr-show-carried-invalid').checked;

    try {
      const nextSprint = findNextSprint(sprintId);
      const prevSprint = findPrevSprint(sprintId);
      const [sprintReport, issues, nextSprintIssues, prevSprintIssues] = await Promise.all([
        fetchSprintReport(boardId, sprintId).catch(() => null),
        fetchSprintIssues(sprintId, assignee),
        nextSprint ? fetchSprintIssues(nextSprint.id, null) : Promise.resolve([]),
        prevSprint ? fetchSprintIssues(prevSprint.id, null) : Promise.resolve([]),
      ]);
      console.log(`[JSR] next sprint: ${nextSprint?.name || 'none'}, prev sprint: ${prevSprint?.name || 'none'}`);

      if (!issues.length) {
        reportDiv.innerHTML = '<div class="jsr-loading">No issues found for selected sprint/assignee.</div>';
        this.disabled = false;
        return;
      }

      const analysis = analyzeIssues(issues, sprintReport, sprintId, nextSprintIssues, prevSprintIssues);
      renderReport(analysis, sprintName, assignee, showCarriedInvalid);
    } catch (e) {
      reportDiv.innerHTML = `<div class="jsr-loading" style="color:#FF5630">❌ ${esc(e.message)}</div>`;
      console.error('[JSR]', e);
    }
    this.disabled = false;
  };

  console.log('%c[JSR] Jira SprintLens loaded ✅', 'color:#36B37E;font-weight:bold');
})();
