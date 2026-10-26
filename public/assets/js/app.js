/* Mộc Thuận Nội Thất — giỏ hàng, menu, các trang và điều hướng */
"use strict";

/* ================= GIỎ HÀNG ================= */
var cart = (store('mocthuan-cart') || []).filter(function(it){ return PBY[it.id]; });
function saveCart(){ store('mocthuan-cart', cart); var n = cart.reduce(function(s, it){ return s + it.qty; }, 0); var b = $('#cartCount'); b.textContent = n; b.hidden = !n; }
function addToCart(p, o, qty){
  var key = p.id + o.W + o.wood + o.frame + o.uph, found = cart.filter(function(it){ return it.key === key; })[0];
  if (found) found.qty += qty; else cart.push({key:key, id:p.id, W:o.W, wood:o.wood, frame:o.frame, uph:o.uph, qty:qty});
  saveCart(); toast('Đã thêm vào giỏ: ' + p.name);
}
function toast(msg){ var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role','status'); t.textContent = msg; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 2600); }

function openLayer(html, side){
  var layer = $('#layer');
  layer.innerHTML = '<div class="scrim" data-close></div><aside class="drawer ' + side + '" role="dialog" aria-modal="true">' + html + '</aside>';
  layer.querySelector('[data-close]').onclick = closeLayer;
  $$('[data-x]', layer).forEach(function(b){ b.onclick = closeLayer; });
  var f = layer.querySelector('button,a,input'); if (f) f.focus();
}
function closeLayer(){ $('#layer').innerHTML = ''; }
document.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ closeLayer(); hideMega(); } });

