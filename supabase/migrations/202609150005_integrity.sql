create or replace function public.validate_assignee_branch() returns trigger language plpgsql set search_path=public as $$
declare schedule_branch uuid; target_branch uuid;
begin
  select branch_id into schedule_branch from public.schedules where id=new.schedule_id;
  if new.assignee_type='MEMBER' then select branch_id into target_branch from public.members where id=new.member_id;
  else select branch_id into target_branch from public.classes where id=new.class_id; end if;
  if schedule_branch is null or target_branch is null or schedule_branch<>target_branch then raise exception 'Assignee must belong to schedule branch'; end if;
  return new;
end $$;
create trigger assignment_branch_check before insert or update on public.assignment_assignees for each row execute function public.validate_assignee_branch();
