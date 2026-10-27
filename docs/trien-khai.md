# Hướng dẫn đưa web Mộc Thuận lên mạng

Dành cho người không rành lập trình. Làm lần lượt từng bước, không nhảy cóc. Mỗi bước có phần **Kiểm tra** để biết đã làm đúng chưa.

Web gồm hai phần, cả hai đều **miễn phí**:

| Phần | Nằm ở đâu | Việc của nó |
|---|---|---|
| Trang web (khách xem) | Render, loại *Static Site* | Hiện sản phẩm, giỏ hàng, trang quản trị. Không bao giờ "ngủ". |
| Máy chủ API | Render, loại *Web Service* | Đăng ký, đăng nhập, nhận đơn, gửi email. **Ngủ sau khoảng 15 phút không ai dùng**, lần gọi đầu sau đó chậm (tới 1 phút). |
| Cơ sở dữ liệu và kho ảnh | Supabase | Lưu sản phẩm, đơn hàng, tài khoản, ảnh. |
| Email báo đơn mới | Brevo (dịch vụ gửi email, miễn phí) | Máy chủ gửi thư qua Brevo, người gửi là email của cửa hàng. |

Trong tài liệu này `tenmien.vn` là **ví dụ**. Hãy thay bằng tên miền thật của bạn. Dự kiến: `www.tenmien.vn` là trang web, `api.tenmien.vn` là máy chủ API.

Chuẩn bị: một tài khoản GitHub (đã có mã nguồn dự án này), một địa chỉ email của cửa hàng (Gmail hay email tên miền đều được), máy tính Windows đã cài **Node.js** (bản 18 trở lên) và **VS Code**.

---

## Bước 1. Tạo dự án Supabase

1. Vào https://supabase.com, bấm **Start your project**, đăng ký bằng GitHub hoặc email.
2. Bấm **New project**. Đặt tên (ví dụ `moc-thuan`), chọn khu vực gần Việt Nam (ví dụ *Southeast Asia (Singapore)*).
3. Ô **Database Password**: bấm **Generate a password**, **sao chép và lưu lại** ở nơi an toàn (sổ tay, trình quản lý mật khẩu). Sau này không xem lại được.
4. Bấm **Create new project**, chờ vài phút cho đến khi hiện giao diện chính.

### 1a. Tạo kho ảnh công khai `public-files`

1. Menu bên trái chọn **Storage** → **New bucket**.
2. Tên: gõ đúng `public-files` (chữ thường, có dấu gạch ngang).
3. Bật công tắc **Public bucket**. Bấm **Create bucket**.

**Kiểm tra:** bucket `public-files` hiện trong danh sách và có chữ *Public*.

### 1b. Lấy `DATABASE_URL` (địa chỉ cơ sở dữ liệu)

1. Bấm nút **Connect** ở đầu trang dự án (hoặc *Project Settings → Database*).
2. Chọn kiểu **Transaction pooler** hoặc **Session pooler** (đều là "connection pooler"), loại **URI**.
3. Sao chép chuỗi có dạng `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-....pooler.supabase.com:6543/postgres`.
4. Thay chữ `[YOUR-PASSWORD]` (kể cả dấu ngoặc vuông) bằng mật khẩu ở bước 1.3. Nếu mật khẩu có ký tự đặc biệt như `@ : / # ?` thì dễ lỗi; nên tạo lại mật khẩu chỉ gồm chữ và số (*Project Settings → Database → Reset database password*).

Đây là `DATABASE_URL`. **Không đưa cho ai, không dán lên mạng.**

Ghi chú kỹ thuật: máy chủ nối vào database bằng SSL nhưng không kiểm tra chứng chỉ (đúng với connection pooler của Supabase). Bạn không cần làm gì thêm.

### 1c. Lấy `SUPABASE_URL` và service key

