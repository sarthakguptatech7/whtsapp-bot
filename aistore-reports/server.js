require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cors = require('cors');
const express = require('express');
const { createStoreReport } = require('./report-pdf');
const { WhatsAppSession } = require('./whatsapp-session');

const port = Number(process.env.PORT || 3010);
const stateDirectory = path.resolve(process.env.STATE_DIRECTORY || '.report-state');
const schedulesPath = path.join(stateDirectory, 'schedules.json');
const historyPath = path.join(stateDirectory, 'history.json');
const defaultOwnerPhone = process.env.DEFAULT_OWNER_PHONE_NUMBER || '';
fs.mkdirSync(stateDirectory, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, value) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

let schedules = readJson(schedulesPath, []);
let history = readJson(historyPath, []);
const session = new WhatsAppSession({
  sessionDirectory: process.env.SESSION_DIRECTORY || '.whatsapp-session',
  adminNumber: process.env.ADMIN_PHONE_NUMBER || '',
});

function validPhone(phone) {
  return /^\+[1-9]\d{9,14}$/.test(String(phone || '').replace(/[\s()-]/g, ''));
}

function maskPhone(phone) {
  const clean = String(phone || '').replace(/\D/g, '');
  return clean.length > 7 ? `+${clean.slice(0, 2)}•••••${clean.slice(-3)}` : '';
}

function reportFileName(report) {
  const store = String(report.store?.name || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `aistore-${store || 'store'}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function decodeEvidenceImage(value) {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ''));
  if (!match) throw new Error('A JPEG or PNG evidence image is required');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 1_500_000) throw new Error('Evidence image must be smaller than 1.5 MB');
  return { buffer, mimetype: match[1] };
}

async function deliver({ ownerPhone, ownerName, report, source = 'manual', scheduleId = null }) {
  ownerPhone = ownerPhone || defaultOwnerPhone;
  if (!validPhone(ownerPhone)) throw new Error('A valid owner number with country code is required');
  const generated = await createStoreReport(report);
  const result = await session.sendPdf(ownerPhone, generated.buffer, reportFileName(generated.report), `AMPM AI Store report for ${generated.report.store.name}. ${generated.report.inventory.outOfStockCount} stock actions and ${generated.report.security.reviewRequired} security review require attention.`);
  const record = { id: crypto.randomUUID(), source, scheduleId, ownerName: ownerName || 'Store owner', ownerPhone, storeName: generated.report.store.name, status: 'sent', ...result };
  history = [record, ...history].slice(0, 100);
  writeJson(historyPath, history);
  return record;
}

const app = express();
app.use(cors({ origin: process.env.DASHBOARD_ORIGIN?.split(',').map((item) => item.trim()) || true, methods: ['GET', 'POST', 'DELETE'] }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_request, response) => response.json({ ok: true, service: 'aistore-whatsapp-reports', whatsapp: session.snapshot().status }));
app.get('/api/whatsapp/status', (_request, response) => response.json({ ...session.snapshot(), ownerConfigured: validPhone(defaultOwnerPhone), ownerPhoneMasked: maskPhone(defaultOwnerPhone) }));
app.get('/api/reports/history', (_request, response) => response.json({ history }));
app.get('/api/schedules', (_request, response) => response.json({ schedules }));

app.post('/api/reports/preview', async (request, response, next) => {
  try {
    const generated = await createStoreReport(request.body?.report);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${reportFileName(generated.report)}"`);
    response.send(generated.buffer);
  } catch (error) { next(error); }
});

app.post('/api/reports/send', async (request, response, next) => {
  try { response.status(201).json(await deliver(request.body || {})); } catch (error) { next(error); }
});

