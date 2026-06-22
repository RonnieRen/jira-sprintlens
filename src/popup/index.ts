/**
 * popup/index.ts — Extension popup logic.
 */
export {};

const STORAGE_KEY = 'jsl_custom_domains';
const BUILTIN_PATTERNS = ['atlassian.net'];

function isBuiltinDomain(host: string): boolean {
  return BUILTIN_PATTERNS.some((d) => host === d || host.endsWith('.' + d));
}

function isRegisteredDomain(host: string, domains: string[]): boolean {
  return domains.some((d) => host === d || host.endsWith('.' + d));
}

function render(html: string): void {
  document.getElementById('content')!.innerHTML = html;
}

/**
 * Opens the SprintLens panel on the given tab.
 * The content script is already injected by the manifest (for built-in domains)
 * or by background.ts (for custom domains). We just call __JSR_OPEN__.
 */
async function openPanel(tabId: number): Promise<void> {
  // Try sending message to already-running content script first.
  // If it's not there yet, inject it, wait for it to init, then send.
  const send = (): Promise<boolean> =>
    chrome.tabs.sendMessage(tabId, { type: 'jsr_open' })
      .then(() => true)
      .catch(() => false);

  if (await send()) return;

  // Content script not running — inject it now.
  try {
    const manifest = chrome.runtime.getManifest();
    const jsFiles = manifest.content_scripts?.[0]?.js ?? [];
    if (!jsFiles.length) return;
    await chrome.scripting.executeScript({ target: { tabId }, files: jsFiles });
    // Give it a moment to initialise, then send.
    await new Promise((r) => setTimeout(r, 300));
    await send();
  } catch (e) {
    console.error('[JSR popup] inject failed:', e);
  }
}

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return render('<p class="not-jira">No active tab.</p>');

  let host: string;
  try { host = new URL(tab.url).hostname; } catch (_) {
    return render('<p class="not-jira">Cannot read page URL.</p>');
  }

  if (!tab.url.startsWith('http')) {
    return render('<p class="not-jira">Not a web page.</p>');
  }

  const looksLikeJira = host.includes('jira') || host.includes('atlassian');
  if (!looksLikeJira) {
    return render('<p class="not-jira">This page doesn\'t look like a Jira instance.</p>');
  }

  if (isBuiltinDomain(host)) {
    await openPanel(tab.id!);
    window.close();
    return;
  }

  const result = await chrome.storage.local.get(STORAGE_KEY);
  const domains = (result[STORAGE_KEY] as string[]) || [];

  if (isRegisteredDomain(host, domains)) {
    await openPanel(tab.id!);
    window.close();
    return;
  }

  // Unknown domain — ask user to add it
  render(`
    <div class="header">
      <img src="icons/icon32.png" width="22" height="22" alt="SprintLens" style="border-radius:4px">
      <strong>Jira SprintLens</strong>
    </div>
    <div class="domain">${host}</div>
    <p class="desc">This Jira instance isn't enabled yet. Add it to activate SprintLens here?</p>
    <div class="actions">
      <button class="btn btn-cancel" id="cancel">Cancel</button>
      <button class="btn btn-add" id="add">Add Domain</button>
    </div>
  `);

  document.getElementById('cancel')!.onclick = () => window.close();
  document.getElementById('add')!.onclick = async () => {
    const updated = [...domains, host];
    await chrome.storage.local.set({ [STORAGE_KEY]: updated });
    // background.ts will pick up the storage change and register the content script.
    // User needs to reload the page for the script to inject on this visit.
    render(`<div class="success">✅ <span>Domain added!<br><span style="font-weight:400;font-size:12px;color:#6B778C">Reload the page to activate SprintLens.</span></span></div>`);
    setTimeout(() => window.close(), 2500);
  };
}

init();
