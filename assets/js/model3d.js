/* Mộc Thuận Nội Thất — dựng mô hình 3D, kích thước theo góc nhìn, ảnh dựng 3D, trình xem 3D (cần three.js r128) */
"use strict";

/* ================= DỰNG 3D (1 đơn vị = 10 cm) ================= */
var G = {};
function mat(hex, opts){ var m = new THREE.MeshLambertMaterial({color:new THREE.Color(hex)}); if (opts) Object.assign(m, opts); return m; }
function shade(hex, f){ var c = new THREE.Color(hex); c.multiplyScalar(f); return c; }
function B(g, w, h, d, m, x, y, z){ var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; }
function C(g, rt, rb, h, m, x, y, z, seg){ var o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), m); o.position.set(x, y, z); g.add(o); return o; }
function bar(g, a, b, t, m){ // thanh vuông nối 2 điểm
  var A = new THREE.Vector3(a[0],a[1],a[2]), Bv = new THREE.Vector3(b[0],b[1],b[2]);
  var len = A.distanceTo(Bv), o = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), m);
  o.position.copy(A).add(Bv).multiplyScalar(.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), Bv.clone().sub(A).normalize());
  g.add(o); return o;
}

/* ================= MÔ HÌNH RIÊNG (.glb) =================
   p.model = {src, W, D, H, rot:[x, y], dims:[{a, b, t, v}]}: dùng file .glb tải lên thay cho bộ dựng GEN.
   W/D/H: kích thước thật (cm) để co mô hình (chỉ có W thì co đều); rot: số lần xoay 90° quanh trục ngang / trục đứng;
   dims: kích thước chi tiết tự nhập; a, b = điểm đầu/cuối theo tỉ lệ 0..1 của khối bao; v = hướng nhìn front/side/top/back.
   Tải không được (mở bằng file://, sai đường dẫn) thì quay về mô hình dựng từ GEN. */
var Scan = { cache:{}, resolve:function(src){ return src; },
  state: function(src){ var c = this.cache[src]; return c ? c.state : ''; },
  load: function(src, cb){
    var c = this.cache[src];
    if (c){ if (c.state === 'loading'){ if (cb) c.wait.push(cb); } else if (cb) cb(); return; }
    c = this.cache[src] = {state:'loading', wait:cb ? [cb] : []};
    function finish(state, scene){ c.state = state; c.scene = scene; var w = c.wait; c.wait = []; w.forEach(function(f){ f(); }); }
    if (!HAS3D || !THREE.GLTFLoader){ finish('err'); return; }
    var L = new THREE.GLTFLoader();
    if (THREE.DRACOLoader){ var dl = new THREE.DRACOLoader(); dl.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/'); L.setDRACOLoader(dl); }
    L.load(this.resolve(src), function(gl){ finish('ok', prepScan(gl.scene)); }, undefined, function(){ finish('err'); });
  },
  forget: function(src){ delete this.cache[src]; }
};
// ảnh quét đã có sẵn ánh sáng nên hiện thẳng màu ảnh; mô hình không có ảnh dán thì dùng vật liệu có đổ bóng như mô hình dựng
function prepScan(root){
  function conv(m){
    if (m.map){ m.map.encoding = THREE.LinearEncoding; m.map.needsUpdate = true; return new THREE.MeshBasicMaterial({map:m.map, side:m.side, transparent:m.transparent, alphaTest:m.alphaTest}); }
    return new THREE.MeshLambertMaterial({color:m.color ? m.color.clone().convertLinearToSRGB() : 0xcccccc, side:m.side, vertexColors:m.vertexColors});
  }
  root.traverse(function(n){ if (n.isMesh){ n.userData.keep = true; n.material = Array.isArray(n.material) ? n.material.map(conv) : conv(n.material); } });
  return root;
}
function scanBuild(p){
  var m = p.model, rot = m.rot || [0, 0];
  var pivot = new THREE.Group(), holder = new THREE.Group();
  pivot.add(Scan.cache[m.src].scene.clone(true)); pivot.rotation.set(rot[0]*Math.PI/2, rot[1]*Math.PI/2, 0, 'YXZ');
  holder.add(pivot); holder.updateMatrixWorld(true);
  var size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  if (!(size.x > 0 && size.y > 0 && size.z > 0)) return null;
  var sx = (m.W || p.W)/10/size.x, sy = m.H ? m.H/10/size.y : sx, sz = m.D ? m.D/10/size.z : sx;
  holder.scale.set(sx, sy, sz); holder.updateMatrixWorld(true);
  var box = new THREE.Box3().setFromObject(holder), ctr = box.getCenter(new THREE.Vector3());
  holder.position.set(-ctr.x, -box.min.y, -ctr.z);
  var g = new THREE.Group(); g.add(holder);
  var W = size.x*sx, H = size.y*sy, D = size.z*sz;
  function pt(n){ return [-W/2 + n[0]*W, n[1]*H, -D/2 + n[2]*D]; }
  return {g:g, info:{W:W*10, D:D*10, H:H*10, kind:'scan', scan:true,
    custom:(m.dims || []).map(function(d){ return {a:pt(d.a), b:pt(d.b), t:d.t, v:d.v}; })}};
}

function buildModel(p, o){
  if (p.model && Scan.state(p.model.src) === 'ok'){ var s = scanBuild(p); if (s) return s; }
  var k = p.k, g = new THREE.Group();
  var W = o.W/10, D = k.D/10, H = k.H/10;
  var wood = mat(o.woodC), woodD = mat(shade(o.woodC, .82)), frame = mat(o.frameC), uph = mat(o.uphC);
  var metal = mat('#A9ADB1'), dark = mat('#2B2C2E'), white = mat('#F1F0EC');
  var st = p.style, info = {W:o.W, D:k.D, H:k.H, kind:k.gen};
  var fn = GEN[k.gen]; fn(g, {k:k, p:p, W:W, D:D, H:H, wood:wood, woodD:woodD, frame:frame, uph:uph, metal:metal, dark:dark, white:white, st:st, o:o, info:info});
  return {g:g, info:info};
}

function legsDesk(g, a, W, D, H, t, style){
  var f = a.frame, ins = .35, s = .4, x0 = W/2 - ins - s/2;
  if (/X/.test(style)){
    [-x0, x0].forEach(function(x){
      bar(g, [x, 0, -D/2+.4], [x, H-t, D/2-.4], .35, f);
      bar(g, [x, 0, D/2-.4], [x, H-t, -D/2+.4], .35, f);
    });
    bar(g, [-x0, (H-t)/2, 0], [x0, (H-t)/2, 0], .3, f);
    return;
  }
  if (/gỗ/.test(style)){
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ B(g, .45, H-t, .45, a.wood, q[0]*(W/2-.5), (H-t)/2, q[1]*(D/2-.45)); });
    B(g, W-1, .7, .2, a.woodD, 0, H-t-.35, -D/2+.45); B(g, W-1, .7, .2, a.woodD, 0, H-t-.35, D/2-.45);
    return;
  }
  // U hoặc hộp vuông
  [-x0, x0].forEach(function(x){
    B(g, s, H-t, s, f, x, (H-t)/2, -D/2+.45); B(g, s, H-t, s, f, x, (H-t)/2, D/2-.45);
    B(g, s, s, D-.5, f, x, H-t-s/2, 0);
    if (/hộp|vuông/.test(style)) B(g, s, s, D-.5, f, x, s/2, 0); else B(g, s*1.1, .25, D-.2, f, x, .12, 0);
  });
  B(g, W-2*ins-s, .5, .15, f, 0, H-t-.6, -D/2+.45);
}

