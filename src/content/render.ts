/**
 * render.ts — Report rendering and export (CSV, HTML, PDF).
 */

import { JSR_BASE_URL, jsrEsc } from './config';
import { jsrStyle } from './styles';
import type { Analysis } from './types';

// ── Report rendering ──────────────────────────────────────────────────────────

export function jsrRenderReport(
  analysis: Analysis,
  sprintName: string,
  assigneeName: string,
  showCarriedInvalid = false
): void {
  const s = analysis.summary;
  const who = assigneeName || 'All Members';
  const pct = (v: string | number) => (v === 'N/A' ? v : `${v}%`);

  let html = `
    <div class="jsr-section-title">📊 Sprint Report: ${jsrEsc(sprintName)} — ${jsrEsc(who)}</div>
    <div class="jsr-stats">
      <div class="jsr-stat-card blue"><div class="num">${s.total}</div><div class="lbl">Total Tickets</div></div>
      <div class="jsr-stat-card blue"><div class="num">${s.planned}</div><div class="lbl">Planned</div></div>
      <div class="jsr-stat-card orange"><div class="num">${s.addedMidSprint}</div><div class="lbl">Added Mid-Sprint</div></div>
      <div class="jsr-stat-card green"><div class="num">${s.completed}</div><div class="lbl">Completed</div></div>
      <div class="jsr-stat-card red"><div class="num">${s.incomplete}</div><div class="lbl">Incomplete</div></div>
      <div class="jsr-stat-card green"><div class="num">${pct(s.completionRate)}</div><div class="lbl">Completion Rate</div></div>
    </div>
    <div class="jsr-stats">
      <div class="jsr-stat-card red"><div class="num">${s.totalBugs}</div><div class="lbl">Total Bugs</div></div>
      <div class="jsr-stat-card orange"><div class="num">${s.newBugsCreated}</div><div class="lbl">New Bugs Created</div></div>
      <div class="jsr-stat-card green"><div class="num">${s.bugsFixed}</div><div class="lbl">Bugs Fixed</div></div>
      <div class="jsr-stat-card red"><div class="num">${s.bugsOpen}</div><div class="lbl">Bugs Open</div></div>
      <div class="jsr-stat-card teal"><div class="num">${s.invalidBugs}</div><div class="lbl">Invalid / Duplicated</div></div>
      ${showCarriedInvalid
        ? `<div class="jsr-stat-card" style="border-left-color:#97A0AF"><div class="num">${s.carriedOverInvalidBugs}</div><div class="lbl">Carried-Over Invalid</div></div>`
        : ''}
      <div class="jsr-stat-card purple"><div class="num">${s.totalSP}</div><div class="lbl">Total Story Points</div></div>
      <div class="jsr-stat-card blue"><div class="num">${s.plannedSP}</div><div class="lbl">Planned Story Points</div></div>
      <div class="jsr-stat-card teal"><div class="num">${s.completedSP}</div><div class="lbl">Completed Story Points</div></div>
      <div class="jsr-stat-card blue"><div class="num">${s.spCompletionBase}</div><div class="lbl">SP Completion Base</div></div>
      <div class="jsr-stat-card purple"><div class="num">${pct(s.spCompletionRate)}</div><div class="lbl">SP Completion Rate</div></div>
      <div class="jsr-stat-card green"><div class="num">${pct(s.taskCompletionRate)}</div><div class="lbl">Task Complete Rate</div></div>
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
    if (r.isCarriedOverInvalidBug && !showCarriedInvalid) continue;

    const statusTag = r.statusCategory === 'done'          ? 'jsr-tag-done'
                    : r.statusCategory === 'indeterminate' ? 'jsr-tag-inprog'
                    : 'jsr-tag-todo';
    let tags = '';
    if (r.isBug)                 tags += '<span class="jsr-tag jsr-tag-bug">Bug</span> ';
    if (r.isAdded)               tags += '<span class="jsr-tag jsr-tag-added">Added</span> ';
    if (r.isCarriedOver)         tags += `<span class="jsr-tag jsr-tag-added">Carry-over Base: ${r.carryOverBaseSP}, Remaining SP: ${r.remainingSP}</span> `;
    if (r.isDevDoneTestPending)  tags += '<span class="jsr-tag jsr-tag-devdone">Development Done / Testing Pending</span> ';
    if (r.isCarriedOverInvalidBug) tags += '<span class="jsr-tag" style="background:#F4F5F7;color:#6B778C">Carried-Over Invalid</span> ';

    html += `<tr class="${r.isDevDoneTestPending ? 'jsr-row-devdone' : ''}">
      <td><a href="${JSR_BASE_URL}/browse/${r.key}" target="_blank" style="color:#0052CC;text-decoration:none;font-weight:600">${r.key}</a></td>
      <td>${r.typeIcon ? `<img src="${r.typeIcon}" width="16" alt="${jsrEsc(r.type)}" style="vertical-align:middle;margin-right:4px">` : ''}${jsrEsc(r.type)}</td>
      <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${jsrEsc(r.summary)}">${jsrEsc(r.summary)}</td>
      <td><span class="jsr-tag ${statusTag}">${jsrEsc(r.status)}</span></td>
      <td>${r.priorityIcon ? `<img src="${r.priorityIcon}" width="16" alt="${jsrEsc(r.priority)}" style="vertical-align:middle;margin-right:4px">` : ''}${jsrEsc(r.priority)}</td>
      <td>${jsrEsc(r.assignee)}</td>
      <td style="text-align:center">${r.sp || '-'}</td>
      <td style="text-align:center">${r.creditedSP || '-'}</td>
      <td>${tags || '-'}</td>
    </tr>`;
  }

  html += `</tbody></table></div>
    <div class="jsr-export-bar">
      <button class="jsr-btn jsr-btn-secondary" id="jsr-export-csv">⬇ Export CSV</button>
      <button class="jsr-btn jsr-btn-secondary" id="jsr-export-html">⬇ Export HTML</button>
      <button class="jsr-btn jsr-btn-secondary" id="jsr-export-pdf">⬇ Export PDF</button>
    </div>
  `;

  document.getElementById('jsr-report')!.innerHTML = html;
  document.getElementById('jsr-export-csv')!.onclick  = () => jsrExportCSV(analysis, sprintName, who);
  document.getElementById('jsr-export-html')!.onclick = () => jsrExportHTML(sprintName);
  document.getElementById('jsr-export-pdf')!.onclick  = () => jsrExportPDF(sprintName);
}

// ── Export helpers ────────────────────────────────────────────────────────────

function jsrDownloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function jsrExportCSV(analysis: Analysis, sprintName: string, who: string): void {
  const s = analysis.summary;
  const pct = (v: string | number) => (v === 'N/A' ? v : `${v}%`);
  let csv = '﻿'; // BOM for Excel UTF-8 compatibility
  csv += `Sprint Report: ${sprintName} — ${who}\n`;
  csv += `Total,${s.total},Planned,${s.planned},Added,${s.addedMidSprint},Completed,${s.completed},Incomplete,${s.incomplete}\n`;
  csv += `Bugs Total,${s.totalBugs},New Bugs Created,${s.newBugsCreated},Bugs Fixed,${s.bugsFixed},Bugs Open,${s.bugsOpen},Invalid/Duplicated,${s.invalidBugs}\n`;
  csv += `Story Points,${s.totalSP},Planned SP,${s.plannedSP},Completed SP,${s.completedSP},SP Base,${s.spCompletionBase},SP Rate,${pct(s.spCompletionRate)}\n`;
  csv += `Tasks with SP,${s.tasksWithSP},Completed Tasks with SP,${s.completedTasksWithSP},Task Rate,${pct(s.taskCompletionRate)}\n`;
  csv += `Ticket Completion Rate,${pct(s.completionRate)}\n\n`;
  csv += `Key,Type,Summary,Status,Priority,Assignee,SP,Carry-over Base SP,Credited SP,Remaining SP,Is Bug,Added,Dev Done Test Pending\n`;
  for (const r of analysis.rows) {
    csv += `${r.key},${r.type},"${r.summary.replace(/"/g, '""')}",${r.status},${r.priority},${r.assignee},${r.sp},${r.carryOverBaseSP},${r.creditedSP},${r.remainingSP ?? ''},${r.isBug},${r.isAdded},${r.isDevDoneTestPending}\n`;
  }
  jsrDownloadFile(`sprintlens-${sprintName}.csv`, csv, 'text/csv');
}

