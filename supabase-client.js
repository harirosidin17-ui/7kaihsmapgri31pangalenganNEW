/**
 * Inisialisasi Supabase Client
 */
(function () {
  "use strict";

  if (typeof window.supabase === "undefined") {
    console.error("[KAIH] Library @supabase/supabase-js belum dimuat. Cek CDN di index.html");
    window.sb = null;
    return;
  }

  const cfg = window.KAIH_CONFIG || {};
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR_PROJECT")) {
    console.warn("[KAIH] SUPABASE_URL belum diisi di js/config.js → mode localStorage aktif");
    window.sb = null;
    window.KAIH_CONFIG = window.KAIH_CONFIG || {};
    window.KAIH_CONFIG.USE_SUPABASE = false;
    return;
  }

  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  });

  console.info("[KAIH] Supabase client siap →", cfg.SUPABASE_URL);
})();
