/**
 * types.ts — Shared TypeScript interfaces for Jira API responses and analysis.
 */

// ── Jira API shapes ──────────────────────────────────────────────────────────

export interface JiraBoard {
  id: number;
  name: string;
  type: 'scrum' | 'kanban' | string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
  _parsed?: ParsedSprintName;
}

export interface JiraIssueType {
  name: string;
  iconUrl?: string;
}

export interface JiraStatus {
  name: string;
  statusCategory: { key: string };
}

export interface JiraPriority {
  name: string;
  iconUrl?: string;
}

export interface JiraAssignee {
  accountId?: string;
  name?: string;
  displayName?: string;
}

export interface JiraChangelogItem {
  field: string;
  toString?: string;
}

export interface JiraChangelogHistory {
  created: string;
  items: JiraChangelogItem[];
}

export interface JiraIssueFields {
  summary?: string;
  status?: JiraStatus;
  issuetype?: JiraIssueType;
  assignee?: JiraAssignee | null;
  priority?: JiraPriority;
  created?: string;
  resolutiondate?: string;
  [key: string]: unknown; // story point custom fields
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
  changelog?: { histories: JiraChangelogHistory[] };
}

export interface JiraSprintReportIssueEstimate {
  statFieldValue?: { value?: number };
  value?: number;
}

export interface JiraSprintReportIssue {
  key?: string;
  currentEstimateStatistic?: JiraSprintReportIssueEstimate;
  estimateStatistic?: JiraSprintReportIssueEstimate;
}

export interface JiraSprintReport {
  sprint?: {
    id: number;
    name: string;
    startDate?: string;
    endDate?: string;
  };
  contents?: {
    issueKeysAddedDuringSprint?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

// ── Analysis shapes ───────────────────────────────────────────────────────────

export interface AnalysisSummary {
  total: number;
  planned: number;
  addedMidSprint: number;
  completed: number;
  incomplete: number;
  totalBugs: number;
  bugsFixed: number;
  bugsOpen: number;
  newBugsCreated: number;
  invalidBugs: number;
  carriedOverInvalidBugs: number;
  totalSP: number;
  plannedSP: number;
  completedSP: number;
  spCompletionBase: number;
  tasksWithSP: number;
  completedTasksWithSP: number;
  completionRate: string | number;
  taskCompletionRate: string | number;
  spCompletionRate: string | number;
}

export interface AnalysisRow {
  key: string;
  summary: string;
  type: string;
  typeIcon: string;
  status: string;
  statusCategory: string;
  priority: string;
  priorityIcon: string;
  assignee: string;
  sp: number;
  carryOverBaseSP: number;
  remainingSP: number | null;
  creditedSP: number;
  isBug: boolean;
  isDone: boolean;
  isAdded: boolean;
  isCarriedOver: boolean;
  isDevDoneTestPending: boolean;
  isInvalidBug: boolean;
  isCarriedOverInvalidBug: boolean;
  created?: string;
  resolved?: string;
}

export interface Analysis {
  summary: AnalysisSummary;
  rows: AnalysisRow[];
}

// ── Sprint parsing ────────────────────────────────────────────────────────────

export interface ParsedSprintName {
  year: number;
  piEndWeek: number;
  startWeek: number;
  endWeek: number;
}

export interface GroupedSprints {
  years: number[];
  groups: Map<number, JiraSprint[]>;
  noYear: JiraSprint[];
}