function cartHTML(){
  if (!cart.length) return '<div class="drawer-head"><h3>Giỏ hàng</h3><button class="icon-btn" data-x aria-label="Đóng">✕</button></div><div class="drawer-body"><div class="empty">Giỏ hàng đang trống.<br>Chọn một món đồ, xoay xem kích thước rồi thêm vào giỏ.</div></div>';
  var total = 0;
  var rows = cart.map(function(it, i){
    var p = PBY[it.id], o = optsOf(p, it), pr = finalPrice(p, it.W, it.wood); total += pr * it.qty;
    return '<div class="ci"><div class="ph">' + (photoOf(p,0) ? photoTag(photoOf(p,0), '') : thumbImg(p, it)) + '</div><div><b>' + esc(p.name) + '</b><div class="o">' + esc(dimsText(p, it.W)) + '</div><div class="o">' + esc(matText(p, o)) + '</div>' +
      '<div class="r"><span class="qty"><button data-dec="' + i + '" aria-label="Bớt">−</button><output>' + it.qty + '</output><button data-inc="' + i + '" aria-label="Thêm">+</button></span><span class="price"><b>' + vnd(pr*it.qty) + '</b></span></div>' +
      '<button class="link-btn" data-rm="' + i + '">Xóa</button></div></div>';
  }).join('');
  return '<div class="drawer-head"><h3>Giỏ hàng</h3><button class="icon-btn" data-x aria-label="Đóng">✕</button></div>' +
    '<div class="drawer-body" id="cartBody">' + rows + '</div>' +
    '<div class="drawer-foot"><div class="total"><span>Tạm tính</span><b>' + vnd(total) + '</b></div><p class="note">Chưa gồm phí giao hàng. Nội thành giao và lắp miễn phí cho đơn từ 3.000.000 ₫.</p><button class="btn primary" id="checkout">Đặt hàng</button></div>';
}
function showCart(){
  openLayer(cartHTML(), 'right');
  var L = $('#layer');
  L.onclick = function(e){
    var t = e.target, i;
    if ((i = t.getAttribute('data-inc')) !== null){ cart[+i].qty++; } else if ((i = t.getAttribute('data-dec')) !== null){ cart[+i].qty = Math.max(1, cart[+i].qty - 1); } else if ((i = t.getAttribute('data-rm')) !== null){ cart.splice(+i, 1); } else if (t.id === 'checkout'){ return checkout(); } else return;
    saveCart(); showCart();
  };
}
function cartTotal(){ return cart.reduce(function(s, it){ return s + finalPrice(PBY[it.id], it.W, it.wood) * it.qty; }, 0); }
function productNo(it){ return +String(it.id).slice(1); } /* 'p1001' → 1001 */
/* Gửi đơn lên máy chủ. Máy chủ có thể đang ngủ nên thử lại; chỉ xóa giỏ khi máy chủ trả 201 (đã lưu đơn) */
function checkout(){
  var L = $('#layer'); L.onclick = null;
  var u = Auth.user;
  openLayer('<div class="drawer-head"><h3>Thông tin giao hàng</h3><button class="icon-btn" data-x aria-label="Đóng">✕</button></div>' +
    '<form class="drawer-body form" id="orderForm">' +
    (u ? '' : '<p class="note">Đã có tài khoản? <a href="#dang-nhap" data-x>Đăng nhập</a> để tự điền thông tin và xem lại đơn trong mục Đơn của tôi. Không đăng nhập vẫn đặt hàng được.</p>') +
    '<label for="o-name">Họ tên<input id="o-name" required autocomplete="name"></label><label for="o-phone">Số điện thoại<input id="o-phone" required inputmode="tel" autocomplete="tel"></label><label for="o-addr">Địa chỉ giao hàng<textarea id="o-addr" required autocomplete="street-address"></textarea></label>' +
    '<fieldset class="pay"><legend>Cách trả tiền</legend><label><input type="radio" name="payment" value="chuyen-khoan" required>Chuyển khoản</label><label><input type="radio" name="payment" value="khi-nhan">Trả khi nhận hàng</label></fieldset>' +
    '<label for="o-note">Ghi chú (kích thước riêng, giờ giao…)<textarea id="o-note"></textarea></label>' +
    '<div class="hp" aria-hidden="true"><label for="o-web">Website<input id="o-web" name="website" tabindex="-1" autocomplete="off"></label></div>' +
    '<div class="total"><span>Tổng tạm tính</span><b id="o-total">' + esc(vnd(cartTotal())) + '</b></div><p class="note">Giá cuối cùng do cửa hàng xác nhận khi gọi lại.</p>' +
    '<p class="form-msg" id="o-status" role="status" hidden></p><button class="btn primary" type="submit">Xác nhận đặt hàng</button></form>', 'right');
  if (u){ $('#o-name').value = u.name || ''; $('#o-phone').value = u.phone || ''; $('#o-addr').value = u.address || ''; }
  var form = $('#orderForm'), btn = form.querySelector('button[type=submit]'), msg = $('#o-status');
  function ready(){ btn.disabled = !cart.length; btn.textContent = 'Xác nhận đặt hàng'; }
  form.onsubmit = function(e){
    e.preventDefault();
    if (btn.disabled || !cart.length) return;
    var name = $('#o-name').value.trim(), pay = form.querySelector('input[name=payment]:checked');
    var body = {customer:{name:name, phone:$('#o-phone').value.trim(), address:$('#o-addr').value.trim()}, payment:pay ? pay.value : '', note:$('#o-note').value.trim(), website:$('#o-web').value,
      items:cart.map(function(it){ return {id:productNo(it), W:+it.W, wood:it.wood, frame:it.frame, uph:it.uph, qty:+it.qty}; })};
    btn.disabled = true; btn.textContent = 'Đang gửi đơn…'; setMsg(msg, '');
    Api.call('POST', '/api/orders', body, {retries:4, onSlow:function(){ setMsg(msg, esc('Đang gửi đơn… (có thể mất tới 1 phút)')); }}).then(function(d){
      cart = []; saveCart();
      openLayer('<div class="drawer-head"><h3>Cửa hàng đã nhận đơn</h3><button class="icon-btn" data-x aria-label="Đóng">✕</button></div><div class="drawer-body form">' +
        '<p>Cảm ơn ' + esc(name) + '. Cửa hàng đã nhận đơn <b class="mono">' + esc(d.code) + '</b> và sẽ gọi lại để xác nhận.</p>' +
        '<p class="note">Nhân viên sẽ gọi số điện thoại bạn vừa nhập để chốt kích thước, giá và lịch giao. Cần hỏi thêm, gọi ' + SHOP_TEL + ' và đọc mã đơn.</p>' +
        (Auth.user ? '<a class="btn" href="#don=' + esc(encodeURIComponent(d.code)) + '" data-x>Xem trong Đơn của tôi</a>' : '') +
        '<button class="btn primary" data-x>Tiếp tục xem sản phẩm</button></div>', 'right');
    }, function(err){
      ready();
      var bad = err.status === 422 && err.data.unavailable ? err.data.unavailable.map(Number) : [];
      var gone = cart.filter(function(it){ return bad.indexOf(productNo(it)) >= 0; });
      if (gone.length){
        cart = cart.filter(function(it){ return gone.indexOf(it) < 0; }); saveCart(); ready();
        $('#o-total').textContent = vnd(cartTotal());
        var names = gone.map(function(it){ return PBY[it.id].name; }).filter(function(n, i, a){ return a.indexOf(n) === i; });
        setMsg(msg, esc('Món sau hiện không còn bán nên đã được bỏ khỏi giỏ: ' + names.join(', ') + '. ') +
          (cart.length ? 'Vui lòng kiểm tra lại rồi bấm Xác nhận đặt hàng.' : 'Giỏ hàng đã trống, vui lòng chọn món khác.'), 'err');
      }
      else if (err.status >= 400 && err.status < 500) setMsg(msg, esc(err.message), 'err');
      else setMsg(msg, 'Chưa gửi được đơn. Vui lòng gọi ' + SHOP_TEL + ' hoặc thử gửi lại sau ít phút. Giỏ hàng vẫn được giữ nguyên.', 'err');
    });
  };
}

