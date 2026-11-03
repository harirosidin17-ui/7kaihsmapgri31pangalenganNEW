/**
 * ============================================================
 * 7 KAIH — Data Layer (Supabase + fallback localStorage)
 * ============================================================
 * Semua CRUD utama melewati file ini.
 * App lama yang masih memanggil localStorage akan di-override
 * lewat bridge di bridge.js
 */

window.KAIH_Data = (function () {
  "use strict";

  const cfg = () => window.KAIH_CONFIG || {};
  const sb = () => window.sb;

  function useCloud() {
    return cfg().USE_SUPABASE && sb();
  }

  // ---------- helpers localStorage ----------
  function lsGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }
  function lsSet(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn("[KAIH] localStorage full?", e);
    }
  }

  // ===================== SISWA =====================
  async function getSiswa() {
    if (!useCloud()) return lsGet("kaih3_siswa", []);
    const { data, error } = await sb()
      .from(cfg().TABLE_SISWA || "siswa")
      .select("*")
      .order("kelas")
      .order("nama");
    if (error) {
      console.error("[KAIH] getSiswa", error);
      return lsGet("kaih3_siswa", []);
    }
    return data || [];
  }

  async function setSiswa(list) {
    if (!useCloud()) {
      lsSet("kaih3_siswa", list);
      return true;
    }
    // Upsert semua baris
    const { error } = await sb()
      .from(cfg().TABLE_SISWA || "siswa")
      .upsert(list, { onConflict: "no_induk" });
    if (error) {
      console.error("[KAIH] setSiswa", error);
      return false;
    }
    // cache lokal
    lsSet("kaih3_siswa", list);
    return true;
  }

  async function upsertSiswa(row) {
    if (!useCloud()) {
      const list = lsGet("kaih3_siswa", []);
      const i = list.findIndex((s) => String(s.no_induk) === String(row.no_induk));
      if (i >= 0) list[i] = row;
      else list.push(row);
      lsSet("kaih3_siswa", list);
      return true;
    }
    const { error } = await sb()
      .from(cfg().TABLE_SISWA || "siswa")
      .upsert(row, { onConflict: "no_induk" });
    return !error;
  }

  async function deleteSiswa(no_induk) {
    if (!useCloud()) {
      const list = lsGet("kaih3_siswa", []).filter((s) => String(s.no_induk) !== String(no_induk));
      lsSet("kaih3_siswa", list);
      return true;
    }
    const { error } = await sb()
      .from(cfg().TABLE_SISWA || "siswa")
      .delete()
      .eq("no_induk", no_induk);
    return !error;
  }

  // ===================== GURU =====================
  async function getGuru() {
    if (!useCloud()) return lsGet("kaih3_guru", []);
    const { data, error } = await sb().from(cfg().TABLE_GURU || "guru").select("*").order("nama");
    if (error) return lsGet("kaih3_guru", []);
    return data || [];
  }

  async function setGuru(list) {
    if (!useCloud()) {
      lsSet("kaih3_guru", list);
      return true;
    }
    const { error } = await sb()
      .from(cfg().TABLE_GURU || "guru")
      .upsert(list, { onConflict: "nuptk" });
    if (!error) lsSet("kaih3_guru", list);
    return !error;
  }

  async function upsertGuru(row) {
    if (!useCloud()) {
      const list = lsGet("kaih3_guru", []);
      const i = list.findIndex((g) => String(g.nuptk) === String(row.nuptk));
      if (i >= 0) list[i] = row;
      else list.push(row);
      lsSet("kaih3_guru", list);
      return true;
    }
    const { error } = await sb()
      .from(cfg().TABLE_GURU || "guru")
      .upsert(row, { onConflict: "nuptk" });
    return !error;
  }

  async function deleteGuru(nuptk) {
    if (!useCloud()) {
      const list = lsGet("kaih3_guru", []).filter((g) => String(g.nuptk) !== String(nuptk));
      lsSet("kaih3_guru", list);
      return true;
    }
    const { error } = await sb()
      .from(cfg().TABLE_GURU || "guru")
      .delete()
      .eq("nuptk", nuptk);
    return !error;
  }

  // ===================== SUBMISSIONS =====================
  async function getSubs(filters) {
    if (!useCloud()) return lsGet("kaih3_subs", []);

    let q = sb().from(cfg().TABLE_SUBS || "submissions").select("*");

    if (filters) {
      if (filters.no_induk) q = q.eq("no_induk", filters.no_induk);
      if (filters.kelas) q = q.eq("kelas", filters.kelas);
      if (filters.tanggal) q = q.eq("tanggal", filters.tanggal);
      if (filters.from) q = q.gte("tanggal", filters.from);
      if (filters.to) q = q.lte("tanggal", filters.to);
    }

    q = q.order("tanggal", { ascending: false });

    const { data, error } = await q;
    if (error) {
      console.error("[KAIH] getSubs", error);
      return lsGet("kaih3_subs", []);
    }
    return data || [];
  }

  async function setSubs(list) {
    if (!useCloud()) {
      lsSet("kaih3_subs", list);
      return true;
    }
    // Hati-hati: overwrite massal jarang dipakai
    const { error } = await sb()
      .from(cfg().TABLE_SUBS || "submissions")
      .upsert(list, { onConflict: "no_induk,tanggal" });
    if (!error) lsSet("kaih3_subs", list);
    return !error;
  }

  /**
   * Simpan / update satu isian harian
   * Unique constraint: (no_induk, tanggal)
   */
  async function saveSubmission(row) {
    // Normalisasi field agar cocok dengan schema SQL
    const payload = {
      no_induk: String(row.no_induk),
      nama: row.nama || null,
      kelas: row.kelas || null,
      tanggal: row.tanggal ? String(row.tanggal).slice(0, 10) : new Date().toISOString().slice(0, 10),
      bangun_pagi: row.bangunPagi || row.bangun_pagi || null,
      jam_bangun: row.jamBangun || row.jam_bangun || null,
      subuh: row.subuh || null,
      dzuhur: row.dzuhur || null,
      ashar: row.ashar || null,
      maghrib: row.maghrib || null,
      isya: row.isya || null,
      haid: row.haid || null,
      olahraga: row.olahraga || null,
      jenis_olahraga: row.jenisOlahraga || row.jenis_olahraga || null,
      makan_sehat: row.makanSehat || row.makan_sehat || null,
      belajar: row.belajar || null,
      baca_buku: row.bacaBuku || row.baca_buku || null,
      nama_buku: row.namaBuku || row.nama_buku || null,
      bermasyarakat: row.bermasyarakat || null,
      kegiatan_masyarakat: row.kegiatanMasyarakat || row.kegiatan_masyarakat || null,
      tidur_cepat: row.tidurCepat || row.tidur_cepat || null,
      jam_tidur: row.jamTidur || row.jam_tidur || null
    };

    if (!useCloud()) {
      const list = lsGet("kaih3_subs", []);
      const idx = list.findIndex(
        (s) => String(s.no_induk) === payload.no_induk && String(s.tanggal).slice(0, 10) === payload.tanggal
      );
      // Simpan juga dalam format camelCase agar app lama tetap kompatibel
      const localRow = {
        ...row,
        no_induk: payload.no_induk,
        tanggal: payload.tanggal
      };
      if (idx >= 0) list[idx] = localRow;
      else list.push(localRow);
      lsSet("kaih3_subs", list);
      return { ok: true };
    }

    const { data, error } = await sb()
      .from(cfg().TABLE_SUBS || "submissions")
      .upsert(payload, { onConflict: "no_induk,tanggal" })
      .select()
      .maybeSingle();

    if (error) {
      console.error("[KAIH] saveSubmission", error);
      return { ok: false, error: error.message };
    }

    // Update cache lokal (format campuran agar chart lama tetap jalan)
    const list = lsGet("kaih3_subs", []);
    const localRow = {
      ...row,
      no_induk: payload.no_induk,
      tanggal: payload.tanggal,
      bangunPagi: payload.bangun_pagi,
      jamBangun: payload.jam_bangun,
      jenisOlahraga: payload.jenis_olahraga,
      makanSehat: payload.makan_sehat,
      bacaBuku: payload.baca_buku,
      namaBuku: payload.nama_buku,
      kegiatanMasyarakat: payload.kegiatan_masyarakat,
      tidurCepat: payload.tidur_cepat,
      jamTidur: payload.jam_tidur
    };
    const idx = list.findIndex(
      (s) => String(s.no_induk) === payload.no_induk && String(s.tanggal).slice(0, 10) === payload.tanggal
    );
    if (idx >= 0) list[idx] = localRow;
    else list.push(localRow);
    lsSet("kaih3_subs", list);

    return { ok: true, data };
  }

  async function deleteSubmission(id) {
    if (!useCloud()) return false;
    const { error } = await sb()
      .from(cfg().TABLE_SUBS || "submissions")
      .delete()
      .eq("id", id);
    return !error;
  }

  // ===================== SETTINGS =====================
  async function getSettings() {
    if (!useCloud()) return lsGet("kaih3_set", {});
    const { data, error } = await sb()
      .from(cfg().TABLE_SETTINGS || "settings")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return lsGet("kaih3_set", {});
    return data.data || {};
  }

  async function saveSettings(obj) {
    if (!useCloud()) {
      lsSet("kaih3_set", obj);
      return true;
    }
    const { error } = await sb()
      .from(cfg().TABLE_SETTINGS || "settings")
      .upsert({ id: 1, data: obj, updated_at: new Date().toISOString() });
    if (!error) lsSet("kaih3_set", obj);
    return !error;
  }

  // ===================== WALI KELAS =====================
  async function getWaliKelas() {
    if (!useCloud()) return lsGet("kaih3_wali", []);
    const { data, error } = await sb()
      .from(cfg().TABLE_WALI || "wali_kelas")
      .select("*")
      .order("kelas");
    if (error) return lsGet("kaih3_wali", []);
    return data || [];
  }

  async function setWaliKelas(list) {
    if (!useCloud()) {
      lsSet("kaih3_wali", list);
      return true;
    }
    const { error } = await sb()
      .from(cfg().TABLE_WALI || "wali_kelas")
      .upsert(list, { onConflict: "kelas" });
    if (!error) lsSet("kaih3_wali", list);
    return !error;
  }

  // ===================== STORAGE (logo, TTD) =====================
  async function uploadFile(bucket, path, fileOrBlob, contentType) {
    if (!useCloud()) return { ok: false, error: "Supabase off" };
    const { data, error } = await sb().storage.from(bucket).upload(path, fileOrBlob, {
      upsert: true,
      contentType: contentType || "image/png"
    });
    if (error) return { ok: false, error: error.message };
    const { data: pub } = sb().storage.from(bucket).getPublicUrl(path);
    return { ok: true, path: data.path, publicUrl: pub?.publicUrl };
  }

  async function getPublicUrl(bucket, path) {
    if (!useCloud()) return null;
    const { data } = sb().storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  // ===================== SYNC (tarik semua data ke cache lokal) =====================
  async function syncAll() {
    if (!useCloud()) return { ok: false, error: "Supabase off" };
    try {
      const [siswa, guru, subs, settings, wali] = await Promise.all([
        getSiswa(),
        getGuru(),
        getSubs(),
        getSettings(),
        getWaliKelas()
      ]);
      lsSet("kaih3_siswa", siswa);
      lsSet("kaih3_guru", guru);
      lsSet("kaih3_subs", subs);
      lsSet("kaih3_set", settings);
      lsSet("kaih3_wali", wali);
      console.info("[KAIH] Sync selesai", {
        siswa: siswa.length,
        guru: guru.length,
        subs: subs.length
      });
      return { ok: true };
    } catch (e) {
      console.error("[KAIH] syncAll", e);
      return { ok: false, error: e.message };
    }
  }

  return {
    getSiswa,
    setSiswa,
    upsertSiswa,
    deleteSiswa,
    getGuru,
    setGuru,
    upsertGuru,
    deleteGuru,
    getSubs,
    setSubs,
    saveSubmission,
    deleteSubmission,
    getSettings,
    saveSettings,
    getWaliKelas,
    setWaliKelas,
    uploadFile,
    getPublicUrl,
    syncAll,
    useCloud
  };
})();
