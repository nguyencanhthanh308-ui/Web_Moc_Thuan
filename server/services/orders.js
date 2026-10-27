const MT = require('../../public/assets/js/shared.js');
const { esc } = require('./mailer');

const STATUSES = {
  moi: 'Mới',
  'da-xac-nhan': 'Đã xác nhận',
  'dang-lam': 'Đang làm',
  'da-giao': 'Đã giao',
  'hoan-tat': 'Hoàn tất',
  'da-huy': 'Đã hủy'
};
const PAYMENTS = { 'chuyen-khoan': 'Chuyển khoản', 'khi-nhan': 'Thanh toán khi nhận hàng' };
const MAX_ITEMS = 30;
const MAX_QTY = 50;

// Lỗi do dữ liệu khách gửi lên: route trả 400 với thông báo này
class InputError extends Error {}

const vnd = n => Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';

function normalizePhone(s) {
  if (typeof s !== 'string') return null;
  let p = s.replace(/[\s.\-]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  return /^0(3|5|7|8|9)\d{8}$/.test(p) ? p : null;
}

// Chọn màu: bắt buộc có và đúng id nếu dáng sản phẩm dùng phần đó, ngược lại lưu null
function pickColour(list, part, kind, id, label) {
  if (!MT.K[kind].parts.includes(part)) return null;
  const found = typeof id === 'string' ? list.find(x => x.id === id) : null;
  if (!found) throw new InputError('Chưa chọn hoặc chọn sai ' + label + '.');
  return found;
}

async function buildLines(db, items) {
  const settings = await db.query("select value from settings where key = 'woodK'");
  const woodK = settings[0] ? settings[0].value : {};
  const lines = [];
  const unavailable = [];
  let total = 0;
  for (const it of items) {
    if (!it || typeof it !== 'object' || !Number.isInteger(it.id) || it.id <= 0) throw new InputError('Có món hàng không hợp lệ.');
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > MAX_QTY) throw new InputError('Số lượng mỗi món phải từ 1 đến ' + MAX_QTY + '.');
    const found = await db.query('select data, hidden from products where id = $1', [it.id]);
    if (!found.length || found[0].hidden) { unavailable.push(it.id); continue; }
    const row = found[0].data;
    const base = MT.K[row.kind];
    const W = it.W == null ? row.W : it.W;
    if (typeof W !== 'number' || !Number.isFinite(W)) throw new InputError('Kích thước không hợp lệ.');
    const custom = !row.prices.some(p => p[0] === W);
    if (custom) {
      const range = MT.customRange(row.prices.map(p => p[0]).sort((a, b) => a - b));
      if (W < range.min || W > range.max || W % range.step !== 0) {
        throw new InputError('Kích thước riêng của "' + row.name + '" phải từ ' + range.min + ' đến ' + range.max + ' cm và chia hết cho ' + range.step + '.');
      }
    }
    const wood = pickColour(MT.WOOD, 'w', row.kind, it.wood, 'chất liệu');
    const frame = pickColour(MT.FRAME, 'f', row.kind, it.frame, 'màu khung');
    const uph = pickColour(MT.UPH, 'u', row.kind, it.uph, 'màu vải bọc');
    const unitPrice = MT.unitPrice(row, W, wood && wood.id, woodK);
    total += unitPrice * it.qty;
    lines.push({
      productId: row.id, code: row.code, name: row.name, W, D: row.D || base.D, H: row.H || base.H,
      wood: wood && wood.id, frame: frame && frame.id, uph: uph && uph.id,
      woodName: wood && wood.name, frameName: frame && frame.name, uphName: uph && uph.name,
      kind: 'product', qty: it.qty, unitPrice, custom, estimate: custom
    });
  }
  return { lines, total, unavailable };
}

// Ngày theo giờ Việt Nam (UTC+7), dạng YYMMDD
const localDay = date => new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(2, 10).replace(/-/g, '');