1. Menu bên trái: **Project Settings** (hình bánh răng) → **API** (hoặc *API Keys*).
2. **Project URL**, dạng `https://abcdxyz.supabase.co`, là `SUPABASE_URL`.
3. Lấy khóa bí mật làm `SUPABASE_SERVICE_KEY`. Vào **Project Settings → API Keys** rồi chọn **một** trong hai (cả hai đều dùng được):
   - tab **Legacy API Keys**: khóa tên **service_role** (bấm *Reveal*, chuỗi rất dài bắt đầu bằng `eyJ...`); hoặc
   - tab **API Keys** mới: khóa **Secret key** (bấm *Reveal*, bắt đầu bằng `sb_secret_...`).

   **Không** lấy khóa `anon` / `Publishable key`. Đây là khóa **rất mạnh**: tuyệt đối không dán vào `config.js`, không đưa lên GitHub.

---

## Bước 2. Brevo: dịch vụ gửi email đơn hàng

**Vì sao không dùng Gmail?** Render gói miễn phí **chặn các cổng gửi thư thường dùng (25, 465, 587)** nên Gmail SMTP sẽ không gửi được (chỉ chạy nếu máy chủ API dùng gói Render trả phí). Vì vậy dùng **Brevo**, gói miễn phí khoảng 300 email mỗi ngày, gửi qua cổng **2525** (không bị chặn).

1. Vào https://www.brevo.com, đăng ký tài khoản miễn phí.
2. Vào **Senders, Domains & Dedicated IPs → Senders → Add a sender**: nhập tên (ví dụ `Mộc Thuận`) và **email của cửa hàng**. Brevo gửi một thư xác nhận tới email đó: mở thư, bấm xác nhận. **Chưa xác minh thì thư sẽ không gửi được.**
3. Vào **SMTP & API → SMTP** (đôi khi nằm trong menu tên bạn ở góc phải → *SMTP & API*). Ở đó có **SMTP server** và **Login** (dạng `xxxx@smtp-brevo.com`). Bấm **Generate a new SMTP key**, đặt tên `moc-thuan`, **chép khóa ngay** (chỉ hiện một lần).

Các giá trị sẽ dùng:

| Biến | Giá trị |
|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `2525` (đã có sẵn trong `render.yaml`) |
| `SMTP_USER` | **Login** SMTP của Brevo (không phải email đăng ký) |
| `SMTP_PASS` | **SMTP key** vừa tạo (không phải mật khẩu tài khoản Brevo) |
| `SMTP_FROM` | người gửi, **phải đúng email đã xác minh ở bước 2**, ví dụ `Mộc Thuận <email-cua-hang@tenmien.vn>` |
| `SHOP_EMAIL` | email nhận thông báo có đơn mới (có thể là chính email cửa hàng) |

---

## Bước 3. Tạo hai dịch vụ trên Render

Máy chủ cần mã nguồn trên GitHub.

**Quan trọng về thứ tự:** trang web cũ trên GitHub Pages vẫn đang chạy từ nhánh `main` và phải **giữ nguyên cho tới khi web mới chạy xong** (bước 9). Vì vậy lúc này **chưa gộp vào `main`**. Hãy đẩy nhánh `feat/ban-hang` lên GitHub (nhờ người hỗ trợ kỹ thuật nếu chưa làm) và tạo Render từ nhánh đó.

1. Vào https://render.com, đăng ký bằng GitHub.
2. Bấm **New +** → **Blueprint**. Chọn kho GitHub của dự án, ở ô **Branch** chọn **`feat/ban-hang`** (không phải `main`), bấm **Connect**.
3. Render đọc file `render.yaml` và đề xuất hai dịch vụ: `moc-thuan-api` (Web Service) và `moc-thuan` (Static Site). Đảm bảo cả hai đều gói **Free**.
4. Render hỏi giá trị cho các biến chưa có. Điền (lấy từ bước 1 và 2):

