# Hướng dẫn kích hoạt Push Notification

## Bước 1 – Chạy migration database

Vào **Supabase Dashboard → SQL Editor**, chạy file:
```sql
-- Nội dung file: supabase/migrations/202609160005_push_subscriptions.sql
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subs_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subs_owner on public.push_subscriptions for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid());
```

## Bước 2 – Deploy Edge Functions

```bash
supabase functions deploy save-push-subscription
supabase functions deploy process-reminders --no-verify-jwt
```

## Bước 3 – Set VAPID secrets vào Supabase

```bash
supabase secrets set VAPID_PUBLIC_KEY=BGVx2JhnUdrhYqghaPGNVUDUedBXaSeYSahvU4cgGC5Ez5kmxZY_3m1VxkvHr0X9T4OYwZ28ztQ-QX1eUU74nKA
supabase secrets set VAPID_PRIVATE_KEY=3zz-sEdLA87Xt6VzcQrHq4o8KH9v4Mxi_G959zjsPWI
supabase secrets set CRON_SECRET=CHANGE_ME_STRONG_RANDOM_SECRET
```

## Bước 4 – Cài đặt cron (chạy mỗi 5 phút)

Vào **Supabase Dashboard → SQL Editor**, thay 2 giá trị và chạy:
```sql
-- Lưu ý: thay YOUR_PROJECT_REF và CRON_SECRET cho đúng
select vault.create_secret('https://ddsufvdezmgbthxpvrge.supabase.co', 'tntt_project_url');
select vault.create_secret('CHANGE_ME_STRONG_RANDOM_SECRET', 'tntt_cron_secret');

select cron.schedule(
  'tntt-process-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='tntt_project_url') || '/functions/v1/process-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='tntt_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Bước 5 – Build & Deploy frontend

```bash
npm run build
```
Sau đó upload thư mục `dist/` lên hosting.

## Kết quả

Người dùng vào tab **🔔 Thông báo** → nhấn nút **"Tắt"** → trình duyệt hỏi cho phép thông báo → chấp nhận → **từ đó sẽ nhận push dù app đang đóng!**

Nội dung thông báo sẽ là:
> **🔔 Bán kem**  
> Anna Nguyễn Hoài Trúc Thơ – 09:30 ngày 2026-09-20

