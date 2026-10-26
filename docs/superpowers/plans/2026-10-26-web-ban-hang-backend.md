# Web bán hàng Mộc Thuận có máy chủ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến web tĩnh Mộc Thuận thành web bán hàng: khách đặt hàng không cần tài khoản, cửa hàng nhận email, tài khoản admin/khách, admin quản lý sản phẩm và đơn qua API máy chủ (không còn GitHub).

**Architecture:** Giao diện (HTML/CSS/JS thuần hiện có) chuyển vào `public/`, chạy trên Render Static Site (không ngủ). Máy chủ Express trong `server/` chạy trên Render Web Service miễn phí (có thể ngủ), dữ liệu ở Supabase Postgres, ảnh/`.glb`/`catalog.js` công khai ở Supabase Storage. Mỗi lần admin lưu, máy chủ xuất lại `catalog.js` lên Storage để khách xem sản phẩm khi máy chủ đang ngủ.

**Tech Stack:** Node 18+, Express 5, `pg` 8, `bcryptjs` 3, `nodemailer@6.10.1`, `express-rate-limit` 8, `multer` 2, `cors` 2; Supabase Storage gọi bằng `fetch` (REST, không dùng SDK vì SDK cần Node 22). Test: `node:test`, `supertest` 7, `pg-mem` 3 (Postgres trong bộ nhớ), `playwright-core@1.49.1` với Edge cài sẵn (`channel: 'msedge'`).

**Spec:** `docs/superpowers/specs/2026-10-26-web-ban-hang-backend-design.md`

## Global Constraints

- Giao diện và mọi thông báo bằng **tiếng Việt**. JS phía trình duyệt là script thường, biến toàn cục, **không module, không build**. three.js cố định **r128**.
- Chạy tốt ở bề rộng **390px**, không cuộn ngang. Dùng token màu và class sẵn có trong `style.css` / `admin.css`.
- Ảnh dựng 3D luôn gắn nhãn **"Ảnh dựng 3D"**. Sản phẩm và giá vẫn ghi rõ là **dữ liệu mẫu**. Không bịa đánh giá khách.
- Số điện thoại cửa hàng: **0386 115 316** (hiển thị), `0386115316` (link `tel:`). Không còn `0900 000 000` ở đâu.
- Sau khi gửi đơn chỉ được báo: **"Cửa hàng sẽ gọi lại để xác nhận"**. Cấm "đặt hàng thành công".
- Đơn phải lưu vào database **trước** khi gửi email. Email lỗi không làm hỏng đơn.
- Không ghi dữ liệu hay file tải lên vào ổ đĩa máy chủ (Render xóa khi deploy/khởi động lại).
- Mọi bí mật (DATABASE_URL, SUPABASE_SERVICE_KEY, SMTP_*, …) chỉ nằm trong biến môi trường. Kho git đang Public; `.env` nằm trong `.gitignore`.
- Phiên đăng nhập: mã ngẫu nhiên gửi qua header `Authorization: Bearer <token>`, hạn **30 ngày**, máy chủ lưu bản băm SHA-256. Không dùng cookie.
- Mọi dữ liệu đưa vào HTML (trình duyệt và email) đi qua `esc()`, kể cả trường số.
- Giữ `id` và `code` (`MA…`) của 300 sản phẩm khi chuyển dữ liệu, để link `#p1001` vẫn đúng.

## Review Focus

1. **Gửi đơn khi máy chủ đang ngủ / mạng chập chờn:** yêu cầu đầu tiên lỗi hoặc rất chậm → web thử lại, **giữ giỏ hàng**, cuối cùng báo gọi 0386 115 316. (Test ở Task 8.)
2. **Khách đoán mã đơn của người khác** (`GET /api/me/orders/DH…`): trả 404, không lộ dữ liệu. Admin route bị gọi bằng token khách → 403. (Test ở Task 3 và Task 6.)
3. **Trình duyệt gửi giá giả hoặc chiều dài ngoài khoảng:** máy chủ bỏ qua giá gửi lên, tự tính lại; chiều dài riêng phải nằm trong `[max(20, round(W0·0,6)), round(Wmax·1,4)]`, bội số 5. (Test ở Task 6.)
4. **Giỏ hàng cũ chứa sản phẩm đã ẩn hoặc đã xóa:** máy chủ trả 422 kèm danh sách món không còn bán; web báo rõ và bỏ món đó khỏi giỏ, không mất các món khác. (Test ở Task 6 và Task 8.)
5. **Tên sản phẩm/khách có ký tự HTML hoặc tiếng Việt có dấu** đi vào email và `catalog.js` xuất ra: email escape đúng, `catalog.js` giữ nguyên UTF-8. (Test ở Task 4 và Task 6.)