| Biến | Điền gì |
|---|---|
| `DATABASE_URL` | chuỗi ở bước 1b (đã thay mật khẩu) |
| `SUPABASE_URL` | bước 1c |
| `SUPABASE_SERVICE_KEY` | bước 1c |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SHOP_EMAIL` | bước 2 |
| `SITE_URL` | địa chỉ trang web của bạn, **không có dấu `/` ở cuối**. Ví dụ `https://www.tenmien.vn` (chưa gắn tên miền thì dùng tạm `https://moc-thuan.onrender.com`). Dùng trong email để tạo link vào trang quản trị và link đặt lại mật khẩu. **Bắt buộc**. |
| `API_PUBLIC_URL` | địa chỉ máy chủ API, ví dụ `https://moc-thuan-api.onrender.com` (hoặc `https://api.tenmien.vn` sau khi gắn tên miền) |
| `CORS_ORIGINS` | danh sách địa chỉ trang web được phép gọi API, ngăn cách bằng dấu phẩy, **không có khoảng trắng thừa, không dấu `/` cuối**. Ví dụ `https://www.tenmien.vn,https://moc-thuan.onrender.com`. **Bắt buộc**: thiếu hoặc sai thì trình duyệt chặn, đăng nhập và đặt hàng báo lỗi. |

Máy chủ **từ chối khởi động** nếu thiếu một trong các biến: `DATABASE_URL`, `SITE_URL`, `API_PUBLIC_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SHOP_EMAIL`. Khi đó trong tab **Logs** của Render sẽ có dòng "Thiếu biến môi trường: ...".

5. Bấm **Apply** / **Deploy Blueprint**. Chờ vài phút. Render kiểm tra file `render.yaml` ngay khi tạo Blueprint: nếu báo lỗi (ví dụ thiếu một mục của dịch vụ trang web tĩnh), đọc dòng lỗi, chép nguyên văn gửi cho người hỗ trợ kỹ thuật để sửa `render.yaml` rồi bấm thử lại.

Nếu tên `moc-thuan-api` hoặc `moc-thuan` đã có người dùng, Render gắn thêm đuôi ngẫu nhiên vào địa chỉ. Khi đó xem địa chỉ thật ở đầu trang mỗi dịch vụ, và nhớ dùng địa chỉ đó thay cho các ví dụ trong tài liệu này (kể cả file `.github/workflows/keepalive.yml` ở bước 10).

**Kiểm tra:** mở `https://moc-thuan-api.onrender.com/api/health` trên trình duyệt. Thấy chữ kiểu `{"ok":true}` là máy chủ chạy. Lần mở đầu có thể mất tới 1 phút vì máy chủ đang ngủ; chờ rồi làm mới trang.

**Kiểm tra địa chỉ IP của khách (làm một lần):** máy chủ chạy sau hệ thống của Render và giới hạn số đơn theo địa chỉ IP, nên cần chắc rằng nó thấy IP của từng khách chứ không phải một IP chung. Sau khi mở `/api/health` ở trên, vào Render → `moc-thuan-api` → **Logs**, tìm dòng bắt đầu bằng `[kiểm tra IP]`, dạng `req.ip=... | x-forwarded-for=...`. So với IP của bạn (tra bằng cách gõ "what is my ip" trên Google):
- `req.ip` **trùng IP của bạn** (hoặc bằng phần cuối của `x-forwarded-for`): đúng, không cần làm gì.
- `req.ip` là một địa chỉ lạ, **giống nhau cho mọi lần gọi** từ các máy khác nhau (ví dụ địa chỉ bắt đầu `10.` hay `172.`): cả cửa hàng bị tính chung một hạn mức, nhờ người hỗ trợ kỹ thuật chỉnh lại.

---

## Bước 4. TRƯỚC khi nhập dữ liệu: lưu hết bản nháp ở trang admin cũ

Làm bước này và bước 5 **trước khi gộp vào `main`**: trang admin cũ và file dữ liệu cũ chỉ còn nguyên khi `main` chưa bị thay đổi.

Trang quản trị **cũ** (trên GitHub Pages) giữ các chỉnh sửa chưa xuất file thành "bản nháp" ngay trong trình duyệt. Dữ liệu mới sẽ lấy từ file đã đăng trên GitHub, nên bản nháp chưa lưu sẽ bị mất.

