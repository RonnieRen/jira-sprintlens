const STORAGE_KEY = 'jsl_custom_domains';

const input = document.getElementById('domain-input');
const addBtn = document.getElementById('add-btn');
const list = document.getElementById('domain-list');
const emptyMsg = document.getElementById('empty-msg');
const errorMsg = document.getElementById('error-msg');
const toast = document.getElementById('toast');

let domains = [];

function normalizeDomain(raw) {
  return raw.replace(/https?:\/\//, '').replace(/\/.*$/, '').trim().toLowerCase();
}

function isValidDomain(domain) {
  return /^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?(\.[a-z]{2,})+$/.test(domain);
}

function showToast(msg = 'Saved') {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function renderList() {
  // Remove all items except empty message
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

function save() {
  chrome.storage.local.set({ [STORAGE_KEY]: domains }, () => {
    showToast('Saved');
  });
}

function addDomain() {
  const raw = input.value.trim();
  const domain = normalizeDomain(raw);
  errorMsg.textContent = '';

  if (!domain) return;
  if (!isValidDomain(domain)) {
    errorMsg.textContent = 'Invalid domain format.';
    return;
  }
  if (domains.includes(domain)) {
    errorMsg.textContent = 'Domain already added.';
    return;
  }

  domains.push(domain);
  input.value = '';
  renderList();
  save();
}

function removeDomain(idx) {
  domains.splice(idx, 1);
  renderList();
  save();
}

// Load saved domains
chrome.storage.local.get(STORAGE_KEY, (result) => {
  domains = result[STORAGE_KEY] || [];
  renderList();
});

addBtn.addEventListener('click', addDomain);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDomain();
});
