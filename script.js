// script.js (production-ready client handlers)
// - Calculator logic
// - Signup modal UX
// - Signup form POST via fetch to /api/signup (credentials included for HTTP-only session cookie)
//
// Server responsibilities (backend):
//  - Validate name (required), phone (required) and password (required, min 8 chars)
//  - Hash password and store securely (bcrypt/argon2)
//  - Create participant record and set an HTTP-only, Secure, SameSite cookie
//  - Return JSON { success: true, redirect: "/participant.html" } on success
//  - Return JSON { success: false, error: "message" } on validation/auth failure
//  - Respond to CORS preflight (OPTIONS) if frontend and API are on different origins

// <-- Added API base for Vercel deployment -->
const API_BASE = 'https://legacy-finance-ghana-2v188uv34-squardzbrain-industry.vercel.app';

document.addEventListener('DOMContentLoaded', () => {
  // Calculator buttons
  const calcBtn = document.getElementById('calcBtn');
  const resetBtn = document.getElementById('resetBtn');
  if (calcBtn) calcBtn.addEventListener('click', calculateGrowth);
  if (resetBtn) resetBtn.addEventListener('click', resetForm);

  // Signup modal and form
  initSignup();

  // Initialize projected placeholder
  const projectedEl = document.getElementById('projected');
  if (projectedEl) projectedEl.textContent = '—';
});

/* -------------------------
   Growth calculator
   ------------------------- */
function calculateGrowth() {
  const amountEl = document.getElementById('amount');
  const monthsEl = document.getElementById('months');
  const rateEl = document.getElementById('rate');
  const projectedEl = document.getElementById('projected');

  if (!amountEl || !monthsEl || !rateEl || !projectedEl) return;

  const amount = parseFloat(amountEl.value);
  const months = parseInt(monthsEl.value, 10);
  const rate = parseFloat(rateEl.value);

  if (isNaN(amount) || amount <= 0) {
    showCalcError('Please enter a valid amount greater than 0.');
    amountEl.focus();
    return;
  }
  if (isNaN(months) || months <= 0) {
    showCalcError('Please select a valid duration.');
    monthsEl.focus();
    return;
  }

  // Compound interest monthly
  const projected = amount * Math.pow(1 + rate, months);
  projectedEl.textContent = projected.toFixed(2);

  // Clear any previous calc error
  clearCalcError();
}

function resetForm() {
  const amountEl = document.getElementById('amount');
  const monthsEl = document.getElementById('months');
  const rateEl = document.getElementById('rate');
  const projectedEl = document.getElementById('projected');

  if (amountEl) amountEl.value = 1000;
  if (monthsEl) monthsEl.value = '6';
  if (rateEl) rateEl.value = '0.04';
  if (projectedEl) projectedEl.textContent = '—';
  clearCalcError();
}

function showCalcError(msg) {
  let el = document.getElementById('calcError');
  if (!el) {
    el = document.createElement('div');
    el.id = 'calcError';
    el.style.color = '#b00020';
    el.style.marginTop = '8px';
    const container = document.querySelector('.calculator .calc-form');
    if (container) container.appendChild(el);
  }
  el.textContent = msg;
}

function clearCalcError() {
  const el = document.getElementById('calcError');
  if (el) el.remove();
}

/* -------------------------
   Signup modal + form (production)
   ------------------------- */
function initSignup() {
  const openBtn = document.getElementById('openSignup');
  const modal = document.getElementById('signupModal');
  const closeBtn = document.getElementById('closeSignup');
  const cancelBtn = document.getElementById('signupCancel');
  const signupForm = document.getElementById('signupForm');

  if (!openBtn || !modal || !signupForm) return;

  // Open modal
  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modal.hidden = false;
    trapFocus(modal);
    const name = document.getElementById('fullName') || document.getElementById('phone');
    if (name) name.focus();
  });

  // Close handlers
  closeBtn && closeBtn.addEventListener('click', () => closeModal(modal));
  cancelBtn && cancelBtn.addEventListener('click', () => closeModal(modal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal(modal);
  });

  // Intercept form submit and POST via fetch (JSON)
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearSignupError();

    const fullName = (document.getElementById('fullName') || {}).value || '';
    const phone = (document.getElementById('phone') || {}).value || '';
    const password = (document.getElementById('password') || {}).value || '';
    const redirect = (signupForm.querySelector('input[name="redirect"]') || {}).value || '/participant.html';

    // Basic client-side validation (server must re-validate)
    if (!fullName || fullName.trim().length < 2) {
      showSignupError('Please enter your full name.');
      document.getElementById('fullName').focus();
      return;
    }
    if (!phone || phone.trim().length < 7) {
      showSignupError('Please enter a valid phone number.');
      document.getElementById('phone').focus();
      return;
    }
    if (!password || password.length < 8) {
      showSignupError('Password must be at least 8 characters.');
      document.getElementById('password').focus();
      return;
    }

    // Prepare payload
    const payload = { name: fullName.trim(), phone: phone.trim(), password };

    // POST to server. Use credentials: 'include' so server can set HTTP-only cookies.
    try {
      const resp = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      // Expect JSON response from server
      const data = await safeJson(resp);

      if (resp.ok && data && data.success) {
        // Server should set session cookie; redirect to provided location
        const dest = data.redirect || redirect || '/participant.html';
        window.location.href = dest;
        return;
      }

      // Handle validation or server errors
      const err = (data && data.error) ? data.error : `Signup failed (${resp.status}).`;
      showSignupError(err);
    } catch (err) {
      showSignupError('Network error. Please try again.');
      // Keep modal open for retry
      console.error('Signup error', err);
    }
  });
}

/* Close modal and restore focus */
function closeModal(modal) {
  modal.hidden = true;
  releaseFocusTrap();
  const openBtn = document.getElementById('openSignup');
  if (openBtn) openBtn.focus();
}

/* Show inline signup error inside modal */
function showSignupError(msg) {
  let el = document.getElementById('signupError');
  const modalContent = document.querySelector('.modal-content');
  if (!modalContent) {
    alert(msg);
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'signupError';
    el.style.color = '#b00020';
    el.style.marginTop = '10px';
    el.style.fontSize = '13px';
    modalContent.appendChild(el);
  }
  el.textContent = msg;
}

/* Clear signup error */
function clearSignupError() {
  const el = document.getElementById('signupError');
  if (el) el.remove();
}

/* Safe JSON parse helper */
async function safeJson(response) {
  try {
    return await response.json();
  } catch (e) {
    return null;
  }
}

/* -------------------------
   Focus trap (simple)
   ------------------------- */
let previousActive = null;
function trapFocus(modal) {
  previousActive = document.activeElement;
  const focusable = modal.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable || focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleKey(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  modal._focusHandler = handleKey;
  document.addEventListener('keydown', handleKey);
}

function releaseFocusTrap() {
  const modal = document.getElementById('signupModal');
  if (!modal || !modal._focusHandler) return;
  document.removeEventListener('keydown', modal._focusHandler);
  modal._focusHandler = null;
  if (previousActive) previousActive.focus();
  previousActive = null;
}