async function nextOrderCode(db, date) {
  const prefix = 'DH' + localDay(date) + '-';
  const rows = await db.query('select code from orders where code like $1 order by code desc limit 1', [prefix + '%']);
  const n = rows.length ? Number(rows[0].code.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

const oneLine = s => String(s).replace(/\s+/g, ' ').trim();

function lineText(l) {
  const parts = [l.W + ' × ' + l.D + ' × ' + l.H + ' cm'];
  if (l.woodName) parts.push(l.woodName);
  if (l.frameName) parts.push(l.frameName);
  if (l.uphName) parts.push(l.uphName);
  return parts.join(', ');
}

// order: {code, total, customer, payment, note, lines}; adminUrl: link mở đơn trong trang quản lý
function newOrderEmail(order, adminUrl) {
  const c = order.customer;
  const total = vnd(order.total);
  const pay = PAYMENTS[order.payment] || order.payment;
  const subject = '[Mộc Thuận] Đơn mới ' + order.code + ' – ' + oneLine(c.name) + ' – ' + total;
  const rows = order.lines.map(l => '<tr>' +
    '<td>' + esc(l.name) + '<br><small>' + esc(lineText(l)) + '</small></td>' +
    '<td style="text-align:center">' + esc(l.qty) + '</td>' +
    '<td style="text-align:right">' + esc(vnd(l.unitPrice)) + (l.estimate ? '<br><small>giá tạm tính</small>' : '') + '</td></tr>').join('');
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px">' +
    '<h2>Đơn mới ' + esc(order.code) + '</h2>' +
    '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse">' +
    '<tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th></tr>' + rows + '</table>' +
    '<p><b>Tổng cộng: ' + esc(total) + '</b></p>' +
    '<p>Khách: ' + esc(c.name) + '<br>Điện thoại: ' + esc(c.phone) + '<br>Địa chỉ: ' + esc(c.address) + '</p>' +
    '<p>Thanh toán: ' + esc(pay) + '</p>' +
    (order.note ? '<p>Ghi chú: ' + esc(order.note) + '</p>' : '') +
    '<p><a href="' + esc(adminUrl) + '">Mở đơn trong trang quản lý</a><br>' + esc(adminUrl) + '</p></div>';
  const text = ['Đơn mới ' + order.code, '']
    .concat(order.lines.map(l => '- ' + l.name + ' (' + lineText(l) + ') x' + l.qty + ' – ' + vnd(l.unitPrice) + (l.estimate ? ' (giá tạm tính)' : '')))
    .concat(['', 'Tổng cộng: ' + total, 'Khách: ' + c.name, 'Điện thoại: ' + c.phone, 'Địa chỉ: ' + c.address, 'Thanh toán: ' + pay])
    .concat(order.note ? ['Ghi chú: ' + order.note] : [])
    .concat(['', adminUrl]).join('\n');
  return { subject, html, text };
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Kiểm tra thông tin khách và cách thanh toán (dùng chung cho lúc đặt hàng và lúc quản trị sửa đơn); ném InputError nếu sai
function parseCustomer(c) {
  c = c && typeof c === 'object' ? c : {};
  const name = str(c.name, 100);
  const address = str(c.address, 300);
  const phone = normalizePhone(c.phone);
  if (!name) throw new InputError('Vui lòng nhập họ tên.');
  if (!phone) throw new InputError('Số điện thoại chưa đúng, vui lòng kiểm tra lại.');
  if (!address) throw new InputError('Vui lòng nhập địa chỉ giao hàng.');
  return { name, phone, address };
}

function parsePayment(p) {
  if (!Object.prototype.hasOwnProperty.call(PAYMENTS, p)) throw new InputError('Vui lòng chọn cách thanh toán.');
  return p;
}

const MAX_EXTRA = 1e9;
const isProduct = l => l.kind !== 'extra';
const orderTotal = lines => lines.reduce((sum, l) => sum + (isProduct(l) ? l.unitPrice * l.qty : l.amount), 0);

// Quản trị sửa dòng hàng. stored: dòng đang lưu; input: [{ref, unitPrice, qty} | {kind:'extra', label, amount}].
// Dòng sản phẩm chỉ sửa/xóa, không thêm; ref là vị trí trong stored. Trả {lines, total}; ném InputError nếu sai.
function editLines(stored, input) {
  if (!Array.isArray(input) || !input.length) throw new InputError('Đơn phải có ít nhất một dòng.');
  if (input.length > MAX_ITEMS * 2) throw new InputError('Đơn có quá nhiều dòng.');
  const seen = new Set();
  const lines = input.map(it => {
    if (!it || typeof it !== 'object') throw new InputError('Có dòng hàng không hợp lệ.');
    if (it.kind === 'extra') {
      const label = str(it.label, 1000);
      if (!label || label.length > 100) throw new InputError('Tên dòng phụ phí/giảm giá phải từ 1 đến 100 ký tự.');
      if (!Number.isInteger(it.amount) || it.amount === 0 || Math.abs(it.amount) > MAX_EXTRA) throw new InputError('Số tiền dòng phụ phí/giảm giá phải là số nguyên khác 0.');
      return { kind: 'extra', label, amount: it.amount };
    }
    if (it.kind !== undefined && it.kind !== 'product') throw new InputError('Có dòng hàng không hợp lệ.');
    if (!Number.isInteger(it.ref) || it.ref < 0 || it.ref >= stored.length || !isProduct(stored[it.ref])) throw new InputError('Có dòng sản phẩm không có trong đơn.');
    if (seen.has(it.ref)) throw new InputError('Một dòng sản phẩm bị gửi trùng.');
    seen.add(it.ref);
    if (!Number.isInteger(it.unitPrice) || it.unitPrice < 0 || it.unitPrice > MAX_EXTRA) throw new InputError('Đơn giá phải là số nguyên không âm.');
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > MAX_QTY) throw new InputError('Số lượng mỗi món phải từ 1 đến ' + MAX_QTY + '.');
    const old = stored[it.ref];
    return { ...old, kind: 'product', unitPrice: it.unitPrice, qty: it.qty, estimate: it.unitPrice !== old.unitPrice ? false : old.estimate };
  });
  const total = orderTotal(lines);
  if (total < 0) throw new InputError('Tổng tiền không được âm.');
  return { lines, total };
}

module.exports = { STATUSES, PAYMENTS, MAX_ITEMS, InputError, str, vnd, normalizePhone, parseCustomer, parsePayment, editLines, buildLines, nextOrderCode, newOrderEmail };
