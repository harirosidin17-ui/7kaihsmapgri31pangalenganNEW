/**
 * ============================================================
 * 7 KAIH — Bridge ke aplikasi lama (index.html monolitik)
 * ============================================================
 * File ini menimpa / membungkus fungsi login & penyimpanan
 * yang ada di index.html agar memakai Supabase.
 *
 * Dijalankan SETELAH seluruh script di index.html dimuat.
 */

(function () {
  "use strict";

  const Auth = window.KAIH_Auth;
  const Data = window.KAIH_Data;

  if (!Auth || !Data) {
    console.error("[KAIH Bridge] Auth/Data belum dimuat");
    return;
  }

  // ---------- Toast helper ----------
  function toast(msg, type) {
    if (typeof window.toast === "function") {
      window.toast(msg, type || "ok");
      return;
    }
    console.log("[toast]", type, msg);
  }

  // ---------- Override doLogin ----------
  // App lama punya fungsi doLogin() yang membaca #inpUser, #inpPass, role
  const originalDoLogin = window.doLogin;

  window.doLogin = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const userEl = document.getElementById("inpUser");
    const passEl = document.getElementById("inpPass");
    const username = (userEl?.value || "").trim();
    const password = passEl?.value || "";

    // Cari role aktif
    let role = "siswa";
    const activeBtn = document.querySelector(".role-btn.active, .role-btn.active-role, [data-role].active");
    if (activeBtn?.dataset?.role) role = activeBtn.dataset.role;
    else if (window.selectedRole) role = window.selectedRole;

    if (!username || !password) {
      toast("Username dan password wajib diisi.", "err");
      return;
    }

    // Jika Supabase aktif → pakai Auth
    if (Auth.useCloud()) {
      toast("Memverifikasi...", "ok");
      const res = await Auth.login(username, password, role);
      if (!res.ok) {
        toast(res.error || "Login gagal", "err");
        return;
      }

      // Set user global yang dipakai app lama
      window.user = res.user;
      try {
        localStorage.setItem("kaih3_user", JSON.stringify(res.user));
      } catch (_) {}

      // Sync data dari cloud
      await Data.syncAll();

      // Lanjutkan alur UI lama
      if (typeof window.afterLogin === "function") {
        window.afterLogin(res.user);
      } else if (typeof window.showWelcome === "function") {
        window.showWelcome(res.user);
      } else {
        // Fallback: sembunyikan login, tampilkan mainApp
        const loginPage = document.getElementById("loginPage");
        const mainApp = document.getElementById("mainApp");
        const wel = document.getElementById("welcomeOV");
        if (loginPage) loginPage.classList.add("hidden");
        if (wel) {
          const nameEl = document.getElementById("welName");
          if (nameEl) nameEl.textContent = "Halo, " + (res.user.nama || res.user.no_induk) + "!";
          wel.classList.remove("hidden");
          wel.classList.add("flex");
        } else if (mainApp) {
          mainApp.classList.remove("hidden");
        }
      }

      toast("Login berhasil. Selamat datang, " + (res.user.nama || "") + "!", "ok");
      return;
    }

    // Fallback ke login lokal (original)
    if (typeof originalDoLogin === "function") {
      return originalDoLogin.call(this, e);
    }

    toast("Mode lokal: pastikan data siswa/guru sudah di-import.", "err");
  };

  // Hook form submit
  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("loginForm");
    if (form) {
      form.removeEventListener("submit", originalDoLogin);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        window.doLogin(e);
      });
    }
  });

  // Juga hook langsung jika form sudah ada
  setTimeout(function () {
    const form = document.getElementById("loginForm");
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        window.doLogin(e);
        return false;
      };
    }
  }, 500);

  // ---------- Override logout ----------
  const originalLogout = window.logout || window.doLogout;
  window.logout = async function () {
    await Auth.logout();
    try {
      localStorage.removeItem("kaih3_user");
      localStorage.removeItem("kaih3_session");
    } catch (_) {}
    window.user = null;
    location.reload();
  };
  window.doLogout = window.logout;

  // ---------- Override penyimpanan form (btnKirim) ----------
  // App lama biasanya punya fungsi kirimForm / submitForm / saveForm
  // Kita bungkus yang paling umum

  function buildSubmissionFromForm() {
    // Baca jawaban dari tombol .ans.sel-ya / .ans.sel-td
    const answers = {};
    document.querySelectorAll(".ans.sel-ya, .ans.sel-td").forEach((btn) => {
      const k = btn.dataset.k;
      const v = btn.dataset.v;
      if (k) answers[k] = v;
    });

    const u = window.user || {};
    const today = new Date().toISOString().slice(0, 10);

    return {
      no_induk: u.no_induk || u.nis || "",
      nama: u.nama || "",
      kelas: u.kelas || "",
      tanggal: today,
      bangunPagi: answers.bangunPagi || null,
      jamBangun: document.getElementById("jamBangun")?.value || null,
      subuh: answers.subuh || null,
      dzuhur: answers.dzuhur || null,
      ashar: answers.ashar || null,
      maghrib: answers.maghrib || null,
      isya: answers.isya || null,
      haid: answers.haid || null,
      olahraga: answers.olahraga || null,
      jenisOlahraga: document.getElementById("jenisOlahraga")?.value || null,
      makanSehat: answers.makanSehat || null,
      belajar: answers.belajar || null,
      bacaBuku: answers.bacaBuku || null,
      namaBuku: document.getElementById("namaBuku")?.value || null,
      bermasyarakat: answers.bermasyarakat || null,
      kegiatanMasyarakat: document.getElementById("kegiatanMasyarakat")?.value || null,
      tidurCepat: answers.tidurCepat || null,
      jamTidur: document.getElementById("jamTidur")?.value || null
    };
  }

  // Hook tombol Kirim
  function hookKirimButton() {
    const btn = document.getElementById("btnKirim");
    if (!btn || btn.dataset.kaihHooked) return;
    btn.dataset.kaihHooked = "1";

    btn.addEventListener("click", async function (e) {
      // Biarkan app lama juga jalan, tapi kita pastikan data masuk Supabase
      if (!Data.useCloud()) return; // biarkan flow lokal

      e.preventDefault();
      e.stopImmediatePropagation();

      const row = buildSubmissionFromForm();
      if (!row.no_induk) {
        toast("Anda belum login dengan benar.", "err");
        return;
      }

      // Validasi minimal: minimal 1 jawaban
      const hasAnswer = Object.keys(row).some(
        (k) =>
          ["bangunPagi", "olahraga", "makanSehat", "belajar", "bermasyarakat", "tidurCepat", "subuh"].includes(k) &&
          row[k]
      );
      if (!hasAnswer) {
        toast("Isi minimal satu kebiasaan.", "err");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> Menyimpan...';

      const res = await Data.saveSubmission(row);

      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane mr-1.5"></i>Kirim Data';

      if (res.ok) {
        toast("Data berhasil disimpan ke database!", "ok");
        // Trigger refresh beranda jika ada
        if (typeof window.updateBeranda === "function") window.updateBeranda();
        if (typeof window.renderRiwayat === "function") window.renderRiwayat();
      } else {
        toast("Gagal menyimpan: " + (res.error || "unknown"), "err");
      }
    }, true); // capture phase agar mendahului handler lama
  }

  // Coba hook berkala karena tombol mungkin di-render dinamis
  setInterval(hookKirimButton, 1500);
  document.addEventListener("DOMContentLoaded", hookKirimButton);

  // ---------- Auto restore session ----------
  async function tryRestoreSession() {
    if (!Auth.useCloud()) return;
    const session = await Auth.getSession();
    if (!session) return;

    window.user = session;
    try {
      localStorage.setItem("kaih3_user", JSON.stringify(session));
    } catch (_) {}

    await Data.syncAll();

    // Jika masih di halaman login, lompat ke app
    const loginPage = document.getElementById("loginPage");
    const mainApp = document.getElementById("mainApp");
    if (loginPage && !loginPage.classList.contains("hidden") && mainApp) {
      // Biarkan user klik "Lanjut" atau langsung masuk
      console.info("[KAIH] Session aktif:", session.nama, session.role);
    }
  }

  // Tunggu client siap
  setTimeout(tryRestoreSession, 800);

  console.info("[KAIH Bridge] Aktif — login & form terhubung ke Supabase");
})();