var GEN = {
  desk: function(g, a){
    var W=a.W, D=a.D, H=a.H, t=.25;
    B(g, W, t, D, a.wood, 0, H-t/2, 0);
    if (/hộc/.test(a.st)){
      var cw = Math.min(4, W*.3), cx = W/2 - cw/2 - .2;
      B(g, cw, H-t, D-.6, a.woodD, cx, (H-t)/2, -.1);
      for (var i=0;i<3;i++){ var fh = (H-t-.3)/3; B(g, cw-.1, fh-.08, .15, a.wood, cx, .2 + fh/2 + i*fh, D/2-.35); B(g, cw*.35, .08, .08, a.metal, cx, .2 + fh*.75 + i*fh, D/2-.24); }
      var s=.4, x=-W/2+.55;
      B(g, s, H-t, s, a.frame, x, (H-t)/2, -D/2+.45); B(g, s, H-t, s, a.frame, x, (H-t)/2, D/2-.45);
      B(g, s, s, D-.5, a.frame, x, H-t-s/2, 0); B(g, s*1.1, .25, D-.2, a.frame, x, .12, 0);
    } else legsDesk(g, a, W, D, H, t, a.st);
  },
  cluster: function(g, a){
    var n = a.k.n, per = a.W, W = per*n/2, D=a.D, H=a.H, t=.25;
    a.info.W = a.o.W*n/2;
    B(g, W, t, D, a.wood, 0, H-t/2, 0);
    for (var i=0;i<=n/2;i++){
      var x = -W/2 + .3 + i*(W-.6)/(n/2);
      B(g, .4, H-t, .4, a.frame, x, (H-t)/2, -D/2+.5); B(g, .4, H-t, .4, a.frame, x, (H-t)/2, D/2-.5);
      B(g, .4, .4, D-.6, a.frame, x, H-t-.2, 0); B(g, .45, .25, D-.3, a.frame, x, .12, 0);
    }
    var scr = /nỉ/.test(a.st) ? a.uph : a.woodD;
    if (/nỉ/.test(a.st)) scr = mat('#7E8A86');
    B(g, W-.2, 3.5, .2, scr, 0, H+1.75, 0);
    for (var j=0;j<n/2;j++){ var cx = -W/2 + per*(j+.5); B(g, .9, .5, .6, mat('#2B2C2E'), cx, H+.25, -.6); B(g, .9, .5, .6, mat('#2B2C2E'), cx, H+.25, .6); }
    a.info.extraFront = [{label:'vách cao 35 cm', from:[W/2+.6, H, 0], to:[W/2+.6, H+3.5, 0], tick:[1,0,0]}];
  },
  table: function(g, a){
    var W=a.W, D=a.D, H=a.H, t=.3;
    B(g, W, t, D, a.wood, 0, H-t/2, 0);
    if (a.k.bar){
      [-1,1].forEach(function(s){ var x = s*(W/2-.5); B(g,.4,H-t,.4,a.frame,x,(H-t)/2,0); B(g,.4,.25,D-.4,a.frame,x,.12,0); });
      B(g, W-1, .3, .3, a.frame, 0, 2.8, 0);
      return;
    }
    if (/sắt/.test(a.st)) legsDesk(g, a, W, D, H, t, 'U');
    else {
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ B(g, .5, H-t, .5, /hộp/.test(a.st)?a.woodD:a.wood, q[0]*(W/2-.5), (H-t)/2, q[1]*(D/2-.45)); });
      B(g, W-1.2, .6, .2, a.woodD, 0, H-t-.3, -D/2+.45); B(g, W-1.2, .6, .2, a.woodD, 0, H-t-.3, D/2-.45);
    }
    if (/kệ dưới/.test(a.st)) B(g, W-1.1, .2, D-.9, a.wood, 0, H*.25, 0);
    if (W > 20){ B(g, 2.4, .15, 1.2, a.metal, 0, H+.01, 0); }
  },
  round: function(g, a){
    var R = a.W/2, H=a.H, t=.3;
    C(g, R, R, t, a.wood, 0, H-t/2, 0, 40);
    if (/sắt/.test(a.st)){
      for (var i=0;i<3;i++){ var an = i*Math.PI*2/3; bar(g, [Math.cos(an)*R*.55, 0, Math.sin(an)*R*.55], [Math.cos(an)*R*.25, H-t, Math.sin(an)*R*.25], .25, a.frame); }
      C(g, R*.3, R*.3, .2, a.frame, 0, H-t-.1, 0);
    } else {
      C(g, .3, .3, H-t, a.frame, 0, (H-t)/2, 0); C(g, R*.6, R*.65, .15, a.frame, 0, .08, 0, 32);
    }
    a.info.round = true;
  },
  counter: function(g, a){
    var W=a.W, D=a.D, H=a.H;
    B(g, W, H, .25, a.wood, 0, H/2, D/2-.12);
    B(g, W+.2, .25, 1.2, a.woodD, 0, H+.12, D/2-.3);
    B(g, .25, H, D, a.wood, -W/2+.12, H/2, 0); B(g, .25, H, D, a.wood, W/2-.12, H/2, 0);
    B(g, W-.5, .25, D-.3, a.wood, 0, 7.5-.12, -.15);
    if (/nan/.test(a.st)) for (var x=-W/2+.4; x<W/2-.2; x+=.5) B(g, .25, H-.2, .1, a.woodD, x, H/2, D/2+.05);
  },
  cabinet: function(g, a){
    var W=a.W, D=a.D, H=a.H, k=a.k, lay=k.lay, ft=.18, base = k.legs ? 1.2 : (a.k.wheels ? .7 : .6);
    var bh = H - base, z = D/2;
    var car = a.woodD, fr = a.wood;
    if (lay === 'kitchen' || lay === 'island'){ bh = H - .4 - .9; base = .9; }
    B(g, W, bh, D-.1, car, 0, base + bh/2, -.05);
    if (k.legs) [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ B(g,.3,base,.3,a.frame,q[0]*(W/2-.35),base/2,q[1]*(D/2-.35)); });
    else if (k.wheels) [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ var w = C(g,.28,.28,.2,a.dark,q[0]*(W/2-.5),.3,q[1]*(D/2-.6),14); w.rotation.z = Math.PI/2; });
    else B(g, W-.2, base, D-.4, a.dark, 0, base/2, -.15);
    function door(x, y, w, h, hx){ B(g, w-.06, h-.06, ft, fr, x, y, z); B(g, .08, Math.min(1.6, h*.35), .1, a.frame, x + hx*(w/2-.35), y, z+.14); }
    function drawer(x, y, w, h){ B(g, w-.06, h-.06, ft, fr, x, y, z); B(g, Math.min(1.4, w*.35), .08, .1, a.frame, x, y + h*.22, z+.14); }
    var top = base + bh;
    if (lay === 'doors'){
      var nd = W >= 6 ? 2 : 1;
      if (/kính/.test(a.st)){
        var hh = bh*.45;
        for (var i=0;i<nd;i++){ var x = -W/2 + W/nd*(i+.5); B(g, W/nd-.06, hh-.06, ft, mat('#B8C7C9',{transparent:true,opacity:.55}), x, top-hh/2, z); door(x, base+(bh-hh)/2, W/nd, bh-hh, i? -1:1); }
        for (var s=1;s<3;s++) B(g, W-.4, .15, D-.4, fr, 0, top - hh*s/3, 0);
      } else for (var i2=0;i2<nd;i2++) door(-W/2 + W/nd*(i2+.5), base+bh/2, W/nd, bh, i2 ? -1 : 1);
    } else if (lay === 'drawers'){
      var n = /hồ sơ/.test(a.st) ? 2 : (H <= 6 && !a.k.wheels ? 2 : 3);
      if (/hộc mở/.test(a.st)){ drawer(0, base + bh*.75, W, bh/2); B(g, W-.4, bh/2-.3, .1, a.dark, 0, base+bh*.25, z-.3); }
      else if (/hồ sơ/.test(a.st)){ drawer(0, top - bh*.18, W, bh*.36); drawer(0, base + bh*.32, W, bh*.64); }
      else for (var j=0;j<n;j++) drawer(0, base + bh/n*(j+.5), W, bh/n);
    } else if (lay === 'mixed'){
      if (/^ngăn kéo/.test(a.st)) { for (var j2=0;j2<3;j2++) drawer(0, base + bh/3*(j2+.5), W, bh/3); }
      else { drawer(-W/4, top - bh*.15, W/2, bh*.3); drawer(W/4, top - bh*.15, W/2, bh*.3); door(-W/4, base + bh*.35, W/2, bh*.7, 1); door(W/4, base + bh*.35, W/2, bh*.7, -1); }
    } else if (lay === 'locker'){
      var cols = /12/.test(a.st) ? 4 : 3, rows = 3;
      for (var c=0;c<cols;c++) for (var r=0;r<rows;r++){
        var x2 = -W/2 + W/cols*(c+.5), y2 = base + bh/rows*(r+.5);
        B(g, W/cols-.06, bh/rows-.06, ft, fr, x2, y2, z);
        B(g, .35, .35, .08, a.dark, x2 + W/cols*.28, y2, z+.12);
        for (var v=0;v<3;v++) B(g, W/cols*.4, .05, .05, car, x2-.2, y2 + bh/rows*.3 - v*.15, z+.1);
      }
    } else if (lay === 'tv'){
      if (/hai bên/.test(a.st)){ B(g, W*.3, bh-.3, .1, a.dark, -W/2+W*.17, base+bh/2, z-.3); B(g, W*.3, bh-.3, .1, a.dark, W/2-W*.17, base+bh/2, z-.3); drawer(0, base+bh*.75, W*.36, bh/2); drawer(0, base+bh*.25, W*.36, bh/2); }
      else { drawer(-W*.25, base+bh/2, W/2, bh); drawer(W*.25, base+bh/2, W/2, bh); }
    } else if (lay === 'wardrobe'){
      var dn = Math.max(2, Math.round(W/5)), dh = /ngăn kéo/.test(a.st) ? bh*.18 : 0;
      for (var w=0; w<dn; w++) door(-W/2 + W/dn*(w+.5), base + dh + (bh-dh)/2, W/dn, bh-dh, w%2 ? -1 : 1);
      if (dh) { drawer(-W/4, base + dh/2, W/2, dh); drawer(W/4, base + dh/2, W/2, dh); }
    } else if (lay === 'kitchen' || lay === 'island'){
      var stone = /đá/.test(a.st) || lay === 'island' ? mat('#DAD7D0') : a.wood;
      var ov = lay === 'island' && /ngồi/.test(a.st) ? 2.5 : .3;
      B(g, W + .2, .4, D + ov, stone, 0, H - .2, ov/2 - .15);
      var kn = Math.max(2, Math.round(W/5));
      for (var q2=0;q2<kn;q2++){ var x3 = -W/2 + W/kn*(q2+.5); drawer(x3, top - 1, W/kn, 2); door(x3, base + (bh-2)/2, W/kn, bh-2, q2%2 ? -1 : 1); }
      if (lay === 'island' && !/ngồi/.test(a.st)) for (var q3=0;q3<kn;q3++) B(g, W/kn-.06, bh-.06, ft, fr, -W/2 + W/kn*(q3+.5), base+bh/2, -D/2-.05);
    }
  },
  shelf: function(g, a){
    var W=a.W, D=a.D, H=a.H, k=a.k, t=.18;
    var n = Math.max(2, Math.round(H/3.6)), from = k.wash ? 9 : 0;
    if (/4 tầng/.test(a.st)) n = 4; if (/5 tầng/.test(a.st)) n = 5;
    if (k.pipe || k.wash && /sắt/.test(a.st) || /khung mở/.test(a.st) && !k.pipe){
      var pm = k.pipe ? mat('#4A4D50') : a.frame;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ C(g, k.pipe?.14:.12, k.pipe?.14:.12, H, pm, q[0]*(W/2-.2), H/2, q[1]*(D/2-.2), 12); });
      if (/khung mở/.test(a.st) && !k.pipe){ [-1,1].forEach(function(s){ bar(g,[s*(W/2-.2),.4,-D/2+.2],[s*(W/2-.2),H-.4,D/2-.2],.1,a.frame); }); }
    } else {
      B(g, t, H, D, a.woodD, -W/2+t/2, H/2, 0); B(g, t, H, D, a.woodD, W/2-t/2, H/2, 0);
      if (/hậu/.test(a.st)) B(g, W-.1, H-.1, .08, shade(a.o.woodC,.7) && mat(shade(a.o.woodC,.7)), 0, H/2, -D/2+.04);
    }
    for (var i=0;i<=n;i++){
      var y = from + (H - from - t) * i / n + t/2;
      if (i === 0 && from) y = from;
      B(g, W - (k.pipe ? 0 : .05), t, D, a.wood, 0, Math.min(y, H - t/2), 0);
    }
    if (k.wash){ var m = new THREE.Group(); B(m, 6, 8.5, 5.6, a.white, 0, 4.25, 0); var dr = C(m, 1.8, 1.8, .2, mat('#BFC6CA'), 0, 4.6, 2.85, 30); dr.rotation.x = Math.PI/2; m.position.set(0, 0, 0); m.scale.set(Math.min(1,(W-.6)/6), 1, Math.min(1, (D+2)/5.6)); g.add(m); a.info.note = 'chỗ máy giặt cao 90 cm'; }
  },
  chair: function(g, a){
    var W=a.W, D=a.D, H=a.H, S=a.k.seat/10;
    var seatM = a.k.parts.indexOf('u') >= 0 ? a.uph : a.wood, legM = /sắt/.test(a.st) ? a.frame : a.woodD, ls = /sắt/.test(a.st) ? .22 : .38;
    B(g, W, .35, D, seatM, 0, S-.17, 0);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ B(g, ls, S-.35, ls, legM, q[0]*(W/2-.3), (S-.35)/2, q[1]*(D/2-.3)); });
    [-1,1].forEach(function(s){ B(g, ls, H-S, ls, legM, s*(W/2-.3), S + (H-S)/2, -D/2+.3); });
    if (/nan/.test(a.st)) { for (var i=-1;i<=1;i++) B(g, .5, H-S-1.4, .12, a.wood, i*W*.22, S+(H-S)/2-.3, -D/2+.3); B(g, W-.3, .7, .2, a.wood, 0, H-.5, -D/2+.3); }
    else B(g, W-.3, /cong/.test(a.st) ? 1.4 : 1, .2, a.wood, 0, H-.9, -D/2+.3);
    B(g, W-.6, .25, .2, legM, 0, S*.35, D/2-.3); B(g, W-.6, .25, .2, legM, 0, S*.35, -D/2+.3);
    a.info.seat = a.k.seat;
  },
  chairOffice: function(g, a){
    var W=a.W, D=a.D, H=a.H, S=a.k.seat/10, R=W/2*.95;
    for (var i=0;i<5;i++){ var an = i*Math.PI*2/5; var arm = bar(g, [0,.5,0], [Math.cos(an)*R, .35, Math.sin(an)*R], .3, a.frame); var w = C(g,.25,.25,.2,a.dark,Math.cos(an)*R,.25,Math.sin(an)*R,12); w.rotation.z = Math.PI/2; }
    C(g, .45, .45, .4, a.frame, 0, .55, 0); C(g, .22, .22, S-1.1, a.metal, 0, .5 + (S-1.1)/2, 0);
    B(g, W*.62, .4, .5, a.dark, 0, S-.6, 0);
    B(g, W*.88, .7, D*.82, a.uph, 0, S-.1, .3);
    var bk = /lưới/.test(a.st) ? mat(shade(a.o.uphC, .55)) : a.uph;
    var back = B(g, W*.82, H-S-1.2, .5, bk, 0, S+.3+(H-S-1.2)/2, -D/2+.6); back.rotation.x = -.12;
    B(g, .35, 1.6, .35, a.dark, 0, S+.1, -D/2+.45);
    if (/tựa đầu/.test(a.st)) { var hr = B(g, W*.45, 1.1, .45, bk, 0, H+.3, -D/2+.35); hr.rotation.x = -.15; }
    [-1,1].forEach(function(s){ B(g, .25, 2, .25, a.dark, s*W*.44, S+.9, -.2); B(g, .7, .25, 2.4, a.dark, s*W*.44, S+2, 0); });
    a.info.seat = a.k.seat;
  },
  bench: function(g, a){
    var W=a.W, D=a.D, H=a.H;
    B(g, W, .4, D, a.wood, 0, H-.2, 0);
    [-1,1].forEach(function(s){
      var x = s*(W/2-.6);
      if (/gỗ/.test(a.st)) { B(g, .5, H-.4, D-.6, a.woodD, x, (H-.4)/2, 0); }
      else { B(g,.3,H-.4,.3,a.frame,x,(H-.4)/2,-D/2+.35); B(g,.3,H-.4,.3,a.frame,x,(H-.4)/2,D/2-.35); B(g,.3,.3,D-.4,a.frame,x,.15,0); }
    });
    a.info.seat = a.k.seat;
  },
  stool: function(g, a){
    var R = a.W/2, S = a.k.seat/10, cush = /nệm/.test(a.st);
    C(g, R, R*.95, cush ? .6 : .35, cush ? a.uph : a.wood, 0, S - (cush ? .3 : .17), 0, 32);
    var lm = /gỗ/.test(a.st) ? a.woodD : a.frame;
    for (var i=0;i<4;i++){ var an = Math.PI/4 + i*Math.PI/2; bar(g, [Math.cos(an)*R*.95, 0, Math.sin(an)*R*.95], [Math.cos(an)*R*.6, S-.4, Math.sin(an)*R*.6], .22, lm); }
    if (S > 5){ var ring = new THREE.Mesh(new THREE.TorusGeometry(R*.82, .1, 8, 32), lm); ring.rotation.x = Math.PI/2; ring.position.y = S*.35; g.add(ring); }
    a.info.seat = a.k.seat; a.info.round = true;
  },
  sofa: function(g, a){
    var W=a.W, D=a.D, H=a.H, S=a.k.seat/10, aw = /mảnh/.test(a.st) ? .8 : 1.6;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ C(g,.15,.12,1,a.woodD,q[0]*(W/2-.6),.5,q[1]*(D/2-.6),10); });
    B(g, W, S-1.6, D, a.uph, 0, 1 + (S-1.6)/2, 0);
    var n = W >= 20 ? 3 : 2, cw = (W - 2*aw)/n;
    for (var i=0;i<n;i++){ B(g, cw-.08, 1, D-1.8, mat(shade(a.o.uphC, 1.05)), -W/2+aw+cw*(i+.5), S-.5, .7); B(g, cw-.1, H-S-.2, 1.4, a.uph, -W/2+aw+cw*(i+.5), S+(H-S)/2-.3, -D/2+1.4); }
    B(g, W, H-1, 1.1, a.uph, 0, 1 + (H-1)/2, -D/2+.55);
    [-1,1].forEach(function(s){ B(g, aw, H*.72-1, D, a.uph, s*(W/2-aw/2), 1 + (H*.72-1)/2, 0); });
    a.info.seat = a.k.seat;
  },
  bed: function(g, a){
    var Wm = a.W, L = a.k.D/10, H=a.H, fw = Wm + .6, fl = L + .5;
    a.info.W = a.o.W + 6; a.info.D = a.k.D + 15; a.info.mattress = a.o.W + ' × ' + a.k.D;
    var head = /bọc/.test(a.st) ? a.uph : a.wood;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ B(g,.4,1,.4,a.woodD,q[0]*(fw/2-.3),.5,q[1]*(fl/2-.3)); });
    B(g, fw, 1.6, fl, a.wood, 0, 1.8, .5);
    B(g, Wm, 2, L, mat('#EEECE6'), 0, 3.6, .5);
    B(g, fw, H, .8, head, 0, H/2, -fl/2+.1);
    if (/bọc/.test(a.st)) for (var i=0;i<4;i++) B(g, fw/4-.15, H-3.2, .3, mat(shade(a.o.uphC,1.06)), -fw/2+fw/4*(i+.5), 3.2 + (H-3.2)/2, -fl/2+.6);
    B(g, Wm*.32, .9, 1.4, a.white, -Wm*.22, 5, -L/2+1.6); B(g, Wm*.32, .9, 1.4, a.white, Wm*.22, 5, -L/2+1.6);
    a.info.D = a.k.D + 15; a.info.shiftZ = .5;
  },
  mirror: function(g, a){
    var W=a.W, H=a.H;
    var stand = /đứng/.test(a.st);
    var fm = B(g, W, H, .4, a.wood, 0, H/2+(stand?.1:0), 0);
    B(g, W-.8, H-.8, .1, mat('#C7D2D5'), 0, H/2+(stand?.1:0), .22);
    if (stand){ fm.rotation.x = -.12; bar(g, [0, H*.7, -.2], [0, 0, -3], .3, a.woodD); }
  },
  power: function(g, a){
    var W=a.W, D=a.D, H=a.H;
    B(g, W, H, D, a.frame, 0, H/2, 0);
    B(g, W+.3, .08, D+.3, a.metal, 0, H, 0);
    var n = /3/.test(a.st) ? 3 : 2;
    for (var i=0;i<n;i++){ B(g, .7, .04, .7, a.white, -W/2+.6+i*.9, H+.05, 0); }
    if (n === 3) { B(g, .25, .04, .12, a.dark, W/2-.6, H+.05, -.2); B(g, .25, .04, .12, a.dark, W/2-.6, H+.05, .2); }
  },
  tray: function(g, a){
    var W=a.W, D=a.D, H=a.H, m = a.frame;
    B(g, W, .05, D, m, 0, .025, 0); B(g, W, H, .05, m, 0, H/2, -D/2); B(g, W, H*.6, .05, m, 0, H*.3, D/2);
    if (/lưới/.test(a.st)) for (var x=-W/2+.3;x<W/2;x+=.5) B(g, .03, H, .06, a.dark, x, H/2, -D/2+.03);
    [-1,1].forEach(function(s){ B(g, .3, .05, D+.6, m, s*(W/2-.6), H, -.3); });
  },
  cpu: function(g, a){
    var W=a.W, D=a.D, H=a.H;
    B(g, W, .15, D, a.frame, 0, .45, 0);
    [-1,1].forEach(function(s){ B(g, .12, H-.4, D*.6, a.frame, s*(W/2-.06), .5+(H-.4)/2, 0); });
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ var w = C(g,.2,.2,.18,a.dark,q[0]*(W/2-.4),.2,q[1]*(D/2-.5),12); w.rotation.z=Math.PI/2; });
  },
  arm: function(g, a){
    var H=a.H;
    B(g, 1, .3, 1.4, a.frame, 0, .15, 0); C(g, .18, .18, H-1, a.frame, 0, (H-1)/2+.3, 0, 14);
    bar(g, [0, H-1.2, 0], [2.2, H-.9, 1], .35, a.frame); bar(g, [2.2, H-.9, 1], [3.6, H-.4, 1.4], .3, a.frame);
    B(g, 1, 1, .15, a.dark, 3.6, H-.4, 1.6);
    a.info.W = 45; a.info.reach = true;
  },
  riser: function(g, a){
    var W=a.W, D=a.D, H=a.H;
    B(g, W, .2, D, a.wood, 0, H-.1, 0);
    if (/sắt/.test(a.st)) [-1,1].forEach(function(s){ B(g, .2, H-.2, D-.2, a.frame, s*(W/2-.3), (H-.2)/2, 0); });
    else { [-1,1].forEach(function(s){ B(g, .3, H-.2, D, a.woodD, s*(W/2-.15), (H-.2)/2, 0); }); B(g, W*.5, H*.55, .12, a.wood, 0, H*.4, D/2-.05); }
  },
  frame: function(g, a){
    var W=a.W, D=a.D, H=a.H, t=.25;
    var ghost = new THREE.Mesh(new THREE.BoxGeometry(W, t, D), mat('#9AA59F', {transparent:true, opacity:.18, depthWrite:false}));
    ghost.position.set(0, H + t/2, 0); g.add(ghost);
    if (a.k.lift){
      [-1,1].forEach(function(s){ var x = s*(W/2-1.2); B(g, .9, H*.55, .6, a.frame, x, H*.275, 0); B(g, .7, H*.5, .45, a.frame, x, H*.7, 0); B(g, .5, .35, D-.4, a.frame, x, .18, 0); B(g, .5, .3, D-1.2, a.frame, x, H-.15, 0); });
      B(g, W-2.6, .3, .5, a.frame, 0, H-.25, 0); B(g, 1.2, .25, .5, a.dark, -W/2+2.2, H-.6, D/2-1);
    } else {
      var st = /X/.test(a.st) ? 'X' : (/hộp/.test(a.st) ? 'hộp vuông' : 'U');
      legsDesk(g, a, W, D, H + t, t, st);
      B(g, W-1.2, .25, .5, a.frame, 0, H - .12, 0);
    }
    a.info.frameOnly = true;
  },
  roundFrame: function(g, a){
    var H=a.H;
    C(g, .3, .3, H, a.frame, 0, H/2, 0); C(g, 2.2, 2.3, .2, a.frame, 0, .1, 0, 32);
    B(g, 3.6, .15, .4, a.frame, 0, H-.07, 0); B(g, .4, .15, 3.6, a.frame, 0, H-.07, 0);
    var ghost = new THREE.Mesh(new THREE.CylinderGeometry(a.W/2, a.W/2, .3, 40), mat('#9AA59F', {transparent:true, opacity:.18, depthWrite:false}));
    ghost.position.y = H + .15; g.add(ghost);
    a.info.round = true; a.info.frameOnly = true;
  },
  top: function(g, a){
    var W=a.W, D=a.D, t = /18/.test(a.st) ? .18 : .25;
    B(g, W, t, D, a.wood, 0, 1 + t/2, 0);
    [-1,1].forEach(function(s){ B(g, .4, 1, D*.7, a.dark, s*(W/2-1.2), .5, 0); });
    a.info.H = /18/.test(a.st) ? 1.8 : 2.5; a.info.thick = true;
  },
  deskTray: function(g, a){
    // bàn có hộc dây khe vát — mô hình chi tiết từ hồ sơ thiết kế
    var TOP_W=a.W, TOP_D=a.D, TOP_T=.25, H=a.H, topY=H-TOP_T/2, zB=-TOP_D/2, zF=TOP_D/2;
    var OP_W = TOP_W-3, OP_B = zB+.41, OP_F = OP_B+1.18, cab = a.frame, cabIn = mat(shade(a.o.frameC,.85));
    B(g, TOP_W, TOP_T, zF-OP_F, a.wood, 0, topY, (OP_F+zF)/2);
    B(g, TOP_W, TOP_T, OP_B-zB, a.wood, 0, topY, (zB+OP_B)/2);
    var endW = (TOP_W-OP_W)/2;
    B(g, endW, TOP_T, 1.18, a.wood, -(OP_W+endW)/2, topY, (OP_B+OP_F)/2); B(g, endW, TOP_T, 1.18, a.wood, (OP_W+endW)/2, topY, (OP_B+OP_F)/2);
    var CAB_W=4, CAB_D=6, CAB_H=H-TOP_T, cabZ = zF-CAB_D/2, cabX = TOP_W/2-.5-CAB_W/2, FACE=(CAB_H-.18)/5-.03;
    [-cabX, cabX].forEach(function(cx){
      B(g, CAB_W, CAB_H, CAB_D, cabIn, cx, CAB_H/2, cabZ);
      for (var i=0;i<5;i++){ var y = .18 + FACE/2 + i*(FACE+.03); B(g, CAB_W-.08, FACE, .18, cab, cx, y, zF+.09); B(g, .96, .07, .05, a.metal, cx, y+FACE/2-.22, zF+.2); }
    });
    var TR_H=.8, trB = zB+.5, trF = trB+1, trY = H-TOP_T-TR_H/2, tray = a.white, trMid=(trB+trF)/2;
    B(g, OP_W, TR_H, .18, tray, 0, trY, trB); B(g, OP_W, TR_H, .18, tray, 0, trY, trF);
    B(g, OP_W, .12, 1.36, tray, 0, trY-TR_H/2, trMid);
    B(g, .18, TR_H, 1, tray, -OP_W/2, trY, trMid); B(g, .18, TR_H, 1, tray, OP_W/2, trY, trMid);
    B(g, 2.6, .45, .3, a.dark, 3, trY, trB+.32);
    C(g, .25, .25, .15, a.dark, 0, trY-TR_H/2, trMid);
    var lid = new THREE.Group(); lid.position.set(0, topY, OP_B); g.add(lid);
    var LW = OP_W-.04, SLW = OP_W-3, SX0 = -SLW/2, SX1 = SLW/2, S_T = 1.16-.25, S_B = 1.16-.13;
    B(lid, LW, TOP_T, S_T-.02, a.wood, 0, 0, (.02+S_T)/2);
    B(lid, (LW-SLW)/2, TOP_T, 1.16-S_T, a.wood, -(SLW+LW)/4 - 0, 0, (S_T+1.16)/2).position.x = (-LW/2+SX0)/2;
    B(lid, (LW-SLW)/2, TOP_T, 1.16-S_T, a.wood, 0, 0, (S_T+1.16)/2).position.x = (SX1+LW/2)/2;
    var bev = B(lid, SLW, .03, Math.sqrt(.12*.12+TOP_T*TOP_T), a.woodD, 0, 0, (S_T+S_B)/2); bev.rotation.x = Math.atan2(TOP_T, .12);
    B(lid, SLW, TOP_T*.45, .12, a.wood, 0, -TOP_T*.27, (S_T+S_B)/2-.01);
    [-5,5].forEach(function(hx){ C(lid, .175, .175, .06, a.metal, hx, -TOP_T/2-.03, .3, 16); B(lid, .18, .06, .34, a.metal, hx, -TOP_T/2-.06, .08); B(g, .22, .45, .05, a.metal, hx, trY+.05, trB+.12); });
    a.info.lid = lid; a.info.tray = {OP_W:OP_W, SLW:SLW, OP_B:OP_B, OP_F:OP_F, zB:zB, zF:zF, trB:trB, trF:trF, trY:trY, TR_H:TR_H, slotZ:OP_B+1.1, cabX:cabX, CAB_W:CAB_W, CAB_D:CAB_D, CAB_H:CAB_H, trMid:trMid};
  }
};

