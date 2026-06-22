/**
 * analysis.ts — Sprint issue analysis engine.
 */

import { JSR_CONFIG } from './config';
import type {
  JiraIssue,
  JiraSprintReport,
  JiraSprintReportIssue,
  Analysis,
  AnalysisRow,
  AnalysisSummary,
} from './types';

function isBug(issue: JiraIssue): boolean {
  return JSR_CONFIG.bugTypeNames.some(
    (n) => n.toLowerCase() === (issue.fields?.issuetype?.name ?? '').toLowerCase()
  );
}

/** Strictly "Done" — used for bug-fixed count */
function isStrictlyDone(issue: JiraIssue): boolean {
  const s = (issue.fields?.status?.name ?? '').toLowerCase();
  return s === 'done' || s === 'closed';
}

/** Broadly done — used for completion rate */
function isDone(issue: JiraIssue): boolean {
  return (
    JSR_CONFIG.doneStatusNames.some(
      (n) => n.toLowerCase() === (issue.fields?.status?.name ?? '').toLowerCase()
    ) || issue.fields?.status?.statusCategory?.key === 'done'
  );
}

function isInvalidBug(issue: JiraIssue): boolean {
  const s = (issue.fields?.status?.name ?? '').toLowerCase();
  return s === 'obsolete' || s === 'resolved';
}

