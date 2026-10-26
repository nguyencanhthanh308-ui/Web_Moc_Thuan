const nodemailer = require('nodemailer');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Escape mọi giá trị đưa vào HTML (kể cả số)
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ESC[c]);

// smtp: {host, port, user, pass, from}
function createMailer(smtp) {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
  return {
    send({ to, subject, html, text }) {
      return transport.sendMail({ from: smtp.from, to, subject, html, text });
    }
  };
}

module.exports = { esc, createMailer };