/* ---------- kích thước theo góc nhìn ---------- */
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#1D6A50'; }
function makeDims(info, scale){
  var col = cssVar('--accent'), bg = cssVar('--surface'), ink = cssVar('--ink');
  var lineM = new THREE.LineBasicMaterial({color:new THREE.Color(col), depthTest:false, transparent:true});
  var zones = [], cur = null, S = scale;
  function V(p){ return new THREE.Vector3(p[0],p[1],p[2]); }
  function label(text, pos, size){
    var c = document.createElement('canvas'), x = c.getContext('2d'), fs = 44;
    var font = '600 ' + fs + 'px "Be Vietnam Pro", system-ui, sans-serif';
    x.font = font; var w = Math.ceil(x.measureText(text).width) + 34, h = fs + 24, r = 16;
    c.width = w; c.height = h; x.font = font;
    x.beginPath(); x.moveTo(r,2); x.lineTo(w-r,2); x.quadraticCurveTo(w-2,2,w-2,r); x.lineTo(w-2,h-r); x.quadraticCurveTo(w-2,h-2,w-r,h-2); x.lineTo(r,h-2); x.quadraticCurveTo(2,h-2,2,h-r); x.lineTo(2,r); x.quadraticCurveTo(2,2,r,2); x.closePath();
    x.fillStyle = bg; x.globalAlpha = .95; x.fill(); x.globalAlpha = 1; x.lineWidth = 3; x.strokeStyle = col; x.stroke();
    x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w/2, h/2 + 2);
    var tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, depthTest:false, transparent:true}));
    var sz = (size || 1) * S; sp.scale.set(sz*w/h, sz, 1); sp.position.copy(pos); sp.renderOrder = 11; cur.add(sp);
  }
  function seg(a, b){ var l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lineM.clone()); l.renderOrder = 10; cur.add(l); }
  function dim(a, b, tick, text, lift, mids){
    var A = V(a), Bv = V(b), T = V(tick).multiplyScalar(S*.3);
    seg(A, Bv); seg(A.clone().sub(T), A.clone().add(T)); seg(Bv.clone().sub(T), Bv.clone().add(T));
    (mids||[]).forEach(function(m){ var M = V(m); seg(M.clone().sub(T), M.clone().add(T)); });
    var m = A.clone().add(Bv).multiplyScalar(.5); if (lift) m.add(V(lift).multiplyScalar(S)); label(text, m);
  }
  function callout(text, at, off){ var A = V(at), P = A.clone().add(V(off)); seg(A, P); label(text, P, .85); }
  // kích thước tự nhập trên mô hình riêng: vạch hai đầu vuông góc với đoạn đo và hướng nhìn
  function custom(v, n){
    (info.custom || []).forEach(function(d){
      if (d.v !== v) return;
      var dir = V(d.b).sub(V(d.a)), tk = dir.clone().cross(V(n)); if (tk.length() < 1e-6) tk = V([0,1,0]); tk.normalize();
      dim(d.a, d.b, [tk.x, tk.y, tk.z], d.t, [tk.x*.7, tk.y*.7, tk.z*.7]);
    });
  }
  function zone(n, lo, hi){ var g = new THREE.Group(); g.visible = false; var z = {g:g, n:n ? V(n).normalize() : null, lo:lo, hi:hi, a:0, mats:[]}; zones.push(z); cur = g; return z; }

  var W = info.W/10, D = info.D/10, H = info.H/10, o = S*1.1, zs = info.shiftZ || 0;
  var zf = D/2 + zs, zb = -D/2 + zs;
  var t = info.tray;
  // MẶT TRƯỚC
  zone([0,.3,1], .55, .8);
  if (info.round){
    dim([-W/2, H+.05, 0], [W/2, H+.05, 0], [0,1,0], 'Ø ' + fcm(info.W) + ' cm', [0,.9,0]);
  } else if (!info.thick) {
    dim([-W/2, H+.05, zf+o], [W/2, H+.05, zf+o], [0,0,1], (info.kind==='bed' ? 'rộng ' : 'dài ') + fcm(info.W) + ' cm', [0,.6,0]);
  } else dim([-W/2, .05, zf+o], [W/2, .05, zf+o], [0,0,1], 'dài ' + fcm(info.W) + ' cm', [0,.6,0]);
  if (!info.thick) dim([W/2+o, 0, zf+o*.5], [W/2+o, H, zf+o*.5], [1,0,0], (info.kind==='bed' ? 'đầu giường cao ' : 'cao ') + fcm(info.H) + ' cm', [1.6,0,0]);
  if (info.seat) dim([-W/2-o, 0, zf], [-W/2-o, info.seat/10, zf], [1,0,0], 'cao ngồi ' + fcm(info.seat) + ' cm', [-1.8,0,0]);
  (info.extraFront || []).forEach(function(e){ dim(e.from, e.to, e.tick, e.label, [1.6,0,0]); });
  custom('front', [0,0,1]);
  if (t){
    var cIn = t.cabX - t.CAB_W/2;
    dim([-cIn, .05, t.zF+o], [cIn, .05, t.zF+o], [0,0,1], 'để chân ' + fcm(cIn*20) + ' cm', [0,.6,0]);
    dim([t.cabX-t.CAB_W/2, .05, t.zF+o], [t.cabX+t.CAB_W/2, .05, t.zF+o], [0,0,1], 'tủ 40 cm', [0,.6,0]);
  }
  // HAI BÊN
  [1,-1].forEach(function(sd){
    zone([sd,.2,0], .65, .85);
    if (info.round){ dim([sd*(W/2+o), H+.05, -W/2], [sd*(W/2+o), H+.05, W/2], [1,0,0], 'Ø ' + fcm(info.W) + ' cm', [0,.6,0]); }
    else if (info.thick) dim([sd*(W/2+o), 1.3, zb], [sd*(W/2+o), 1.3, zf], [1,0,0], 'rộng ' + fcm(info.D) + ' cm', [0,.6,0]);
    else dim([sd*(W/2+o), H+.05, zb], [sd*(W/2+o), H+.05, zf], [1,0,0], (info.kind==='bed' ? 'dài ' : 'sâu ') + fcm(info.D) + ' cm', [0,.6,0]);
    custom('side', [sd,0,0]);
    if (info.thick) dim([sd*(W/2+o), 1, zf+o], [sd*(W/2+o), 1 + info.H/10, zf+o], [1,0,0], 'dày ' + fcm(info.H*10) + ' mm', [1.8,0,0]);
    if (t){
      var tx = sd*(t.OP_W/2+.35), trTop = t.trY + t.TR_H/2, trBot = t.trY - t.TR_H/2 - .06;
      dim([tx, trBot-.15, t.trB-.09], [tx, trBot-.15, t.trF+.09], [0,1,0], 'hộp dây 13,6 cm', [0,-.7,0]);
      dim([tx, trBot, t.trB-.35], [tx, trTop, t.trB-.35], [0,0,1], 'cao 8 cm', [0,.2,-1.4]);
    }
  });
  // NHÌN TỪ TRÊN
  zone([0,1,0], .6, .85);
  var top = info.round ? 'mặt tròn Ø' + fcm(info.W) + ' cm' : (info.mattress ? 'nệm ' + info.mattress + ' cm' : 'mặt ' + fcm(info.W) + ' × ' + fcm(info.D) + ' cm');
  if (info.scan) top = 'chiếm chỗ ' + fcm(info.W) + ' × ' + fcm(info.D) + ' cm';
  custom('top', [0,1,0]);
  if (info.frameOnly) top = 'vừa mặt ' + fcm(info.W) + (info.round ? '' : ' × ' + fcm(info.D)) + ' cm';
  if (!t) label(top, V([0, H + S*1.5, zs]), 1.05);
  if (t){
    var ly = H + .35, OPh = t.OP_W/2, SL = t.SLW/2;
    dim([-SL, ly, t.slotZ+.5], [SL, ly, t.slotZ+.5], [0,0,1], 'khe vát ' + fcm(t.SLW*10) + ' × 2,5 cm', [0,0,.8]);
    dim([-OPh, ly, t.slotZ+.5], [-SL, ly, t.slotZ+.5], [0,0,1], '15 cm', [0,0,.7]);
    dim([SL, ly, t.slotZ+.5], [OPh, ly, t.slotZ+.5], [0,0,1], '15 cm', [0,0,.7]);
    dim([-OPh-.6, ly, t.zB], [-OPh-.6, ly, t.OP_F], [1,0,0], '4,1 + 11,8 cm', [-1.6,0,0], [[-OPh-.6, ly, t.OP_B]]);
    label('mặt ' + fcm(info.W) + ' × ' + fcm(info.D) + ' × 2,5 cm', V([0, ly, 1.4]), 1);
  }
  if (info.note) label(info.note, V([0, H*.25, zf + o]), .9);
  // MẶT SAU
  if (t){
    zone([0,.2,-1], .55, .8);
    var trBot2 = t.trY - t.TR_H/2 - .06;
    dim([-t.OP_W/2-.09, trBot2-.45, t.trB-.3], [t.OP_W/2+.09, trBot2-.45, t.trB-.3], [0,1,0], 'hộp dây dài ' + fcm(t.OP_W*10) + ' cm', [0,-.7,0]);
    dim([t.OP_W/2+.5, trBot2, t.trB-.3], [t.OP_W/2+.5, H, t.trB-.3], [1,0,0], '8 + 2,5 cm', [1.4,0,0], [[t.OP_W/2+.5, t.trY+t.TR_H/2, t.trB-.3]]);
    callout('MDF: lòng 10 · vách 1,8 · đáy 1,2 cm', [-4.5, t.trY, t.trB-.09], [-.5, -1.8, -.8]);
    callout('lỗ Ø5 cm → sàn', [0, trBot2, t.trMid], [.6, -2.3, -1]);
    zone(null, 0, 1);
    [-5,5].forEach(function(hx){ callout('bản lề chén', [hx, t.trY+.15, t.trB+.12], [hx > 0 ? 1 : -1, 2.6, -.4]); });
    label('mở ~95°', V([0, H+1.7, t.OP_B-.2]), .9);
  } else {
    zone([0,.2,-1], .55, .8);
    if (!info.round && !info.thick) dim([W/2+o, 0, zb-o*.5], [W/2+o, H, zb-o*.5], [1,0,0], 'cao ' + fcm(info.H) + ' cm', [1.6,0,0]);
    custom('back', [0,0,-1]);
  }
  zones.forEach(function(z){ z.g.traverse(function(o2){ if (o2.material) z.mats.push(o2.material); }); });
  return zones;
}

