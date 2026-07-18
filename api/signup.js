// api/signup.js (Vercel serverless)
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const USERS = new Map();    // demo only
const SESSIONS = new Map(); // demo only

function makeSetCookieHeader(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  return parts.join('; ');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success:false, error:'Method not allowed' });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  let body;
  try { body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}'); }
  catch (e) { res.status(400).json({ success:false, error:'Invalid JSON' }); return; }

  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  const password = body.password || '';

  if (!name || name.length < 2) return res.status(400).json({ success:false, error:'Full name required' });
  if (!phone || phone.length < 7) return res.status(400).json({ success:false, error:'Valid phone required' });
  if (!password || password.length < 8) return res.status(400).json({ success:false, error:'Password must be at least 8 chars' });

  if (USERS.has(phone)) return res.status(409).json({ success:false, error:'Phone already registered' });

  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const user = {
      id: 'u_' + Date.now(),
      name,
      phone,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      currentBalance: 0,
      totalDeposited: 0,
      returnsEarned: 0
    };
    USERS.set(phone, user);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    SESSIONS.set(sessionToken, phone);

    const cookie = makeSetCookieHeader('session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });
    res.setHeader('Set-Cookie', cookie);

    res.status(200).json({ success:true, redirect:'/participant.html' });
  } catch (err) {
    console.error('Signup error', err);
    res.status(500).json({ success:false, error:'Server error' });
  }
};