---

## File Structure

```
package.json, .gitignore, .env.example, render.yaml
.github/workflows/keepalive.yml        gọi /api/health mỗi ngày (giữ Supabase hoạt động)
public/                                 giao diện (chuyển từ thư mục gốc bằng git mv)
  index.html, admin.html, assets/...
  assets/js/shared.js      MỚI: K, WOOD, FRAME, UPH, byId, priceAt, unitPrice, customRange — dùng chung trình duyệt + máy chủ
  assets/js/config.js      MỚI: MT_CONFIG.apiBase, MT_CONFIG.catalogUrl
  assets/js/api.js         MỚI: gọi API (token, đánh thức, thử lại), trạng thái đăng nhập
  assets/js/account.js     MỚI: đăng nhập/đăng ký/quên mật khẩu, trang Đơn của tôi
  assets/js/admin-orders.js MỚI: tab Đơn hàng trong admin
  assets/js/data.js, app.js, admin.js, catalog.js (bản dự phòng)  SỬA
server/
  index.js                 khởi động (đọc env, tạo pool pg, listen)
  app.js                   createApp(deps) → express app
  config.js                đọc + kiểm tra biến môi trường
  db/schema.sql, db/index.js (query helper, migrate)
  auth.js                  băm mật khẩu, tạo/kiểm tra token, middleware
  routes/auth.js, routes/products.js, routes/uploads.js, routes/orders.js, routes/admin-orders.js
  services/storage.js      Supabase Storage REST (+ fake cho test)
  services/catalog.js      đọc sản phẩm từ DB, sinh + xuất catalog.js
  services/mailer.js       nodemailer (+ fake cho test), mẫu email
  services/orders.js       kiểm tra + tính giá + chụp giá đơn, mã đơn
  scripts/create-admin.js, scripts/import-catalog.js
tests/
  helpers.js               newTestApp(): pg-mem + fake storage + fake mailer
  shared.test.js, auth.test.js, products.test.js, uploads.test.js, orders.test.js, admin-orders.test.js
  ui/*.test.js             playwright-core + Edge, mock API bằng page.route
```

---

### Task 1: Chuyển giao diện vào `public/`, thêm công cụ test, tách code dùng chung

**Files:**
- Move: `index.html`, `admin.html`, `assets/` → `public/` (`git mv`)
- Create: `package.json`, `.gitignore`, `public/assets/js/shared.js`, `tests/shared.test.js`
- Modify: `public/assets/js/data.js` (bỏ phần đã chuyển sang shared.js), `public/index.html`, `public/admin.html` (nạp `shared.js` trước `data.js`)

**Interfaces:**
- Produces (`shared.js`, gắn vào `globalThis.MT` trong trình duyệt, `module.exports` trong Node):
  - `K`, `WOOD`, `FRAME`, `UPH` (chuyển nguyên từ `data.js`), `byId(list, id)`
  - `priceAt(prices: [W,price][], W: number) → number` (chuyển nguyên)
  - `unitPrice(product: {kind, prices, sale}, W, woodId, woodK: {[id]:number}) → number` — giá 1 món sau hệ số chất liệu (chỉ khi `K[kind].parts` có `'w'`) và giảm giá, làm tròn 10.000 ₫, đúng như `finalPrice` hiện tại
  - `customRange(sizes: number[]) → {min, max, step: 5}` với `min = max(20, round(sizes[0]*0.6))`, `max = round(sizes.at(-1)*1.4)` (đúng như input "Đặt kích thước riêng" trong `app.js`)
- `data.js` giữ tên toàn cục cũ (`K`, `WOOD`, `priceOf`, `finalPrice`…) bằng cách gán từ `MT` để `app.js`, `model3d.js`, `admin.js` không phải đổi.

- [ ] **Step 1:** Commit các thay đổi đang dở trên máy làm mốc: `git add -A && git commit -m "Mốc trước khi chuyển sang máy chủ"`.
- [ ] **Step 2:** `git mv index.html admin.html assets public/`. Tạo `package.json` (`"type": "commonjs"`, `"engines": {"node": ">=18"}`, scripts `test: node --test tests/`, `test:ui: node --test tests/ui/`, `dev: node server/index.js`), cài dependencies và devDependencies đúng phiên bản ở Tech Stack. `.gitignore`: `node_modules/`, `.env`, `sao-luu/`.
- [ ] **Step 3: Viết test** `tests/shared.test.js`:
  - đọc `public/assets/js/catalog.js` hiện tại; với 20 sản phẩm đầu × mọi kích thước × mọi chất liệu, `unitPrice` bằng đúng `finalPrice` cũ (tính lại công thức cũ trong test);
  - `priceAt([[100,1e6],[120,1.2e6]], 110) === 1.1e6`; `priceAt([[100,1e6]], 150) === 1.5e6`;
  - `customRange([160,180]) → {min:96, max:252, step:5}`; `customRange([25]) → {min:20, max:35, step:5}`.
