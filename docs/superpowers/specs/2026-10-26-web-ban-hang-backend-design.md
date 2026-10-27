# Thiết kế: Mộc Thuận thành web bán hàng có máy chủ

Ngày: 2026-10-26 · Trạng thái: đã duyệt (2026-10-26)

## 1. Ý định và lý do

Mộc Thuận hiện là web tĩnh. Danh sách sản phẩm nằm trong file `assets/js/catalog.js`. Trang admin lưu bằng cách ghi file đó lên GitHub, nên mỗi máy phải dán một mã truy cập GitHub. Form đặt hàng chưa gửi đi đâu.

Chủ dự án muốn một **web bán hàng thực thụ**, giống các web họ từng làm:
- bấm **Lưu** ở trang quản trị thì **code phía máy chủ** xử lý và ghi vào database;
- không phải dán mã truy cập, không dính tới git;
- khách đặt hàng thật, cửa hàng nhận được đơn.

## 2. Mục tiêu

1. **Đặt hàng không cần tài khoản.**
   - Khách điền họ tên, số điện thoại, địa chỉ, ghi chú, cách trả tiền (chuyển khoản hoặc trả khi nhận hàng), rồi gửi đơn.
   - Đơn được lưu vào database ở trạng thái **Mới**.
   - Web báo khách rằng cửa hàng sẽ gọi lại xác nhận. Không ghi "đặt hàng thành công".
2. **Email báo đơn mới** gửi tới hộp thư cửa hàng. Thư ghi:
   - tên khách, số điện thoại, địa chỉ;
   - các món (kích thước, chất liệu, màu, số lượng, giá);
   - tổng tiền, cách trả tiền, ghi chú;
   - đường dẫn mở thẳng đơn đó trong trang quản trị.
3. **Tài khoản**: có hai vai trò, `admin` (cửa hàng) và `customer` (khách).
   - Ở đầu trang có nút **Đăng nhập / Đăng ký**, đăng nhập bằng email + mật khẩu.
   - Có "Quên mật khẩu": gửi đường dẫn đặt lại mật khẩu qua email.
   - Tài khoản admin thấy thêm mục **Quản trị** ở đầu trang. Tài khoản khách không thấy.
   - Máy chủ kiểm tra quyền ở **mọi** API quản trị; giấu đường dẫn không được coi là bảo mật.
   - Không có cách tự đăng ký làm admin. Tài khoản admin đầu tiên tạo bằng một lệnh lúc cài đặt.
4. **Tài khoản khách** (không bắt buộc):
   - đặt hàng khi đã đăng nhập thì tự điền sẵn tên, số điện thoại, địa chỉ;
   - đơn được gắn vào tài khoản;
   - có trang **Đơn của tôi**: danh sách đơn kèm trạng thái và chi tiết.
5. **Quản trị sản phẩm**: giữ đủ chức năng của trang admin hiện có.
   - Sửa, thêm, nhân bản, xóa sản phẩm; ẩn hoặc hiện ("Đang bán").
   - Bảng giá theo chiều dài, giảm giá, mẫu mới, thứ tự hiển thị.
   - Chọn dáng và kiểu 3D, nhập kích thước sâu và cao.
   - Màu mặc định.
   - Ảnh thực tế và mô hình `.glb` riêng (kích thước, hướng xoay, kích thước chi tiết đo trên mô hình).
   - Đổi giá hàng loạt, hệ số chất liệu.
   - Bấm **Lưu** là ghi vào database qua API.
6. **Quản trị đơn hàng**:
   - Danh sách đơn có đếm số đơn **Mới**, lọc theo trạng thái, tìm theo tên, số điện thoại, mã đơn.
   - Xem chi tiết đơn.
   - Đổi trạng thái theo vòng: Mới → Đã xác nhận → Đang làm → Đã giao → Hoàn tất, hoặc Đã hủy.
   - Có ghi chú nội bộ.
   - **Sửa nội dung đơn** sau khi gọi khách: giá, số lượng, món, phí hoặc giảm giá, thông tin khách. Xem mục 7.
   - Lưu lịch sử đổi trạng thái và sửa đơn: ai làm, lúc nào.
