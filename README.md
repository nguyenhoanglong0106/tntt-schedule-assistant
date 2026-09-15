# TNTT Schedule Assistant

Web App/PWA mobile-first để quản lý lịch phân công 5 Ngành **Chiên – Ấu – Thiếu – Nghĩa – Hiệp**.

## Chức năng đã có

- Mobile-first + PWA, bottom navigation tối ưu thao tác một tay.
- 5 màu Ngành cố định: Chiên hồng, Ấu xanh lá, Thiếu xanh dương, Nghĩa vàng, Hiệp nâu.
- Lịch chung: mọi Admin xem được toàn bộ, Admin Ngành chỉ sửa Ngành mình.
- Đọc sách xoay tự động `Chiên → Ấu → Thiếu → Nghĩa → Hiệp`, cấu hình bằng ngày bắt đầu + Ngành bắt đầu.
- Các ngày đọc sách: T2, T3, T5, CN; Calendar luôn hiển thị Ngành đọc sách của tuần và cảnh báo slot chưa phân công.
- Bán kem / Trực văn phòng / Vệ sinh: mỗi Ngành tự chọn ngày, giờ, người/lớp; nhiều Ngành có thể cùng có lịch.
- Thành viên và lớp.
- Nhiều người/lớp cho một lịch.
- Nhiều mốc nhắc trước.
- Hoàn thành công việc.
- AI chat tiếng Việt: hỏi lịch + tạo/sửa/xóa/hoàn thành bằng structured command.
- **AI không ghi ngay:** tạo Pending Action → Preview → người dùng Xác nhận → database mới commit.
- AI không được sửa Ngành khác nếu là Branch Admin.
- Activity log cho thay đổi lịch.
- Notification center + Edge Function xử lý reminder định kỳ.
- Super Admin tạo tài khoản Admin Ngành.
- Demo mode chạy ngay không cần Supabase/API key.

---

# A. Chạy thử ngay – KHÔNG cần Supabase

Yêu cầu: Node.js 20+ (khuyến nghị Node.js 22+).

Mở folder bằng VS Code, mở Terminal và chạy:

```bash
npm install
npm run dev
```

Sau đó mở địa chỉ Vite hiển thị, thường là:

```text
http://localhost:5173
```

Nếu file `.env` chưa có Supabase URL/key, app tự chạy **Demo Mode** bằng `localStorage`.

Demo Mode có sẵn dữ liệu và tài khoản Super Admin giả lập. Vào **Cá nhân → Chế độ Demo** để chuyển thử giữa Super Admin và Admin của 5 Ngành.

---

# B. Kết nối Supabase để dùng thật

## 1. Tạo Supabase Project

Tạo một project mới trên Supabase.

Lấy trong phần **Connect / API**:

- Project URL
- Publishable key

Copy:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Điền:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

> Không đưa Service Role key hoặc OpenAI API key vào frontend.

## 2. Khởi tạo và đăng nhập Supabase CLI

Supabase CLI đã nằm trong `devDependencies`, nên `npm install` ở bước đầu đã cài luôn. Khởi tạo config local:

```bash
npx supabase init
```

Lệnh này chỉ tạo `supabase/config.toml`; các migration/function đã có sẵn trong project.

Đăng nhập:

```bash
npx supabase login
```

Link project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

## 3. Chạy migrations + seed

```bash
npx supabase db push
```

Các migration trong `supabase/migrations/` sẽ tạo:

- schema
- 5 Ngành
- task types
- reading rotation
- demo member/class
- RLS
- AI pending action confirmation RPC
- notifications
- audit log

## 4. Tạo Super Admin đầu tiên

Cách dễ nhất: tại màn hình Login của app, nhập email + mật khẩu rồi bấm **Tạo tài khoản đầu tiên**.

Nếu Supabase đang bật xác minh email, xác minh email rồi đăng nhập lại.

Khi tài khoản đầu tiên đăng nhập nhưng chưa có profile, app hiện bước **Thiết lập Super Admin đầu tiên**. Nhập tên và bấm tạo.