1. Mở trang admin cũ trên GitHub Pages **bằng đúng trình duyệt và máy tính bạn từng sửa**.
2. Nếu có thay đổi chưa lưu, bấm **Lưu** (hoặc làm theo cách lưu mà trang đó hướng dẫn) cho tới khi không còn báo bản nháp.
3. Đợi khoảng 1-2 phút cho GitHub cập nhật.
4. **Ảnh và mô hình 3D mới:** nếu bạn có tải ảnh hoặc mô hình `.glb` mới lên bằng trang admin cũ, các file đó nằm ở thư mục `assets/img/products` và `assets/models` của kho cũ. Lệnh nhập ở bước 5 sẽ in cảnh báo liệt kê các sản phẩm đó. Khi gặp cảnh báo: chép hai thư mục `assets/img/products` và `assets/models` vào `public/assets/` (rồi đưa lên GitHub), hoặc tải lại các ảnh/mô hình đó qua trang admin mới. (Lúc làm hướng dẫn này, danh mục chưa có ảnh hay mô hình nào như vậy.)

**Kiểm tra:** mở trang web cũ, thấy sản phẩm và giá đúng như bạn muốn. Đó chính là dữ liệu sẽ được chuyển sang hệ thống mới.

---

## Bước 5. Chạy các lệnh nhập dữ liệu từ máy của bạn

Làm một lần. Dùng cửa sổ **PowerShell** trong VS Code (menu *Terminal → New Terminal*), đang ở thư mục dự án.

1. Cài thư viện (một lần): `npm install`
2. Tạo file `.env`: sao chép `.env.example` thành `.env` rồi điền giá trị thật (cùng các giá trị đã điền trên Render). File `.env` đã được chặn, **không bị đẩy lên GitHub**. Tối thiểu cần: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STORAGE_BUCKET=public-files`, và để chạy lệnh được thì các biến bắt buộc khác (`SITE_URL`, `API_PUBLIC_URL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SHOP_EMAIL`) cũng phải có giá trị.

   Cách khác không cần file `.env`: đặt biến ngay trong PowerShell (chỉ có tác dụng trong cửa sổ đó), ví dụ:
   ```powershell
   $env:DATABASE_URL="postgresql://postgres.xxxx:MATKHAU@aws-0-xxx.pooler.supabase.com:6543/postgres"
   $env:SUPABASE_URL="https://abcdxyz.supabase.co"
   $env:SUPABASE_SERVICE_KEY="khoa-service-role"
   $env:STORAGE_BUCKET="public-files"
   $env:SITE_URL="https://www.tenmien.vn"
   $env:API_PUBLIC_URL="https://moc-thuan-api.onrender.com"
   $env:SMTP_HOST="smtp-relay.brevo.com"
   $env:SMTP_USER="login-smtp-brevo"
   $env:SMTP_PASS="khoa-smtp-brevo"
   $env:SHOP_EMAIL="email-cua-hang@tenmien.vn"
   ```
3. **Tạo bảng trong database (migrate).** Việc này tự chạy mỗi lần máy chủ khởi động và cả khi chạy hai lệnh dưới đây, nên không có lệnh riêng. Nếu bước 3 ở trên đã Deploy thành công thì bảng đã có.
4. **Nhập 300 sản phẩm** từ trang cũ:
   ```powershell
   node server/scripts/import-catalog.js
   ```
   **Kiểm tra:** in ra `Đã nhập 300 sản phẩm và đưa catalog.js lên Storage.` (số có thể khác nếu bạn đã thêm hoặc bớt). Trong Supabase → Storage → `public-files` có file `catalog.js`. Nếu lệnh in thêm dòng **CẢNH BÁO** về ảnh/mô hình dùng đường dẫn tương đối: làm theo mục 4 của bước 4 (chép `assets/img/products` và `assets/models` vào `public/assets/`, hoặc tải lại qua trang admin mới). Lệnh tự thử địa chỉ cũ rồi địa chỉ mới (`public/`) nên chạy được cả trước và sau khi gộp.
5. **Tạo tài khoản quản trị** (thay email bằng email của bạn):
   ```powershell
   node server/scripts/create-admin.js ban@gmail.com
   ```
   Lệnh hỏi mật khẩu: gõ ít nhất 8 ký tự rồi nhấn Enter (khi gõ có thể không thấy hiện chữ nào là bình thường). **Kiểm tra:** in ra `Đã tạo tài khoản quản trị: ban@gmail.com`.

Ghi chú: nếu lệnh báo `Thiếu biến môi trường`, tên biến được in ngay sau đó; điền biến đó rồi chạy lại. Chạy lại `import-catalog.js` là an toàn (cập nhật theo mã sản phẩm, không nhân đôi).

---

## Bước 6. Điền `public/assets/js/config.js`

Mở file `public/assets/js/config.js` trong VS Code. Sửa dòng `return` thứ hai (dòng không dành cho localhost):

```js
return {apiBase:'https://moc-thuan-api.onrender.com', catalogUrl:'https://abcdxyz.supabase.co/storage/v1/object/public/public-files/catalog.js'};
```

- `apiBase`: địa chỉ máy chủ API (giống `API_PUBLIC_URL`). Nếu bạn gắn `api.tenmien.vn` ở bước 7 thì đổi thành `https://api.tenmien.vn`.
- `catalogUrl`: thay `abcdxyz` bằng phần đầu của `SUPABASE_URL`. Địa chỉ này cho phép khách xem sản phẩm mới ngay cả khi máy chủ đang ngủ.

