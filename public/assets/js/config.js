/* Mộc Thuận Nội Thất — địa chỉ máy chủ API và file danh sách sản phẩm
   Chạy trên máy (localhost): dùng máy chủ của "npm run dev" và file catalog.js nằm trong public/.

   Khi đưa lên web thật, cần điền hai giá trị ở dòng "return" thứ hai bên dưới:
   1) apiBase: địa chỉ máy chủ API. Mặc định https://moc-thuan-api.onrender.com là địa chỉ Render cấp cho dịch vụ tên "moc-thuan-api".
      Nếu bạn gắn tên miền riêng cho API (ví dụ api.tenmien.vn) thì đổi thành https://api.tenmien.vn
   2) catalogUrl: địa chỉ công khai của file catalog.js trên Supabase Storage. Sau khi tạo bucket "public-files", điền:
      https://<mã-dự-án>.supabase.co/storage/v1/object/public/public-files/catalog.js
      (<mã-dự-án> là phần đầu trong SUPABASE_URL của bạn). Để null thì web chỉ dùng catalog.js đi kèm,
      và sản phẩm sửa trong trang quản trị sẽ KHÔNG hiện cho khách. */
"use strict";
var MT_CONFIG = (function(host){
  if (host === 'localhost' || host === '127.0.0.1') return {apiBase:'http://localhost:3000', catalogUrl:null};
  return {apiBase:'https://moc-thuan-api.onrender.com', catalogUrl:null};
})(location.hostname);