7. **Đơn giữ giá tại thời điểm đặt**. Mỗi món lưu lại:
   - tên, mã, kích thước, chất liệu, màu;
   - đơn giá, số lượng.
   Đổi giá sản phẩm sau này không làm đổi đơn cũ.
8. **Giá do máy chủ tính lại** khi nhận đơn, không tin giá do trình duyệt gửi lên.
9. **Chống đơn rác** mức đơn giản:
   - một ô bẫy ẩn (honeypot);
   - giới hạn số lần gửi đơn và số lần đăng nhập theo địa chỉ IP;
   - kiểm tra định dạng số điện thoại Việt Nam.
10. **Chuyển dữ liệu**: đưa 300 sản phẩm và hệ số chất liệu trong `catalog.js` hiện tại vào database. Giữ nguyên mã `MA…` và số `id` để đường dẫn `#p1001` vẫn đúng.

## 3. Không làm (lần này)

- Thanh toán online: thẻ, MoMo, VNPay, QR.
- Báo đơn qua Zalo hoặc Telegram. Có thể thêm sau.
- Quản lý tồn kho, phí giao hàng tự tính, mã giảm giá.
- Nhiều cấp nhân viên. Chỉ có `admin` và `customer`.
- Viết lại giao diện bằng framework.

## 4. Những điều tuyệt đối tránh

Làm đúng kỹ thuật nhưng vẫn coi là hỏng nếu:
- **Mất đơn.** Đơn phải lưu vào database trước. Gửi email lỗi thì đơn vẫn còn và vẫn hiện trong trang quản trị. Email chỉ là báo thêm.
- **Người không phải admin** sửa được sản phẩm hoặc xem được đơn của người khác.
- Khách xem được đơn của khách khác.
- Mất hoặc làm hỏng phần 3D, giao diện, cách chọn kích thước và màu đã được chủ dự án duyệt. Ví dụ quy ước kích thước theo góc nhìn, bàn hộc dây khe vát.
- Báo khách "đặt hàng thành công" hoặc gì khác ngoài "cửa hàng sẽ gọi lại xác nhận".
- Trang trắng hoặc không xem được sản phẩm khi máy chủ đang ngủ. Trên gói miễn phí, Render cho máy chủ ngủ sau khoảng 15 phút không có ai vào và mất 30–60 giây để thức dậy. Xem phần "Chạy trên gói miễn phí".
- **Mất giỏ hàng** vì máy chủ chậm khi gửi đơn.

## 5. Ràng buộc

- Giữ các quy ước trong ghi chú dự án:
  - giao diện tiếng Việt;
  - three.js cố định bản **r128**, JS thuần dùng biến toàn cục;
  - chạy tốt ở bề rộng 390px, không cuộn ngang;
  - ảnh dựng 3D luôn gắn nhãn "Ảnh dựng 3D";
  - dữ liệu mẫu phải ghi rõ là mẫu;
  - không bịa đánh giá của khách.
- Máy chủ chạy trên **Render Web Service**. Ổ đĩa của Render bị xóa mỗi lần deploy hoặc khởi động lại, nên không được ghi dữ liệu hay file tải lên vào ổ đĩa.
- Database và kho file dùng **Supabase**: Postgres cho dữ liệu, Storage cho ảnh và `.glb`.
- Mật khẩu, khóa bí mật, thông tin SMTP chỉ nằm trong **biến môi trường** của Render, không bao giờ nằm trong kho git. Kho git đang để Public.
- Máy của chủ dự án có Node 18.

## 6. Các cách đã cân nhắc

