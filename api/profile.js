// api/profile.js (demo)
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // In production: validate session cookie and fetch user from DB.
  res.json({
    name: 'Kwame Mensah',
    phone: '+233201234567',
    email: null,
    currentBalance: 1200,
    totalDeposited: 1000,
    returnsEarned: 200
  });
};
