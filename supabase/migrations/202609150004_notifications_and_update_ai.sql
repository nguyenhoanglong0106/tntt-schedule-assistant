create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete cascade, title text not null, body text not null,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
create policy notifications_owner_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_owner_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.confirm_ai_pending_action(p_pending_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.ai_pending_actions%rowtype; operation jsonb; op text; s public.schedules%rowtype; sid uuid; assignee jsonb; reminder jsonb; taskid uuid; bid uuid; sdate date; count_ops int:=0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into p from public.ai_pending_actions where id=p_pending_id for update;
  if not found or p.user_id<>auth.uid() then raise exception 'Pending action not found'; end if;
  if p.status<>'PENDING' or p.expires_at<now() then raise exception 'Pending action expired'; end if;
  for operation in select * from jsonb_array_elements(coalesce(p.payload->'operations','[]'::jsonb)) loop
    op:=operation->>'op';
    if op='CREATE_SCHEDULE' then
      taskid:=(operation->>'task_type_id')::uuid; bid:=(operation->>'branch_id')::uuid; sdate:=(operation->>'date')::date;
      if not public.can_manage_schedule(bid,sdate,taskid) then raise exception 'Permission denied'; end if;
      insert into public.schedules(task_type_id,branch_id,scheduled_date,start_time,end_time,status,notes,source,created_by)
      values(taskid,bid,sdate,nullif(operation->>'start_time','')::time,nullif(operation->>'end_time','')::time,case when jsonb_array_length(coalesce(operation->'assignees','[]'::jsonb))>0 then 'ASSIGNED'::public.schedule_status else 'UNASSIGNED'::public.schedule_status end,operation->>'notes','AI',auth.uid()) returning * into s; sid:=s.id;
      for assignee in select * from jsonb_array_elements(coalesce(operation->'assignees','[]'::jsonb)) loop
        if assignee->>'type'='MEMBER' then insert into public.assignment_assignees(schedule_id,assignee_type,member_id) values(sid,'MEMBER',(assignee->>'id')::uuid); else insert into public.assignment_assignees(schedule_id,assignee_type,class_id) values(sid,'CLASS',(assignee->>'id')::uuid); end if;
      end loop;
      for reminder in select * from jsonb_array_elements(coalesce(operation->'reminders','[]'::jsonb)) loop insert into public.reminders(schedule_id,offset_minutes) values(sid,(reminder#>>'{}')::int) on conflict do nothing; end loop;
    elsif op='UPDATE_SCHEDULE' then
      select * into s from public.schedules where id=(operation->>'schedule_id')::uuid;
      if not found or not public.can_manage_schedule(s.branch_id,s.scheduled_date,s.task_type_id) then raise exception 'Permission denied'; end if;
      taskid:=coalesce(nullif(operation->>'task_type_id','')::uuid,s.task_type_id); bid:=coalesce(nullif(operation->>'branch_id','')::uuid,s.branch_id); sdate:=coalesce(nullif(operation->>'date','')::date,s.scheduled_date);
      if not public.can_manage_schedule(bid,sdate,taskid) then raise exception 'Permission denied'; end if;
      update public.schedules set task_type_id=taskid,branch_id=bid,scheduled_date=sdate,start_time=nullif(operation->>'start_time','')::time,end_time=nullif(operation->>'end_time','')::time,notes=operation->>'notes',status=case when jsonb_array_length(coalesce(operation->'assignees','[]'::jsonb))>0 then 'ASSIGNED'::public.schedule_status else 'UNASSIGNED'::public.schedule_status end,source='AI' where id=s.id;
      delete from public.assignment_assignees where schedule_id=s.id;
      for assignee in select * from jsonb_array_elements(coalesce(operation->'assignees','[]'::jsonb)) loop
        if assignee->>'type'='MEMBER' then insert into public.assignment_assignees(schedule_id,assignee_type,member_id) values(s.id,'MEMBER',(assignee->>'id')::uuid); else insert into public.assignment_assignees(schedule_id,assignee_type,class_id) values(s.id,'CLASS',(assignee->>'id')::uuid); end if;
      end loop;
      delete from public.reminders where schedule_id=s.id;
      for reminder in select * from jsonb_array_elements(coalesce(operation->'reminders','[]'::jsonb)) loop insert into public.reminders(schedule_id,offset_minutes) values(s.id,(reminder#>>'{}')::int) on conflict do nothing; end loop;
    elsif op='DELETE_SCHEDULE' then
      select * into s from public.schedules where id=(operation->>'schedule_id')::uuid;
      if not found or not public.can_manage_schedule(s.branch_id,s.scheduled_date,s.task_type_id) then raise exception 'Permission denied'; end if;
      delete from public.schedules where id=s.id;
    elsif op='MARK_COMPLETED' then
      select * into s from public.schedules where id=(operation->>'schedule_id')::uuid;
      if not found or not public.can_manage_schedule(s.branch_id,s.scheduled_date,s.task_type_id) then raise exception 'Permission denied'; end if;
      update public.schedules set status='COMPLETED',completed_at=now(),completed_by=auth.uid(),source='AI' where id=s.id;
    elsif op='UPDATE_READING_ROTATION' then
      if not public.is_super_admin() then raise exception 'Permission denied'; end if;
      insert into public.reading_rotation_config(singleton_key,start_date,start_branch_id,updated_by) values(1,(operation->>'start_date')::date,(operation->>'start_branch_id')::uuid,auth.uid())
      on conflict(singleton_key) do update set start_date=excluded.start_date,start_branch_id=excluded.start_branch_id,updated_by=auth.uid(),updated_at=now();
    else raise exception 'Unsupported AI operation: %',op;
    end if;
    count_ops:=count_ops+1;
  end loop;
  update public.ai_pending_actions set status='CONFIRMED',confirmed_at=now() where id=p_pending_id;
  return jsonb_build_object('ok',true,'operations',count_ops,'message',format('Đã lưu %s thay đổi.',count_ops));
end $$;
