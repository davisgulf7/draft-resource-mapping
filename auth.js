/* ─────────────────────────────────────────────────────────────
   auth.js — shared session + role helpers.

   Requires: config.js (which has loaded the Supabase client into
   window.sb). Load this file AFTER config.js in every page that
   needs a session-protected experience.

   Public API (attached to window.Auth):
     requireSession({ allowedRoles, redirectIfAnon }) → Promise<{user, profile}>
     currentUser()                                    → Promise<{user, profile}|null>
     signOut()                                        → void (redirects to /login.html)
     renderUserChip(target?)                          → void
     onSignOut(handler)                               → void
───────────────────────────────────────────────────────────── */

(() => {
  let cached = null;          // {user, profile} once we've looked them up
  let signOutHandlers = [];

  /* ── Internal: fetch the current user + their profile row ── */
  async function fetchUserAndProfile() {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session?.user) return null;

    const user = session.user;
    const { data: profile, error } = await window.sb
      .from('profiles')
      .select('id, role, display_name, email')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Could not load profile:', error);
      return null;
    }
    if (!profile) {
      // Edge case: auth user exists but profile trigger didn't fire.
      console.warn('No profile row for user', user.id);
      return null;
    }

    return { user, profile };
  }

  /* ── Public: get current user (no redirect) ── */
  async function currentUser() {
    if (cached) return cached;
    cached = await fetchUserAndProfile();
    return cached;
  }

  /* ── Public: gate a page on session + (optionally) role ── */
  async function requireSession(opts = {}) {
    const { allowedRoles = null, redirectIfAnon = 'login.html' } = opts;

    const found = await currentUser();
    if (!found) {
      window.location.href = redirectIfAnon;
      // Keep the promise pending so caller code doesn't continue
      return new Promise(() => {});
    }

    if (allowedRoles && !allowedRoles.includes(found.profile.role)) {
      window.location.href = 'unauthorized.html';
      return new Promise(() => {});
    }

    return found;
  }

  /* ── Public: sign out ── */
  async function signOut() {
    signOutHandlers.forEach(h => { try { h(); } catch (_) {} });
    try {
      await window.sb.auth.signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
    cached = null;
    window.location.href = 'login.html';
  }

  function onSignOut(handler) {
    signOutHandlers.push(handler);
  }

  /* ── Public: render the user chip into .topbar__user (if present) ── */
  function renderUserChip(target) {
    const mount = target ||
                  document.querySelector('.topbar__user') ||
                  document.querySelector('[data-user-chip]');
    if (!mount) return;

    if (!cached) return;
    const { profile } = cached;
    const name = profile.display_name || profile.email || 'Account';

    mount.innerHTML = '';
    const chip = document.createElement('div');
    chip.className = 'user-chip';

    chip.innerHTML = `
      <span class="user-chip__avatar" aria-hidden="true">${initialFrom(name)}</span>
      <span class="user-chip__meta">
        <span class="user-chip__name">${escapeHtml(name)}</span>
        <span class="user-chip__role">${escapeHtml(profile.role)}</span>
      </span>
      <button type="button" class="user-chip__signout btn btn--ghost btn--sm" title="Sign out">Sign out</button>
    `;

    chip.querySelector('.user-chip__signout').addEventListener('click', signOut);
    mount.appendChild(chip);
  }

  function initialFrom(s) {
    if (!s) return '?';
    return s.trim().charAt(0).toUpperCase();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ── Public surface ── */
  window.Auth = {
    requireSession,
    currentUser,
    signOut,
    renderUserChip,
    onSignOut,
  };
})();
