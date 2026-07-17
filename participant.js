// participant.js
// Production-ready client logic for the participant dashboard (updated).
// Assumes backend sets a secure HTTP-only session cookie after authentication.
// Endpoints used:
//  - GET  /api/profile         -> returns { name, phone, email, currentBalance, totalDeposited, returnsEarned }
//  - GET  /api/transactions    -> returns [ { date, type, amount, status } ]
//  - POST /api/logout          -> clears session
// All requests use credentials: 'include' so cookies are sent/received by the browser.
//
// Improvements in this version:
// - Robust fetch helper with timeout and optional retries for transient failures
// - Clearer UI states (loading, empty, error) and a manual refresh action
// - Defensive rendering to avoid runtime errors if server returns unexpected shapes
// - Better logging and user-facing error messages
// - Small accessibility improvements (focus management for refresh button)

document.addEventListener('DOMContentLoaded', () => {
  attachUiHandlers();
  // Allow user to manually refresh profile/transactions
  const refreshBtn = createRefreshButton();
  const profileSection = document.getElementById('profileSection');
  if (profileSection && refreshBtn) profileSection.appendChild(refreshBtn);

  fetchAndRenderProfile();
  fetchAndRenderTransactions();
});

/* -------------------------
   UI wiring
   ------------------------- */
function attachUiHandlers() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const depositBtn = document.getElementById('depositBtn');
  if (depositBtn) depositBtn.addEventListener('click', (e) => { e.preventDefault(); openAction('deposit'); });

  const withdrawBtn = document.getElementById('withdrawBtn');
  if (withdrawBtn) withdrawBtn.addEventListener('click', (e) => { e.preventDefault(); openAction('withdraw'); });

  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) profileBtn.addEventListener('click', (e) => { e.preventDefault(); openAction('profile'); });
}

/* -------------------------
   Fetch helpers
   ------------------------- */
/**
 * Fetch with timeout and optional retries for transient errors.
 * - url: string
 * - options: fetch options
 * - timeoutMs: number (default 8000)
 * - retries: number (default 0)
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000, retries = 0) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return resp;
    } catch (err) {
      clearTimeout(id);
      // If aborted or network error and we have retries left, wait and retry
      const isAbort = err.name === 'AbortError';
      const isNetwork = err instanceof TypeError;
      if (attempt < retries && (isAbort || isNetwork)) {
        // Exponential backoff with jitter
        const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(r => setTimeout(r, backoff + Math.random() * 200));
        continue;
      }
      throw err;
    }
  }
}

/* -------------------------
   Profile fetching and rendering
   ------------------------- */
async function fetchAndRenderProfile() {
  setProfileLoading(true);
  clearProfileError();

  try {
    const resp = await fetchWithTimeout('/api/profile', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    }, 8000, 1); // one retry for transient issues

    if (resp.status === 401) return redirectToHome(); // not authenticated
    if (resp.status === 403) {
      showProfileError('Access denied. Please sign in again.');
      return;
    }
    if (!resp.ok) {
      // Try to parse error message if present
      let errMsg = `Profile request failed (${resp.status})`;
      try {
        const body = await resp.json();
        if (body && body.error) errMsg = body.error;
      } catch (_) { /* ignore parse errors */ }
      throw new Error(errMsg);
    }

    const profile = await safeJson(resp);
    if (!profile || typeof profile !== 'object') {
      throw new Error('Invalid profile data received from server.');
    }

    renderProfile(profile);
  } catch (err) {
    console.error('Error loading profile', err);
    showProfileError('Unable to load profile. Please refresh or contact support.');
  } finally {
    setProfileLoading(false);
  }
}

function renderProfile(profile) {
  const heading = document.getElementById('profileHeading');
  const lead = document.getElementById('profileLead');
  if (heading) heading.textContent = `Welcome, ${escapeText(profile.name) || 'Participant'}`;
  if (lead) {
    const phone = profile.phone ? escapeText(profile.phone) : '—';
    const email = profile.email ? ` • ${escapeText(profile.email)}` : '';
    lead.textContent = `Phone: ${phone}${email}`;
  }

  const pCurrent = document.getElementById('pCurrentBalance');
  const pDeposited = document.getElementById('pTotalDeposited');
  const pReturns = document.getElementById('pReturnsEarned');

  if (pCurrent) pCurrent.textContent = formatCurrency(profile.currentBalance);
  if (pDeposited) pDeposited.textContent = formatCurrency(profile.totalDeposited);
  if (pReturns) pReturns.textContent = formatCurrency(profile.returnsEarned);
}

