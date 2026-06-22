const STORAGE_KEY = 'jsl_custom_domains';
const BUILTIN_PATTERNS = ['atlassian.net'];

function isBuiltinDomain(host) {
  return BUILTIN_PATTERNS.some((d) => host === d || host.endsWith('.' + d));
}

function isRegisteredDomain(host, domains) {
  return domains.some((d) => host === d || host.endsWith('.' + d));
}

function render(html) {
  document.getElementById('content').innerHTML = html;
}

async function injectIfNeeded(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['jira-sprintlens.js'],
    });
  } catch (_) {}
  // Open the panel (works whether script was just injected or already running)
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { if (!window.__JSR_IS_OPEN__) window.__JSR_OPEN__?.(); },
    });
  } catch (_) {}
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return render('<p class="not-jira">No active tab.</p>');

  let host;
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
    await injectIfNeeded(tab.id);
    return window.close();
  }

  const result = await chrome.storage.local.get(STORAGE_KEY);
  const domains = result[STORAGE_KEY] || [];

  if (isRegisteredDomain(host, domains)) {
    await injectIfNeeded(tab.id);
    return window.close();
  }

  // Show add prompt
  render(`
    <div class="header"><img src="icons/icon32.png" width="22" height="22" style="border-radius:4px"><strong>Jira SprintLens</strong></div>
    <div class="domain">${host}</div>
    <p class="desc">This Jira instance isn't enabled yet. Add it to activate SprintLens here?</p>
    <div class="actions">
      <button class="btn btn-cancel" id="cancel">Cancel</button>
      <button class="btn btn-add" id="add">Add Domain</button>
    </div>
  `);

  document.getElementById('cancel').onclick = () => window.close();
  document.getElementById('add').onclick = async () => {
    const updated = [...domains, host];
    await chrome.storage.local.set({ [STORAGE_KEY]: updated });

    // Inject the content script into the current tab immediately (no reload needed)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['jira-sprintlens.js'],
      });
      render(`<div class="success">✅ <span>Domain added!<br><span style="font-weight:400;font-size:12px;color:#6B778C">SprintLens is now active on this page.</span></span></div>`);
    } catch (_) {
      render(`<div class="success">✅ <span>Domain added!<br><span style="font-weight:400;font-size:12px;color:#6B778C">Reload the page to activate SprintLens.</span></span></div>`);
    }
    setTimeout(() => window.close(), 2500);
  };
}

init();
