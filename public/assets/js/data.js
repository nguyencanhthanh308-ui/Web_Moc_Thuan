/* Mộc Thuận Nội Thất — tiện ích, vật liệu, loại sản phẩm, danh mục và dữ liệu sản phẩm mẫu */
"use strict";

var HAS3D = typeof THREE !== 'undefined';
function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function slug(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function fold(s){ return slug(s).replace(/-/g,' '); }
function vnd(n){ return Math.round(n).toLocaleString('vi-VN') + ' ₫'; }
function fcm(n){ return String(Math.round(n*10)/10).replace('.', ','); }
function store(k, v){ try{ if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); }catch(e){ return null; } }

/* ================= VẬT LIỆU, LOẠI SẢN PHẨM, GIÁ: nằm ở shared.js (MT), gán lại tên toàn cục cũ ================= */
var K = MT.K, WOOD = MT.WOOD, FRAME = MT.FRAME, UPH = MT.UPH, byId = MT.byId, priceAt = MT.priceAt;

/* ================= DANH MỤC ================= */
var CATS = [
  {name:'Nội thất văn phòng', short:'Văn phòng', blurb:'Bàn, ghế, tủ hồ sơ và phụ kiện cho văn phòng mọi quy mô.', groups:[
    ['Bàn văn phòng',[['Bàn giám đốc','desk_exec'],['Bàn trưởng phòng','desk'],['Bàn nhân viên','desk'],['Cụm bàn 2 người','cluster2'],['Cụm bàn 4 người','cluster4'],['Cụm bàn 6 người','cluster6'],['Bàn đào tạo','school'],['Bàn họp','meeting'],['Quầy lễ tân','counter']]],
    ['Phụ kiện bàn',[['Hộp điện','box_power'],['Khay đi dây','box_tray'],['Kệ để CPU','box_cpu'],['Tay đỡ màn hình','arm'],['Kệ màn hình','box_monitor']]],
    ['Ghế văn phòng',[['Ghế giám đốc','chairOffice'],['Ghế nhân viên','chairOffice'],['Ghế phòng họp','chairOffice'],['Ghế training','chair_school'],['Ghế băng chờ','bench']]],
    ['Tủ kệ văn phòng',[['Tủ hồ sơ đứng','cab_tall'],['Tủ hồ sơ di động','cab_mobile'],['Tủ hồ sơ thấp','cab_low'],['Tủ locker','locker'],['Tủ kệ máy in','cab_low']]],
    ['Chân bàn văn phòng',[['Chân bàn nhân viên','frame'],['Chân bàn giám đốc','frame'],['Chân bàn họp','frame'],['Chân bàn nâng hạ','frame_lift']]]
  ]},
  {name:'Phòng khách', short:'Phòng khách', blurb:'Sofa, bàn trà, kệ tivi và tủ trang trí.', groups:[
    ['Ghế & bàn',[['Ghế sofa','sofa'],['Bàn sofa','coffee'],['Bàn bên sofa','side'],['Bàn console','console']]],
    ['Tủ kệ',[['Kệ tivi','tv'],['Tủ giày','shoe'],['Kệ trang trí','shelf'],['Tủ trang trí','cab_tall'],['Tủ rượu','cab_tall']]]
  ]},
  {name:'Bếp & phòng ăn', short:'Bếp & ăn', blurb:'Bàn ăn, ghế ăn, tủ bếp và bàn đảo.', groups:[
    ['Bàn ghế ăn',[['Bàn ăn','dining'],['Ghế ăn','chair'],['Ghế quầy bếp','stool_bar']]],
    ['Tủ bếp',[['Tủ bếp','kitchen'],['Tủ bếp mini','kitchen'],['Tủ kệ nhà bếp','shelf'],['Bàn đảo bếp','island']]]
  ]},
  {name:'Phòng ngủ', short:'Phòng ngủ', blurb:'Giường, tủ quần áo, tủ đầu giường và bàn trang điểm.', groups:[
    ['Giường & tủ',[['Giường ngủ','bed'],['Tủ đầu giường','night'],['Tủ quần áo','wardrobe']]],
    ['Trang điểm',[['Bàn trang điểm','vanity'],['Ghế trang điểm','stool_low'],['Gương đứng','mirror']]]
  ]},
  {name:'Phòng làm việc', short:'Làm việc', blurb:'Góc làm việc tại nhà: bàn, ghế công thái học, kệ sách.', groups:[
    ['Bàn làm việc',[['Bàn làm việc','desk'],['Bàn làm việc có hộc dây','deskTray'],['Bàn gaming','desk_gaming']]],
    ['Ghế',[['Ghế làm việc','chairOffice'],['Ghế công thái học','chairOffice'],['Ghế gaming','chairOffice']]],
    ['Lưu trữ',[['Kệ sách','shelf'],['Tủ cá nhân','cab_mobile']]]
  ]},
  {name:'Phòng tắm', short:'Phòng tắm', blurb:'Kệ máy giặt và kệ phòng tắm chống ẩm.', groups:[
    ['Phòng tắm',[['Kệ máy giặt','shelf_wash'],['Kệ phòng tắm','shelf_small']]]
  ]},
  {name:'Nội thất trẻ em', short:'Trẻ em', blurb:'Bàn học, giường, tủ kệ vừa tầm cho bé.', groups:[
    ['Trẻ em',[['Bàn học trẻ em','kids_desk'],['Giường trẻ em','bed_kid'],['Tủ quần áo trẻ em','wardrobe_kid'],['Tủ kệ trẻ em','shelf_small']]]
  ]},
  {name:'Cafe & ngoài trời', short:'Cafe', blurb:'Bàn ghế cho quán cafe, quầy bar và sân vườn.', groups:[
    ['Quán cafe',[['Bàn cafe','cafe'],['Ghế cafe','chair'],['Bàn bar','bar'],['Ghế bar','stool_bar'],['Ghế băng dài','bench']]],
    ['Ngoài trời',[['Bàn ngoài trời','dining'],['Ghế ngoài trời','chair']]]
  ]},
  {name:'Trường học', short:'Trường học', blurb:'Bàn ghế học sinh, bàn giáo viên, tủ kệ lớp học và thư viện.', groups:[
    ['Bàn ghế',[['Bàn học sinh','school'],['Ghế học sinh','chair_school'],['Bàn giáo viên','desk'],['Bàn mầm non','kids_desk']]],
    ['Tủ kệ',[['Tủ kệ mầm non','shelf_small'],['Tủ kệ thư viện','shelf'],['Tủ locker học sinh','locker']]]
  ]},
  {name:'Phụ kiện & chân bàn', short:'Phụ kiện', blurb:'Chân bàn sắt, mặt bàn gỗ, kệ ống nước để tự lắp.', groups:[
    ['Chân bàn',[['Chân bàn sắt','frame'],['Chân bàn ăn','frame_dining'],['Chân bàn cafe','frame_cafe']]],
    ['Khác',[['Mặt bàn gỗ','top'],['Kệ ống nước','shelf_pipe']]]
  ]}
];