function setProfileLoading(isLoading) {
  const lead = document.getElementById('profileLead');
  if (!lead) return;
  lead.style.opacity = isLoading ? '0.6' : '1';
  if (isLoading) lead.textContent = 'Loading your account…';
}

function showProfileError(msg) {
  const lead = document.getElementById('profileLead');
  if (lead) lead.textContent = msg;
}

function clearProfileError() {
  const lead = document.getElementById('profileLead');
  if (lead && lead.textContent && lead.textContent.startsWith('Unable to load')) {
    lead.textContent = '';
  }
}

/* -------------------------
   Transactions fetching and rendering
   ------------------------- */
async function fetchAndRenderTransactions() {
  const tbody = document.getElementById('txBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#666;padding:12px;">Loading transactions…</td></tr>`;

  try {
    const resp = await fetchWithTimeout('/api/transactions', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    }, 8000, 1);

    if (resp.status === 401) return redirectToHome();
    if (!resp.ok) throw new Error(`Transactions request failed (${resp.status})`);

    const txs = await safeJson(resp);
    renderTransactions(txs);
  } catch (err) {
    console.error('Error loading transactions', err);
    const tbody = document.getElementById('txBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#b00020;padding:12px;">Error loading transactions.</td></tr>';
  }
}

function renderTransactions(txs) {
  const tbody = document.getElementById('txBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!Array.isArray(txs) || txs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#666;padding:12px;">No transactions found.</td></tr>';
    return;
  }

  // Render newest first if server returns chronological order
  const list = Array.isArray(txs) ? txs.slice().reverse() : [];

  list.forEach(tx => {
    const tr = document.createElement('tr');

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(tx && tx.date);
    tr.appendChild(dateCell);

    const typeCell = document.createElement('td');
    typeCell.textContent = tx && tx.type ? tx.type : '—';
    tr.appendChild(typeCell);

    const amountCell = document.createElement('td');
    amountCell.textContent = formatCurrency(tx && tx.amount);
    tr.appendChild(amountCell);

    const statusCell = document.createElement('td');
    const span = document.createElement('span');
    span.className = `badge ${statusClass(tx && tx.status)}`;
    span.textContent = tx && tx.status ? tx.status : '—';
    statusCell.appendChild(span);
    tr.appendChild(statusCell);

    tbody.appendChild(tr);
  });
}

/* -------------------------
   Logout
   ------------------------- */
async function handleLogout(e) {
  e && e.preventDefault();
  try {
    // Attempt logout; server should clear session cookie
    await fetchWithTimeout('/api/logout', { method: 'POST', credentials: 'include' }, 5000, 0);
  } catch (err) {
    console.error('Logout request failed', err);
  } finally {
    // Redirect to public home regardless of logout response
    window.location.href = 'index.html';
  }
}

/* -------------------------
   Utilities
   ------------------------- */
function redirectToHome() {
  // If server indicates unauthenticated, send user to public site
  window.location.href = 'index.html';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '0.00';
  const num = Number(value);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

function statusClass(status) {
  if (!status) return '';
  switch (String(status).toLowerCase()) {
    case 'confirmed': return 'confirmed';
    case 'credited': return 'credited';
    case 'completed': return 'completed';
    case 'pending': return 'pending';
    case 'failed': return 'failed';
    default: return '';
  }
}

function openAction(action) {
  // Placeholder hooks for deposit/withdraw/profile actions.
  // In production these should open a secure modal or navigate to a server-rendered page.
  switch (action) {
    case 'deposit':
      window.location.href = '/deposit.html';
      break;
    case 'withdraw':
      window.location.href = '/withdraw.html';
      break;
    case 'profile':
      window.location.href = '/account.html';
      break;
    default:
      console.warn('Unknown action', action);
  }
}

/* -------------------------
   Small helpers
   ------------------------- */
async function safeJson(response) {
  try {
    return await response.json();
  } catch (e) {
    return null;
  }
}

function escapeText(s) {
  if (s === null || s === undefined) return '';
  return String(s);
}

/* -------------------------
   UI: Refresh button
   ------------------------- */
function createRefreshButton() {
  try {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'refreshData';
    btn.className = 'btn-secondary';
    btn.style.marginLeft = '12px';
    btn.textContent = 'Refresh';
    btn.title = 'Refresh profile and transactions';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Refreshing…';
      try {
        await Promise.all([fetchAndRenderProfile(), fetchAndRenderTransactions()]);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Refresh';
        btn.focus();
      }
    });
    return btn;
  } catch (err) {
    console.error('Could not create refresh button', err);
    return null;
  }
}
