'use strict';

// Verstuurt e-mails via de Resend HTTP API — geen SDK nodig, alleen fetch
// (Node 18+). RESEND_API_KEY is verplicht; RESEND_FROM is optioneel en valt
// terug op Resend's eigen testdomein zodat dit meteen werkt zonder dat je
// eerst een eigen domein hoeft te verifiëren.
function _getFrom() {
  return process.env.RESEND_FROM || 'TACTIX26 <onboarding@resend.dev>';
}

async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is niet ingesteld');

  const body = { from: _getFrom(), to: [to], subject, html };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend API fout (${res.status}): ${detail}`);
  }
}

function _escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function sendPasswordResetEmail(to, name, token, origin) {
  const link = `${origin}/?reset=${token}`;
  const html = `
    <p>Hoi ${_escapeHtml(name)},</p>
    <p>Je hebt een nieuw wachtwoord aangevraagd voor je TACTIX26-account. Klik op onderstaande link om een nieuw wachtwoord in te stellen. Deze link is 1 uur geldig.</p>
    <p><a href="${link}">${link}</a></p>
    <p>Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>
  `;
  await sendEmail({ to, subject: 'Wachtwoord resetten — TACTIX26', html });
}

async function sendContactFormEmail(adminEmail, name, fromEmail, message) {
  const html = `
    <p>Nieuw contactformulier-bericht via tactix26.com:</p>
    <p><strong>Naam:</strong> ${_escapeHtml(name)}<br>
       <strong>E-mail:</strong> ${_escapeHtml(fromEmail)}</p>
    <p>${_escapeHtml(message).replace(/\n/g, '<br>')}</p>
  `;
  await sendEmail({ to: adminEmail, subject: `Contactformulier: ${name}`, html, replyTo: fromEmail });
}

module.exports = { sendEmail, sendPasswordResetEmail, sendContactFormEmail };