Database chỉ cho bootstrap Super Admin khi hệ thống chưa có Super Admin.

Sau khi đã có Super Admin, tạo 5 Admin Ngành tại:

**Cá nhân → Tạo Admin Ngành**.

---

# C. Deploy AI Edge Functions

## 1. Set secrets

```bash
npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
npx supabase secrets set OPENAI_MODEL=gpt-5.6-luna
```

Tạo secret cho reminder cron:

```bash
npx supabase secrets set CRON_SECRET=YOUR_STRONG_RANDOM_SECRET
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` được Supabase Edge runtime cung cấp cho project.

## 2. Deploy functions

```bash
npx supabase functions deploy ai-chat
npx supabase functions deploy ai-confirm-action
npx supabase functions deploy admin-create-user
npx supabase functions deploy process-reminders --no-verify-jwt
```

`process-reminders` dùng `CRON_SECRET` riêng nên deploy `--no-verify-jwt` để Supabase Cron có thể gọi nó mà không cần JWT người dùng.

---

# D. Bật reminder chạy tự động

Supabase hỗ trợ Cron gọi Edge Functions định kỳ.

File mẫu:

```text
supabase/cron.example.sql
```

Trong file này:

1. đổi `YOUR_PROJECT_REF`
2. đổi `CHANGE_ME_STRONG_RANDOM_SECRET` đúng bằng `CRON_SECRET`
3. chạy SQL trong Supabase SQL Editor

Mặc định job chạy mỗi 5 phút.

Khi reminder tới hạn, Edge Function tạo notification cho:

- Super Admin
- Admin của Ngành có lịch

App hiển thị notification trong tab **Nhắc việc**.

---

# E. Chạy local với Supabase thật

```bash
npm install
npm run dev
```

Kiểm tra production build:

```bash
npm run typecheck
npm run test
npm run build
```

Output nằm trong:

```text
dist/
```

---

# F. Deploy Cloudflare Pages

Push project lên GitHub, sau đó trong Cloudflare Pages tạo project từ repository.

Cấu hình:

```text
Build command: npm run build
Build output directory: dist
```

Environment Variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Project đã có `public/_redirects` để Vue Router hoạt động khi refresh URL.

---

# G. Luồng AI an toàn

Ví dụ người dùng nhập:

```text
T2 Minh Thư đọc sách, T3 Đức đọc sách, T5 Tuyền đọc sách
```

Luồng thực tế:

```text
Text
→ Edge Function AI parse
→ kiểm tra ID người/Ngành/quyền
→ tạo ai_pending_actions
→ frontend hiển thị Preview
→ người dùng bấm XÁC NHẬN
→ ai-confirm-action
→ PostgreSQL RPC khóa pending action + revalidate permission
→ transaction cập nhật database
```

Không có bước **Xác nhận** thì không ghi lịch.

Branch Admin được hỏi AI về lịch Ngành khác nhưng database không cho sửa Ngành khác.

---

# H. Cấu trúc project

```text
src/
  components/       UI dùng lại
  composables/      app/auth state
  lib/              Supabase + constants
  services/         data + AI
  utils/            date/rotation/search
  views/            các màn hình

supabase/
  migrations/       schema + RLS + seed
  functions/
    ai-chat/
    ai-confirm-action/
    admin-create-user/
    process-reminders/
    _shared/
```

---

# I. Các lệnh thường dùng

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run build
```

Supabase:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy ai-chat
npx supabase functions deploy ai-confirm-action
npx supabase functions deploy admin-create-user
npx supabase functions deploy process-reminders --no-verify-jwt
```

---

## Lưu ý bảo mật

- Không commit `.env.local`.
- Không đặt `OPENAI_API_KEY` ở Vue/Vite env.
- Không đặt Service Role key ở frontend.
- Quyền thật được enforce bằng RLS và RPC phía PostgreSQL.
- AI chỉ tạo structured operations, không được chạy SQL tùy ý.
- Pending Action có hạn 15 phút và chỉ chính user tạo nó mới xác nhận được.
