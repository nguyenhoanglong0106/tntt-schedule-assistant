alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.members enable row level security;
alter table public.task_types enable row level security;
alter table public.reading_rotation_config enable row level security;
alter table public.schedules enable row level security;
alter table public.assignment_assignees enable row level security;
alter table public.reminders enable row level security;
alter table public.activity_logs enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_pending_actions enable row level security;

create policy branches_read on public.branches for select to authenticated using(true);
create policy tasks_read on public.task_types for select to authenticated using(true);
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_super_admin());
create policy profiles_super_manage on public.profiles for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy classes_read on public.classes for select to authenticated using(true);
create policy classes_insert on public.classes for insert to authenticated with check(public.is_super_admin() or branch_id=public.current_branch_id());
create policy classes_update on public.classes for update to authenticated using(public.is_super_admin() or branch_id=public.current_branch_id()) with check(public.is_super_admin() or branch_id=public.current_branch_id());
create policy members_read on public.members for select to authenticated using(true);
create policy members_insert on public.members for insert to authenticated with check(public.is_super_admin() or branch_id=public.current_branch_id());
create policy members_update on public.members for update to authenticated using(public.is_super_admin() or branch_id=public.current_branch_id()) with check(public.is_super_admin() or branch_id=public.current_branch_id());
create policy rotation_read on public.reading_rotation_config for select to authenticated using(true);
create policy rotation_super on public.reading_rotation_config for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy schedules_read on public.schedules for select to authenticated using(true);
create policy schedules_insert on public.schedules for insert to authenticated with check(public.can_manage_schedule(branch_id,scheduled_date,task_type_id));
create policy schedules_update on public.schedules for update to authenticated using(public.can_manage_schedule(branch_id,scheduled_date,task_type_id)) with check(public.can_manage_schedule(branch_id,scheduled_date,task_type_id));
create policy schedules_delete on public.schedules for delete to authenticated using(public.can_manage_schedule(branch_id,scheduled_date,task_type_id));
create policy assignees_read on public.assignment_assignees for select to authenticated using(true);
create policy assignees_manage on public.assignment_assignees for all to authenticated using(exists(select 1 from public.schedules s where s.id=schedule_id and public.can_manage_schedule(s.branch_id,s.scheduled_date,s.task_type_id))) with check(exists(select 1 from public.schedules s where s.id=schedule_id and public.can_manage_schedule(s.branch_id,s.scheduled_date,s.task_type_id)));
create policy reminders_read on public.reminders for select to authenticated using(true);
create policy reminders_manage on public.reminders for all to authenticated using(exists(select 1 from public.schedules s where s.id=schedule_id and public.can_manage_schedule(s.branch_id,s.scheduled_date,s.task_type_id))) with check(exists(select 1 from public.schedules s where s.id=schedule_id and public.can_manage_schedule(s.branch_id,s.scheduled_date,s.task_type_id)));
create policy logs_read on public.activity_logs for select to authenticated using(public.is_super_admin() or branch_id=public.current_branch_id());
create policy conversations_owner on public.ai_conversations for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy messages_owner on public.ai_messages for all to authenticated using(exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=auth.uid())) with check(exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=auth.uid()));
create policy pending_owner on public.ai_pending_actions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

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
grant execute on function public.confirm_ai_pending_action(uuid) to authenticated;
