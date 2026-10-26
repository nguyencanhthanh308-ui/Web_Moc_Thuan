/* Mộc Thuận Nội Thất — dữ liệu và công thức giá dùng chung cho trình duyệt (MT toàn cục) và máy chủ (require) */
(function (root) {
"use strict";

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

/* giá theo chiều dài: nội suy giữa các kích thước đã khai báo; ngoài khoảng thì kéo dài đoạn gần nhất (giá ước tính cho kích thước riêng) */
function priceAt(prices, W){
  if (prices.length === 1) return prices[0][1] * W / prices[0][0];
  for (var i = 0; i < prices.length - 2 && W > prices[i+1][0]; i++);
  var a = prices[i], b = prices[i+1];
  return Math.max(0, a[1] + (b[1] - a[1]) * (W - a[0]) / (b[0] - a[0]));
}

/* giá 1 món: p = {kind, prices, sale}; woodK = {id chất liệu: hệ số}, thiếu thì lấy WOOD[i].k. Làm tròn 10.000 ₫ */
function unitPrice(p, W, woodId, woodK){
  var wk = 1;
  if (K[p.kind].parts.indexOf('w') >= 0) wk = (woodK && woodK[woodId] > 0) ? woodK[woodId] : byId(WOOD, woodId).k;
  var b = Math.round(priceAt(p.prices, W) * wk / 10000) * 10000;
  return p.sale ? Math.round(b * (1 - p.sale/100) / 10000) * 10000 : b;
}

/* khoảng nhập cho "Đặt kích thước riêng", sizes = các chiều dài đã khai báo (tăng dần) */
function customRange(sizes){
  return {min: Math.max(20, Math.round(sizes[0]*.6)), max: Math.round(sizes[sizes.length-1]*1.4), step: 5};
}

var MT = {K:K, WOOD:WOOD, FRAME:FRAME, UPH:UPH, byId:byId, priceAt:priceAt, unitPrice:unitPrice, customRange:customRange};
if (typeof module !== 'undefined' && module.exports) module.exports = MT; else root.MT = MT;
})(this);
