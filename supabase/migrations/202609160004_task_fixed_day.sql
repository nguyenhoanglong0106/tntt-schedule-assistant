alter table public.task_type_branch_times add column fixed_day_of_week integer check (fixed_day_of_week between 0 and 6);

