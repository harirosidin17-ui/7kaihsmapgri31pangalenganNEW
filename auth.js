/**
 * ============================================================
 * 7 KAIH — Auth Layer (Supabase Auth)
 * ============================================================
 * Mapping role:
 *   - siswa  → login dengan email: {nis}@siswa.kaih.local  atau email asli
 *   - guru   → login dengan email: {nuptk}@guru.kaih.local atau email asli
 *   - admin  → login dengan email admin yang didaftarkan
 *
 * Password default saat seed: "kaih2026" (wajib diganti)
 */

window.KAIH_Auth = (function () {
  "use strict";

  const cfg = () => window.KAIH_CONFIG || {};
  const sb = () => window.sb;

  function useCloud() {
    return cfg().USE_SUPABASE && sb();
  }

  /** Ubah username role menjadi email internal jika belum berupa email */
  function toEmail(username, role) {
    const u = String(username || "").trim().toLowerCase();
    if (u.includes("@")) return u;
    if (role === "siswa") return u + "@siswa.kaih.local";
    if (role === "guru") return u + "@guru.kaih.local";
    return u + "@admin.kaih.local";
  }

  /**
   * Login
   * @param {string} username - NIS / NUPTK / email
   * @param {string} password
   * @param {string} role - 'siswa' | 'guru' | 'admin'
   * @returns {Promise<{ok:boolean, user?:object, error?:string}>}
   */
  async function login(username, password, role) {
    if (!useCloud()) {
      return { ok: false, error: "Supabase belum dikonfigurasi. Isi js/config.js dulu." };
    }

    const email = toEmail(username, role);

    const { data, error } = await sb().auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { ok: false, error: error.message || "Login gagal" };
    }

    // Ambil profile
    const profile = await getProfile(data.user.id);
    if (!profile) {
      await sb().auth.signOut();
      return { ok: false, error: "Profil user tidak ditemukan. Hubungi admin." };
    }

    // Validasi role
    if (profile.role !== role) {
      await sb().auth.signOut();
      return { ok: false, error: "Role tidak sesuai. Pilih role yang benar." };
    }

    // Simpan session ke objek global yang dipakai app lama
    const sessionUser = {
      id: data.user.id,
      role: profile.role,
      no_induk: profile.no_induk || username,
      nama: profile.nama || data.user.email,
      kelas: profile.kelas || "",
      jk: profile.jk || "",
      email: data.user.email
    };

    // Sinkron ke localStorage agar app lama tetap jalan
    try {
      localStorage.setItem("kaih3_session", JSON.stringify(sessionUser));
    } catch (e) {}

    return { ok: true, user: sessionUser };
  }

  async function logout() {
    if (useCloud()) {
      await sb().auth.signOut();
    }
    try {
      localStorage.removeItem("kaih3_session");
    } catch (e) {}
  }

  async function getSession() {
    if (!useCloud()) return null;
    const { data } = await sb().auth.getSession();
    if (!data?.session?.user) return null;

    const profile = await getProfile(data.session.user.id);
    if (!profile) return null;

    return {
      id: data.session.user.id,
      role: profile.role,
      no_induk: profile.no_induk,
      nama: profile.nama,
      kelas: profile.kelas || "",
      jk: profile.jk || "",
      email: data.session.user.email
    };
  }

  async function getProfile(userId) {
    const { data, error } = await sb()
      .from(cfg().TABLE_PROFILES || "profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[KAIH Auth] getProfile", error);
      return null;
    }
    return data;
  }

  /**
   * Daftarkan user baru (hanya dipanggil admin / seed)
   * Membutuhkan service role di backend, atau dijalankan lewat SQL.
   * Di frontend ini hanya helper untuk development.
   */
  async function signUp(email, password, profile) {
    if (!useCloud()) return { ok: false, error: "Supabase off" };

    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: {
        data: {
          role: profile.role,
          no_induk: profile.no_induk,
          nama: profile.nama
        }
      }
    });

    if (error) return { ok: false, error: error.message };

    // Profile biasanya diisi lewat trigger SQL (lihat 001_init.sql)
    // Jika trigger belum ada, insert manual:
    if (data.user) {
      await sb().from(cfg().TABLE_PROFILES || "profiles").upsert({
        id: data.user.id,
        role: profile.role,
        no_induk: profile.no_induk,
        nama: profile.nama,
        kelas: profile.kelas || null,
        jk: profile.jk || null
      });
    }

    return { ok: true, user: data.user };
  }

  async function changePassword(newPassword) {
    if (!useCloud()) return { ok: false, error: "Supabase off" };
    const { error } = await sb().auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  return {
    login,
    logout,
    getSession,
    getProfile,
    signUp,
    changePassword,
    toEmail,
    useCloud
  };
})();
