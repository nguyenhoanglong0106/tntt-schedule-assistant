# BẮT ĐẦU Ở ĐÂY

## Chạy thử giao diện ngay

1. Giải nén project và mở folder `tntt-schedule-assistant` bằng Visual Studio Code.
2. Mở **Terminal → New Terminal**.
3. Chạy:

```bash
npm install
npm run dev
```

4. Mở địa chỉ hiện trong Terminal, thường là `http://localhost:5173`.

**Không cần tạo `.env` ở bước này.** App sẽ tự chạy Demo Mode, có sẵn dữ liệu để thử.

## Sau khi xem Demo ổn

Làm theo `README.md`, mục **B. Kết nối Supabase để dùng thật**.

Thứ tự ngắn gọn:

```text
Tạo Supabase Project
→ tạo .env.local
→ npx supabase init
→ npx supabase login
→ npx supabase link
→ npx supabase db push
→ set GEMINI_API_KEY
→ deploy 4 Edge Functions
→ chạy app
→ tạo Super Admin đầu tiên
```

## Lệnh kiểm tra trước khi deploy

```bash
npm run test
npm run typecheck
npm run build
```

Nếu `npm run build` thành công, folder `dist` là output để Cloudflare Pages deploy.
