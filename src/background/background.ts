/**
 * background/background.ts — Service worker for Jira SprintLens.
 * Registers content scripts for user-added custom Jira domains.
 */

const STORAGE_KEY = 'jsl_custom_domains';
const SCRIPT_ID_PREFIX = 'jsl_custom_';

async function getCustomDomains(): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve((result[STORAGE_KEY] as string[]) || []);
    });
  });
}

function domainToPattern(domain: string): string | null {
  try {
    const host = domain.replace(/https?:\/\//, '').replace(/\/.*$/, '').trim();
    if (!host) return null;
    return `https://${host}/*`;
  } catch (_) {
    return null;
  }
}

/**
 * Returns the JS files from the manifest's first content_scripts entry.
 * @crxjs rewrites these to hashed filenames at build time, so this is always correct.
 */
function getContentScriptFiles(): string[] {
  return chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
}

async function syncContentScripts(domains: string[]): Promise<void> {
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const toRemove = existing
    .filter((s) => s.id.startsWith(SCRIPT_ID_PREFIX))
    .map((s) => s.id);
  if (toRemove.length) {
    await chrome.scripting.unregisterContentScripts({ ids: toRemove });
  }

  const jsFiles = getContentScriptFiles();
  if (!jsFiles.length) {
    console.warn('[JSL] No content script files found in manifest');
    return;
  }

  for (const domain of domains) {
    const pattern = domainToPattern(domain);
    if (!pattern) continue;
    await chrome.scripting
      .registerContentScripts([
        {
          id: SCRIPT_ID_PREFIX + btoa(domain).replace(/[^a-z0-9]/gi, '_'),
          matches: [pattern],
          js: jsFiles,
          runAt: 'document_idle',
        },
      ])
      .catch((e: unknown) =>
        console.warn('[JSL] Failed to register script for', domain, e)
      );
  }
}

chrome.runtime.onStartup.addListener(async () => {
  const domains = await getCustomDomains();
  await syncContentScripts(domains);
});

chrome.runtime.onInstalled.addListener(async () => {
  const domains = await getCustomDomains();
  await syncContentScripts(domains);
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    await syncContentScripts((changes[STORAGE_KEY].newValue as string[]) || []);
  }
});
