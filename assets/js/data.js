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

/* ================= VẬT LIỆU ================= */
var WOOD = [
  {id:'caosu', name:'Gỗ cao su', c:'#D3A46D', k:1},
  {id:'soi', name:'Gỗ sồi', c:'#C9A77C', k:1.1},
  {id:'occho', name:'Veneer óc chó', c:'#71503A', k:1.18},
  {id:'tram', name:'Gỗ tràm', c:'#C08D5A', k:.97},
  {id:'trang', name:'Melamine trắng', c:'#ECEAE5', k:.9},
  {id:'xam', name:'Melamine xám đá', c:'#8D908D', k:.9}
];
var FRAME = [
  {id:'den', name:'Sơn đen', c:'#2A2C2E'},
  {id:'trang', name:'Sơn trắng', c:'#E6E6E2'},
  {id:'ghi', name:'Sơn ghi', c:'#8A8E91'}
];
var UPH = [
  {id:'xam', name:'Vải xám', c:'#8E9396'},
  {id:'be', name:'Vải be', c:'#CDBEA4'},
  {id:'reu', name:'Vải xanh rêu', c:'#617359'},
  {id:'den', name:'Da đen', c:'#2E2F31'}
];
function byId(list, id){ for (var i=0;i<list.length;i++) if (list[i].id===id) return list[i]; return list[0]; }

/* ================= LOẠI SẢN PHẨM =================
   name: tên dáng (hiện ở trang quản lý); gen: bộ dựng 3D; W: các chiều dài chọn được (cm); D sâu; H cao; p giá gốc; pcm giá thêm mỗi cm dài
   parts: wood / frame / uph = các phần chọn màu */
