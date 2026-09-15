alter table public.reading_rotation_config
  add constraint reading_rotation_starts_monday check (extract(isodow from start_date)=1);

create or replace function public.validate_reading_schedule() returns trigger language plpgsql set search_path=public as $$
declare code text; expected_branch uuid;
begin
  select t.code into code from public.task_types t where t.id=new.task_type_id;
  if code='READING' then
    if extract(dow from new.scheduled_date) not in (0,1,2,4) then
      raise exception 'Reading is only allowed on Monday, Tuesday, Thursday and Sunday';
    end if;
    expected_branch:=public.get_reading_branch_for_date(new.scheduled_date);
    if expected_branch is null or new.branch_id<>expected_branch then
      raise exception 'Reading branch does not match rotation';
    end if;
    if exists(select 1 from public.schedules s join public.task_types t on t.id=s.task_type_id where t.code='READING' and s.scheduled_date=new.scheduled_date and s.id<>new.id) then
      raise exception 'Reading schedule already exists for this date';
    end if;
  end if;
  return new;
end $$;
create trigger schedules_reading_rules before insert or update on public.schedules for each row execute function public.validate_reading_schedule();
