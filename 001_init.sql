-- ============================================================
-- 7 KAIH — Schema lengkap + Auth trigger + RLS
-- Jalankan SEMUA isi file ini di Supabase → SQL Editor → Run
-- ============================================================

-- 1. PROFILES (terhubung ke auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('siswa', 'guru', 'admin')),
  no_induk text,
  nama text,
  kelas text,
  jk text check (jk is null or jk in ('L', 'P')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_no_induk on public.profiles (no_induk);
create index if not exists idx_profiles_role on public.profiles (role);

-- 2. MASTER SISWA
create table if not exists public.siswa (
  no_induk text primary key,
  nama text not null,
  kelas text not null,
  jk text check (jk is null or jk in ('L', 'P')),
  created_at timestamptz default now()
);

create index if not exists idx_siswa_kelas on public.siswa (kelas);

-- 3. MASTER GURU
create table if not exists public.guru (
  nuptk text primary key,
  nama text not null,
  jk text check (jk is null or jk in ('L', 'P')),
  jabatan text,
  created_at timestamptz default now()
);

-- 4. PENGISIAN HARIAN 7 KAIH
create table if not exists public.submissions (
  id bigserial primary key,
  no_induk text not null,
  nama text,
  kelas text,
  tanggal date not null,
  bangun_pagi text,
  jam_bangun time,
  subuh text,
  dzuhur text,
  ashar text,
  maghrib text,
  isya text,
  haid text,
  olahraga text,
  jenis_olahraga text,
  makan_sehat text,
  belajar text,
  baca_buku text,
  nama_buku text,
  bermasyarakat text,
  kegiatan_masyarakat text,
  tidur_cepat text,
  jam_tidur time,
  created_at timestamptz default now(),
  unique (no_induk, tanggal)
);

create index if not exists idx_subs_tanggal on public.submissions (tanggal);
create index if not exists idx_subs_kelas on public.submissions (kelas);
create index if not exists idx_subs_no_induk on public.submissions (no_induk);

-- 5. SETTINGS (satu baris JSON)
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into public.settings (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- 6. WALI KELAS
create table if not exists public.wali_kelas (
  kelas text primary key,
  nama text,
  nuptk text,
  ttd_url text,
  updated_at timestamptz default now()
);

-- ============================================================
-- TRIGGER: otomatis buat profile saat user Auth dibuat
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, no_induk, nama, kelas, jk)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'siswa'),
    new.raw_user_meta_data->>'no_induk',
    coalesce(new.raw_user_meta_data->>'nama', new.email),
    new.raw_user_meta_data->>'kelas',
    new.raw_user_meta_data->>'jk'
  )
  on conflict (id) do update set
    role = excluded.role,
    no_induk = excluded.no_induk,
    nama = excluded.nama,
    kelas = excluded.kelas,
    jk = excluded.jk,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.siswa enable row level security;
alter table public.guru enable row level security;
alter table public.submissions enable row level security;
alter table public.settings enable row level security;
alter table public.wali_kelas enable row level security;

-- Helper: ambil role user yang sedang login
create or replace function public.current_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_no_induk()
returns text
language sql
stable
as $$
  select no_induk from public.profiles where id = auth.uid();
$$;

-- PROFILES
create policy "User baca profil sendiri"
  on public.profiles for select
  using (id = auth.uid() or public.current_role() in ('guru', 'admin'));

create policy "Admin kelola profil"
  on public.profiles for all
  using (public.current_role() = 'admin');

-- SISWA
create policy "Siswa baca data sendiri / Guru Admin baca semua"
  on public.siswa for select
  using (
    no_induk = public.current_no_induk()
    or public.current_role() in ('guru', 'admin')
  );

create policy "Admin kelola siswa"
  on public.siswa for all
  using (public.current_role() = 'admin');

-- GURU
create policy "Semua user terautentikasi baca guru"
  on public.guru for select
  using (auth.uid() is not null);

create policy "Admin kelola guru"
  on public.guru for all
  using (public.current_role() = 'admin');

-- SUBMISSIONS
create policy "Siswa baca isian sendiri"
  on public.submissions for select
  using (
    no_induk = public.current_no_induk()
    or public.current_role() in ('guru', 'admin')
  );

create policy "Siswa insert/update isian sendiri"
  on public.submissions for insert
  with check (
    no_induk = public.current_no_induk()
    or public.current_role() in ('guru', 'admin')
  );

create policy "Siswa update isian sendiri"
  on public.submissions for update
  using (
    no_induk = public.current_no_induk()
    or public.current_role() in ('guru', 'admin')
  );

create policy "Admin hapus isian"
  on public.submissions for delete
  using (public.current_role() = 'admin');

-- SETTINGS
create policy "Semua baca settings"
  on public.settings for select
  using (auth.uid() is not null);

create policy "Admin ubah settings"
  on public.settings for all
  using (public.current_role() = 'admin');

-- WALI KELAS
create policy "Semua baca wali"
  on public.wali_kelas for select
  using (auth.uid() is not null);

create policy "Admin kelola wali"
  on public.wali_kelas for all
  using (public.current_role() = 'admin');

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

-- Policy storage branding (public read)
create policy "Public read branding"
  on storage.objects for select
  using (bucket_id = 'branding');

create policy "Admin upload branding"
  on storage.objects for insert
  with check (bucket_id = 'branding' and public.current_role() = 'admin');

create policy "Admin update branding"
  on storage.objects for update
  using (bucket_id = 'branding' and public.current_role() = 'admin');

-- ============================================================
-- SEED ADMIN AWAL (ganti password setelah login pertama!)
-- ============================================================
-- Cara membuat user admin:
-- 1. Di dashboard Supabase → Authentication → Users → Add user
--    Email   : admin@admin.kaih.local
--    Password: kaih2026
-- 2. Lalu jalankan SQL di bawah (ganti UUID dengan id user yang baru dibuat)
--
-- Atau gunakan snippet ini setelah user dibuat:
/*
insert into public.profiles (id, role, no_induk, nama)
values (
  'UUID-USER-ADMIN-DARI-AUTH',
  'admin',
  'admin',
  'Administrator KAIH'
) on conflict (id) do update set role = 'admin';
*/

comment on table public.submissions is 'Pengisian harian 7 Kebiasaan Anak Indonesia Hebat';
comment on table public.profiles is 'Profil tambahan user Auth (role, NIS/NUPTK)';
