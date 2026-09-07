(function initLoginCredentials(root) {
  const ROLE_NAMES = { player: '\u4fee\u70bc\u8005', admin: '\u5929\u9053' };

  function create(options = {}) {
    const { usernameInput, passwordInput } = options;
    const credentials = options.credentials;
    const PasswordCredential = options.PasswordCredential;
    const supported = options.isSecureContext === true && credentials;
    let role = null;
    let revision = 0;

    passwordInput.addEventListener('input', () => { revision++; });

    function clear() {
      revision++;
      passwordInput.value = '';
    }

    async function selectRole(nextRole) {
      if (!Object.hasOwn(ROLE_NAMES, nextRole)) return false;
      if ((role && role !== nextRole)
          || (usernameInput.value && usernameInput.value !== nextRole)) clear();
      role = nextRole;
      usernameInput.value = nextRole;
      const requestRevision = ++revision;
      if (!supported || typeof credentials.get !== 'function' || passwordInput.value) return false;
      try {
        // Silent retrieval never opens an account chooser or submits the form.
        const saved = await credentials.get({ password: true, mediation: 'silent' });
        if (requestRevision !== revision || role !== nextRole || passwordInput.value
            || saved?.type !== 'password' || saved.id !== nextRole
            || typeof saved.password !== 'string' || !saved.password) return false;
        passwordInput.value = saved.password;
        return true;
      } catch {
        return false;
      }
    }

    function readPassword(expectedRole) {
      revision++;
      if (role !== expectedRole || usernameInput.value !== expectedRole) {
        clear();
        usernameInput.value = expectedRole;
        return '';
      }
      return passwordInput.value;
    }

    async function saveVerified(verifiedRole, password) {
      if (!supported || typeof credentials.store !== 'function'
          || typeof PasswordCredential !== 'function'
          || !Object.hasOwn(ROLE_NAMES, verifiedRole) || !password) return false;
      try {
        const credential = new PasswordCredential({
          id: verifiedRole,
          name: ROLE_NAMES[verifiedRole],
          password,
        });
        await credentials.store(credential);
        return true;
      } catch {
        return false;
      }
    }

    return { selectRole, clear, readPassword, saveVerified };
  }

  root.LoginCredentials = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
})(typeof globalThis !== 'undefined' ? globalThis : window);
