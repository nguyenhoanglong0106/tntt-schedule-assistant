# Hướng dẫn kích hoạt Push Notification

## Bước 1 – Chạy migration database

Chạy lần lượt `supabase/migrations/202609160005_push_subscriptions.sql` và `supabase/migrations/202609160007_fcm_tokens.sql` trong **Supabase Dashboard → SQL Editor** (hoặc `npx supabase db push`).

## Bước 2 – Deploy Edge Functions

```bash
npx supabase functions deploy save-push-subscription
npx supabase functions deploy process-reminders --no-verify-jwt
```

## Bước 3 – Set secrets vào Supabase

Gửi push dùng **FCM HTTP v1** (API legacy `fcm/send` + server key đã bị Google tắt).

1. Firebase Console → ⚙️ Project settings → **Service accounts** → **Generate new private key** → tải file JSON.
2. Set toàn bộ nội dung file JSON làm secret:

```bash
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat tntt-26354-firebase-adminsdk-xxxx.json)"
npx supabase secrets set CRON_SECRET=CHANGE_ME_STRONG_RANDOM_SECRET
```

Không commit file JSON service account vào git.

## Kiểm tra nhanh

Sau khi bật thông báo trên ít nhất một thiết bị (tab **🔔 Thông báo**), gửi thử một thông báo tới mọi thiết bị đã đăng ký:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-reminders \
  -H "x-cron-secret: CRON_SECRET_CUA_BAN" -H "Content-Type: application/json" \
  -d '{"test":true}'
```

Kết quả mong đợi: `{"ok":true,"test":true,"users":1,"sent":1,"failed":0,...}`. Nếu `users` = 0 thì thiết bị chưa lưu được token; nếu `failed` > 0 xem `errors`.

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