/* ---------- bóng đổ mềm dưới sản phẩm ---------- */
var shadowTex = null;
function shadowPlane(w, d){
  if (!shadowTex){
    var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
    var gr = x.createRadialGradient(64,64,4,64,64,64); gr.addColorStop(0,'rgba(0,0,0,0.32)'); gr.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0,0,128,128); shadowTex = new THREE.CanvasTexture(c);
  }
  var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({map:shadowTex, transparent:true, depthWrite:false}));
  m.rotation.x = -Math.PI/2; m.position.y = .005; return m;
}
function lights(scene){
  scene.add(new THREE.HemisphereLight(0xf2f5f3, 0x5b6560, .62));
  var k = new THREE.DirectionalLight(0xfff4e6, .55); k.position.set(12, 20, 14); scene.add(k);
  var f = new THREE.DirectionalLight(0xdfe9f2, .2); f.position.set(-14, 8, -10); scene.add(f);
}
function disposeTree(o){ o.traverse(function(n){ if (n.userData.keep) return; if (n.geometry) n.geometry.dispose(); if (n.material){ if (n.material.map) n.material.map.dispose(); n.material.dispose(); } }); }
function optsOf(p, o){
  o = o || {};
  var W = o.W || p.W, wood = o.wood || p.wood, frame = o.frame || p.frame, uph = o.uph || p.uph;
  return {W:W, wood:wood, frame:frame, uph:uph, woodC:byId(WOOD, wood).c, frameC:byId(FRAME, frame).c, uphC:byId(UPH, uph).c};
}
function fit(info){
  var W = info.W/10, D = info.D/10, H = info.H/10, m = Math.max(W, D, H*1.2);
  return {target:new THREE.Vector3(0, Math.max(H*.45, .5), (info.shiftZ||0)), dist: m*1.75 + 3};
}