| Cách | Ưu | Nhược |
|---|---|---|
| **A. Máy chủ Node.js (Express) trên Render + Supabase**, **đã chọn** | Đúng ý chủ dự án: code máy chủ xử lý nút Lưu và đơn hàng. Giữ được giao diện và phần 3D. Mô hình quen thuộc, dễ sửa. | Render miễn phí bị ngủ. Chủ dự án chọn **miễn phí**, nên giao diện và dữ liệu sản phẩm phải đặt ở chỗ không ngủ (xem mục 7). |
| B. Web tĩnh + Supabase, không tự viết máy chủ | Miễn phí, không bị ngủ. | Logic nằm trong các quy tắc của Supabase, khó theo dõi. Gửi email cần thêm hàm riêng. |
| C. Viết lại bằng Next.js trên Vercel | Một bộ code duy nhất. | Phải viết lại giao diện đã duyệt, tốn công mà không thêm giá trị. |

Chủ dự án chọn **A**.

## 7. Phần cách làm đã quyết

**Chạy trên gói miễn phí: chia hai phần** (chủ dự án chọn bản miễn phí)
- **Giao diện** chạy trên **Render Static Site** (không bao giờ ngủ, miễn phí), nằm trong thư mục `public/`: `index.html`, `admin.html`, `assets/`. Mỗi lần push, Render tự deploy lại.
- **Máy chủ API** chạy trên **Render Web Service** miễn phí, nằm trong thư mục `server/`. Máy chủ có thể ngủ; chỉ đặt hàng, đăng nhập và quản trị cần gọi tới nó.
- Hai phần ở hai địa chỉ khác nhau. Khi gắn tên miền thì dùng ví dụ `www.<tên-miền>` cho giao diện và `api.<tên-miền>` cho máy chủ.
- `package.json` ở thư mục gốc. Máy chủ chỉ trả lời các yêu cầu tới `/api/...`, có CORS chỉ cho phép địa chỉ của giao diện.

**Dữ liệu sản phẩm cho trang web: không phụ thuộc máy chủ đang thức**
- Mỗi lần admin lưu sản phẩm hoặc hệ số chất liệu, máy chủ sinh lại file `catalog.js` **đúng định dạng hiện tại** (`var CATALOG = {...}`, đã bỏ sản phẩm `hidden`) và đưa lên **Supabase Storage** dưới dạng file công khai.
- Trang web nạp `catalog.js` từ đó, kèm `?v=<phút>` để không dùng bản cũ.
- Nhờ vậy, khách xem sản phẩm ngay cả khi máy chủ đang ngủ, và `data.js`, `model3d.js`, `app.js` gần như không phải đổi.
- Trang admin lấy danh sách đầy đủ, gồm cả sản phẩm ẩn, qua API (chỉ admin gọi được).
- Dự phòng: nếu không tải được `catalog.js` từ Supabase, trang dùng bản `catalog.js` nằm trong `public/` (bản lúc deploy gần nhất) và vẫn hiển thị được.

**Khi máy chủ đang ngủ**
- Vừa mở trang, web gửi ngay một yêu cầu "đánh thức" tới máy chủ (không chờ kết quả). Thường khi khách điền xong form đặt hàng thì máy chủ đã thức.
- Gửi đơn mà máy chủ còn đang khởi động thì nút hiện "Đang gửi đơn… (có thể mất tới 1 phút)". Web tự thử lại, **không xóa giỏ hàng** cho tới khi máy chủ xác nhận đã lưu đơn. Thất bại hẳn thì báo khách gọi số **0386115316**.
- Nút Đăng nhập luôn hiện ngay. Trạng thái đã đăng nhập và mục **Quản trị** hiện khi máy chủ trả lời. Trang admin hiện "Đang kết nối máy chủ…" trong lúc chờ.
- **Giữ cho dự án Supabase không bị tạm dừng:** dùng một lịch chạy miễn phí trên GitHub Actions, gọi `/api/health` mỗi ngày một lần. Yêu cầu này có truy vấn database.

**Database (Postgres)**
- `products`: các trường như mỗi dòng trong `catalog.js` hiện nay:
  - `id`, `code`, `sub`, `kind`, `style`, `name`;
  - `prices`, `W`, `D`, `H`, `wood`, `frame`, `uph`;
  - `sale`, `isNew`, `order`, `flag`, `hidden`;
  - `photos`, `model`;
  - cộng thêm `updated_at`.
