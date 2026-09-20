-- Migration: store FCM tokens instead of VAPID subscriptions
alter table public.push_subscriptions drop column if exists endpoint;
alter table public.push_subscriptions drop column if exists p256dh;
alter table public.push_subscriptions drop column if exists auth;
alter table public.push_subscriptions add column if not exists fcm_token text;
alter table public.push_subscriptions alter column fcm_token set not null;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
alter table public.push_subscriptions add unique(user_id, fcm_token);