Lưu file, rồi đưa lên GitHub **trên nhánh `feat/ban-hang`** (commit và push, nhờ người hỗ trợ nếu chưa quen). Render tự cập nhật trang web sau vài phút.

**Kiểm tra:** dán địa chỉ `catalogUrl` vào trình duyệt, thấy nội dung bắt đầu bằng `var CATALOG`.

---

## Bước 7. Gắn tên miền `www` và `api`

Làm ở Render và ở nơi bạn mua tên miền (nhà đăng ký như PA Vietnam, Mắt Bão, GoDaddy, Namecheap...).

1. Render → dịch vụ `moc-thuan` (trang web) → **Settings → Custom Domains → Add Custom Domain** → gõ `www.tenmien.vn`.
2. Render hiện giá trị **CNAME** cần tạo (thường trỏ về `moc-thuan.onrender.com`).
3. Vào trang quản lý DNS của nhà đăng ký tên miền, thêm bản ghi: loại **CNAME**, tên (Host) `www`, giá trị đúng như Render hiện. Lưu lại.
4. Quay lại Render, bấm **Verify**. DNS có thể mất từ vài phút tới vài giờ. Render tự cấp HTTPS (ổ khóa).
5. Lặp lại cho dịch vụ `moc-thuan-api` với tên `api.tenmien.vn` (CNAME tên `api`).
6. Sau khi hai tên miền chạy:
   - Cập nhật trên Render (tab **Environment** của `moc-thuan-api`): `SITE_URL` = `https://www.tenmien.vn`, `API_PUBLIC_URL` = `https://api.tenmien.vn`, `CORS_ORIGINS` = `https://www.tenmien.vn,https://moc-thuan.onrender.com`. Lưu: máy chủ tự khởi động lại.
   - Sửa `apiBase` trong `config.js` thành `https://api.tenmien.vn` (bước 6) và đưa lên GitHub (cùng nhánh đang dùng).

**Kiểm tra:** `https://www.tenmien.vn` mở được web; `https://api.tenmien.vn/api/health` trả `{"ok":true}`.

Không gắn tên miền riêng cũng được: dùng luôn địa chỉ `.onrender.com`.

---

## Bước 8. Kiểm tra toàn bộ bằng một đơn thử