- `settings`: hệ số chất liệu `woodK`.
- `users`: email, mật khẩu đã băm, vai trò, họ tên, số điện thoại, địa chỉ.
- `orders`:
  - mã đơn;
  - trạng thái;
  - thông tin khách;
  - cách trả tiền;
  - `user_id` (có thể trống);
  - danh sách món đã chụp giá;
  - tổng tiền;
  - ghi chú khách, ghi chú nội bộ;
  - thời gian tạo và cập nhật.
- `order_events`: lịch sử đổi trạng thái và sửa đơn.
- `sessions`: bản băm mã phiên, người dùng, hạn dùng.
- `password_resets`.

**Lưu sản phẩm**
- Trang admin gọi API theo **từng sản phẩm**: tạo, sửa, xóa.
- Thêm một API đổi giá hàng loạt và một API lưu hệ số chất liệu.
- Phần ghi lên GitHub, lưu vào thư mục, xuất và nhập file, gộp bản nháp trong `admin.js` sẽ bị **thay** bằng các lời gọi API này.
- Giao diện trang admin giữ nguyên.

**Ảnh và mô hình**
- Admin tải file lên máy chủ, máy chủ đưa lên Supabase Storage, rồi lưu đường dẫn công khai vào sản phẩm.
- Giới hạn loại file (ảnh, `.glb`) và dung lượng.

**Đăng nhập**
- Mật khẩu băm bằng bcrypt.
- Giao diện và máy chủ ở hai địa chỉ khác nhau. Khi chưa có tên miền thì cả hai cùng nằm dưới `onrender.com`, và trình duyệt (nhất là Safari) chặn cookie gửi sang trang khác. Vì vậy phiên đăng nhập dùng **mã phiên có hạn** (ví dụ 30 ngày):
  - máy chủ cấp mã khi đăng nhập;
  - trình duyệt lưu mã và gửi kèm trong header `Authorization`;
  - máy chủ lưu bản băm của mã để có thể thu hồi khi đăng xuất hoặc đổi mật khẩu.
- Cách này không cần cookie nên cũng không bị CSRF. Bù lại phải giữ chặt việc chống XSS: mọi dữ liệu đưa vào HTML đều đi qua `esc()`, kể cả trường số.

**Email**
- Gửi qua SMTP: Gmail có mật khẩu ứng dụng, hoặc dịch vụ gửi mail. Cấu hình bằng biến môi trường.
- Lỗi gửi mail được ghi log và không làm hỏng việc lưu đơn.

**Tính giá**
- Đưa các hàm tính giá thuần (`priceAt`, `priceOf`, `finalPrice`, hệ số chất liệu) ra một file dùng chung cho cả trình duyệt và máy chủ.
- Máy chủ tính lại tổng tiền khi nhận đơn.
- Món "đặt kích thước riêng" được ghi rõ là giá ước tính.

**Tài khoản admin đầu tiên**: tạo bằng lệnh `npm run create-admin`.

**GitHub Pages**: ngừng dùng sau khi web trên Render chạy ổn. Tên miền riêng trỏ sang Render.

**Số điện thoại cửa hàng**: thay `0900 000 000` bằng **0386 115 316** ở mọi chỗ trong đầu trang, chân trang và thông báo. Dòng chân trang "dữ liệu minh họa" sửa lại để không còn nhắc số điện thoại. Sản phẩm và giá vẫn là mẫu, vẫn ghi rõ là mẫu cho tới khi có dữ liệu thật. Đơn hàng là đơn thật, cửa hàng sẽ gọi lại.

**Sửa nội dung đơn** (chủ dự án cần chức năng này)
- Sau khi gọi khách, admin sửa được:
  - từng món: đơn giá (báo lại giá kích thước riêng), số lượng, xóa món;
  - thêm một dòng tùy ý, ví dụ phí giao hàng, phụ thu hoặc giảm giá, có tên và số tiền (số âm là giảm);
  - thông tin khách: tên, số điện thoại, địa chỉ;
  - cách trả tiền.
