/**
 * ============================================================
 * 7 KAIH — Konfigurasi Supabase
 * ============================================================
 * 1. Buka https://supabase.com → Project → Settings → API
 * 2. Salin Project URL dan anon public key ke bawah
 * 3. JANGAN pernah taruh service_role key di frontend
 */
window.KAIH_CONFIG = {
  // ========== ISI DUA BARIS INI ==========
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_PUBLIC_KEY_HERE",
  // =======================================

  STORAGE_BUCKET_BRANDING: "branding",
  STORAGE_BUCKET_SIGNATURES: "signatures",

  // true = pakai Supabase Auth + Database
  // false = fallback localStorage (untuk development offline)
  USE_SUPABASE: true,

  // Nama tabel
  TABLE_SISWA: "siswa",
  TABLE_GURU: "guru",
  TABLE_SUBS: "submissions",
  TABLE_SETTINGS: "settings",
  TABLE_WALI: "wali_kelas",
  TABLE_PROFILES: "profiles"
};
