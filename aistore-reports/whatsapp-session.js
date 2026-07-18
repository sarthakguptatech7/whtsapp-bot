const path = require('node:path');
const pino = require('pino');
const QRCode = require('qrcode');
const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');

class WhatsAppSession {
  constructor({ sessionDirectory, adminNumber }) {
    this.sessionDirectory = path.resolve(sessionDirectory);
    this.adminNumber = adminNumber || '';
    this.socket = null;
    this.status = 'starting';
    this.qrDataUrl = null;
    this.lastError = null;
    this.reconnectTimer = null;
  }

  async start() {
    clearTimeout(this.reconnectTimer);
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDirectory);
    this.status = 'connecting';
    this.socket = makeWASocket({
      auth: state,
      logger: pino({ level: process.env.LOG_LEVEL || 'warn' }),
      printQRInTerminal: false,
      browser: ['AIstore Reports', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    this.socket.ev.on('creds.update', saveCreds);
    this.socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.qrDataUrl = await QRCode.toDataURL(qr, { width: 360, margin: 1, color: { dark: '#17211f', light: '#ffffff' } });
        this.status = 'awaiting_scan';
      }
      if (connection === 'open') {
        this.status = 'connected';
        this.qrDataUrl = null;
        this.lastError = null;
        const ownId = this.socket?.user?.id?.split(':')[0];
        if (ownId) this.adminNumber = `+${ownId}`;
      }
      if (connection === 'close') {
        this.socket = null;
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        this.status = loggedOut ? 'logged_out' : 'reconnecting';
        this.lastError = lastDisconnect?.error?.message || 'WhatsApp connection closed';
        if (!loggedOut) this.reconnectTimer = setTimeout(() => void this.start(), 2500);
      }
    });
  }

  snapshot() {
    const digits = String(this.adminNumber || '').replace(/\D/g, '');
    const adminNumberMasked = digits.length > 7 ? `+${digits.slice(0, 2)}•••••${digits.slice(-3)}` : '';
    return { status: this.status, connected: this.status === 'connected', adminConfigured: Boolean(digits), adminNumberMasked, qrDataUrl: this.qrDataUrl, lastError: this.lastError };
  }

  normalizeRecipient(phoneNumber) {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) throw new Error('Owner number must include a valid country code');
    return `${digits}@s.whatsapp.net`;
  }

  async sendPdf(phoneNumber, pdfBuffer, fileName, caption) {
    if (this.status !== 'connected' || !this.socket) throw new Error('Admin WhatsApp is not paired');
    const jid = this.normalizeRecipient(phoneNumber);
    await this.socket.sendMessage(jid, { document: pdfBuffer, mimetype: 'application/pdf', fileName, caption });
    return { recipient: phoneNumber, sentAt: new Date().toISOString() };
  }

  async sendImage(phoneNumber, imageBuffer, mimetype, caption) {
    if (this.status !== 'connected' || !this.socket) throw new Error('Admin WhatsApp is not paired');
    const jid = this.normalizeRecipient(phoneNumber);
    await this.socket.sendMessage(jid, { image: imageBuffer, mimetype, caption });
    return { recipient: phoneNumber, sentAt: new Date().toISOString() };
  }
}

module.exports = { WhatsAppSession };