- [ ] **Step 4:** Chạy `npm test` → FAIL (chưa có `shared.js`).
- [ ] **Step 5:** Tạo `shared.js` (mẫu UMD: `(function(root){ … if (typeof module!=='undefined') module.exports = MT; else root.MT = MT; })(this)`), chuyển code, sửa `data.js` và thứ tự script.
- [ ] **Step 6:** `npm test` → PASS. Mở `public/index.html` và `public/admin.html` bằng Edge: không lỗi console, trang chủ và trang `#p1183` hiện đúng (chụp màn hình).
- [ ] **Step 7:** Commit `"Chuyển giao diện vào public/, tách shared.js"`.

### Task 2: Khung máy chủ, database, test helper

**Files:**
- Create: `server/config.js`, `server/db/schema.sql`, `server/db/index.js`, `server/app.js`, `server/index.js`, `tests/helpers.js`, `.env.example`
- Test: `tests/health.test.js`

**Interfaces:**
- `loadConfig(env) → {port, databaseUrl, siteUrl, apiPublicUrl, corsOrigins: string[], supabaseUrl, supabaseServiceKey, storageBucket, smtp:{host,port,user,pass,from}, shopEmail}`; ném lỗi tiếng Việt nêu tên biến thiếu (trừ khi `NODE_ENV=test`).
- `createDb(pool) → {query(sql, params) → rows[], tx(fn(client)) → any}`; `migrate(db)` chạy `schema.sql` (idempotent: `create table if not exists`).
- `createApp({db, storage, mailer, config, now?: () => Date}) → express app`. CORS chỉ cho `config.corsOrigins`; JSON body giới hạn 1 MB; lỗi trả `{error: "<thông báo tiếng Việt>"}`.
- `newTestApp(overrides?) → {app, db, storage: FakeStorage, mailer: FakeMailer}` (pg-mem, migrate sẵn).
- Bảng (schema.sql):
  - `products(id int primary key, code text unique not null, data jsonb not null, hidden boolean not null default false, updated_at timestamptz not null default now())` — `data` là nguyên một dòng `catalog.js`.
  - `settings(key text primary key, value jsonb not null)` — `woodK`.
  - `users(id serial pk, email text unique not null, password_hash text not null, role text not null check (role in ('admin','customer')), name text, phone text, address text, created_at timestamptz default now())`.
  - `sessions(token_hash text pk, user_id int not null references users on delete cascade, expires_at timestamptz not null)`.
  - `password_resets(token_hash text pk, user_id int references users on delete cascade, expires_at timestamptz not null, used boolean default false)`.
  - `orders(id serial pk, code text unique not null, status text not null, customer jsonb not null, payment text not null check (payment in ('chuyen-khoan','khi-nhan')), user_id int references users, lines jsonb not null, total bigint not null, note text, internal_note text, created_at timestamptz default now(), updated_at timestamptz default now())`.
  - `order_events(id serial pk, order_id int references orders on delete cascade, kind text not null check (kind in ('tao','trang-thai','sua')), actor_id int references users, before jsonb, after jsonb, at timestamptz default now())`.

- [ ] **Step 1: Test** `GET /api/health` → 200 `{ok:true}` và có chạy một truy vấn DB (`select 1`); `OPTIONS` từ origin lạ không có header `Access-Control-Allow-Origin`; từ origin trong `corsOrigins` thì có.
- [ ] **Step 2:** Chạy → FAIL. **Step 3:** Viết code. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `"Khung máy chủ Express + schema"`.

### Task 3: Đăng nhập, tài khoản, quyền

**Files:**
- Create: `server/auth.js`, `server/routes/auth.js`, `server/scripts/create-admin.js`
- Test: `tests/auth.test.js`

