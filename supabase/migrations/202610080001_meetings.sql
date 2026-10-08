-- Monthly meetings: Ban điều hành posts the agenda/minutes (Word, PDF, photos) and branch leaders read them.
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date not null,
  notes text,
  -- Last time leaders were notified about it (the "Báo cho các trưởng ngành" button)
  notified_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists meetings_date_idx on public.meetings(meeting_date desc);

create table if not exists public.meeting_files (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  path text not null unique,
  mime text,
  size bigint,
  uploaded_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists meeting_files_meeting_idx on public.meeting_files(meeting_id);

-- Who has opened a meeting, so Ban điều hành can see which leaders have not read it yet
create table if not exists public.meeting_views (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  viewed_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

alter table public.meetings enable row level security;
alter table public.meeting_files enable row level security;
alter table public.meeting_views enable row level security;

create policy meetings_read on public.meetings for select to authenticated using (true);
create policy meetings_write on public.meetings for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy meeting_files_read on public.meeting_files for select to authenticated using (true);
create policy meeting_files_write on public.meeting_files for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy meeting_views_read on public.meeting_views for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy meeting_views_insert on public.meeting_views for insert to authenticated with check (user_id = auth.uid());
create policy meeting_views_update on public.meeting_views for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket: files are opened through short-lived signed URLs
insert into storage.buckets (id, name, public, file_size_limit)
values ('meeting-files', 'meeting-files', false, 26214400)
on conflict (id) do nothing;

create policy meeting_files_storage_read on storage.objects for select to authenticated using (bucket_id = 'meeting-files');
create policy meeting_files_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'meeting-files' and public.is_super_admin());
create policy meeting_files_storage_delete on storage.objects for delete to authenticated using (bucket_id = 'meeting-files' and public.is_super_admin());
