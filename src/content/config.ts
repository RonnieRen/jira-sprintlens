/**
 * config.ts — Shared configuration and utilities.
 * Loaded first; all other content-script modules depend on this.
 */

export interface JsrConfig {
  bugTypeNames: string[];
  doneStatusNames: string[];
  storyPointFields: string[];
  maxResults: number;
}

export const JSR_CONFIG: JsrConfig = {
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

/** Base URL for all Jira API calls and issue links. */
export const JSR_BASE_URL = window.location.origin;

/** True in `vite build --mode development`, false in production builds. Tree-shaken by Vite. */
const JSR_DEBUG = import.meta.env.DEV;

/** Log only in dev builds. Compiled away entirely in prod. */
export function jsrLog(...args: unknown[]): void {
  if (JSR_DEBUG) console.log(...args);
}

/** HTML-escape a string for safe insertion into innerHTML. */
export function jsrEsc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