var K = {
  desk:{name:'Bàn làm việc',gen:'desk',W:[100,120,140,160],D:60,H:75,p:1850000,pcm:9000,parts:'wf',styles:['chân sắt chữ U','chân chữ X','khung hộp vuông','có hộc 3 ngăn','chân gỗ thanh mảnh']},
  desk_exec:{name:'Bàn giám đốc',gen:'desk',W:[160,180,200],D:80,H:76,p:4300000,pcm:16000,parts:'wf',styles:['có hộc 3 ngăn','khung hộp vuông','chân chữ X']},
  desk_gaming:{name:'Bàn gaming',gen:'desk',W:[120,140,160],D:65,H:75,p:2550000,pcm:10000,parts:'wf',styles:['chân chữ X','khung hộp vuông']},
  deskTray:{name:'Bàn có hộc dây khe vát',gen:'deskTray',W:[160,180],D:75,H:75,p:6900000,pcm:22000,parts:'wf',frameLabel:'Màu hộc tủ',styles:['khe vát thả dây']},
  kids_desk:{name:'Bàn học trẻ em',gen:'desk',W:[80,100],D:50,H:58,p:1250000,pcm:8000,parts:'wf',styles:['chân gỗ thanh mảnh','khung hộp vuông']},
  school:{name:'Bàn học sinh, bàn đào tạo',gen:'desk',W:[100,120],D:45,H:72,p:980000,pcm:6000,parts:'wf',styles:['khung hộp vuông','chân sắt chữ U']},
  vanity:{name:'Bàn trang điểm',gen:'desk',W:[80,100],D:40,H:75,p:2200000,pcm:12000,parts:'wf',styles:['có hộc 3 ngăn','chân gỗ thanh mảnh']},
  cluster2:{name:'Cụm bàn 2 người',gen:'cluster',n:2,W:[120,140],D:120,H:75,p:4200000,pcm:20000,parts:'wf',styles:['vách ngăn nỉ','vách ngăn gỗ']},
  cluster4:{name:'Cụm bàn 4 người',gen:'cluster',n:4,W:[120,140],D:120,H:75,p:8400000,pcm:38000,parts:'wf',styles:['vách ngăn nỉ','vách ngăn gỗ']},
  cluster6:{name:'Cụm bàn 6 người',gen:'cluster',n:6,W:[120,140],D:120,H:75,p:12500000,pcm:56000,parts:'wf',styles:['vách ngăn nỉ','vách ngăn gỗ']},
  meeting:{name:'Bàn họp',gen:'table',W:[240,300,360],D:120,H:75,p:6200000,pcm:14000,parts:'wf',styles:['chân sắt chữ U','chân gỗ hộp']},
  counter:{name:'Quầy lễ tân',gen:'counter',W:[140,160,180],D:60,H:110,p:6600000,pcm:18000,parts:'wf',styles:['mặt trước phẳng','mặt trước nan gỗ']},
  box_power:{name:'Hộp điện âm bàn',gen:'power',W:[25,30],D:12,H:9,p:420000,pcm:15000,parts:'f',frameLabel:'Màu vỏ',styles:['âm bàn 2 ổ cắm','âm bàn 3 ổ cắm + USB']},
  box_tray:{name:'Khay đi dây',gen:'tray',W:[60,80,100],D:15,H:10,p:240000,pcm:3000,parts:'f',styles:['thép tấm','lưới thép']},
  box_cpu:{name:'Kệ để CPU',gen:'cpu',W:[25],D:48,H:14,p:390000,pcm:0,parts:'f',styles:['có bánh xe','treo gầm bàn']},
  arm:{name:'Tay đỡ màn hình',gen:'arm',W:[45],D:15,H:52,p:690000,pcm:0,parts:'f',styles:['1 màn hình','tay lò xo khí']},
  box_monitor:{name:'Kệ màn hình',gen:'riser',W:[50,60,80],D:22,H:10,p:350000,pcm:5000,parts:'wf',styles:['có ngăn kéo nhỏ','chân sắt']},
  chairOffice:{name:'Ghế văn phòng xoay',gen:'chairOffice',W:[62],D:62,H:112,seat:47,p:1850000,pcm:0,parts:'fu',styles:['lưng lưới','đệm da','tựa đầu công thái học']},
  chair:{name:'Ghế gỗ, ghế ăn',gen:'chair',W:[44],D:50,H:84,seat:45,p:620000,pcm:0,parts:'wu',styles:['tựa nan dọc','tựa cong','khung sắt']},
  chair_school:{name:'Ghế học sinh',gen:'chair',W:[40],D:42,H:78,seat:42,p:390000,pcm:0,parts:'wf',styles:['khung sắt','tựa cong']},
  bench:{name:'Ghế băng',gen:'bench',W:[120,160,180],D:35,H:45,seat:45,p:1150000,pcm:6000,parts:'wf',styles:['chân sắt chữ U','chân gỗ']},
  stool_bar:{name:'Ghế quầy bar',gen:'stool',W:[40],D:40,H:75,seat:75,p:680000,pcm:0,parts:'wf',styles:['có gác chân','mặt bọc nệm']},
  stool_low:{name:'Ghế đôn thấp',gen:'stool',W:[38],D:38,H:46,seat:46,p:520000,pcm:0,parts:'wf',styles:['mặt bọc nệm','chân gỗ']},
  cab_tall:{name:'Tủ cao',gen:'cabinet',lay:'doors',W:[80,100,120],D:40,H:180,p:3100000,pcm:20000,parts:'wf',styles:['2 cánh mở','cánh kính trên']},
  cab_low:{name:'Tủ thấp',gen:'cabinet',lay:'mixed',W:[80,100,120],D:45,H:75,p:1950000,pcm:14000,parts:'wf',styles:['cánh + ngăn kéo','ngăn kéo']},
  cab_mobile:{name:'Tủ di động có bánh xe',gen:'cabinet',lay:'drawers',wheels:true,W:[40],D:50,H:60,p:1450000,pcm:0,parts:'wf',styles:['3 ngăn kéo có khóa','2 ngăn kéo + 1 ngăn hồ sơ']},
  locker:{name:'Tủ locker',gen:'cabinet',lay:'locker',W:[90,120],D:45,H:180,p:3900000,pcm:22000,parts:'wf',styles:['9 ô khóa số','12 ô khóa từ']},
  shoe:{name:'Tủ giày',gen:'cabinet',lay:'doors',legs:true,W:[80,100,120],D:35,H:100,p:1750000,pcm:12000,parts:'wf',styles:['cánh lật','cánh mở + kệ trên']},
  tv:{name:'Kệ tivi',gen:'cabinet',lay:'tv',legs:true,W:[140,160,180],D:40,H:50,p:2650000,pcm:14000,parts:'wf',styles:['ngăn kéo giữa','hộc mở hai bên']},
  night:{name:'Tủ đầu giường',gen:'cabinet',lay:'drawers',legs:true,W:[45,50],D:40,H:50,p:950000,pcm:20000,parts:'wf',styles:['2 ngăn kéo','1 ngăn kéo + hộc mở']},
  wardrobe:{name:'Tủ quần áo',gen:'cabinet',lay:'wardrobe',W:[120,160,200],D:58,H:200,p:5600000,pcm:26000,parts:'wf',styles:['cánh mở','cánh mở + ngăn kéo']},
  wardrobe_kid:{name:'Tủ quần áo trẻ em',gen:'cabinet',lay:'wardrobe',W:[80,100],D:50,H:160,p:3200000,pcm:22000,parts:'wf',styles:['cánh mở','cánh mở + ngăn kéo']},
  kitchen:{name:'Tủ bếp',gen:'cabinet',lay:'kitchen',W:[120,160,200],D:60,H:85,p:4800000,pcm:26000,parts:'wf',styles:['mặt đá','mặt gỗ']},
  island:{name:'Bàn đảo bếp',gen:'cabinet',lay:'island',W:[140,160],D:80,H:90,p:7900000,pcm:30000,parts:'wf',styles:['có chỗ ngồi','tủ hai mặt']},
  shelf:{name:'Kệ cao',gen:'shelf',W:[60,80,100],D:30,H:180,p:1550000,pcm:12000,parts:'wf',styles:['có tấm hậu','khung mở']},
  shelf_small:{name:'Kệ thấp',gen:'shelf',W:[60,80],D:30,H:90,p:850000,pcm:9000,parts:'wf',styles:['có tấm hậu','khung mở']},
  shelf_wash:{name:'Kệ máy giặt',gen:'shelf',wash:true,W:[65],D:30,H:170,p:1250000,pcm:0,parts:'wf',styles:['khung sắt','có tấm hậu']},
  shelf_pipe:{name:'Kệ ống nước',gen:'shelf',pipe:true,W:[80,100,120],D:30,H:160,p:1650000,pcm:10000,parts:'wf',styles:['ống nước 4 tầng','ống nước 5 tầng']},
  sofa:{name:'Sofa',gen:'sofa',W:[180,200,220],D:85,H:80,seat:42,p:7200000,pcm:28000,parts:'wu',styles:['tay vuông','tay mảnh']},
  coffee:{name:'Bàn trà',gen:'table',low:true,W:[90,100,120],D:50,H:45,p:1450000,pcm:9000,parts:'wf',styles:['có kệ dưới','chân sắt chữ U']},
  side:{name:'Bàn tròn nhỏ',gen:'round',W:[45,50],D:45,H:55,p:780000,pcm:12000,parts:'wf',styles:['chân trụ','chân sắt']},
  console:{name:'Bàn console',gen:'table',W:[100,120],D:35,H:80,p:1850000,pcm:10000,parts:'wf',styles:['có kệ dưới','chân gỗ thanh mảnh']},
  dining:{name:'Bàn ăn',gen:'table',W:[120,140,160],D:80,H:75,p:2600000,pcm:14000,parts:'wf',styles:['chân gỗ thanh mảnh','chân sắt chữ U']},
  cafe:{name:'Bàn cafe tròn',gen:'round',W:[60,70,80],D:60,H:75,p:950000,pcm:15000,parts:'wf',styles:['chân trụ','chân sắt']},
  bar:{name:'Bàn bar',gen:'table',bar:true,W:[100,120],D:45,H:105,p:1950000,pcm:12000,parts:'wf',styles:['chân sắt chữ U']},
  bed:{name:'Giường',gen:'bed',W:[160,180],D:200,H:100,p:7800000,pcm:45000,parts:'wu',frameLabel:'',styles:['đầu giường bọc nệm','đầu giường gỗ']},
  bed_kid:{name:'Giường trẻ em',gen:'bed',W:[100,120],D:200,H:85,p:3900000,pcm:35000,parts:'wu',styles:['đầu giường gỗ','đầu giường bọc nệm']},
  mirror:{name:'Gương đứng',gen:'mirror',W:[50,60],D:4,H:160,p:950000,pcm:20000,parts:'w',styles:['khung gỗ đứng','treo tường']},
  frame:{name:'Chân bàn sắt',gen:'frame',W:[100,120,140,160],D:60,H:72,p:950000,pcm:5000,parts:'f',styles:['chữ U','chữ X','khung hộp vuông']},
  frame_lift:{name:'Chân bàn nâng hạ',gen:'frame',lift:true,W:[120,140,160],D:70,H:72,p:4900000,pcm:8000,parts:'f',styles:['nâng hạ điện 2 động cơ']},
  frame_dining:{name:'Chân bàn ăn',gen:'frame',W:[120,140],D:70,H:72,p:1150000,pcm:5000,parts:'f',styles:['chữ U','khung hộp vuông']},
  frame_cafe:{name:'Chân bàn cafe',gen:'roundFrame',W:[60],D:60,H:72,p:450000,pcm:0,parts:'f',styles:['đế tròn gang']},
  top:{name:'Mặt bàn gỗ',gen:'top',W:[100,120,140,160],D:60,H:2.5,p:650000,pcm:7000,parts:'w',styles:['dày 25 mm','dày 18 mm']}
};

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
   Lấy từ CATALOG (assets/js/catalog.js, do admin.html xuất ra).
   Mở web với ?xem-thu thì dùng bản nháp đang sửa ở trang quản lý (lưu trong localStorage). */
