/**
 * options/index.ts — Options page for managing custom Jira domains.
 */
export {};

const STORAGE_KEY = 'jsl_custom_domains';

const input    = document.getElementById('domain-input') as HTMLInputElement;
const addBtn   = document.getElementById('add-btn') as HTMLButtonElement;
const list     = document.getElementById('domain-list') as HTMLUListElement;
const emptyMsg = document.getElementById('empty-msg') as HTMLLIElement;
const errorMsg = document.getElementById('error-msg') as HTMLElement;
const toast    = document.getElementById('toast') as HTMLElement;

let domains: string[] = [];

function normalizeDomain(raw: string): string {
  return raw.replace(/https?:\/\//, '').replace(/\/.*$/, '').trim().toLowerCase();
}

function isValidDomain(domain: string): boolean {
  return /^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?(\.[a-z]{2,})+$/.test(domain);
}

function showToast(msg = 'Saved'): void {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function renderList(): void {
  [...list.querySelectorAll('li:not(#empty-msg)')].forEach((el) => el.remove());
  emptyMsg.style.display = domains.length ? 'none' : '';

  domains.forEach((domain, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${domain}</span>`;
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '✕';
    btn.title = 'Remove';
    btn.onclick = () => removeDomain(idx);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function save(): void {
  chrome.storage.local.set({ [STORAGE_KEY]: domains }, () => showToast('Saved'));
}

function addDomain(): void {
  const raw    = input.value.trim();
  const domain = normalizeDomain(raw);
  errorMsg.textContent = '';

  if (!domain) return;
  if (!isValidDomain(domain)) { errorMsg.textContent = 'Invalid domain format.'; return; }
  if (domains.includes(domain)) { errorMsg.textContent = 'Domain already added.'; return; }

  domains.push(domain);
  input.value = '';
  renderList();
  save();
}

function removeDomain(idx: number): void {
  domains.splice(idx, 1);
  renderList();
  save();
}

chrome.storage.local.get(STORAGE_KEY, (result) => {
  domains = (result[STORAGE_KEY] as string[]) || [];
  renderList();
});

addBtn.addEventListener('click', addDomain);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDomain(); });