function buildExportHTML(sprintName: string, autoPrint = false): string {
  const content = document.getElementById('jsr-report')!.innerHTML;
  const cleanCSS = jsrStyle.textContent!.replace(
    /#jsr-trigger[\s\S]*?#jsr-overlay\.active\s*\{[^}]*}/g, ''
  );
  // noinspection JSVoidFunctionReturnValueUsed
  const printScript = '<scr' + 'ipt>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})</scr' + 'ipt>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
    <title>Sprint Report: ${jsrEsc(sprintName)}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:960px;margin:40px auto;padding:0 20px;color:#172B4D}
      ${cleanCSS};
      .jsr-export-bar{display:none}
      @media print{body{max-width:none;margin:0;padding:0}.jsr-table-wrap{overflow:visible}.jsr-table{font-size:10px}.jsr-stat-card{break-inside:avoid}tr{break-inside:avoid}}
    </style></head><body>
    <h1 style="color:#0052CC">Jira SprintLens</h1>
    <p style="color:#6B778C">Generated: ${new Date().toLocaleString()}</p>
    ${content}
    ${autoPrint ? printScript : ''}
    </body></html>`;
}

export function jsrExportHTML(sprintName: string): void {
  jsrDownloadFile(`sprintlens-${sprintName}.html`, buildExportHTML(sprintName), 'text/html');
}

export function jsrExportPDF(sprintName: string): void {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to export PDF.'); return; }
  win.document.open();
  win.document.write(buildExportHTML(sprintName, true));
  win.document.close();
}