app.post('/api/alerts/send', async (request, response, next) => {
  try {
    const { ownerPhone = defaultOwnerPhone, storeName = 'AMPM', cameraId = 'camera', alertId, detectedAt, confidence, imageDataUrl, audit } = request.body || {};
    if (!validPhone(ownerPhone)) throw new Error('A valid owner number with country code is required');
    if (!alertId) throw new Error('An alert ID is required');
    const existing = history.find((item) => item.id === alertId && item.source === 'vision-security-alert');
    if (existing) return response.status(200).json(existing);
    const image = decodeEvidenceImage(imageDataUrl);
    const detected = new Date(detectedAt || Date.now());
    const result = await session.sendImage(
      ownerPhone,
      image.buffer,
      image.mimetype,
      `🚨 AIstore security alert\nSuspected theft activity at ${storeName}.\nCamera: ${cameraId}\nTime: ${Number.isNaN(detected.getTime()) ? new Date().toLocaleString('en-IN') : detected.toLocaleString('en-IN')}\nConfidence: ${Math.round(Number(confidence || 0) * 100)}%\n\nPre-event evidence attached. Please review immediately.`,
    );
    const record = {
      id: alertId,
      source: 'vision-security-alert',
      ownerPhone,
      storeName,
      cameraId,
      status: 'sent',
      audit: audit || null,
      ...result,
    };
    history = [record, ...history].slice(0, 100);
    writeJson(historyPath, history);
    return response.status(201).json(record);
  } catch (error) { return next(error); }
});

app.post('/api/schedules', (request, response) => {
  let { ownerPhone } = request.body || {};
  const { ownerName, sendAt, recurrence = 'daily', reportPeriod = 'daily', report = {} } = request.body || {};
  ownerPhone = ownerPhone || defaultOwnerPhone;
  if (!validPhone(ownerPhone)) return response.status(400).json({ error: 'A valid owner number with country code is required' });
  const date = new Date(sendAt);
  if (Number.isNaN(date.getTime())) return response.status(400).json({ error: 'A valid schedule date and time is required' });
  if (!['once', 'daily', 'weekly'].includes(recurrence)) return response.status(400).json({ error: 'Recurrence must be once, daily or weekly' });
  const schedule = { id: crypto.randomUUID(), ownerPhone, ownerName: ownerName || 'Store owner', sendAt: date.toISOString(), recurrence, reportPeriod, report, enabled: true, lastSentAt: null, createdAt: new Date().toISOString() };
  schedules = [schedule, ...schedules];
  writeJson(schedulesPath, schedules);
  return response.status(201).json(schedule);
});

app.delete('/api/schedules/:id', (request, response) => {
  const previousLength = schedules.length;
  schedules = schedules.filter((schedule) => schedule.id !== request.params.id);
  if (previousLength === schedules.length) return response.status(404).json({ error: 'Schedule not found' });
  writeJson(schedulesPath, schedules);
  return response.status(204).end();
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(400).json({ error: error instanceof Error ? error.message : 'Report operation failed' });
});

setInterval(async () => {
  const now = Date.now();
  for (const schedule of schedules.filter((item) => item.enabled && new Date(item.sendAt).getTime() <= now)) {
    try {
      await deliver({ ...schedule, source: 'scheduled', scheduleId: schedule.id });
      schedule.lastSentAt = new Date().toISOString();
      if (schedule.recurrence === 'once') schedule.enabled = false;
      else {
        const next = new Date(schedule.sendAt);
        const intervalDays = schedule.recurrence === 'weekly' ? 7 : 1;
        do next.setDate(next.getDate() + intervalDays); while (next.getTime() <= Date.now());
        schedule.sendAt = next.toISOString();
      }
      writeJson(schedulesPath, schedules);
    } catch (error) {
      schedule.lastError = error instanceof Error ? error.message : 'Scheduled delivery failed';
      writeJson(schedulesPath, schedules);
    }
  }
}, 30_000).unref();

void session.start().catch((error) => console.error('WhatsApp session failed to start:', error));
app.listen(port, () => console.log(`AIstore WhatsApp report service listening on http://localhost:${port}`));