- Tổng tiền tính lại từ các dòng.
- Mỗi lần lưu ghi vào `order_events`: loại sự kiện **sửa đơn**, ai sửa, lúc nào, nội dung trước và sau.
- Khách thấy giá đã chốt trong "Đơn của tôi". Món đã báo lại giá không còn chữ "giá ước tính".
- Admin sửa được **mọi đơn**, kể cả đơn của khách có tài khoản. Những gì admin sửa (món, giá, phí, thông tin giao hàng, trạng thái) hiện ngay trong "Đơn của tôi" của khách đó.
- Khách **chỉ xem** đơn của mình, không tự sửa được; muốn đổi thì gọi cửa hàng. Khách không thấy ghi chú nội bộ và lịch sử sửa đơn.
- Sửa đơn không làm đổi thông tin hồ sơ của tài khoản khách (tên, số điện thoại, địa chỉ lưu sẵn); hai thứ này tách riêng.
- Nguyên tắc "giữ giá lúc đặt" vẫn áp dụng với **thay đổi giá sản phẩm**; chỉ admin sửa tay mới đổi được giá trong đơn.

## 8. Những việc giao cho người xây

- Thư viện cụ thể:
  - định dạng mã phiên (chuỗi ngẫu nhiên lưu bản băm, hay JWT có thể thu hồi);
  - gửi mail;
  - truy vấn database;
  - giới hạn tần suất.
- Cách chạy và cách viết test, ví dụ có thể dùng Postgres giả lập trong bộ nhớ khi test.
- Bố cục chi tiết của các trang mới:
  - đăng nhập, đăng ký, quên mật khẩu;
  - Đơn của tôi;
  - tab Đơn hàng trong trang quản trị.

  Theo đúng phong cách và các token màu hiện có, chạy tốt ở 390px.
- Định dạng mã đơn, ví dụ `DH2610-0001`.

## 9. Quyết định do người viết thiết kế tự đặt (chủ dự án kiểm tra lại)

- **Không** tự gắn đơn đặt khi chưa đăng nhập vào tài khoản có cùng số điện thoại, như đã đề xuất lúc trước. Lý do: số điện thoại không được xác minh, nên ai đăng ký bằng số của người khác sẽ xem được tên và địa chỉ của họ. Chỉ đơn đặt **khi đã đăng nhập** mới được gắn vào tài khoản.
- Giỏ hàng vẫn lưu trong trình duyệt như hiện nay; không lưu giỏ lên máy chủ.
- Phần "Lưu lên GitHub" và các bản sửa chưa push của nó sẽ bị thay hẳn. Web trên GitHub Pages giữ nguyên tới khi chuyển xong.
- **Nguồn dữ liệu khi chuyển sang database:**
  - Lấy file `assets/js/catalog.js` mới nhất trên nhánh `main` của kho GitHub, tại thời điểm chuyển. Không lấy bản trên máy, vì trang admin hiện lưu thẳng lên GitHub nên bản trên máy có thể đã cũ.
  - Trước khi chuyển, chủ dự án mở trang admin và bấm **Lưu** để không còn bản nháp nằm trong trình duyệt. Sau khi chuyển, trang admin cũ ngừng dùng.
- **Đổi trạng thái đơn:**
  - Admin được chọn **bất kỳ trạng thái nào**, kể cả lùi lại hay mở lại đơn đã hủy, để sửa nhầm dễ dàng.
  - Giao diện gợi ý sẵn bước tiếp theo.
  - Mọi lần đổi đều ghi vào `order_events` (ai đổi, lúc nào, từ trạng thái nào sang trạng thái nào).
  - Đổi sang **Đã hủy** hoặc từ **Hoàn tất** sang trạng thái khác phải bấm xác nhận.
- **Chuyển khoản:** web và email gửi khách không hiện số tài khoản ngân hàng; cửa hàng báo khi gọi lại. Có thể thêm phần cài đặt số tài khoản sau.