/* ---------- ảnh sản phẩm: dựng 3D rồi chụp ---------- */
var Thumb = { r:null, cache:{}, queue:[], busy:false,
  key: function(p, o, v){ return p.id + '|' + o.W + o.wood + o.frame + o.uph + '|' + (v || 'home'); },
  get: function(p, o, v){
    o = optsOf(p, o); var k = this.key(p, o, v);
    if (this.cache[k]) return this.cache[k];
    if (!HAS3D) return '';
    if (p.model && !/ok|err/.test(Scan.state(p.model.src))){ var self = this; Scan.load(p.model.src, function(){ self.get(p, o, v); }); return ''; }
    if (this.queue.every(function(q){ return q.k !== k; })) this.queue.push({k:k, p:p, o:o, v:v || 'home'});
    this.pump(); return '';
  },
  pump: function(){
    var self = this; if (this.busy) return; this.busy = true;
    setTimeout(function step(){
      var t0 = performance.now();
      while (self.queue.length && performance.now() - t0 < 24){ var q = self.queue.shift(); if (!self.cache[q.k]) self.render(q); }
      if (self.queue.length) setTimeout(step, 16); else self.busy = false;
    }, 0);
  },
  render: function(q){
    try{
      if (!this.r){
        this.r = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
        this.r.setPixelRatio(1); this.r.setSize(480, 360); this.r.setClearColor(0x000000, 0);
        this.scene = new THREE.Scene(); lights(this.scene); this.cam = new THREE.PerspectiveCamera(32, 4/3, .1, 500);
      }
      var b = buildModel(q.p, q.o), f = fit(b.info), sh = shadowPlane(b.info.W/10*1.5 + 1, b.info.D/10*1.5 + 1);
      if (b.info.shiftZ) sh.position.z = b.info.shiftZ;
      this.scene.add(b.g); this.scene.add(sh);
      var VW = {home:[.62,1.12,.92], front:[0,1.3,.95], side:[1.5,1.25,.95], top:[0,.32,1.05]}[q.v] || [.62,1.12,.92];
      var az = VW[0], pol = VW[1], d = f.dist*VW[2];
      this.cam.position.set(f.target.x + d*Math.sin(pol)*Math.sin(az), f.target.y + d*Math.cos(pol), f.target.z + d*Math.sin(pol)*Math.cos(az));
      this.cam.lookAt(f.target);
      this.r.render(this.scene, this.cam);
      var url = this.r.domElement.toDataURL('image/png');
      this.scene.remove(b.g); this.scene.remove(sh); disposeTree(b.g); sh.geometry.dispose(); sh.material.dispose();
      this.cache[q.k] = url;
      $$('img[data-tk="' + q.k + '"]').forEach(function(im){ im.src = url; im.hidden = false; var s = im.nextElementSibling; if (s) s.hidden = true; });
    } catch(e){ this.cache[q.k] = ''; }
  }
};
function photoOf(p, i){ return p.photos && p.photos.length ? p.photos[Math.min(i||0, p.photos.length-1)] : ''; }
function photoTag(u, alt){ return '<img src="' + esc(u) + '" alt="' + esc(alt) + '" loading="lazy">'; }
function cardImg(p, alt){
  var ph = photoOf(p, 0);
  if (ph) return photoTag(ph, alt || p.name);
  return thumbImg(p, null, alt) + '<span class="ph-tag">Ảnh dựng 3D</span>';
}
function thumbImg(p, o, alt, v){
  o = optsOf(p, o); var k = Thumb.key(p, o, v), src = Thumb.get(p, o, v);
  return '<img data-tk="' + esc(k) + '" alt="' + esc(alt || p.name) + '" loading="lazy"' + (src ? ' src="' + src + '"' : ' hidden') + '>' + (src ? '' : '<span class="ph-ph">' + (HAS3D ? 'Đang dựng ảnh…' : esc(p.sub.name)) + '</span>');
}

