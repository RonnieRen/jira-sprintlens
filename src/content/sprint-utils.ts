/**
 * sprint-utils.ts — Sprint name parsing, sorting, grouping, and navigation.
 */

import type { JiraSprint, ParsedSprintName, GroupedSprints } from './types';
import { jsrLog } from './config';

/**
 * Parses sprint names in three supported formats:
 *   Compact: CS_PI2625_W21/22  → { year:2026, piEndWeek:25, startWeek:21, endWeek:22 }
 *   Full:    CS_PI26W26_W21&22 → { year:2026, piEndWeek:26, startWeek:21, endWeek:22 }
 *   Short:   CS_PI26W3         → { year:2026, piEndWeek:3,  startWeek:3,  endWeek:3  }
 * Returns null if the name doesn't match any format.
 */
export function jsrParseSprintName(name: string): ParsedSprintName | null {
  // Compact format: CS_PI2625_W21/22
  const compact = name.match(/\w_PI(\d{2})(\d{2})_W(\d{1,2})\/(\d{1,2})/i);
  if (compact) {
    return {
      year:      parseInt(compact[1], 10) + 2000,
      piEndWeek: parseInt(compact[2], 10),
      startWeek: parseInt(compact[3], 10),
      endWeek:   parseInt(compact[4], 10),
    };
  }
  // Full format: CS_PI26W26_W21&22
  const full = name.match(/\w_PI(\d{2,4})W(\d{1,2})_W(\d{1,2})&(\d{1,2})/i);
  if (full) {
    let year = parseInt(full[1], 10);
    if (year < 100) year += 2000;
    return {
      year,
      piEndWeek: parseInt(full[2], 10),
      startWeek: parseInt(full[3], 10),
      endWeek:   parseInt(full[4], 10),
    };
  }
  // Short format: CS_PI26W3
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
 * Sorts sprints descending by: year → piEndWeek → startWeek → endWeek.
 * Sprints whose names can't be parsed are sorted by startDate descending at the end.
 */
export function jsrSortSprintsByYearWeek(sprints: JiraSprint[]): JiraSprint[] {
  return [...sprints].sort((a, b) => {
    const pa = jsrParseSprintName(a.name);
    const pb = jsrParseSprintName(b.name);
    if (pa && pb) {
      if (pa.year      !== pb.year)      return pb.year      - pa.year;
      if (pa.piEndWeek !== pb.piEndWeek) return pb.piEndWeek - pa.piEndWeek;
      if (pa.startWeek !== pb.startWeek) return pb.startWeek - pa.startWeek;
      return pb.endWeek - pa.endWeek;
    }
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    return new Date(b.startDate ?? 0).getTime() - new Date(a.startDate ?? 0).getTime();
  });
}

/**
 * Groups a sorted sprint array by parsed year.
 * Sprints that don't match the naming pattern go into the `noYear` bucket.
 */
export function jsrGroupSprintsByYear(sprints: JiraSprint[]): GroupedSprints {
  const groups = new Map<number, JiraSprint[]>();
  const noYear: JiraSprint[] = [];
  for (const sp of sprints) {
    const parsed = jsrParseSprintName(sp.name);
    if (parsed) {
      if (!groups.has(parsed.year)) groups.set(parsed.year, []);
      groups.get(parsed.year)!.push({ ...sp, _parsed: parsed });
    } else {
      noYear.push(sp);
    }
  }
  const years = Array.from(groups.keys()).sort((a, b) => b - a);
  jsrLog(`[JSR] groupSprintsByYear years=${JSON.stringify(years)}, noYear=${noYear.length}`);
  return { years, groups, noYear };
}

/**
 * Returns the sprint that started immediately before the given sprint.
 * @param sprintId The sprint to look up.
 * @param allSprints The full sorted sprint list (maintained by panel state).
 */
export function jsrFindPrevSprint(
  sprintId: string | number,
  allSprints: JiraSprint[]
): JiraSprint | null {
  const current = allSprints.find((sp) => String(sp.id) === String(sprintId));
  if (!current) return null;

  const currentStart = current.startDate ? new Date(current.startDate).getTime() : NaN;
  if (Number.isFinite(currentStart)) {
    const earlier = allSprints
      .filter((sp) => String(sp.id) !== String(sprintId) && sp.startDate)
      .filter((sp) => new Date(sp.startDate!).getTime() < currentStart)
      .sort((a, b) => new Date(b.startDate!).getTime() - new Date(a.startDate!).getTime());
    if (earlier.length) return earlier[0];
  }

  const index = allSprints.findIndex((sp) => String(sp.id) === String(sprintId));
  return index >= 0 && index < allSprints.length - 1 ? allSprints[index + 1] : null;
}

/**
 * Returns the sprint that started immediately after the given sprint.
 * @param sprintId The sprint to look up.
 * @param allSprints The full sorted sprint list (maintained by panel state).
 */
export function jsrFindNextSprint(
  sprintId: string | number,
  allSprints: JiraSprint[]
): JiraSprint | null {
  const current = allSprints.find((sp) => String(sp.id) === String(sprintId));
  if (!current) return null;

  const currentStart = current.startDate ? new Date(current.startDate).getTime() : NaN;
  if (Number.isFinite(currentStart)) {
    const later = allSprints
      .filter((sp) => String(sp.id) !== String(sprintId) && sp.startDate)
      .filter((sp) => new Date(sp.startDate!).getTime() > currentStart)
      .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
    if (later.length) return later[0];
  }

  const index = allSprints.findIndex((sp) => String(sp.id) === String(sprintId));
  return index > 0 ? allSprints[index - 1] : null;
}
