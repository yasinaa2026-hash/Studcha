(() => {
  const q = (s) => document.querySelector(s);
  const cfg = window.CHAT_CONFIG || {};
  const configured = Boolean(
    cfg.supabaseUrl &&
    cfg.supabaseAnonKey &&
    !String(cfg.supabaseUrl).includes('YOUR_') &&
    !String(cfg.supabaseAnonKey).includes('YOUR_')
  );

  function message(text) {
    const box = q('#authMessage');
    if (box) box.textContent = text;
  }

  async function initChat() {
    if (!configured) {
      message('التطبيق جاهز، ويحتاج اتصال الخدمة من مالك الموقع قبل استقبال الحسابات والرسائل.');
      q('#signupForm')?.querySelectorAll('input,button').forEach((el) => el.disabled = true);
      q('#loginForm')?.querySelectorAll('input,button').forEach((el) => el.disabled = true);
      return;
    }

    try {
      // These public values stay outside the user interface. Never put a Service Role key here.
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session) {
        await start(data.session.user);
      } else {
        show('authScreen');
      }

      client.auth.onAuthStateChange(async (_event, session) => {
        if (session && !me) await start(session.user);
        if (!session) show('authScreen');
      });

      q('#roomsBtn')?.addEventListener('click', () => {
        if (typeof openRooms === 'function') openRooms();
      });
    } catch (err) {
      console.error(err);
      message('تعذر الاتصال بالخدمة الآن.');
    }
  }

  window.addEventListener('load', initChat);
})();
