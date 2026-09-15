create extension if not exists pgcrypto;

create type public.app_role as enum ('SUPER_ADMIN','BRANCH_ADMIN');
create type public.schedule_status as enum ('UNASSIGNED','ASSIGNED','UPCOMING','REMINDED','COMPLETED','MISSED','CANCELLED');
create type public.assignee_type as enum ('MEMBER','CLASS');
create type public.action_source as enum ('MANUAL','AI','SYSTEM');
create type public.pending_status as enum ('PENDING','CONFIRMED','CANCELLED','EXPIRED');

create table public.branches (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null unique,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'), rotation_index int not null unique check (rotation_index >= 0),
  created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text not null,
  role public.app_role not null default 'BRANCH_ADMIN', branch_id uuid references public.branches(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint branch_admin_requires_branch check (role='SUPER_ADMIN' or branch_id is not null)
);
create table public.classes (
  id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(branch_id,name)
);
create table public.members (
  id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null, full_name text not null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index members_branch_name_idx on public.members(branch_id,full_name);
create table public.task_types (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, icon text not null default '📌',
  active boolean not null default true, sort_order int not null default 100, created_at timestamptz not null default now()
);
create table public.reading_rotation_config (
  singleton_key smallint primary key default 1 check(singleton_key=1), start_date date not null,
  start_branch_id uuid not null references public.branches(id), updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table public.schedules (
  id uuid primary key default gen_random_uuid(), task_type_id uuid not null references public.task_types(id), branch_id uuid not null references public.branches(id),
  scheduled_date date not null, start_time time, end_time time, status public.schedule_status not null default 'UNASSIGNED', notes text,
  source public.action_source not null default 'MANUAL', created_by uuid references auth.users(id), completed_at timestamptz, completed_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint valid_time_range check (start_time is null or end_time is null or end_time > start_time)
);
create index schedules_date_idx on public.schedules(scheduled_date);
create index schedules_branch_date_idx on public.schedules(branch_id,scheduled_date);
create table public.assignment_assignees (
  id uuid primary key default gen_random_uuid(), schedule_id uuid not null references public.schedules(id) on delete cascade,
  assignee_type public.assignee_type not null, member_id uuid references public.members(id) on delete cascade, class_id uuid references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint one_assignee_target check ((assignee_type='MEMBER' and member_id is not null and class_id is null) or (assignee_type='CLASS' and class_id is not null and member_id is null))
);
create unique index assignment_member_unique on public.assignment_assignees(schedule_id,member_id) where member_id is not null;
create unique index assignment_class_unique on public.assignment_assignees(schedule_id,class_id) where class_id is not null;
create table public.reminders (
  id uuid primary key default gen_random_uuid(), schedule_id uuid not null references public.schedules(id) on delete cascade,
  offset_minutes int not null check(offset_minutes>=0), delivered_at timestamptz, created_at timestamptz not null default now(), unique(schedule_id,offset_minutes)
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id), branch_id uuid references public.branches(id),
  action text not null, entity_type text not null, entity_id uuid, before_data jsonb, after_data jsonb, source public.action_source not null default 'MANUAL', created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs(created_at desc);
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check(role in('user','assistant')), content text not null, created_at timestamptz not null default now()
);
create table public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null, payload jsonb not null, preview_data jsonb not null default '{}'::jsonb, status public.pending_status not null default 'PENDING',
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '15 minutes'), confirmed_at timestamptz
);
create index ai_pending_owner_idx on public.ai_pending_actions(user_id,status,created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger classes_updated before update on public.classes for each row execute function public.set_updated_at();
create trigger members_updated before update on public.members for each row execute function public.set_updated_at();
create trigger schedules_updated before update on public.schedules for each row execute function public.set_updated_at();
create trigger conversations_updated before update on public.ai_conversations for each row execute function public.set_updated_at();

create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='SUPER_ADMIN');
$$;
create or replace function public.current_branch_id() returns uuid language sql stable security definer set search_path=public as $$
  select branch_id from public.profiles where id=auth.uid();
$$;
create or replace function public.get_reading_branch_for_date(p_date date) returns uuid language plpgsql stable security definer set search_path=public as $$
declare c public.reading_rotation_config%rowtype; start_idx int; weeks_delta int; branch_count int; target_idx int; result_id uuid;
begin
  select * into c from public.reading_rotation_config where singleton_key=1;
  if not found then return null; end if;
  select rotation_index into start_idx from public.branches where id=c.start_branch_id;
  select count(*) into branch_count from public.branches;
  if branch_count=0 then return null; end if;
  weeks_delta := floor((p_date - c.start_date)::numeric/7)::int;
  target_idx := ((start_idx + weeks_delta) % branch_count + branch_count) % branch_count;
  select id into result_id from public.branches where rotation_index=target_idx;
  return result_id;
end $$;
create or replace function public.can_manage_schedule(p_branch uuid,p_date date,p_task_type uuid) returns boolean language plpgsql stable security definer set search_path=public as $$
declare task_code text;
begin
  if public.is_super_admin() then return true; end if;
  if public.current_branch_id() is distinct from p_branch then return false; end if;
  select code into task_code from public.task_types where id=p_task_type;
  if task_code='READING' then return public.get_reading_branch_for_date(p_date)=p_branch; end if;
  return true;
end $$;

create or replace function public.bootstrap_first_admin(p_full_name text) returns public.profiles language plpgsql security definer set search_path=public as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into result from public.profiles where id=auth.uid(); if found then return result; end if;
  if exists(select 1 from public.profiles where role='SUPER_ADMIN') then raise exception 'Super Admin already exists'; end if;
  insert into public.profiles(id,full_name,role,branch_id) values(auth.uid(),trim(p_full_name),'SUPER_ADMIN',null) returning * into result;
  return result;
end $$;
grant execute on function public.bootstrap_first_admin(text) to authenticated;

create or replace function public.log_schedule_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.activity_logs(actor_user_id,branch_id,action,entity_type,entity_id,before_data,after_data,source)
  values(auth.uid(),coalesce(new.branch_id,old.branch_id),tg_op,'SCHEDULE',coalesce(new.id,old.id),case when tg_op='INSERT' then null else to_jsonb(old) end,case when tg_op='DELETE' then null else to_jsonb(new) end,coalesce(new.source,old.source,'MANUAL'));
  return coalesce(new,old);
end $$;
create trigger schedules_audit after insert or update or delete on public.schedules for each row execute function public.log_schedule_change();