/* ================= MENU ================= */
function catHref(c){ return '#c-' + c.id; }
function subHref(s){ return '#s-' + s.id; }
function megaHTML(c){
  return '<div class="wrap"><div class="mega-side"><h3>' + esc(c.name) + '</h3><p>' + esc(c.blurb) + '</p><a class="btn sm" href="' + catHref(c) + '">Xem tất cả</a></div><div class="mega-cols">' +
    c.groups.map(function(g){ return '<div><h4>' + esc(g.name) + '</h4>' + g.subs.map(function(s){ return '<a href="' + subHref(s) + '">' + esc(s.name) + '</a>'; }).join('') + '</div>'; }).join('') + '</div></div>';
}
var megaTimer = null;
function showMega(i, btn){
  clearTimeout(megaTimer);
  var m = $('#mega'); m.innerHTML = megaHTML(CATS[i]); m.hidden = false;
  $$('#catNav button').forEach(function(b){ b.setAttribute('aria-expanded', b === btn ? 'true' : 'false'); });
}
function hideMega(){ var m = $('#mega'); m.hidden = true; $$('#catNav button').forEach(function(b){ b.setAttribute('aria-expanded','false'); }); }
function buildNav(){
  $('#catNav').innerHTML = CATS.map(function(c, i){ return '<li><button data-i="' + i + '" aria-expanded="false" aria-controls="mega">' + esc(c.short) + '</button></li>'; }).join('');
  $$('#catNav button').forEach(function(b){
    var i = +b.getAttribute('data-i');
    b.addEventListener('mouseenter', function(){ showMega(i, b); });
    b.addEventListener('click', function(){ if (b.getAttribute('aria-expanded') === 'true') hideMega(); else showMega(i, b); });
  });
  var nav = $('nav.cats');
  nav.addEventListener('mouseleave', function(){ megaTimer = setTimeout(hideMega, 180); });
  nav.addEventListener('mouseenter', function(){ clearTimeout(megaTimer); });
  $('#mega').addEventListener('click', function(e){ if (e.target.closest('a')) hideMega(); });
  $('#footCats').innerHTML = CATS.map(function(c){ return '<li><a href="' + catHref(c) + '">' + esc(c.name) + '</a></li>'; }).join('');
  $('#menuBtn').onclick = function(){
    openLayer('<div class="drawer-head"><h3>Danh mục</h3><button class="icon-btn" data-x aria-label="Đóng">✕</button></div><div class="drawer-body">' +
      CATS.map(function(c, i){ return '<div class="acc"><button aria-expanded="false" data-acc="' + i + '">' + esc(c.name) + '<span aria-hidden="true">+</span></button><div class="acc-body" hidden><a href="' + catHref(c) + '"><b>Xem tất cả ' + esc(c.short.toLowerCase()) + '</b></a>' +
        c.groups.map(function(g){ return '<h5>' + esc(g.name) + '</h5>' + g.subs.map(function(s){ return '<a href="' + subHref(s) + '">' + esc(s.name) + '</a>'; }).join(''); }).join('') + '</div></div>'; }).join('') + '</div>', 'left');
    var L = $('#layer');
    L.onclick = function(e){
      var b = e.target.closest('[data-acc]');
      if (b){ var open = b.getAttribute('aria-expanded') === 'true'; b.setAttribute('aria-expanded', !open); b.nextElementSibling.hidden = open; b.lastChild.textContent = open ? '+' : '−'; return; }
      if (e.target.closest('a')) closeLayer();
    };
  };
  $('#cartBtn').onclick = showCart;
  $('#searchForm').onsubmit = function(e){ e.preventDefault(); var q = $('#q').value.trim(); if (q){ state.q = q; if (location.hash === '#tim') route(); else location.hash = 'tim'; } };
}

/* ================= TRANG ================= */
var state = {q:'', filters:{}, sort:'pop', shown:12};
function card(p){
  var o = optsOf(p);
  var pr = finalPrice(p, p.W, p.wood), base = priceOf(p, p.W, p.wood);
  return '<a class="card" href="#' + p.id + '">' +
    (p.sale ? '<span class="tag sale">−' + p.sale + '%</span>' : (p.isNew ? '<span class="tag new">Mẫu mới</span>' : '')) +
    '<div class="ph">' + cardImg(p) + '</div><div class="body"><span class="name">' + esc(p.name) + '</span><span class="size">' + esc(dimsText(p, p.W)) + ' · ' + esc(matText(p, o).split(' · ')[0]) + '</span>' +
    '<span class="price"><b>' + vnd(pr) + '</b>' + (p.sale ? '<s>' + vnd(base) + '</s>' : '') + '</span></div></a>';
}
function crumbs(list){ return '<nav class="crumbs wrap" aria-label="Đường dẫn"><a href="#home">Trang chủ</a>' + list.map(function(c){ return '<span aria-hidden="true">/</span>' + (c[1] ? '<a href="' + c[1] + '">' + esc(c[0]) + '</a>' : '<span>' + esc(c[0]) + '</span>'); }).join('') + '</nav>'; }

