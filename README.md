# Mộc Thuận Nội Thất — web bán nội thất (bản mẫu)

Web tĩnh chạy hoàn toàn trên trình duyệt, chưa cần máy chủ hay cơ sở dữ liệu.
Sản phẩm, giá, số điện thoại hiện là dữ liệu mẫu.

## Chạy thử

- Cách nhanh: nhấp đúp `index.html` để mở bằng Chrome hoặc Edge.
- Cách nên dùng khi sửa code: mở thư mục bằng VS Code, cài tiện ích **Live Server**, chuột phải `index.html` → *Open with Live Server*. Trang tự tải lại mỗi lần lưu file.
- Cần có mạng để tải thư viện 3D (three.js r128) và phông chữ Google Fonts.

## Cấu trúc thư mục

```
moc-thuan/
├── index.html              Khung trang: header, menu danh mục, footer, nạp CSS/JS
├── admin.html              Trang quản lý sản phẩm và giá (dành cho cửa hàng, không gắn link trên web)
├── README.md
└── assets/
    ├── css/style.css       Toàn bộ giao diện (màu sáng/tối, bố cục máy tính và điện thoại)
    ├── css/admin.css       Giao diện riêng của trang quản lý
    ├── img/products/       Ảnh thực tế của sản phẩm
    └── js/
        ├── catalog.js      Danh sách sản phẩm, bảng giá, ảnh, hệ số chất liệu (do admin.html xuất ra)
        ├── data.js         Vật liệu, các dáng sản phẩm (K), cây danh mục, đọc catalog.js, tính giá
        ├── model3d.js      Dựng mô hình 3D, kích thước theo góc nhìn, ảnh dựng 3D, trình xem 3D
        ├── app.js          Giỏ hàng, menu, trang chủ, trang danh mục, trang sản phẩm, điều hướng
        └── admin.js        Trang quản lý: sửa, thêm, xóa sản phẩm, đổi giá, xuất file
```

Thứ tự nạp script phải giữ nguyên:
- `index.html`: three.js → catalog.js → data.js → model3d.js → app.js
- `admin.html`: three.js → catalog.js → data.js → model3d.js → admin.js

## Các việc hay làm

### Sửa giá, thêm, ẩn hoặc xóa sản phẩm: dùng `admin.html`
**Chrome hoặc Edge trên máy tính: lưu thẳng**
1. Mở `admin.html` (nên mở bằng Live Server).
2. Bấm **Lưu thẳng vào thư mục…**, chọn thư mục `moc-thuan`, bấm **Cho phép**. Lần sau mở trang chỉ cần bấm **Cho phép lưu vào thư mục…**.
3. Từ đó mỗi lần bấm Lưu, Xóa, đổi giá hàng loạt, sửa hệ số chất liệu: `assets/js/catalog.js` được ghi ngay. Ảnh và file `.glb` chọn từ máy được tự chép vào `assets/img/products/` và `assets/models/`.
4. Muốn khách thấy: đưa thư mục lên hosting như mọi lần.

Lần lưu đầu tiên mỗi ngày, bản cũ của `catalog.js` được cất vào `sao-luu/catalog-<ngày>.js`. Thư mục `sao-luu/` không cần đưa lên hosting.

**Trình duyệt khác (Firefox, Safari, điện thoại): bản nháp + xuất file**
1. Sửa trong trang. Thay đổi giữ thành **bản nháp trong trình duyệt**, khách chưa thấy.
2. Bấm **Xem thử trên web** để xem web với bản nháp (`index.html?xem-thu`).
3. Bấm **Xuất file catalog.js**, chép đè file vừa tải vào `assets/js/catalog.js`, rồi đưa thư mục lên hosting.

Mỗi sản phẩm có bảng **chiều dài → giá** (giá với chất liệu hệ số 1). Kích thước riêng khách tự nhập được ước tính theo bảng này.
Giá theo chất liệu nhân với hệ số ở tab "Hệ số chất liệu".

### Mô hình 3D cho sản phẩm mới
Không cần vẽ. Ở trang quản lý, chọn **dáng** (một khóa trong biến `K` của `data.js`) và **kiểu dáng** (`styles`), nhập sâu/cao nếu khác mặc định; mô hình tự dựng.
Tab "Dáng 3D có sẵn" cho xem hình mọi dáng. Muốn có dáng hoàn toàn mới (ví dụ giường tầng) thì thêm khóa vào `K` và một bộ dựng vào `GEN` trong `model3d.js`.