1. Mở web (lần đầu có thể chậm do máy chủ ngủ). Bấm **Đăng ký**, tạo tài khoản khách thử bằng email khác với email quản trị.
2. Thêm một sản phẩm vào giỏ, điền thông tin, bấm đặt hàng. Nếu thấy "Đang gửi đơn… (có thể mất tới 1 phút)" thì cứ chờ, giỏ hàng chỉ xóa khi đơn đã được lưu.
3. **Kiểm tra email:** `SHOP_EMAIL` nhận thư báo đơn mới (xem cả thư rác/Spam lần đầu). Nếu không thấy, xem hàng "Email không tới" ở mục Khi có sự cố. Máy chủ chỉ chờ gửi thư tối đa khoảng 8 giây, nên dù email lỗi đơn vẫn lưu và khách vẫn thấy đặt xong.
4. Đăng nhập bằng tài khoản quản trị (bước 5), mở trang quản trị (`/admin.html`, hoặc mục **Quản trị** trên web). Thấy đơn vừa đặt.
5. Đổi trạng thái đơn; sửa giá một sản phẩm, lưu. Mở web ở cửa sổ ẩn danh: giá mới hiện (có thể chờ tới 1 phút).

Mọi bước đều đúng nghĩa là hệ thống chạy tốt.

---

## Bước 9. Gộp vào `main` và chuyển Render sang `main` (chỉ sau khi đã kiểm tra xong bước 8)

Đến đây web mới đã chạy ổn từ nhánh `feat/ban-hang`. Giờ mới gộp:

1. Trên GitHub, mở **Pull request** từ `feat/ban-hang` vào `main` rồi **Merge** (hoặc nhờ người hỗ trợ kỹ thuật). Sau khi gộp, trang GitHub Pages cũ sẽ **ngừng hiện** vì các file đã chuyển vào `public/`; việc này là chủ ý.
2. Chuyển Render sang theo dõi `main`: Render → **Blueprints** → chọn blueprint của dự án → **Settings** → đổi **Branch** thành `main`, lưu. Nếu không thấy, vào từng dịch vụ (`moc-thuan-api`, `moc-thuan`) → **Settings → Build & Deploy → Branch** và đổi thành `main`. Sau đó Render tự triển khai lại.
3. Tắt GitHub Pages: làm ở bước 11, sau vài ngày web mới chạy ổn.

**Kiểm tra:** Render hiện hai dịch vụ cùng nhánh `main` và trạng thái **Live**; mở lại web và `/api/health` vẫn bình thường.

---

## Bước 10. Giữ cho Supabase không bị tạm dừng (tự động)

Supabase miễn phí sẽ tạm dừng nếu lâu không có ai dùng. File `.github/workflows/keepalive.yml` (đã có sẵn) cho GitHub mỗi ngày gọi `https://moc-thuan-api.onrender.com/api/health` một lần; việc này cũng đánh thức máy chủ. GitHub chỉ chạy lịch tự động của nhánh mặc định, nên làm bước này **sau bước 9**.

1. Mở kho trên GitHub, tab **Actions**. Nếu GitHub hỏi, bấm bật Actions.
2. Chọn **Giữ dịch vụ thức** → **Run workflow** để chạy thử. Chạy tay như vậy là bình thường và không ảnh hưởng lịch tự động.

**Kiểm tra:** lượt chạy hiện dấu tích xanh. Nếu đỏ: mở lượt chạy xem lỗi; thường do địa chỉ máy chủ khác với địa chỉ trong file (sửa file cho đúng).

**Lưu ý quan trọng:** GitHub **tự tắt lịch chạy** của kho nếu khoảng 60 ngày không có hoạt động nào (không ai đưa mã mới lên). Cứ vài tuần nên mở tab **Actions** xem workflow **Giữ dịch vụ thức** còn chạy không. Nếu thấy dòng báo workflow đã bị tắt (disabled), bấm nút **Enable workflow**, rồi bấm **Run workflow** để chạy ngay.

---

## Bước 11. Dọn trang cũ (chỉ sau khi web mới chạy ổn vài ngày)

