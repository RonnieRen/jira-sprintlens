# Jira SprintLens

A Chrome extension that generates sprint reports directly from Jira pages — tickets, story points, bug breakdowns, carry-overs, and completion rates, all in one click.

## Features

- **Sprint summary** — total, planned, added mid-sprint, completed, incomplete, and completion rate
- **Bug tracking** — new bugs created, bugs fixed (Done only), bugs open, invalid/duplicated, and carried-over invalid bugs (excluded from stats)
- **Story point metrics** — planned SP, completed SP, SP completion rate, task completion rate
- **Carry-over detection** — identifies dev-done/test-pending items and credits partial SP
- **Assignee filter** — view the full team or drill into one person
- **Remember last board** — auto-fills your most recently used board on next open
- **Export** — download as CSV, HTML, or PDF

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this directory.
5. Open or refresh a Jira page.
6. Click the **📊** button in the lower-right corner.

## Self-hosted Jira

The default manifest covers Jira Cloud (`https://*.atlassian.net/*`). For a self-hosted instance, add its URL to `matches` in `manifest.json`:

```json
"matches": [
  "https://*.atlassian.net/*",
  "https://jira.example.com/*"
]
```

## Update

After changing the source:

1. Open `chrome://extensions`.
2. Click the reload button on the extension card.
3. Refresh the Jira page.