var DRAFT_KEY = 'mocthuan-admin-draft';
var PREVIEW_ASKED = /[?&]xem-thu(&|=|$)/.test(location.search);
var PREVIEW = PREVIEW_ASKED ? store(DRAFT_KEY) : null;
if (!(PREVIEW && PREVIEW.data && PREVIEW.data.products)) PREVIEW = null;
var DATA = PREVIEW ? PREVIEW.data : CATALOG;
function applyWoodK(woodK){ WOOD.forEach(function(w){ if (woodK && woodK[w.id] > 0) w.k = woodK[w.id]; }); }
applyWoodK(DATA.woodK);

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
DATA.products.forEach(function(r){
  if (r.hidden) return;
  var p = makeProduct(r); if (p){ PRODUCTS.push(p); PBY[p.id] = p; }
});
var FLAG = PRODUCTS.filter(function(p){ return p.flag; })[0] || PRODUCTS[0];

/* giá theo chiều dài: nội suy giữa các kích thước đã khai báo; ngoài khoảng thì kéo dài đoạn gần nhất (giá ước tính cho kích thước riêng) */
function priceAt(prices, W){
  if (prices.length === 1) return prices[0][1] * W / prices[0][0];
  for (var i = 0; i < prices.length - 2 && W > prices[i+1][0]; i++);
  var a = prices[i], b = prices[i+1];
  return Math.max(0, a[1] + (b[1] - a[1]) * (W - a[0]) / (b[0] - a[0]));
}
function priceOf(p, W, woodId){
  var wk = (p.k.parts.indexOf('w') >= 0) ? byId(WOOD, woodId).k : 1;
  return Math.round(priceAt(p.prices, W) * wk / 10000) * 10000;
}
function finalPrice(p, W, wood){ var b = priceOf(p, W, wood); return p.sale ? Math.round(b * (1 - p.sale/100) / 10000) * 10000 : b; }
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
