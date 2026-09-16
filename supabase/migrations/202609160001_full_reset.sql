-- Full data + auth reset, requested by the project owner to start fresh.
-- Keeps the fixed seed (branches, task_types) but clears everything else,
-- including all Supabase Auth accounts.
truncate table
  public.reminders,
  public.assignment_assignees,
  public.ai_messages,
  public.ai_conversations,
  public.ai_pending_actions,
  public.notifications,
  public.activity_logs,
  public.schedules,
  public.members,
  public.classes,
  public.reading_rotation_config,
  public.profiles,
  auth.users
cascade;
