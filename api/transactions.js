// api/transactions.js (demo)
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  res.json([
    { date: '2026-07-01', type: 'Deposit (MoMo)', amount: 500, status: 'Confirmed' },
    { date: '2026-07-31', type: 'Return (4%)', amount: 40, status: 'Credited' },
    { date: '2026-08-05', type: 'Withdrawal', amount: 200, status: 'Completed' }
  ]);
};