**Interfaces:**
- `hashPassword(pw) → Promise<string>` (bcryptjs, cost 10), `checkPassword(pw, hash) → Promise<boolean>`.
- `issueSession(db, userId) → Promise<token>` (32 byte ngẫu nhiên, base64url; lưu sha256; hạn 30 ngày).
- Middleware: `attachUser(db)` (đọc `Authorization: Bearer`, gắn `req.user = {id, email, role, name, phone, address}` hoặc `null`), `requireUser`, `requireAdmin` (401 nếu chưa đăng nhập, 403 nếu không phải admin).
- API:
  - `POST /api/auth/register {email, password, name, phone?, address?}` → 201 `{token, user}`; luôn tạo vai trò `customer`; mật khẩu ≥ 8 ký tự; email trùng → 409.
  - `POST /api/auth/login {email, password}` → `{token, user}`; sai → 401 "Email hoặc mật khẩu không đúng". Giới hạn 10 lần / 15 phút / IP.
  - `POST /api/auth/logout` → xóa phiên hiện tại.
  - `GET /api/auth/me` → `{user}` hoặc 401.
  - `PUT /api/auth/me {name, phone, address}` → cập nhật hồ sơ.
  - `POST /api/auth/forgot {email}` → luôn 200 (không lộ email có tồn tại); nếu có thì gửi email chứa `${siteUrl}/#dat-lai-mat-khau=<token>` (hạn 1 giờ).
  - `POST /api/auth/reset {token, password}` → đổi mật khẩu, đánh dấu đã dùng, **xóa mọi phiên cũ** của người đó.
- `node server/scripts/create-admin.js <email>` hỏi mật khẩu (stdin), tạo hoặc nâng vai trò `admin`.

- [ ] **Step 1: Test:**
  - đăng ký → token dùng được ở `/me`;
  - đăng ký gửi kèm `role:'admin'` vẫn ra `customer`;
  - đăng nhập sai → 401;
  - đăng nhập sai lần thứ 11 trong 15 phút → 429;
  - logout → token cũ bị 401;
  - token hết hạn (dùng `now` giả) → 401;
  - forgot với email lạ → 200 và FakeMailer không gửi;
  - reset → đăng nhập bằng mật khẩu mới được, token cũ bị 401, dùng lại reset token → 400;
  - `requireAdmin` với token khách → 403.
- [ ] **Step 2–4:** FAIL → viết code → `npm test` PASS.
- [ ] **Step 5:** Commit `"Đăng nhập, tài khoản, quyền admin"`.

### Task 4: Sản phẩm trong database, xuất `catalog.js`, nhập dữ liệu cũ

**Files:**
- Create: `server/services/storage.js`, `server/services/catalog.js`, `server/routes/products.js`, `server/scripts/import-catalog.js`
- Test: `tests/products.test.js`

**Interfaces:**
- `createStorage({supabaseUrl, serviceKey, bucket}) → {put(path, buffer, contentType) → Promise<publicUrl>, publicUrl(path)}` dùng `POST/PUT ${url}/storage/v1/object/${bucket}/${path}` với `x-upsert: true`, `Authorization: Bearer serviceKey`; URL công khai `${url}/storage/v1/object/public/${bucket}/${path}`. `FakeStorage` trong `tests/helpers.js` lưu vào Map.
- `catalogText({rev, woodK, products}) → string` — **đúng định dạng** `catalogText` trong `admin.js` hiện tại (header comment + `var CATALOG = {...}` mỗi sản phẩm một dòng).
- `publishCatalog(db, storage, now) → Promise<{rev}>`: đọc sản phẩm không `hidden` (sắp theo `id`) + `woodK`, đưa lên `catalog.js` (contentType `text/javascript; charset=utf-8`, header `cache-control: max-age=60`).
- API (đều `requireAdmin`, mọi thay đổi gọi `publishCatalog` sau khi ghi DB):
  - `GET /api/admin/products` → `{woodK, products: [...data + hidden]}` (gồm cả sản phẩm ẩn)
  - `PUT /api/admin/products/:id {product}` → tạo hoặc thay; kiểm tra `code` không trùng (409), `prices` không rỗng, mỗi `[W>=5, price>0]`, `kind` có trong `K`, `sub` không rỗng
  - `DELETE /api/admin/products/:id` → 204; từ chối (409) nếu `flag: true`
  - `POST /api/admin/products/bulk-price {ids: number[], percent: number}` → nhân giá, làm tròn 10.000, tối thiểu 10.000
  - `PUT /api/admin/settings/woodK {woodK}` → mỗi hệ số trong `[0.5, 3]`
- `node server/scripts/import-catalog.js <url-hoặc-đường-dẫn catalog.js>` — mặc định tải `https://raw.githubusercontent.com/nguyencanhthanh308-ui/Web_Moc_Thuan/main/assets/js/catalog.js`; ghi `products` + `settings.woodK` trong một transaction; chạy lại không nhân đôi (upsert); cuối cùng `publishCatalog`.

