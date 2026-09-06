(function initAccountSession(root) {
  const ACCOUNTS = {
    player: [
      { hash: 'cdb59355f3ba293977fc0945fb85f11822d412c45c7520c7121bd2234f6c1f48', playerRole: 'player', environment: 'test' },
      { hash: '86efa4a4f57d74780988b065d7621df44e498eb105b048c81d19252073bd872a', playerRole: 'player_live', environment: 'live' },
    ],
    admin: [
      { hash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', playerRole: 'player', environment: 'test' },
      { hash: '57ddecc129d8696d3f455b9aab450acf1910ea072c71657e3c2b02d5ae97855a', playerRole: 'player_live', environment: 'live' },
    ],
  };

  async function sha256(value) {
    if (typeof require === 'function') {
      return require('node:crypto').createHash('sha256').update(value).digest('hex');
    }
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function verify(role, password) {
    const candidates = ACCOUNTS[role] || [];
    const hash = await sha256(String(password || ''));
    const account = candidates.find(candidate => candidate.hash === hash);
    return account ? { role, playerRole: account.playerRole, environment: account.environment } : null;
  }

  root.AccountSession = { verify };
  if (typeof module !== 'undefined' && module.exports) module.exports = { verify };
})(typeof globalThis !== 'undefined' ? globalThis : window);
