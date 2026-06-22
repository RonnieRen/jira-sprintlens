/**
 * api.ts — Jira REST API helpers.
 */

import { JSR_CONFIG, JSR_BASE_URL } from './config';
import type { JiraBoard, JiraSprint, JiraIssue, JiraSprintReport, JiraAssignee } from './types';

async function jsrGet<T>(path: string): Promise<T> {
  const res = await fetch(`${JSR_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Jira API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function jsrFetchAllBoards(name = ''): Promise<JiraBoard[]> {
  let all: JiraBoard[] = [];
  let startAt = 0;
  const nameParam = name ? `&name=${encodeURIComponent(name)}` : '';
  while (true) {
    const data = await jsrGet<{ values: JiraBoard[]; isLast?: boolean; total?: number }>(
      `/rest/agile/1.0/board?maxResults=100&startAt=${startAt}${nameParam}`
    );
    const values = data.values || [];
    all = all.concat(values);
    if (data.isLast !== false && startAt + values.length >= (data.total ?? all.length)) break;
    startAt += values.length;
    if (!values.length) break;
  }
  return all;
}

export async function jsrFetchAllSprints(boardId: string | number): Promise<JiraSprint[]> {
  let all: JiraSprint[] = [];
  let startAt = 0;
  const maxResults = 50;
  while (true) {
    const data = await jsrGet<{ values: JiraSprint[]; isLast?: boolean }>(
      `/rest/agile/1.0/board/${boardId}/sprint?maxResults=${maxResults}&state=active,closed&startAt=${startAt}`
    );
    const values = data.values || [];
    all = all.concat(values);
    console.log(
      `[JSR] fetchAllSprints page startAt=${startAt} got=${values.length} total_so_far=${all.length} isLast=${data.isLast}`
    );
    if (data.isLast === true || values.length < maxResults || !values.length) break;
    startAt += values.length;
  }
  console.log(`[JSR] fetchAllSprints done, total=${all.length} sprints`);
  return all;
}

export async function jsrFetchSprintReport(
  boardId: string | number,
  sprintId: string | number
): Promise<JiraSprintReport> {
  return jsrGet<JiraSprintReport>(
    `/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=${boardId}&sprintId=${sprintId}`
  );
}

let _storyPointFieldsPromise: Promise<void> | null = null;

export async function jsrDetectStoryPointFields(): Promise<void> {
  if (!_storyPointFieldsPromise) {
    _storyPointFieldsPromise = jsrGet<Array<{ id: string; name: string }>>('/rest/api/2/field')
      .then((fields) => {
        const detected = fields
          .filter((f) => /story\s*points?/i.test(f.name || ''))
          .map((f) => f.id);
        JSR_CONFIG.storyPointFields = [...new Set([...detected, ...JSR_CONFIG.storyPointFields])];
        console.log(`[JSR] story point fields=${JSON.stringify(JSR_CONFIG.storyPointFields)}`);
      })
      .catch((e: unknown) => {
        console.warn('[JSR] Failed to detect story point fields, using configured fallbacks:', e);
      });
  }
  return _storyPointFieldsPromise;
}

export async function jsrFetchSprintIssues(
  sprintId: string | number,
  assignee: string | null
): Promise<JiraIssue[]> {
  await jsrDetectStoryPointFields();
  let jql = `sprint = ${sprintId}`;
  if (assignee) jql += ` AND assignee = "${assignee}"`;
  let allIssues: JiraIssue[] = [];
  let startAt = 0;
  while (true) {
    const data = await jsrGet<{ issues: JiraIssue[]; total: number; maxResults: number }>(
      `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${JSR_CONFIG.maxResults}&startAt=${startAt}` +
        `&fields=summary,status,issuetype,assignee,priority,created,resolutiondate,${JSR_CONFIG.storyPointFields.join(',')}&expand=changelog`
    );
    allIssues = allIssues.concat(data.issues || []);
    if (startAt + data.maxResults >= data.total) break;
    startAt += data.maxResults;
  }
  return allIssues;
}

export async function jsrFetchCurrentUser(): Promise<{
  accountId?: string;
  name?: string;
  displayName?: string;
}> {
  return jsrGet('/rest/api/2/myself');
}

export async function jsrFetchSprintMembers(sprintId: string | number): Promise<JiraAssignee[]> {
  const data = await jsrGet<{ issues: JiraIssue[] }>(
    `/rest/api/2/search?jql=${encodeURIComponent(`sprint = ${sprintId}`)}&maxResults=200&startAt=0&fields=assignee`
  );
  const seen = new Map<string, JiraAssignee>();
  for (const issue of data.issues || []) {
    const a = issue.fields?.assignee;
    if (a && !seen.has((a.accountId ?? a.name) as string)) {
      seen.set((a.accountId ?? a.name) as string, a);
    }
  }
  return Array.from(seen.values());
}

export function jsrDetectBoardFromUrl(): string | null {
  const url = window.location.href;
  let m = url.match(/\/boards\/(\d+)/);
  if (m) return m[1];
  m = url.match(/[?&]rapidView=(\d+)/);
  if (m) return m[1];
  return null;
}