- [ ] **Step 1: Test:**
  - import file mẫu 3 sản phẩm → `GET /api/admin/products` trả đủ, giữ `id`/`code`;
  - token khách gọi → 403;
  - `PUT` sửa giá → FakeStorage có `catalog.js` mới chứa giá mới; `PUT` với `hidden:true` → `catalog.js` không còn sản phẩm đó nhưng `GET /api/admin/products` vẫn có;
  - mã trùng → 409;
  - bulk +10% đúng công thức làm tròn;
  - tên sản phẩm `Bàn "góc" <b>` → `catalog.js` đọc lại bằng `new Function(text + ';return CATALOG')()` ra đúng chuỗi (Review Focus 5).
- [ ] **Step 2–4:** FAIL → viết code → PASS.
- [ ] **Step 5:** Commit `"API sản phẩm + xuất catalog.js lên Storage"`.

### Task 5: Tải ảnh và mô hình

**Files:**
- Create: `server/routes/uploads.js`
- Test: `tests/uploads.test.js`

**Interfaces:**
- `POST /api/admin/uploads` (`requireAdmin`, `multer.memoryStorage`, field `file`, query `kind=photo|model`) → `{url}`. Ảnh: `image/jpeg|png|webp`, ≤ 8 MB, lưu `products/<tên-đã-làm-sạch>`; mô hình: đuôi `.glb`, ≤ 25 MB, lưu `models/<tên>`. Tên làm sạch: bỏ dấu, chỉ `[a-z0-9._-]`, thêm `-<6 ký tự ngẫu nhiên>` trước đuôi để không ghi đè.

- [ ] **Step 1: Test:**
  - ảnh hợp lệ → 200, URL công khai, FakeStorage có file;
  - file `.exe` → 415;
  - ảnh 9 MB → 413;
  - không đăng nhập → 401.
- [ ] **Step 2–4:** FAIL → code → PASS.
- [ ] **Step 5:** Commit `"API tải ảnh và mô hình"`.

### Task 6: Đơn hàng (khách) và email

**Files:**
- Create: `server/services/orders.js`, `server/services/mailer.js`, `server/routes/orders.js`
- Test: `tests/orders.test.js`

**Interfaces:**
- `buildLines(db, items: {id, W, wood, frame, uph, qty}[]) → {lines, total, unavailable: number[]}`:
  - giá tính bằng `MT.unitPrice` từ dữ liệu DB, bỏ qua giá client gửi;
  - mỗi dòng chụp `{productId, code, name, W, D, H, wood, frame, uph, woodName, frameName, uphName, qty, unitPrice, custom: boolean, estimate: boolean}` (`custom` = W không nằm trong `prices`, `estimate = custom`);
  - `qty` nguyên 1–50; `W` riêng phải trong `MT.customRange` và chia hết cho 5.
- `nextOrderCode(db, date) → "DH" + YYMMDD + "-" + số thứ tự trong ngày 3 chữ số` (ví dụ `DH261026-001`).
- `normalizePhone(s) → "0xxxxxxxxx" | null`: bỏ khoảng trắng, dấu chấm, gạch; `+84` → `0`; khớp `/^0(3|5|7|8|9)\d{8}$/`.
- `createMailer(smtp) → {send({to, subject, html, text}) → Promise}`; `FakeMailer` lưu `sent[]`, có thể đặt `fail = true`.
- `newOrderEmail(order, adminUrl) → {subject, html, text}`: tiêu đề `"[Mộc Thuận] Đơn mới ${code} – ${name} – ${total}"`; mọi giá trị đi qua `esc`; có link `${siteUrl}/admin.html#don=${code}`.
- API:
  - `POST /api/orders {customer:{name, phone, address}, payment, note, items, website}` (`attachUser`, giới hạn 5 lần / 10 phút / IP):
    - `website` là ô bẫy, có giá trị → trả 200 giả, không lưu;
    - món không còn bán → 422 `{error, unavailable:[id]}`;
    - lưu đơn trạng thái `moi`, event `tao`, gắn `user_id` nếu đã đăng nhập;
    - **sau khi commit** mới gửi email tới `shopEmail`, lỗi email chỉ ghi log;
    - trả 201 `{code}`.
  - `GET /api/me/orders` (`requireUser`) → đơn của chính mình, mới nhất trước, **không** có `internal_note` và events.
  - `GET /api/me/orders/:code` → 404 nếu không phải đơn của mình.
- Trạng thái (giá trị lưu → chữ hiển thị): `moi` Mới, `da-xac-nhan` Đã xác nhận, `dang-lam` Đang làm, `da-giao` Đã giao, `hoan-tat` Hoàn tất, `da-huy` Đã hủy. Export `STATUSES` từ `services/orders.js`.