/* dựng chỉ mục danh mục */
var SUBS = {};
CATS.forEach(function(c){
  c.id = slug(c.short);
  c.subs = [];
  c.groups = c.groups.map(function(g){
    return {name:g[0], subs:g[1].map(function(s){
      var id = slug(s[0]); if (SUBS[id]) id = id + '-' + c.id;
      var sub = {id:id, name:s[0], kind:s[1], cat:c};
      SUBS[id] = sub; c.subs.push(sub); return sub;
    })};
  });
});

/* ================= SẢN PHẨM =================
   Lấy từ CATALOG (catalog.js do máy chủ xuất ra khi quản trị lưu sản phẩm). */
function applyWoodK(woodK){ WOOD.forEach(function(w){ if (woodK && woodK[w.id] > 0) w.k = woodK[w.id]; }); }
applyWoodK(CATALOG.woodK);

/* r: một dòng trong CATALOG.products → sản phẩm dùng trên web. p.k = thông số loại K, đã thay kích thước/sâu/cao riêng của sản phẩm */
function makeProduct(r){
  var sub = SUBS[r.sub], base = K[r.kind];
  if (!sub || !base || !r.prices || !r.prices.length) return null;
  var prices = r.prices.slice().sort(function(a, b){ return a[0] - b[0]; });
  var sizes = prices.map(function(x){ return x[0]; });
  return {
    id: 'p' + r.id, code: r.code, sub: sub, cat: sub.cat, kind: r.kind, style: r.style, name: r.name,
    k: Object.assign({}, base, {W: sizes, D: r.D || base.D, H: r.H || base.H}),
    prices: prices, W: sizes.indexOf(r.W) >= 0 ? r.W : sizes[0],
    wood: r.wood || 'caosu', frame: r.frame || 'den', uph: r.uph || 'xam',
    sale: +r.sale || 0, isNew: !!r.isNew, order: +r.order || 0, flag: !!r.flag,
    photos: r.photos || [], /* ảnh thực tế; để trống thì hiển thị ảnh dựng 3D */
    model: r.model && r.model.src ? r.model : null /* mô hình .glb riêng, xem Scan trong model3d.js */
  };
}
var PRODUCTS = [], PBY = {};
CATALOG.products.forEach(function(r){
  if (r.hidden) return;
  var p = makeProduct(r); if (p){ PRODUCTS.push(p); PBY[p.id] = p; }
});
var FLAG = PRODUCTS.filter(function(p){ return p.flag; })[0] || PRODUCTS[0];

function priceOf(p, W, woodId){
  var wk = (p.k.parts.indexOf('w') >= 0) ? byId(WOOD, woodId).k : 1;
  return Math.round(priceAt(p.prices, W) * wk / 10000) * 10000;
}
function finalPrice(p, W, wood){ return MT.unitPrice(p, W, wood); }
function dimsText(p, W){
  var k = p.k;
  if (k.gen === 'round' || k.gen === 'roundFrame') return 'Ø' + W + ' × cao ' + k.H + ' cm';
  if (k.gen === 'bed') return 'nệm ' + W + ' × ' + k.D + ' cm';
  if (k.gen === 'top') return W + ' × ' + k.D + ' cm, ' + p.style;
  var D = k.gen === 'cluster' ? k.D : k.D;
  var Wt = k.gen === 'cluster' ? W * k.n / 2 : W;
  return Wt + ' × ' + D + ' × ' + k.H + ' cm';
}
function matText(p, o){
  var k = p.k, out = [];
  if (k.parts.indexOf('w') >= 0) out.push(byId(WOOD, o.wood).name);
  if (k.parts.indexOf('f') >= 0) out.push((k.frameLabel ? k.frameLabel.replace('Màu ','') + ' ' : 'Khung ') + byId(FRAME, o.frame).name.toLowerCase());
  if (k.parts.indexOf('u') >= 0) out.push(byId(UPH, o.uph).name);
  return out.join(' · ');
}
