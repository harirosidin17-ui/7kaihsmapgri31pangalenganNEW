# 7 KAIH Dashboard — Terhubung Supabase (Auth + Database)

Versi lengkap yang **sudah terintegrasi** dengan:

- **Supabase Auth** (login siswa / guru / admin)
- **PostgreSQL** (siswa, guru, pengisian harian, settings, wali kelas)
- **Storage** (logo & TTD)
- **Fallback localStorage** jika Supabase belum dikonfigurasi

---

## Isi Folder

```
7kaih-supabase-full/
├── index.html                 ← Aplikasi + script Supabase sudah di-inject
├── js/
│   ├── config.js              ← ⚠️ ISI URL & KEY DI SINI
│   ├── supabase-client.js
│   ├── auth.js                ← Login / logout / session
│   ├── data.js                ← CRUD ke database
│   └── bridge.js              ← Menghubungkan form & login app lama ke Supabase
├── supabase/migrations/
│   ├── 001_init.sql           ← Schema + RLS + trigger (WAJIB dijalankan)
│   └── 002_seed_contoh.sql    ← Data contoh (opsional)
├── vercel.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Langkah Setup (wajib berurutan)

### 1. Buat project Supabase
1. Buka https://supabase.com → **New Project**
2. Catat **Project URL** dan **anon public key**  
   (Settings → API)

### 2. Jalankan schema database
1. Di dashboard Supabase → **SQL Editor**
2. Copy-paste **seluruh** isi `supabase/migrations/001_init.sql`
3. Klik **Run**
4. (Opsional) Jalankan juga `002_seed_contoh.sql`

### 3. Isi konfigurasi frontend
Buka file `js/config.js` dan ganti:

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
USE_SUPABASE: true
```

### 4. Buat user Admin pertama
1. Supabase → **Authentication** → **Users** → **Add user**
   - Email: `admin@admin.kaih.local`
   - Password: `kaih2026` (ganti setelah login)
2. Copy **User UID**
3. Di SQL Editor jalankan:

```sql
insert into public.profiles (id, role, no_induk, nama)
values (
  'TEMPLEKAN-UUID-USER-ADMIN',
  'admin',
  'admin',
  'Administrator KAIH'
) on conflict (id) do update set role = 'admin', nama = excluded.nama;
```

### 5. Buat user Siswa / Guru
**Cara A — lewat dashboard (paling mudah)**  
Authentication → Add user:

| Role  | Contoh Email                    | Password  | Lalu isi profiles |
|-------|---------------------------------|-----------|-------------------|
| Siswa | `2627.10.001@siswa.kaih.local`  | `kaih2026`| role=siswa, no_induk=2627.10.001, nama=..., kelas=X.A |
| Guru  | `1234567890123456@guru.kaih.local` | `kaih2026`| role=guru, no_induk=NUPTK, nama=... |

**Cara B — lewat SQL + metadata** (saat create user via API/Admin):

```js
// contoh di browser console setelah login admin (atau via service role)
await supabase.auth.admin.createUser({
  email: '2627.10.001@siswa.kaih.local',
  password: 'kaih2026',
  email_confirm: true,
  user_metadata: {
    role: 'siswa',
    no_induk: '2627.10.001',
    nama: 'Ahmad Fauzi',
    kelas: 'X.A',
    jk: 'L'
  }
})
```

Trigger `handle_new_user` akan otomatis mengisi tabel `profiles`.

### 6. Deploy ke Vercel
1. Push folder ini ke GitHub
2. Vercel → New Project → import repo
3. Framework: **Other**
4. Deploy

Atau upload ZIP langsung ke Vercel.

---

## Cara Login di Aplikasi

| Role  | Username (boleh tanpa @...)     | Password   |
|-------|---------------------------------|------------|
| Admin | `admin`                         | `kaih2026` |
| Siswa | `2627.10.001`                   | `kaih2026` |
| Guru  | `1234567890123456`              | `kaih2026` |

Bridge otomatis menambahkan suffix `@siswa.kaih.local` / `@guru.kaih.local` / `@admin.kaih.local`.

---

## Alur Data

1. **Login** → `js/auth.js` → Supabase Auth → isi `window.user`
2. **Sync** → `Data.syncAll()` tarik siswa/guru/subs ke cache lokal
3. **Isi Form** → tombol Kirim di-intercept `bridge.js` → `Data.saveSubmission()` → tabel `submissions`
4. **Rekap / Chart** → masih membaca cache lokal (yang sudah di-sync)

---

## Fallback

Jika `USE_SUPABASE: false` atau URL belum diisi, aplikasi kembali ke perilaku **localStorage** asli (offline).

---

## Keamanan

- Jangan pernah taruh **service_role key** di frontend
- Ganti semua password default setelah deploy
- RLS sudah aktif — siswa hanya bisa lihat/isi data sendiri
- Admin bisa mengelola semua data

---

## Troubleshooting

| Gejala | Solusi |
|--------|--------|
| "Supabase belum dikonfigurasi" | Isi `js/config.js` |
| Login gagal "Invalid login" | Cek email format + password di Auth Users |
| "Profil user tidak ditemukan" | Insert baris di tabel `profiles` |
| Form tidak tersimpan | Buka Console (F12) → lihat error RLS / network |
| CORS / blocked | Pastikan domain Vercel ditambahkan di Supabase → Auth → URL Configuration |

---

SMA PGRI 31 Pangalengan — Dashboard 7 Kebiasaan Anak Indonesia Hebat 2026