function pageHome(){
  var news = PRODUCTS.filter(function(p){ return p.isNew; }).slice(0, 8);
  var office = CATS[0], offProds = PRODUCTS.filter(function(p){ return p.cat === office && !p.flag; }).sort(function(a,b){ return a.order - b.order; }).slice(0, 4);
  var rep = {}; CATS.forEach(function(c){ rep[c.id] = PRODUCTS.filter(function(p){ return p.cat === c; }).sort(function(a, b){ return a.order - b.order; })[0]; });
  rep['lam-viec'] = FLAG;
  var html =
  '<section class="hero"><div class="wrap hero-grid"><div>' +
    '<span class="eyebrow">Xưởng nội thất gỗ · làm theo kích thước riêng</span>' +
    '<h1>Nội thất gỗ đặt đúng kích thước nhà bạn.</h1>' +
    '<p class="lede">Bàn, ghế, tủ, kệ cho văn phòng và gia đình, làm tại xưởng. Mẫu nào cũng đặt được theo kích thước riêng, kèm mô hình 3D để xem trước kích thước.</p>' +
    '<div class="ctas"><a class="btn primary" href="#' + FLAG.id + '">Xem bàn hộc dây khe vát</a><a class="btn" href="#c-van-phong">Nội thất văn phòng</a></div>' +
    '<div class="hero-facts"><div><b>' + CATS.reduce(function(s,c){ return s + c.subs.length; }, 0) + '</b>danh mục sản phẩm</div><div><b>' + PRODUCTS.length + '</b>mẫu đang bán</div><div><b>12 tháng</b>bảo hành tại xưởng</div></div>' +
  '</div><div><a class="hero-media" href="#' + FLAG.id + '" id="heroMedia">' + (photoOf(FLAG,0) ? photoTag(photoOf(FLAG,0), FLAG.name) : thumbImg(FLAG, null, FLAG.name) + '<span class="ph-tag">Ảnh dựng 3D</span>') + '<span class="btn sm go3d">Xem chi tiết &amp; 3D</span></a></div></div></section>' +
  '<section class="block"><div class="wrap"><div class="sec-head"><h2>Mua theo không gian</h2></div><div class="room-grid">' +
    CATS.map(function(c){ var p = rep[c.id]; return '<a class="room" href="' + catHref(c) + '"><div class="ph">' + (p ? (photoOf(p,0) ? photoTag(photoOf(p,0), c.name) : thumbImg(p, null, c.name)) : '') + '</div><div class="t"><b>' + esc(c.name) + '</b><span>' + c.subs.length + ' danh mục · ' + PRODUCTS.filter(function(x){ return x.cat === c; }).length + ' mẫu</span></div></a>'; }).join('') +
  '</div></div></section>' +
  '<section class="block"><div class="wrap"><div class="sec-head"><h2>Mẫu mới về xưởng</h2><a href="#moi">Xem tất cả</a></div><div class="grid">' + news.map(card).join('') + '</div></div></section>' +
  '<section class="block office-band"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">Cho doanh nghiệp</span><h2>Nội thất văn phòng</h2></div><a href="#c-van-phong">Xem tất cả</a></div>' +
    '<div class="chips" style="margin-bottom:16px">' + office.subs.slice(0, 14).map(function(s){ return '<a class="chip" href="' + subHref(s) + '">' + esc(s.name) + '</a>'; }).join('') + '</div>' +
    '<div class="grid">' + offProds.map(card).join('') + '</div></div></section>' +
  '<section class="block"><div class="wrap"><div class="services">' +
    '<div><b>Làm theo kích thước</b><p>Đổi dài, sâu, cao theo phòng của bạn. Xem lại trên mô hình 3D trước khi chốt.</p></div>' +
    '<div><b>Giao và lắp tận nơi</b><p>Thợ của xưởng giao, lắp và cân chỉnh tại chỗ. Không cần ra showroom.</p></div>' +
    '<div><b>Vật liệu ghi rõ</b><p>Gỗ cao su, sồi, tràm, plywood, MDF chống ẩm, sắt sơn tĩnh điện.</p></div>' +
    '<div><b>Bảo hành 12 tháng</b><p>Bảo hành kết cấu, ray, bản lề. Sửa tại nhà trong nội thành.</p></div>' +
  '</div></div></section>' +
  '<section class="block"><div class="wrap"><div class="sec-head"><h2>Chọn kích thước cho đúng</h2></div><div class="ideas">' +
    '<div class="idea"><span class="eyebrow">Bàn làm việc</span><b>Cao 72–76 cm, sâu tối thiểu 60 cm</b><p>Dùng hai màn hình thì nên chọn sâu 70–80 cm để mắt cách màn hình đủ xa.</p></div>' +
    '<div class="idea"><span class="eyebrow">Bàn ăn</span><b>Mỗi người cần khoảng 60 cm chiều dài</b><p>Bàn 140 × 80 cm ngồi thoải mái 6 người, 160 cm ngồi được 6–8 người.</p></div>' +
    '<div class="idea"><span class="eyebrow">Sofa & bàn trà</span><b>Bàn trà dài bằng 2/3 sofa</b><p>Sofa 200 cm hợp bàn trà dài 120–130 cm, cách mép sofa 40–45 cm.</p></div>' +
  '</div></div></section>';
  $('#app').innerHTML = html;
  $('#heroMedia').onclick = function(){ state.open3d = true; };
}

