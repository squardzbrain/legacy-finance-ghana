document.addEventListener('DOMContentLoaded', () => {
  const calcBtn = document.getElementById('calcBtn');
  const resetBtn = document.getElementById('resetBtn');

  calcBtn.addEventListener('click', calculateGrowth);
  resetBtn.addEventListener('click', resetForm);

  // Pre-calc example to match mockup: 1000 at 4% for 6 months => ~1264.86
  document.getElementById('projected').textContent = '—';
});

function calculateGrowth() {
  const amountEl = document.getElementById('amount');
  const monthsEl = document.getElementById('months');
  const rateEl = document.getElementById('rate');
  const projectedEl = document.getElementById('projected');

  const amount = parseFloat(amountEl.value);
  const months = parseInt(monthsEl.value, 10);
  const rate = parseFloat(rateEl.value);

  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount greater than 0.');
    amountEl.focus();
    return;
  }
  if (isNaN(months) || months <= 0) {
    alert('Please select a valid duration.');
    monthsEl.focus();
    return;
  }

  const projected = amount * Math.pow(1 + rate, months);
  projectedEl.textContent = projected.toFixed(2);

  // Optional: update current balance preview (commented out)
  // document.getElementById('currentBalance').textContent = projected.toFixed(2);
}

function resetForm() {
  document.getElementById('amount').value = 1000;
  document.getElementById('months').value = '6';
  document.getElementById('rate').value = '0.04';
  document.getElementById('projected').textContent = '—';
}
