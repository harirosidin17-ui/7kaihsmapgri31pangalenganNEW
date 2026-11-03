-- ============================================================
-- SEED CONTOH (opsional)
-- Jalankan SETELAH 001_init.sql dan SETELAH membuat user Auth
-- ============================================================

-- Contoh data siswa (boleh dihapus / diganti data asli)
insert into public.siswa (no_induk, nama, kelas, jk) values
  ('2627.10.001', 'Ahmad Fauzi', 'X.A', 'L'),
  ('2627.10.002', 'Siti Nurhaliza', 'X.A', 'P'),
  ('2627.11.101', 'Budi Santoso', 'XI.A1', 'L'),
  ('2627.12.201', 'Dewi Lestari', 'XII.A1', 'P')
on conflict (no_induk) do nothing;

-- Contoh data guru
insert into public.guru (nuptk, nama, jk, jabatan) values
  ('1234567890123456', 'Drs. H. Sutrisno, M.Pd', 'L', 'Kepala Sekolah'),
  ('2345678901234567', 'Hj. Rina Marlina, S.Pd', 'P', 'Guru BK')
on conflict (nuptk) do nothing;

-- Contoh wali kelas
insert into public.wali_kelas (kelas, nama, nuptk) values
  ('X.A', 'Guru Wali X.A', '2345678901234567'),
  ('XI.A1', 'Guru Wali XI.A1', '2345678901234567')
on conflict (kelas) do nothing;

-- Settings awal
update public.settings set data = jsonb_build_object(
  'nama', 'SMA PGRI 31 PANGALENGAN',
  'alamat', 'Jl. Raya Pangalengan No.332 Kecamatan Pangalengan, Kabupaten Bandung Provinsi Jawa Barat 40378',
  'kepsek', 'Drs. H. Sutrisno, M.Pd',
  'font', 16,
  'theme', 'classic'
) where id = 1;
