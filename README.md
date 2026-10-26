# Mộc Thuận Nội Thất — web bán nội thất

Web bán hàng có tài khoản khách, giỏ hàng, đặt đơn, email báo đơn mới và trang quản trị (sản phẩm, giá, đơn hàng, ảnh).

- **Giao diện** (`public/`): web tĩnh, chạy trên Render Static Site.
- **Máy chủ API** (`server/`): Node.js + Express, chạy trên Render Web Service (gói miễn phí, tự ngủ khi vắng).
- **Dữ liệu**: Supabase (Postgres + Storage). Email đơn hàng gửi qua Gmail SMTP.

Mỗi lần quản trị lưu sản phẩm, máy chủ sinh lại file `catalog.js` và đưa lên Supabase Storage; khách xem sản phẩm từ đó nên không phụ thuộc máy chủ đang ngủ hay thức.

Quy tắc của dự án: giao diện toàn tiếng Việt; số liệu, giá, số điện thoại còn là dữ liệu mẫu thì phải ghi nhãn mẫu; sản phẩm chưa có ảnh thật dùng ảnh dựng 3D và ghi rõ **"Ảnh dựng 3D"**; giao diện phải dùng được ở màn hình hẹp 390px.

## Cấu trúc thư mục

```
moc-thuan/
├── public/                 Giao diện (thư mục được đưa lên Render Static Site)
│   ├── index.html          Trang bán hàng
│   ├── admin.html          Trang quản trị (đăng nhập bằng tài khoản quản trị)
│   └── assets/
│       ├── css/            style.css, admin.css
│       ├── img/products/   Ảnh sản phẩm đi kèm
│       └── js/
│           ├── config.js   Địa chỉ máy chủ API và file catalog.js (xem docs/trien-khai.md)
│           ├── catalog.js  Danh sách sản phẩm đi kèm (dự phòng)
│           ├── shared.js, data.js   Phần dùng chung, vật liệu, dáng, danh mục, tính giá
│           ├── model3d.js  Dựng mô hình 3D, kích thước, trình xem 3D
│           ├── api.js, account.js   Gọi máy chủ, đăng ký/đăng nhập
│           ├── app.js      Giỏ hàng, trang sản phẩm, đặt hàng
│           └── admin.js, admin-orders.js   Trang quản trị: sản phẩm, đơn hàng
├── server/                 Máy chủ API (Express)
│   ├── index.js            Điểm khởi động, tự chạy migrate (tạo/cập nhật bảng)
│   ├── config.js           Đọc biến môi trường, báo lỗi nếu thiếu biến bắt buộc
│   ├── load-env.js         Đọc file .env khi chạy trên máy
│   ├── app.js, auth.js     Ứng dụng Express, đăng nhập
│   ├── db/  routes/  services/
│   └── scripts/            import-catalog.js, create-admin.js
├── tests/                  Kiểm thử máy chủ (npm test) và giao diện (npm run test:ui)
├── docs/                   trien-khai.md (hướng dẫn triển khai), spec và kế hoạch
├── render.yaml             Cấu hình hai dịch vụ trên Render
├── .github/workflows/keepalive.yml   Mỗi ngày gọi /api/health để giữ Supabase không bị tạm dừng
├── .env.example            Mẫu biến môi trường
└── package.json
```

## Chạy trên máy

1. Cài Node.js 18 trở lên, rồi `npm install`.
2. Sao chép `.env.example` thành `.env` và điền giá trị thật (cần dự án Supabase và Gmail; xem `docs/trien-khai.md`). Không commit `.env`. Biến bắt buộc: `DATABASE_URL`, `SITE_URL`, `API_PUBLIC_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SHOP_EMAIL`; thiếu một biến thì máy chủ không khởi động. Chạy local có thể để `CORS_ORIGINS` trống (cho phép localhost).
3. `npm run dev` chạy máy chủ ở `http://localhost:3000` (tự tạo bảng khi khởi động).
4. Mở thư mục dự án bằng VS Code, cài tiện ích **Live Server**, chuột phải `public/index.html` → *Open with Live Server*. Khi mở từ localhost, web tự gọi máy chủ `http://localhost:3000` và dùng `catalog.js` trong `public/`.
5. Lần đầu: `node server/scripts/import-catalog.js` để nhập sản phẩm, `node server/scripts/create-admin.js <email>` để tạo tài khoản quản trị.

Mở `index.html` bằng cách nhấp đúp (file://) không dùng được các chức năng gọi máy chủ và không tải được file `.glb`; hãy dùng Live Server.

## Kiểm thử

- `npm test`: kiểm thử máy chủ và phần dùng chung (dùng cơ sở dữ liệu giả lập, không cần mạng hay Supabase).
- `npm run test:ui`: kiểm thử giao diện bằng trình duyệt thật; **cần cài Microsoft Edge**.

## Triển khai

Xem **[docs/trien-khai.md](docs/trien-khai.md)**: hướng dẫn từng bước cho người không rành lập trình (Supabase, Gmail, Render, tên miền, kiểm tra đơn thử, xử lý sự cố).

## Các việc hay làm

- **Sửa giá, thêm/ẩn/xóa sản phẩm, ảnh, xem và đổi trạng thái đơn:** vào `/admin.html`, đăng nhập bằng tài khoản quản trị. Lưu xong khách thấy sau tối đa khoảng 1 phút (bộ nhớ đệm).
- **Mô hình 3D cho sản phẩm mới:** chọn **dáng** (khóa trong `K` của `data.js`) và **kiểu dáng** trong trang quản trị, mô hình tự dựng. Dáng hoàn toàn mới thì thêm khóa vào `K` và bộ dựng vào `GEN` trong `model3d.js`.
- **Sửa danh mục:** biến `CATS` trong `data.js`; mỗi nhóm con là `['Tên danh mục', 'dáng']`. Đổi tên danh mục con làm đổi mã `sub` của sản phẩm, cần chọn lại danh mục trong trang quản trị.
- **Dáng 3D và giá gợi ý:** biến `K` trong `data.js` (`W`, `D`, `H`, `p`, `pcm`, `styles`).
- **Đổi tên, số điện thoại:** tìm "Mộc Thuận" và số điện thoại trong `public/index.html` và `public/assets/js/app.js`.
- **Đổi màu thương hiệu:** khối `:root` đầu file `public/assets/css/style.css`.