- [ ] **Step 1: Test:**
  - đơn hợp lệ → 201, DB có đơn `moi`, event `tao`, FakeMailer gửi 1 thư tới shopEmail;
  - client gửi `unitPrice: 1` → bị bỏ qua, total tính lại đúng;
  - W riêng ngoài khoảng → 400;
  - sản phẩm `hidden` → 422 có `unavailable`;
  - số điện thoại `0123` → 400, `+84 386 115 316` → lưu `0386115316`;
  - ô bẫy có giá trị → 200 nhưng không có đơn;
  - đơn thứ 6 trong 10 phút → 429;
  - `mailer.fail = true` → vẫn 201 và đơn vẫn có;
  - tên khách `<script>` → html email chứa `&lt;script&gt;`;
  - khách A gọi `GET /api/me/orders/<mã của B>` → 404;
  - mã đơn ngày thứ hai bắt đầu lại từ `-001`.
- [ ] **Step 2–4:** FAIL → code → PASS.
- [ ] **Step 5:** Commit `"Đặt hàng, email báo đơn mới"`.

### Task 7: Quản trị đơn hàng (API)

**Files:**
- Create: `server/routes/admin-orders.js`
- Test: `tests/admin-orders.test.js`

**Interfaces** (đều `requireAdmin`):
- `GET /api/admin/orders?status=&q=&page=` → `{orders, total, counts: {moi: n, …}}`, 30 đơn/trang, tìm theo mã, tên, số điện thoại.
- `GET /api/admin/orders/:code` → đơn đầy đủ + `events` (kèm email người làm).
- `PUT /api/admin/orders/:code/status {status}` → event `trang-thai` `{before:{status}, after:{status}}`; trạng thái không hợp lệ → 400. (Việc bấm xác nhận khi hủy hoặc mở lại từ Hoàn tất làm ở giao diện.)
- `PUT /api/admin/orders/:code {lines, customer, payment, internal_note}`:
  - `lines` cho phép sửa `unitPrice`, `qty`, xóa dòng, thêm dòng `{kind:'extra', label, amount}` (số âm = giảm giá);
  - dòng sản phẩm đã sửa `unitPrice` thì `estimate=false`;
  - `total` tính lại trên máy chủ;
  - event `sua` lưu before/after.
  - Khách xem `/api/me/orders/:code` thấy ngay giá mới.

- [ ] **Step 1: Test:**
  - danh sách có `counts.moi` đúng;
  - đổi trạng thái → event đúng;
  - sửa giá dòng kích thước riêng → total mới, `estimate=false`, khách thấy giá mới và **không** thấy `internal_note`;
  - thêm dòng phí `150000` và dòng giảm `-50000` → total đúng;
  - token khách gọi → 403.
- [ ] **Step 2–4:** FAIL → code → PASS.
- [ ] **Step 5:** Commit `"API quản trị đơn hàng"`.

### Task 8: Giao diện khách — nạp sản phẩm, đăng nhập, đặt hàng, Đơn của tôi

**Files:**
- Create: `public/assets/js/config.js`, `public/assets/js/api.js`, `public/assets/js/account.js`, `tests/ui/helpers.js`, `tests/ui/shop.test.js`
- Modify: `public/index.html`, `public/assets/js/app.js`, `public/assets/css/style.css`

**Interfaces:**
- `MT_CONFIG = {apiBase, catalogUrl}`: trên `localhost` hoặc `127.0.0.1` → `http://localhost:3000` và `catalogUrl: null` (dùng file trong `public/`); còn lại → `https://moc-thuan-api.onrender.com` và URL công khai `catalog.js` trên Supabase (điền khi deploy, Task 10).
- Nạp sản phẩm trong `index.html` (và `admin.html` không cần):
  - `document.write` thẻ script `catalogUrl + '?v=' + phút`;
  - script kế tiếp: nếu `typeof CATALOG === 'undefined'` thì `document.write` thẻ `assets/js/catalog.js` (bản dự phòng).
- `api.js`:
  - `Api.call(method, path, body?, {retries=0, slowMs=4000, onSlow}) → Promise<json>`: gửi `Authorization` nếu có token, thử lại khi lỗi mạng hoặc 502/503/504 với giãn cách 2 s, 4 s, 8 s…;
  - `Api.wake()` (gọi `/api/health`, không chờ);
  - `Auth.user` / `Auth.load()` / `Auth.login()` / `Auth.logout()` / `Auth.onChange(fn)`; token trong `localStorage['mocthuan-token']` (bọc try/catch như `store()`).