1. **Tắt GitHub Pages:** kho GitHub → **Settings → Pages → Unpublish site** (hoặc *Source: None*).
2. **Xóa mã truy cập GitHub đã tạo cho trang admin cũ:** GitHub → ảnh đại diện → **Settings → Developer settings → Personal access tokens** → tìm mã đã tạo cho trang quản trị cũ → **Delete**. Cũng xóa mã đã lưu trong trình duyệt nếu có (xóa dữ liệu trang của địa chỉ GitHub Pages cũ).

Sau bước này, trang admin cũ không còn, và chỉ còn trang quản trị mới đăng nhập bằng tài khoản.

---

## Khi nào máy chủ "ngủ" và cách xử lý

- Gói miễn phí của Render cho máy chủ ngủ sau khoảng 15 phút không có ai gọi. Lần gọi đầu sau đó **mất tới 1 phút**. Đây là bình thường.
- Web tự gọi "đánh thức" ngay khi khách mở trang; khách xem sản phẩm không bị ảnh hưởng vì danh sách nằm trên Supabase Storage.
- Muốn kiểm tra: mở `/api/health` của máy chủ, chờ rồi làm mới.
- Nếu gửi đơn báo lỗi nhiều lần: khách được hướng dẫn gọi số điện thoại cửa hàng; kiểm tra tab **Logs** của `moc-thuan-api` trên Render.

## Khi có sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| **Email không tới** | Kiểm tra thư rác. Kiểm tra `SMTP_HOST` = `smtp-relay.brevo.com`, `SMTP_PORT` = `2525` (cổng 587/465 và Gmail bị Render gói miễn phí chặn), `SMTP_USER` là **Login SMTP** của Brevo, `SMTP_PASS` là **SMTP key** (không phải mật khẩu tài khoản). `SMTP_FROM` phải là email **đã xác minh** trong Brevo (Senders). Kiểm tra `SHOP_EMAIL`. Xem tab **Logs** của `moc-thuan-api`: dòng "Không gửi được email ..." kèm lý do. Đơn vẫn được lưu và vẫn thấy trong trang quản trị dù email lỗi. |
| **Link trong email trỏ sai địa chỉ** | `SITE_URL` đang sai. Sửa trong tab Environment của `moc-thuan-api`. |
| **Web hiện sản phẩm cũ** | Kiểm tra `catalogUrl` trong `config.js` đã điền đúng (bước 6) và đã đưa lên GitHub. Mở địa chỉ đó trong trình duyệt xem file `catalog.js` có mới không. Kiểm tra Supabase → Storage → bucket `public-files` là **Public**. Xóa bộ nhớ đệm trình duyệt (Ctrl+F5). |
| **Đăng nhập/đặt hàng báo lỗi kết nối** | Máy chủ đang ngủ (chờ 1 phút thử lại), hoặc `CORS_ORIGINS` trống/thiếu địa chỉ trang web (khi trống, tab **Logs** có dòng "CẢNH BÁO: CORS_ORIGINS đang trống"), hoặc `apiBase` trong `config.js` sai. |
| **Không đăng nhập được trang quản trị** | Chạy lại `node server/scripts/create-admin.js ban@gmail.com` với mật khẩu mới: lệnh này đặt lại mật khẩu và nâng tài khoản lên quản trị. (Phải có biến môi trường của Supabase như bước 5.) |
| **Máy chủ không lên, Render báo Failed** | Tab **Logs**: dòng "Thiếu biến môi trường: ..." cho biết biến nào chưa điền. Nếu lỗi kết nối database: kiểm tra `DATABASE_URL` (đã thay mật khẩu, dùng địa chỉ pooler). |
| **Supabase báo dự án bị tạm dừng** | Vào Supabase bấm **Restore project**, rồi kiểm tra bước 10 (lịch tự gọi hằng ngày) đang chạy. |

Không bao giờ dán `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, `SMTP_PASS` (khóa SMTP) vào tin nhắn, ảnh chụp màn hình hoặc file được đưa lên GitHub. Nếu lỡ lộ: tạo lại khóa/mật khẩu ở Supabase hoặc Brevo và cập nhật trên Render.
