/* Mộc Thuận Nội Thất — địa chỉ máy chủ API và file danh sách sản phẩm
   Trên máy (localhost) dùng máy chủ chạy bằng "npm run dev" và catalog.js trong public/.
   catalogUrl = null: nạp thẳng assets/js/catalog.js. Khi deploy (Task 10) điền URL công khai catalog.js trên Supabase. */
"use strict";
var MT_CONFIG = (function(host){
  if (host === 'localhost' || host === '127.0.0.1') return {apiBase:'http://localhost:3000', catalogUrl:null};
  return {apiBase:'https://moc-thuan-api.onrender.com', catalogUrl:null};
})(location.hostname);