- Đầu trang: nút **Đăng nhập** (cạnh giỏ hàng) luôn hiện ngay. Khi `Auth.user` có thì đổi thành tên người dùng + menu: **Đơn của tôi**, **Thông tin tài khoản**, **Đăng xuất**, và với admin thêm link **Quản trị** (`admin.html`).
- Điều hướng hash mới: `#dang-nhap`, `#dang-ky`, `#quen-mat-khau`, `#dat-lai-mat-khau=<token>`, `#don-cua-toi`, `#don=<code>`, `#tai-khoan`.
- `checkout()` trong `app.js`:
  - form thêm **cách trả tiền** (radio: Chuyển khoản / Trả khi nhận hàng) và ô bẫy ẩn `website`;
  - đã đăng nhập thì tự điền tên, số điện thoại, địa chỉ;
  - gửi `POST /api/orders` với `retries: 4`;
  - sau 4 s hiện "Đang gửi đơn… (có thể mất tới 1 phút)";
  - **chỉ xóa giỏ khi nhận 201**;
  - 422 → bỏ các món `unavailable` khỏi giỏ và báo tên món;
  - thất bại hẳn → "Chưa gửi được đơn. Vui lòng gọi 0386 115 316" và giữ giỏ;
  - thành công → "Cửa hàng đã nhận đơn **{code}** và sẽ gọi lại để xác nhận".
- Thay `0900 000 000` → `0386 115 316` (`index.html` header, footer, `app.js`). Dòng chân trang: "Sản phẩm và giá trên web là dữ liệu minh họa. Ảnh sản phẩm được dựng 3D trực tiếp trong trình duyệt."

- [ ] **Step 1: Test UI** (`tests/ui/shop.test.js`, playwright-core `chromium.launch({channel:'msedge'})`, server tĩnh cho `public/`, mock API bằng `page.route`):
  - trang chủ hiện, không lỗi console, footer có 0386 115 316, không còn `0900 000 000`;
  - `catalogUrl` lỗi → vẫn hiện sản phẩm từ bản dự phòng;
  - đặt hàng khi API trả 503 hai lần rồi 201 → giỏ chỉ trống sau 201, hiện mã đơn và chữ "sẽ gọi lại để xác nhận";
  - API trả 503 mãi → giỏ còn nguyên, hiện số 0386 115 316;
  - API trả 422 `unavailable` → món đó bị bỏ, món còn lại vẫn trong giỏ;
  - đăng nhập admin (mock `/api/auth/me` role admin) → có link "Quản trị"; khách → không có;
  - `#don-cua-toi` hiện danh sách từ mock;
  - bề rộng 390px không cuộn ngang ở trang chủ, giỏ hàng, form đặt hàng, đăng nhập.
- [ ] **Step 2–4:** FAIL → code → `npm run test:ui` PASS; chụp màn hình form đặt hàng và menu tài khoản ở 1280px và 390px để chủ dự án xem.
- [ ] **Step 5:** Commit `"Giao diện khách: đăng nhập, đặt hàng thật, Đơn của tôi"`.

### Task 9: Trang quản trị — sản phẩm qua API, tab Đơn hàng

**Files:**
- Create: `public/assets/js/admin-orders.js`, `tests/ui/admin.test.js`
- Modify: `public/admin.html`, `public/assets/js/admin.js`, `public/assets/css/admin.css`

**Interfaces:**
- **Cổng đăng nhập:**
  - `admin.html` nạp `config.js`, `api.js`; khi mở thì gọi `Auth.load()`;
  - chưa đăng nhập hoặc không phải admin → hiện form đăng nhập ngay trong trang (không tải dữ liệu);
  - đang chờ máy chủ → "Đang kết nối máy chủ…".
- **Dữ liệu:**
  - `admin.html` vẫn nạp `assets/js/catalog.js` dự phòng trước `data.js`, vì `data.js` cần `CATALOG` lúc khởi động;
  - sau khi đăng nhập, nạp từ `GET /api/admin/products` rồi gán vào `CATALOG.products` / `CATALOG.woodK` (`applyWoodK`) trước khi vẽ danh sách;
  - bỏ toàn bộ phần GitHub (`gh*`), lưu thư mục (`dir*`, `idb`), xuất/nhập file, bản nháp/gộp (`draft.baseData`, `rebase`), "Xem thử";
  - giữ nguyên mọi giao diện sửa sản phẩm.
