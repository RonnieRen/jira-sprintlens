/**
 * Jira SprintLens — Background Service Worker
 * Registers content scripts for user-added custom Jira domains.
 */

const STORAGE_KEY = 'jsl_custom_domains';
const SCRIPT_ID_PREFIX = 'jsl_custom_';

async function getCustomDomains() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

async function syncContentScripts(domains) {
  // Remove all previously registered dynamic scripts
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const toRemove = existing
    .filter((s) => s.id.startsWith(SCRIPT_ID_PREFIX))
    .map((s) => s.id);
  if (toRemove.length) {
    await chrome.scripting.unregisterContentScripts({ ids: toRemove });
  }

  // Register one script per custom domain
  for (const domain of domains) {
    const pattern = domainToPattern(domain);
    if (!pattern) continue;
    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID_PREFIX + btoa(domain).replace(/[^a-z0-9]/gi, '_'),
        matches: [pattern],
        js: ['jira-sprintlens.js'],
        runAt: 'document_idle',
      },
    ]).catch((e) => console.warn('[JSL] Failed to register script for', domain, e));
  }
}

function domainToPattern(domain) {
  try {
    // Accept bare domains like "jira.example.com" or full URLs
    const host = domain.replace(/https?:\/\//, '').replace(/\/.*$/, '').trim();
    if (!host) return null;
    return `https://${host}/*`;
  } catch (_) {
    return null;
  }
}

// Sync on startup
chrome.runtime.onStartup.addListener(async () => {
  const domains = await getCustomDomains();
  await syncContentScripts(domains);
});

// Sync on install/update
chrome.runtime.onInstalled.addListener(async () => {
  const domains = await getCustomDomains();
  await syncContentScripts(domains);
});

// Sync when storage changes (user adds/removes domains in options)
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    await syncContentScripts(changes[STORAGE_KEY].newValue || []);
  }
});

// storage.onChanged triggers syncContentScripts when popup adds a new domain