/* ---------- trình xem 3D dùng chung ---------- */
var Viewer = {
  init: function(){
    if (this.r || !HAS3D) return !!this.r;
    var self = this;
    this.r = new THREE.WebGLRenderer({antialias:true, alpha:true});
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene(); lights(this.scene);
    this.cam = new THREE.PerspectiveCamera(34, 4/3, .1, 600);
    this.target = new THREE.Vector3(); this.targetT = new THREE.Vector3();
    this.az = .62; this.pol = 1.12; this.dist = 30; this.azT = .62; this.polT = 1.12; this.distT = 30;
    this.dimOn = true; this.zones = []; this.lidA = 0; this.lidOpen = false; this.idle = 0; this.auto = false;
    var cv = this.r.domElement, down = false, px = 0, py = 0;
    cv.addEventListener('pointerdown', function(e){ down = true; px = e.clientX; py = e.clientY; cv.classList.add('drag'); self.idle = 0; try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
    cv.addEventListener('pointermove', function(e){ if (!down) return; self.azT -= (e.clientX-px)*.008; self.polT = Math.max(.12, Math.min(1.45, self.polT - (e.clientY-py)*.006)); px = e.clientX; py = e.clientY; self.idle = 0; });
    function up(){ down = false; cv.classList.remove('drag'); }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function(e){ e.preventDefault(); self.distT = Math.max(self.minD, Math.min(self.maxD, self.distT + e.deltaY*.02*self.base/20)); self.idle = 0; }, {passive:false});
    this.ro = new ResizeObserver(function(){ self.resize(); });
    (function loop(){ requestAnimationFrame(loop); self.tick(); })();
    return true;
  },
  mount: function(el, p, o, opts){
    if (!this.init()){ el.innerHTML = '<div class="v-fallback">Không tải được thư viện 3D.<br>Cần kết nối mạng để xoay xem sản phẩm.</div>'; return; }
    el.appendChild(this.r.domElement); this.el = el; this.ro.disconnect(); this.ro.observe(el);
    this.auto = !!(opts && opts.auto); this.resize(); this.set(p, o, true);
  },
  resize: function(){ if (!this.el) return; var w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return; this.r.setSize(w, h, false); this.cam.aspect = w/h; this.cam.updateProjectionMatrix(); },
  set: function(p, o, reset){
    var self = this; o = optsOf(p, o);
    if (this.model){ this.scene.remove(this.model); disposeTree(this.model); }
    if (this.sh){ this.scene.remove(this.sh); this.sh.geometry.dispose(); this.sh.material.dispose(); }
    this.zones.forEach(function(z){ self.scene.remove(z.g); disposeTree(z.g); });
    this.p = p; this.o = o;
    if (p.model){
      var st = Scan.state(p.model.src);
      if (st !== 'ok' && st !== 'err') Scan.load(p.model.src, function(){ if (self.p === p) self.set(p, self.o, true); });
      this.status(st === 'err' ? 'Không tải được mô hình riêng, đang hiện mô hình dựng sẵn' : st === 'ok' ? '' : 'Đang tải mô hình…');
    } else this.status('');
    var b = buildModel(p, o); this.model = b.g; this.info = b.info; this.scene.add(b.g);
    this.sh = shadowPlane(b.info.W/10*1.5 + 1, b.info.D/10*1.5 + 1); if (b.info.shiftZ) this.sh.position.z = b.info.shiftZ; this.scene.add(this.sh);
    var f = fit(b.info), m = Math.max(b.info.W, b.info.D, b.info.H)/10;
    this.zones = makeDims(b.info, Math.max(.32, Math.min(.85, m*.042)));
    this.zones.forEach(function(z){ self.scene.add(z.g); });
    this.base = f.dist; this.minD = f.dist*.45; this.maxD = f.dist*2.2;
    this.targetT.copy(f.target);
    if (reset){ this.target.copy(f.target); this.distT = f.dist; this.dist = f.dist*1.15; this.azT = .62; this.polT = 1.12; this.lidOpen = false; this.lidA = 0; }
    else this.distT = Math.max(this.minD, Math.min(this.maxD, f.dist * (this.distT / (this.base || f.dist))));
    if (this.lidOpen && b.info.lid){ b.info.lid.rotation.x = this.lidA; }
  },
  status: function(t){
    if (!this.el) return;
    var s = this.el.querySelector('.v-status');
    if (!s){ s = document.createElement('span'); s.className = 'v-status'; s.setAttribute('role', 'status'); this.el.appendChild(s); }
    s.textContent = t; s.hidden = !t;
  },
  view: function(name){
    if (name === 'top'){ this.azT = 0; this.polT = .25; }
    else if (name === 'back'){ this.azT = Math.PI + .35; this.polT = 1.15; }
    else { this.azT = .62; this.polT = 1.12; this.distT = this.base; }
    this.idle = 0;
  },
  tick: function(){
    if (!this.el || !this.el.isConnected) return;
    this.idle += 1;
    if (this.auto && this.idle > 180) this.azT += .0035;
    this.az += (this.azT-this.az)*.12; this.pol += (this.polT-this.pol)*.12; this.dist += (this.distT-this.dist)*.12;
    this.target.lerp(this.targetT, .12);
    var t = this.target, d = this.dist;
    this.cam.position.set(t.x + d*Math.sin(this.pol)*Math.sin(this.az), t.y + d*Math.cos(this.pol), t.z + d*Math.sin(this.pol)*Math.cos(this.az));
    this.cam.lookAt(t);
    if (this.info && this.info.lid){ this.lidA += ((this.lidOpen ? -1.66 : 0) - this.lidA)*.14; this.info.lid.rotation.x = this.lidA; }
    var dir = this.cam.position.clone().sub(t).normalize(), self = this;
    this.zones.forEach(function(z){
      var goal = !self.dimOn ? 0 : (!z.n ? (self.lidOpen ? 1 : 0) : Math.max(0, Math.min(1, (dir.dot(z.n) - z.lo)/(z.hi - z.lo))));
      z.a += (goal - z.a)*.18; z.g.visible = z.a > .02; z.mats.forEach(function(m){ m.opacity = z.a; });
    });
    this.r.render(this.scene, this.cam);
  }
};