- **Lưu:**
  - nút Lưu trong ngăn sửa → `PUT /api/admin/products/:id`;
  - Xóa → `DELETE`;
  - Đổi giá hàng loạt → `bulk-price`;
  - hệ số chất liệu → `PUT /api/admin/settings/woodK`;
  - chọn ảnh hoặc `.glb` → `POST /api/admin/uploads`, nhận `url` rồi đưa vào `photos` / `model.src`;
  - lỗi thì báo rõ và **giữ nguyên nội dung đang sửa** trong ngăn để bấm Lưu lại.
- Đầu trang admin: trạng thái + **Mở web** + tên admin + **Đăng xuất**. Không còn nút Lưu chung ở đầu trang.
- **Tab Đơn hàng** (tab đầu tiên, có số đơn Mới):
  - danh sách lọc theo trạng thái, tìm kiếm;
  - mở `#don=<code>` → chi tiết, đổi trạng thái (gợi ý bước tiếp theo; hủy hoặc mở lại từ Hoàn tất phải `confirm`);
  - sửa dòng, giá, số lượng, thêm phí/giảm, sửa thông tin khách, cách trả tiền, ghi chú nội bộ;
  - lịch sử.

- [ ] **Step 1: Test UI** (mock API):
  - không token → hiện form đăng nhập, không gọi `/api/admin/products`;
  - đăng nhập admin → danh sách 300 sản phẩm;
  - sửa giá rồi Lưu → đúng một `PUT` với giá mới;
  - API trả 500 → ngăn sửa vẫn mở, nội dung còn nguyên;
  - chọn ảnh → gọi uploads, `photos` có URL trả về;
  - tab Đơn hàng hiện số đơn Mới;
  - đổi sang Đã hủy hỏi xác nhận;
  - sửa giá dòng → `PUT` đơn với `unitPrice` mới;
  - 390px không cuộn ngang.
- [ ] **Step 2–4:** FAIL → code → PASS; chụp màn hình tab Đơn hàng và chi tiết đơn.
- [ ] **Step 5:** Commit `"Trang quản trị dùng API: sản phẩm và đơn hàng"`.

### Task 10: Triển khai và tài liệu

**Files:**
- Create: `render.yaml`, `.github/workflows/keepalive.yml`, `docs/trien-khai.md`
- Modify: `README.md`, `public/assets/js/config.js` (URL thật sau khi tạo dịch vụ)

**Interfaces:**
- `render.yaml`:
  - `type: web` `moc-thuan-api` (`rootDir: .`, `buildCommand: npm ci --omit=dev`, `startCommand: node server/index.js`, `plan: free`, `healthCheckPath: /api/health`, envVars `sync: false` cho các bí mật);
  - `type: web` `runtime: static` `moc-thuan` (`staticPublishPath: public`, header `Cache-Control: no-cache` cho `/*.html`).
- `keepalive.yml`: `schedule: cron '0 1 * * *'` + `workflow_dispatch`, chạy `curl -fsS --retry 5 --retry-delay 20 https://moc-thuan-api.onrender.com/api/health`.
- `docs/trien-khai.md` (tiếng Việt, cho người mới), từng bước:
  - tạo dự án Supabase, bucket công khai `public-files`, lấy `DATABASE_URL` (connection pooler) và service key;
  - tạo hai dịch vụ trên Render từ `render.yaml`, điền biến môi trường;
  - Gmail: bật xác minh 2 bước, tạo mật khẩu ứng dụng cho SMTP;
  - **trước khi nhập dữ liệu:** mở trang admin cũ trên GitHub Pages, bấm Lưu để không còn bản nháp trong trình duyệt;
  - chạy migrate, `import-catalog.js`, `create-admin.js` từ máy (với `DATABASE_URL` của Supabase);
  - điền `config.js`;
  - gắn tên miền `www` và `api`;
  - kiểm tra: đặt một đơn thử → nhận email, admin thấy đơn;
  - sau khi web trên Render chạy ổn: tắt GitHub Pages (Settings → Pages → Unpublish) và xóa mã truy cập GitHub đã tạo cho trang admin cũ.

- [ ] **Step 1:** Viết các file; `npm test` và `npm run test:ui` vẫn PASS.
- [ ] **Step 2:** Chạy toàn bộ trên máy: `.env` trỏ Postgres của Supabase (chủ dự án tạo), `npm run dev` + mở `public/` qua Live Server: đăng ký, đặt đơn, nhận email, admin đổi trạng thái và sửa giá → khách thấy giá mới. Ghi kết quả vào báo cáo; bước nào cần tài khoản của chủ dự án mà chưa có thì nói rõ là chưa chạy được.
- [ ] **Step 3:** Commit `"Cấu hình Render, keep-alive, hướng dẫn triển khai"`. **Không push** cho tới khi chủ dự án đồng ý.