### Mô hình 3D riêng (file .glb tự làm)
Dùng khi muốn khách xem đúng mô hình của sản phẩm thật thay cho dáng dựng sẵn.
1. Tạo mô hình bằng app quét 3D trên điện thoại (Polycam, RealityScan, Scaniverse…) hoặc phần mềm 3D (SketchUp, Blender), xuất file **.glb**. Nên giữ dưới khoảng 10 MB.
2. Chép file vào `assets/models/`, ví dụ `assets/models/MA1001.glb`.
3. Ở trang quản lý, mở sản phẩm, mục **Mô hình 3D riêng** → *Chọn file .glb…*
4. Nhập **dài thật** (cm). Chỉ nhập dài thì mô hình co đều; nhập thêm sâu và cao thì co theo từng chiều.
5. Dùng *Xoay ngang 90°* / *Lật dựng 90°* cho đến khi mặt trước quay về phía mình và chân chạm sàn.
6. **Kích thước chi tiết:** bấm *Đo trên mô hình*, bấm điểm đầu và điểm cuối trên mô hình, rồi sửa chữ cho đúng số đo thật (ví dụ "để chân 90 cm") và chọn góc nhìn để hiện (mặt trước, hai bên, nhìn từ trên, mặt sau).
7. Lưu, xem thử, xuất file `catalog.js` như mọi lần. Nhớ đưa cả thư mục `assets/models/` lên hosting.

Lưu ý:
- Mở `index.html` bằng cách nhấp đúp (file://) thì trình duyệt **không cho tải file .glb**; web tự quay về mô hình dựng sẵn. Dùng Live Server hoặc hosting.
- Mô hình riêng có màu và hình cố định. Khách vẫn chọn kích thước và màu để tính giá; dưới mô hình có ghi chú mô hình là mẫu thật dài bao nhiêu cm.
- Web tự hiện dài, sâu, cao tổng theo kích thước thật đã nhập. Các kích thước chi tiết tự nhập cũng hiện trong bảng thông số.

### Thêm ảnh thực tế cho sản phẩm
1. Chép ảnh vào `assets/img/products/`, đặt tên theo mã sản phẩm: `MA1001-1.jpg`, `MA1001-2.jpg`…
2. Ở trang quản lý, mở sản phẩm, mục "Ảnh thực tế" → **Chọn ảnh trong máy…**, rồi lưu và xuất file.
   Ảnh đầu tiên là ảnh đại diện trên thẻ sản phẩm. Sản phẩm chưa có ảnh tự dùng ảnh dựng 3D và ghi rõ "Ảnh dựng 3D".

Mã sản phẩm hiện ở trang chi tiết, dòng "Mã MA…".

### Sửa danh mục
Trong `data.js`, biến `CATS`: mỗi nhóm lớn có `groups`, mỗi nhóm con là `['Tên danh mục', 'dáng']`.
`dáng` là một khóa trong biến `K` (ví dụ `desk`, `chairOffice`, `sofa`, `wardrobe`), là dáng 3D mặc định khi thêm sản phẩm vào danh mục đó.
Đổi tên danh mục con làm đổi mã danh mục (`sub` trong `catalog.js`); sản phẩm trỏ tới mã cũ sẽ không hiện trên web cho tới khi chọn lại danh mục ở trang quản lý.

### Dáng 3D và giá gợi ý
Trong `data.js`, biến `K`:
- `name`: tên dáng hiện ở trang quản lý; `gen`: bộ dựng 3D
- `W`: chiều dài gợi ý (cm); `D` sâu; `H` cao; `seat` chiều cao ngồi
- `p`, `pcm`: giá gợi ý khi thêm sản phẩm mới (giá thật nằm trong `catalog.js`)
- `styles`: các kiểu dáng (tên kiểu dáng điều khiển hình 3D, ví dụ "chân chữ X", "có hộc 3 ngăn")

### Đổi tên, số điện thoại
Tìm "Mộc Thuận" và "0900 000 000" trong `index.html` và `assets/js/app.js`.

### Đổi màu thương hiệu
Đầu file `style.css`, khối `:root` (giao diện sáng) và hai khối giao diện tối ngay bên dưới.

## Đường dẫn trang

| Trang | Đường dẫn |
|---|---|
| Trang chủ | `index.html#home` |
| Nhóm danh mục | `index.html#c-van-phong` |
| Danh mục con | `index.html#s-ban-lam-viec` |
| Sản phẩm | `index.html#p1001` |
| Mẫu mới | `index.html#moi` |

## Bước tiếp theo khi làm web thật

- Nếu cần nhiều người cùng sửa hoặc sửa xong lên web ngay (không chép file), chuyển `catalog.js` sang cơ sở dữ liệu hoặc Google Sheet.
- Nối form đặt hàng với email, Zalo OA hoặc hệ thống quản lý đơn (hiện đơn chỉ hiển thị trên trang).
- Lưu ảnh sản phẩm lên dịch vụ lưu trữ ảnh để trang tải nhanh.
- Đưa lên hosting tĩnh (Netlify, Vercel, GitHub Pages…) để có tên miền riêng.
