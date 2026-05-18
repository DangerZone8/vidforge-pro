
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Profiles insertable by owner" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles updatable by owner" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled project',
  description text,
  thumbnail_url text,
  duration_seconds numeric not null default 0,
  timeline_state jsonb not null default '{"clips": [], "tracks": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "Projects select own" on public.projects for select using (auth.uid() = user_id);
create policy "Projects insert own" on public.projects for insert with check (auth.uid() = user_id);
create policy "Projects update own" on public.projects for update using (auth.uid() = user_id);
create policy "Projects delete own" on public.projects for delete using (auth.uid() = user_id);

create index projects_user_idx on public.projects(user_id, updated_at desc);

-- Media files
create table public.media_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  duration_seconds numeric,
  width integer,
  height integer,
  kind text not null default 'video', -- video | audio | image
  created_at timestamptz not null default now()
);
alter table public.media_files enable row level security;
create policy "Media select own" on public.media_files for select using (auth.uid() = user_id);
create policy "Media insert own" on public.media_files for insert with check (auth.uid() = user_id);
create policy "Media update own" on public.media_files for update using (auth.uid() = user_id);
create policy "Media delete own" on public.media_files for delete using (auth.uid() = user_id);

create index media_project_idx on public.media_files(project_id, created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Storage policies: path prefixed by user id, e.g. {uid}/{projectId}/file.mp4
create policy "Media storage read own" on storage.objects for select
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Media storage insert own" on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Media storage update own" on storage.objects for update
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Media storage delete own" on storage.objects for delete
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