function getIssueStoryPoints(issue: JiraIssue): number | null {
  for (const f of JSR_CONFIG.storyPointFields) {
    const v = issue.fields?.[f];
    if (v != null && v !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function getReportStoryPoints(reportIssue: JiraSprintReportIssue): number | null {
  const candidates = [
    reportIssue?.currentEstimateStatistic?.statFieldValue?.value,
    reportIssue?.currentEstimateStatistic?.value,
    reportIssue?.estimateStatistic?.statFieldValue?.value,
    reportIssue?.estimateStatistic?.value,
  ];
  const v = candidates.find((c) => c != null && Number.isFinite(Number(c)));
  return v == null ? null : Number(v);
}

/**
 * Analyses sprint issues and produces summary stats and row data.
 */
export function jsrAnalyzeIssues(
  issues: JiraIssue[],
  sprintReport: JiraSprintReport | null,
  sprintId: string | number,
  nextSprintIssues: JiraIssue[] = [],
  prevSprintIssues: JiraIssue[] = []
): Analysis {
  const sprintStartDate = sprintReport?.sprint?.startDate
    ? new Date(sprintReport.sprint.startDate)
    : null;

  const prevIssuesByKey = new Map(prevSprintIssues.map((i) => [i.key, i]));

  const isCarriedOverInvalidBug = (issue: JiraIssue): boolean => {
    if (!isInvalidBug(issue)) return false;
    if (prevIssuesByKey.has(issue.key)) return true;
    if (sprintStartDate && issue.fields?.created) {
      return new Date(issue.fields.created) < sprintStartDate;
    }
    return false;
  };

  // Build key → SP map from sprint report (most accurate source)
  const reportPointsByKey = new Map<string, number>();
  for (const val of Object.values(sprintReport?.contents ?? {})) {
    if (!Array.isArray(val)) continue;
    for (const ri of val as JiraSprintReportIssue[]) {
      const sp = getReportStoryPoints(ri);
      if (ri?.key && sp != null && !reportPointsByKey.has(ri.key)) {
        reportPointsByKey.set(ri.key, sp);
      }
    }
  }

  // Issues added mid-sprint (via Greenhopper or changelog)
  const addedKeys = new Set(
    Object.keys(sprintReport?.contents?.issueKeysAddedDuringSprint ?? {})
  );
  const wasAddedDuringSprint = (issue: JiraIssue): boolean => {
    if (addedKeys.has(issue.key)) return true;
    const sprint = sprintReport?.sprint;
    if (!sprint?.startDate) return false;
    const sprintStart = new Date(sprint.startDate);
    for (const h of issue.changelog?.histories ?? []) {
      for (const item of h.items ?? []) {
        if (item.field === 'Sprint' && item.toString?.includes(String(sprintId))) {
          if (new Date(h.created) > sprintStart) return true;
        }
      }
    }
    return false;
  };

  const nextIssuesByKey = new Map(nextSprintIssues.map((i) => [i.key, i]));

  // ── Counters ─────────────────────────────────────────────────────────────
  let planned = 0, completed = 0, incomplete = 0, addedMidSprint = 0;
  let totalBugs = 0, bugsFixed = 0, bugsOpen = 0, newBugsCreated = 0;
  let invalidBugs = 0, carriedOverInvalidBugs = 0;
  let totalSP = 0, plannedSP = 0, completedSP = 0, spCompletionBase = 0;
  let tasksWithSP = 0, completedTasksWithSP = 0;

  const rows: AnalysisRow[] = issues.map((issue) => {
    const bug      = isBug(issue);
    const done     = isDone(issue);
    const added    = wasAddedDuringSprint(issue);
    const sp       = reportPointsByKey.get(issue.key) ?? getIssueStoryPoints(issue) ?? 0;
    const carryOverBaseSP = sp;

    const nextIssue    = nextIssuesByKey.get(issue.key);
    const remainingSP  = nextIssue ? getIssueStoryPoints(nextIssue) : null;
    const carriedOver  = !done && remainingSP != null;
    const devCompletedSP = carriedOver
      ? Math.min(carryOverBaseSP, Math.max(0, carryOverBaseSP - remainingSP!))
      : 0;
    const devDoneTestPending = carriedOver && carryOverBaseSP > 0 && remainingSP === 0;
    const effectiveDone  = done || devDoneTestPending;
    const creditedSP     = done ? sp : devCompletedSP;
    const carriedOverInvalid = bug && isCarriedOverInvalidBug(issue);

    if (carriedOverInvalid) {
      carriedOverInvalidBugs++;
    } else {
      totalSP += sp;
      if (!added) plannedSP += sp;
      completedSP      += creditedSP;
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
        if (
          sprintStartDate &&
          issue.fields?.created &&
          new Date(issue.fields.created) >= sprintStartDate
        ) {
          newBugsCreated++;
        }
        if (isInvalidBug(issue))                                    invalidBugs++;
        else if (isStrictlyDone(issue) || devDoneTestPending)       bugsFixed++;
        else                                                         bugsOpen++;
      }
    }

    return {
      key:            issue.key,
      summary:        issue.fields?.summary ?? '',
      type:           issue.fields?.issuetype?.name ?? '',
      typeIcon:       issue.fields?.issuetype?.iconUrl ?? '',
      status:         issue.fields?.status?.name ?? '',
      statusCategory: issue.fields?.status?.statusCategory?.key ?? '',
      priority:       issue.fields?.priority?.name ?? '',
      priorityIcon:   issue.fields?.priority?.iconUrl ?? '',
      assignee:       issue.fields?.assignee?.displayName ?? 'Unassigned',
      sp, carryOverBaseSP, remainingSP, creditedSP,
      isBug: bug, isDone: done, isAdded: added,
      isCarriedOver: carriedOver,
      isDevDoneTestPending: devDoneTestPending,
      isInvalidBug: isInvalidBug(issue),
      isCarriedOverInvalidBug: carriedOverInvalid,
      created:  issue.fields?.created,
      resolved: issue.fields?.resolutiondate,
    };
  });

  const summary: AnalysisSummary = {
    total: issues.length, planned, addedMidSprint, completed, incomplete,
    totalBugs, bugsFixed, bugsOpen, newBugsCreated, invalidBugs, carriedOverInvalidBugs,
    totalSP, plannedSP, completedSP, spCompletionBase,
    tasksWithSP, completedTasksWithSP,
    completionRate:     issues.length    ? ((completed / issues.length) * 100).toFixed(1) : '0',
    taskCompletionRate: tasksWithSP      ? ((completedTasksWithSP / tasksWithSP) * 100).toFixed(1) : 'N/A',
    spCompletionRate:   spCompletionBase ? ((completedSP / spCompletionBase) * 100).toFixed(1) : 'N/A',
  };

  return { summary, rows };
}