function matchFilters(p, f){
  var pr = finalPrice(p, p.W, p.wood);
  if (f.price){ var r = f.price.split('-'); if (pr < +r[0] || (r[1] && pr >= +r[1])) return false; }
  if (f.mats && f.mats.length && f.mats.indexOf(p.wood) < 0) return false;
  if (f.width){ var w = f.width.split('-'), W = p.k.gen === 'cluster' ? p.W*p.k.n/2 : p.W; if (W < +w[0] || (w[1] && W >= +w[1])) return false; }
  if (f.sale && !p.sale) return false;
  return true;
}
function sortList(list, s){
  var a = list.slice();
  if (s === 'asc') a.sort(function(x, y){ return finalPrice(x, x.W, x.wood) - finalPrice(y, y.W, y.wood); });
  else if (s === 'desc') a.sort(function(x, y){ return finalPrice(y, y.W, y.wood) - finalPrice(x, x.W, x.wood); });
  else if (s === 'new') a.sort(function(x, y){ return (y.isNew - x.isNew) || (x.order - y.order); });
  else a.sort(function(x, y){ return (y.flag?1:0) - (x.flag?1:0) || x.order - y.order; });
  return a;
}
function pageList(opt){
  var f = state.filters;
  var list = sortList(opt.items.filter(function(p){ return matchFilters(p, f); }), state.sort);
  var hasWood = opt.items.some(function(p){ return p.k.parts.indexOf('w') >= 0; });
  var html = crumbs(opt.crumbs) +
  '<div class="wrap list-head"><h1>' + esc(opt.title) + '</h1>' + (opt.chips ? '<div class="chips">' + opt.chips + '</div>' : '') + '</div>' +
  '<div class="wrap list-layout"><aside class="filters" id="filters" aria-label="Bộ lọc">' +
    '<fieldset><legend>Khoảng giá</legend>' + [['','Tất cả'],['0-2000000','Dưới 2 triệu'],['2000000-5000000','2 – 5 triệu'],['5000000-10000000','5 – 10 triệu'],['10000000-','Trên 10 triệu']].map(function(r, i){ return '<label><input type="radio" name="price" id="fp' + i + '" value="' + r[0] + '"' + ((f.price||'') === r[0] ? ' checked' : '') + '>' + r[1] + '</label>'; }).join('') + '</fieldset>' +
    '<fieldset><legend>Chiều dài</legend>' + [['','Tất cả'],['0-100','Dưới 100 cm'],['100-150','100 – 149 cm'],['150-200','150 – 199 cm'],['200-','Từ 200 cm']].map(function(r, i){ return '<label><input type="radio" name="width" id="fw' + i + '" value="' + r[0] + '"' + ((f.width||'') === r[0] ? ' checked' : '') + '>' + r[1] + '</label>'; }).join('') + '</fieldset>' +
    (hasWood ? '<fieldset><legend>Chất liệu mặt</legend>' + WOOD.map(function(w){ return '<label><input type="checkbox" name="mats" id="fm-' + w.id + '" value="' + w.id + '"' + ((f.mats||[]).indexOf(w.id) >= 0 ? ' checked' : '') + '><span class="sw" aria-hidden="true" style="width:16px;height:16px;background:' + w.c + ';box-shadow:0 0 0 1px var(--line);border:0"></span>' + w.name + '</label>'; }).join('') + '</fieldset>' : '') +
    '<fieldset><legend>Khuyến mãi</legend><label><input type="checkbox" id="fsale" name="sale"' + (f.sale ? ' checked' : '') + '>Đang giảm giá</label></fieldset>' +
    '<button class="btn sm ghost" id="clearF" type="button">Xóa bộ lọc</button>' +
  '</aside><div>' +
    '<div class="toolbar"><span class="muted">' + list.length + ' sản phẩm</span><div style="display:flex;gap:8px;align-items:center"><button class="btn sm filter-toggle" id="ftog" aria-controls="filters" aria-expanded="false">Bộ lọc</button><label for="sortSel" class="muted" style="font-size:14px">Sắp xếp</label><select id="sortSel">' +
      [['pop','Phổ biến'],['new','Mới nhất'],['asc','Giá thấp đến cao'],['desc','Giá cao đến thấp']].map(function(s){ return '<option value="' + s[0] + '"' + (state.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div></div>' +
    (list.length ? '<div class="grid">' + list.slice(0, state.shown).map(card).join('') + '</div>' + (list.length > state.shown ? '<div class="more"><button class="btn" id="moreBtn">Xem thêm ' + Math.min(12, list.length - state.shown) + ' sản phẩm</button></div>' : '')
      : '<div class="empty">Không có sản phẩm khớp bộ lọc. Thử bỏ bớt điều kiện.</div>') +
  '</div></div>';
  $('#app').innerHTML = html;
  var F = $('#filters');
  F.onchange = function(){
    var nf = {}; var pr = F.querySelector('input[name=price]:checked'); if (pr && pr.value) nf.price = pr.value;
    var wd = F.querySelector('input[name=width]:checked'); if (wd && wd.value) nf.width = wd.value;
    nf.mats = $$('input[name=mats]:checked', F).map(function(i){ return i.value; });
    nf.sale = $('#fsale').checked; state.filters = nf; state.shown = 12; var y = window.scrollY; pageList(opt); window.scrollTo(0, y); if (window.innerWidth <= 860) { $('#filters').classList.add('open'); $('#ftog').setAttribute('aria-expanded','true'); }
  };
  $('#clearF').onclick = function(){ state.filters = {}; state.shown = 12; pageList(opt); };
  $('#sortSel').onchange = function(e){ state.sort = e.target.value; var y = window.scrollY; pageList(opt); window.scrollTo(0, y); };
  $('#ftog').onclick = function(){ var open = F.classList.toggle('open'); this.setAttribute('aria-expanded', open); };
  var mb = $('#moreBtn'); if (mb) mb.onclick = function(){ state.shown += 12; var y = window.scrollY; pageList(opt); window.scrollTo(0, y); };
}

function pageProduct(p){
  var k = p.k, o = optsOf(p), qty = 1;
  var related = PRODUCTS.filter(function(x){ return x.sub === p.sub && x !== p; }).concat(PRODUCTS.filter(function(x){ return x.cat === p.cat && x.sub !== p.sub; }).sort(function(a,b){ return a.order-b.order; })).slice(0, 4);
  var html = crumbs([[p.cat.name, catHref(p.cat)], [p.sub.name, subHref(p.sub)], [p.name]]) +
  '<div class="wrap pd"><div class="pd-left"><div>' +
    '<div class="viewer" id="pdViewer"><span class="v-hint">Kéo để xoay · cuộn để phóng · kích thước hiện theo góc nhìn</span></div>' +
    '<div class="v-tools"><button class="btn sm" id="vDim" aria-pressed="true">Kích thước: tự động theo góc nhìn</button><button class="btn sm" id="vTop">Nhìn từ trên</button><button class="btn sm" id="vBack">Mặt sau</button>' + (k.gen === 'deskTray' ? '<button class="btn sm" id="vLid" aria-pressed="false">Mở nắp hộc dây</button>' : '') + '<button class="btn sm ghost" id="vReset">Về góc nhìn gốc</button></div>' +
    (p.model ? '<p class="note">Mô hình 3D làm từ mẫu thật dài ' + p.model.W + ' cm, màu như mẫu. Kích thước và màu bạn chọn bên phải dùng để tính giá.</p>' : '') + '</div>' +
    '<div class="photos"><h3>Ảnh thực tế</h3><p class="note" id="phNote"></p><div class="photo-grid" id="thumbs"></div></div></div>' +
  '<div><span class="eyebrow">' + esc(p.sub.name) + '</span><h1>' + esc(p.name) + '</h1>' +
    '<div class="meta"><span>Mã <span class="mono">' + p.code + '</span></span><span>Còn hàng tại xưởng</span>' + (p.isNew ? '<span>Mẫu mới</span>' : '') + '</div>' +
    '<div class="price" id="pdPrice"></div>' +
    '<div class="opt"><h4>Kích thước <span id="pdDims"></span></h4><div class="sizes" id="pdSizes">' + k.W.map(function(w){ return '<button data-w="' + w + '" aria-pressed="' + (w === o.W) + '">' + esc(dimsText(p, w).replace(/, .*/, '')) + '</button>'; }).join('') + '</div></div>' +
    (k.parts.indexOf('w') >= 0 ? swatchBlock('Chất liệu mặt', 'wood', WOOD, o.wood) : '') +
    (k.parts.indexOf('f') >= 0 ? swatchBlock(k.frameLabel || 'Màu khung', 'frame', FRAME, o.frame) : '') +
    (k.parts.indexOf('u') >= 0 ? swatchBlock('Màu bọc', 'uph', UPH, o.uph) : '') +
    '<div class="buy"><span class="qty"><button id="qDec" aria-label="Bớt">−</button><output id="qOut">1</output><button id="qInc" aria-label="Thêm">+</button></span><button class="btn primary" id="addCart">Thêm vào giỏ</button><button class="btn" id="custBtn" aria-expanded="false">Đặt kích thước riêng</button></div>' +
    '<div class="custom" id="custom" hidden><span class="note">Nhập chiều dài muốn đặt, mô hình 3D đổi theo ngay. Xưởng báo giá lại sau khi xác nhận.</span><div class="row"><label for="cW">Dài (cm)<input id="cW" type="number" min="' + Math.max(20, Math.round(k.W[0]*.6)) + '" max="' + Math.round(k.W[k.W.length-1]*1.4) + '" step="5" value="' + o.W + '"></label><button class="btn sm" id="cApply">Xem trên mô hình</button></div></div>' +
    '<table class="spec"><tbody id="pdSpec"></tbody></table>' +
    '<div class="perks"><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12l4 4 10-10"/></svg>Giao và lắp đặt tận nơi trong nội thành</div><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12l4 4 10-10"/></svg>Bảo hành 12 tháng kết cấu, ray, bản lề</div><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12l4 4 10-10"/></svg>Đổi trả trong 7 ngày nếu lỗi sản xuất</div></div>' +
  '</div></div>' +
  '<section class="block"><div class="wrap"><div class="sec-head"><h2>Có thể bạn quan tâm</h2><a href="' + subHref(p.sub) + '">Xem tất cả ' + esc(p.sub.name.toLowerCase()) + '</a></div><div class="grid">' + related.map(card).join('') + '</div></div></section>';
  $('#app').innerHTML = html;

  function update(rebuild){
    var pr = finalPrice(p, o.W, o.wood), base = priceOf(p, o.W, o.wood), custom = k.W.indexOf(o.W) < 0;
    $('#pdPrice').innerHTML = '<b>' + vnd(pr) + '</b>' + (p.sale ? '<s>' + vnd(base) + '</s><span class="tag sale" style="position:static">−' + p.sale + '%</span>' : '') + (custom ? '<span class="note">Giá ước tính cho kích thước riêng</span>' : '');
    $('#pdDims').textContent = dimsText(p, o.W);
    $$('#pdSizes button').forEach(function(b){ b.setAttribute('aria-pressed', +b.getAttribute('data-w') === o.W); });
    var rows = [['Kích thước', dimsText(p, o.W)], ['Kiểu dáng', p.style]];
    if (k.parts.indexOf('w') >= 0) rows.push(['Chất liệu mặt', byId(WOOD, o.wood).name + (o.wood === 'trang' || o.wood === 'xam' ? ' (MDF chống ẩm)' : ', sơn PU chống nước')]);
    if (k.parts.indexOf('f') >= 0) rows.push([k.frameLabel || 'Khung', (k.gen === 'deskTray' ? 'MDF melamine, ' : 'Sắt sơn tĩnh điện, ') + byId(FRAME, o.frame).name.toLowerCase()]);
    if (k.parts.indexOf('u') >= 0) rows.push(['Bọc', byId(UPH, o.uph).name]);
    if (p.k.seat) rows.push(['Chiều cao ngồi', p.k.seat + ' cm']);
    if (p.model && p.model.dims && p.model.dims.length) rows.push(['Kích thước chi tiết', p.model.dims.map(function(d){ return d.t; }).join(' · ')]);
    if (k.gen === 'deskTray') rows.push(['Hộc đi dây', 'Hộp ' + (o.W*10-300) + ' × 100 × 80 mm, nắp lật bản lề chén, khe vát ' + (o.W*10-600) + ' × 25 mm, lỗ Ø50 xuống sàn']);
    rows.push(['Mã sản phẩm', p.code], ['Bảo hành', '12 tháng']);
    $('#pdSpec').innerHTML = rows.map(function(r){ return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('');
    if (rebuild && Viewer.r && Viewer.el && Viewer.el.isConnected && Viewer.el.id === 'pdViewer') Viewer.set(p, o, false);
    gallery();
  }
  function gallery(){
    var has = p.photos && p.photos.length;
    var items = has ? p.photos.map(function(u){ return {u:u}; }) : [{v:'home'},{v:'front'},{v:'side'},{v:'top'}];
    function img(it){ return it.u ? photoTag(it.u, p.name) : thumbImg(p, o, p.name, it.v); }
    $('#thumbs').innerHTML = items.map(function(it, i){ return '<button data-gi="' + i + '" aria-label="Phóng to ảnh ' + (i+1) + '">' + img(it) + (has ? '' : '<span class="ph-tag">Ảnh dựng 3D</span>') + '</button>'; }).join('');
    $('#phNote').textContent = has ? 'Ảnh chụp sản phẩm tại xưởng. Bấm vào ảnh để phóng to.' : 'Mẫu này chưa có ảnh chụp thực tế, tạm hiển thị ảnh dựng 3D theo kích thước và màu đang chọn.';
    $('#thumbs').onclick = function(e){
      var bt = e.target.closest('[data-gi]'); if (!bt) return;
      var im = bt.querySelector('img'); if (!im || !im.src) return;
      lightbox(im.src, p.name);
    };
  }
  update(false);
  Viewer.mount($('#pdViewer'), p, o);
  $('#pdSizes').onclick = function(e){ var b = e.target.closest('button'); if (!b) return; o.W = +b.getAttribute('data-w'); $('#cW').value = o.W; update(true); };
  $$('.swatches').forEach(function(box){ box.onclick = function(e){ var b = e.target.closest('button'); if (!b) return; o[box.getAttribute('data-part')] = b.getAttribute('data-id'); o = optsOf(p, o); $$('button', box).forEach(function(x){ x.setAttribute('aria-pressed', x === b); }); box.previousElementSibling.querySelector('span').textContent = b.getAttribute('title'); update(true); }; });
  $('#qDec').onclick = function(){ qty = Math.max(1, qty-1); $('#qOut').textContent = qty; };
  $('#qInc').onclick = function(){ qty++; $('#qOut').textContent = qty; };
  $('#addCart').onclick = function(){ addToCart(p, o, qty); };
  $('#custBtn').onclick = function(){ var c = $('#custom'); c.hidden = !c.hidden; this.setAttribute('aria-expanded', !c.hidden); };
  $('#cApply').onclick = function(){ var inp = $('#cW'), v = Math.round(+inp.value / 5) * 5; v = Math.max(+inp.min, Math.min(+inp.max, v || o.W)); inp.value = v; o.W = v; update(true); };
  $('#vDim').onclick = function(){ Viewer.dimOn = !Viewer.dimOn; this.setAttribute('aria-pressed', Viewer.dimOn); this.textContent = Viewer.dimOn ? 'Kích thước: tự động theo góc nhìn' : 'Kích thước: tắt'; };
  $('#vTop').onclick = function(){ Viewer.view('top'); };
  $('#vBack').onclick = function(){ Viewer.view('back'); };
  $('#vReset').onclick = function(){ Viewer.view('home'); };
  var lb = $('#vLid'); if (lb) lb.onclick = function(){ Viewer.lidOpen = !Viewer.lidOpen; lb.setAttribute('aria-pressed', Viewer.lidOpen); lb.textContent = Viewer.lidOpen ? 'Đóng nắp hộc dây' : 'Mở nắp hộc dây'; };
}
function lightbox(src, alt){
  var L = $('#layer');
  L.innerHTML = '<div class="scrim" data-close></div><div class="lightbox" role="dialog" aria-modal="true" aria-label="' + esc(alt) + '"><img src="' + src + '" alt="' + esc(alt) + '"><button class="icon-btn" data-x aria-label="Đóng">✕</button></div>';
  L.onclick = function(e){ if (e.target.closest('[data-x],[data-close]')) closeLayer(); };
  L.querySelector('[data-x]').focus();
}
function swatchBlock(title, part, list, cur){
  return '<div class="opt"><h4>' + esc(title) + ' <span>' + esc(byId(list, cur).name) + '</span></h4><div class="swatches" data-part="' + part + '">' +
    list.map(function(m){ return '<button class="sw" data-id="' + m.id + '" title="' + esc(m.name) + '" aria-label="' + esc(m.name) + '" aria-pressed="' + (m.id === cur) + '" style="background:' + m.c + '"></button>'; }).join('') + '</div></div>';
}

/* ================= ĐIỀU HƯỚNG ================= */
var lastList = '';
function route(){
  hideMega();
  var h = (location.hash || '').slice(1), c, s, p;
  if (h !== lastList && !/^p\d+$/.test(h)){ state.filters = {}; state.shown = 12; state.sort = 'pop'; lastList = h; }
  if (!h || h === 'home'){ pageHome(); document.title = 'Mộc Thuận Nội Thất'; }
  else if (h.indexOf('c-') === 0 && (c = CATS.filter(function(x){ return x.id === h.slice(2); })[0])){
    pageList({title:c.name, crumbs:[[c.name]], items:PRODUCTS.filter(function(x){ return x.cat === c; }),
      chips:c.subs.map(function(x){ return '<a class="chip" href="' + subHref(x) + '">' + esc(x.name) + '</a>'; }).join('')});
  }
  else if (h.indexOf('s-') === 0 && (s = SUBS[h.slice(2)])){
    pageList({title:s.name, crumbs:[[s.cat.name, catHref(s.cat)], [s.name]], items:PRODUCTS.filter(function(x){ return x.sub === s; }),
      chips:s.cat.subs.map(function(x){ return '<a class="chip" href="' + subHref(x) + '"' + (x === s ? ' aria-current="true"' : '') + '>' + esc(x.name) + '</a>'; }).join('')});
  }
  else if (h === 'moi') pageList({title:'Mẫu mới về xưởng', crumbs:[['Mẫu mới']], items:PRODUCTS.filter(function(x){ return x.isNew; })});
  else if (h === 'tim'){
    var words = fold(state.q).split(' ').filter(Boolean);
    var items = PRODUCTS.filter(function(x){ var t = fold(x.name + ' ' + x.sub.name + ' ' + x.cat.name + ' ' + dimsText(x, x.W) + ' ' + x.code); return words.every(function(w){ return t.indexOf(w) >= 0; }); });
    pageList({title:'Kết quả cho “' + state.q + '”', crumbs:[['Tìm kiếm']], items:items});
  }
  else if (Account.route(h)) {}
  else if ((p = PBY[h])) pageProduct(p);
  else { pageHome(); }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
if (PREVIEW_ASKED) document.body.insertAdjacentHTML('afterbegin', '<div class="preview-bar" role="status">' +
  (PREVIEW ? 'Đang xem thử bản nháp từ trang quản lý. Khách vào web chưa thấy các thay đổi này.' : 'Không có bản nháp nào (hoặc trình duyệt không cho đọc), đang hiện dữ liệu trong catalog.js.') +
  ' <a href="index.html">Thoát xem thử</a></div>');
Api.wake(); buildNav(); saveCart(); Account.init(); route();
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){ if (Viewer.r && Viewer.model){ var cur = (location.hash || '').slice(1); route(); } });
