-- Sunday 08:00 breakfast: Ban điều hành keeps the menu; each branch picks 2–3 dishes in order of preference
-- (and how many will eat) until Friday 23:59; the tally tells Ban điều hành what to order.
create table if not exists public.breakfast_menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  note text,
  -- Hidden instead of deleted, so past weeks keep their dish names
  active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

-- One row per Sunday once something happens to it (chốt món, nghỉ, Saturday tally sent)
create table if not exists public.breakfast_weeks (
  week_date date primary key check (extract(isodow from week_date) = 7),
  status text not null default 'OPEN' check (status in ('OPEN', 'SKIPPED', 'ORDERED')),
  final_item_ids uuid[] not null default '{}',
  note text,
  ordered_at timestamptz,
  -- Last "Chốt món / nghỉ" notice to the leaders
  notified_at timestamptz,
  -- Saturday-morning tally to Ban điều hành, sent once
  results_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

-- One ballot per branch per Sunday; item_ids are in order of preference (① ② ③)
create table if not exists public.breakfast_ballots (
  week_date date not null check (extract(isodow from week_date) = 7),
  branch_id uuid not null references public.branches(id) on delete cascade,
  item_ids uuid[] not null check (cardinality(item_ids) between 1 and 3),
  headcount int check (headcount between 0 and 500),
  updated_by uuid references auth.users(id) on delete set null,
  -- Kept by name: branch leaders cannot read other profiles
  updated_by_name text,
  updated_at timestamptz not null default now(),
  primary key (week_date, branch_id)
);

-- Daily "chưa chọn món" reminders already sent, so the 5-minute cron sends one per branch per day
create table if not exists public.breakfast_reminders (
  week_date date not null,
  branch_id uuid not null references public.branches(id) on delete cascade,
  sent_on date not null,
  primary key (week_date, branch_id, sent_on)
);

alter table public.breakfast_menu_items enable row level security;
alter table public.breakfast_weeks enable row level security;
alter table public.breakfast_ballots enable row level security;
alter table public.breakfast_reminders enable row level security;

-- Everyone sees the menu, the tally and who picked what; only Ban điều hành edits the menu and the week.
-- Ballots have no write policy: they are saved through save_breakfast_ballot, which checks the deadline.
create policy breakfast_menu_read on public.breakfast_menu_items for select to authenticated using (true);
create policy breakfast_menu_write on public.breakfast_menu_items for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy breakfast_weeks_read on public.breakfast_weeks for select to authenticated using (true);
create policy breakfast_weeks_write on public.breakfast_weeks for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy breakfast_ballots_read on public.breakfast_ballots for select to authenticated using (true);

-- Choosing closes when Saturday starts in Vietnam (Friday 23:59 is the last minute)
create or replace function public.breakfast_closes_at(p_week date) returns timestamptz language sql stable as $$
  select (p_week - 1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
$$;

-- Saves (or with no items, clears) a branch's ballot. Branch leaders: own branch, before the deadline and before
-- Ban điều hành has ordered. Ban điều hành can fill in for any branch at any time.
create or replace function public.save_breakfast_ballot(p_week date, p_branch uuid, p_items uuid[], p_headcount int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_super boolean := public.is_super_admin();
  v_status text;
  v_active int;
  v_n int := coalesce(cardinality(p_items), 0);
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if extract(isodow from p_week) <> 7 then raise exception 'Ngày ăn sáng phải là Chủ nhật'; end if;
  if not v_super and public.current_branch_id() is distinct from p_branch then raise exception 'Bạn chỉ chọn được món cho ngành mình'; end if;
  select status into v_status from public.breakfast_weeks where week_date = p_week;
  if v_status = 'SKIPPED' then raise exception 'Chủ nhật này nghỉ ăn sáng'; end if;
  if not v_super and v_status = 'ORDERED' then raise exception 'Ban điều hành đã chốt món tuần này, liên hệ Ban điều hành nếu cần đổi'; end if;
  if not v_super and now() >= public.breakfast_closes_at(p_week) then raise exception 'Đã qua hạn chót (thứ 6, 23:59). Liên hệ Ban điều hành nếu cần đổi'; end if;

  if v_n = 0 then
    delete from public.breakfast_ballots where week_date = p_week and branch_id = p_branch;
    return;
  end if;
  if (select count(distinct x) from unnest(p_items) x) <> v_n then raise exception 'Mỗi món chỉ chọn một lần'; end if;
  select count(*) into v_active from public.breakfast_menu_items where active;
  if v_n > 3 or v_n < least(2, v_active) then raise exception 'Hãy chọn từ 2 đến 3 món'; end if;
  if exists (select 1 from unnest(p_items) x where not exists (select 1 from public.breakfast_menu_items m where m.id = x and m.active)) then
    raise exception 'Có món không còn trong thực đơn, hãy tải lại trang';
  end if;
  if p_headcount is not null and (p_headcount < 0 or p_headcount > 500) then raise exception 'Số người ăn không hợp lệ'; end if;

  insert into public.breakfast_ballots (week_date, branch_id, item_ids, headcount, updated_by, updated_by_name, updated_at)
  values (p_week, p_branch, p_items, p_headcount, auth.uid(), (select full_name from public.profiles where id = auth.uid()), now())
  on conflict (week_date, branch_id) do update
    set item_ids = excluded.item_ids, headcount = excluded.headcount, updated_by = excluded.updated_by, updated_by_name = excluded.updated_by_name, updated_at = now();
end $$;
grant execute on function public.save_breakfast_ballot(date, uuid, uuid[], int) to authenticated;
