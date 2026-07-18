const PDFDocument = require('pdfkit');
const { mergeReport } = require('./report-data');

const COLORS = {
  ink: '#17211f', soft: '#61706c', teal: '#087f6f', pale: '#eaf7f4',
  line: '#dce5e2', red: '#b43c32', amber: '#c67a17', white: '#ffffff',
};

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function createStoreReport(input) {
  const report = mergeReport(input);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 42, left: 46, right: 46, bottom: 48 }, bufferPages: true, info: { Title: `${report.store.name} Intelligence Report`, Author: 'AMPM AI Store' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), report }));

    const pageWidth = doc.page.width - 92;
    const usableBottom = doc.page.height - 55;
    const ensureSpace = (height) => { if (doc.y + height > usableBottom) doc.addPage(); };
    const rule = () => doc.moveTo(46, doc.y).lineTo(doc.page.width - 46, doc.y).strokeColor(COLORS.line).stroke();
    const section = (number, title, subtitle) => {
      ensureSpace(62);
      doc.moveDown(0.7);
      doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(8).text(`${number}  ${title.toUpperCase()}`);
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(17).text(subtitle, { lineGap: 2 });
      doc.moveDown(0.35); rule(); doc.moveDown(0.55);
    };
    const metricGrid = (items) => {
      const cols = 3; const gap = 8; const width = (pageWidth - gap * (cols - 1)) / cols; const startY = doc.y;
      items.forEach((item, index) => {
        const x = 46 + (index % cols) * (width + gap); const y = startY + Math.floor(index / cols) * 62;
        doc.roundedRect(x, y, width, 53, 5).fillAndStroke(COLORS.pale, '#cce6df');
        doc.fillColor(COLORS.soft).font('Helvetica-Bold').fontSize(7).text(item.label.toUpperCase(), x + 10, y + 9, { width: width - 20 });
        doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(16).text(String(item.value), x + 10, y + 24, { width: width - 20 });
      });
      doc.y = startY + Math.ceil(items.length / cols) * 62;
    };
    const table = (headers, rows, widths) => {
      const rowHeight = 34; const startX = 46;
      ensureSpace(rowHeight * Math.min(rows.length + 1, 5));
      let y = doc.y;
      doc.rect(startX, y, pageWidth, 24).fill(COLORS.ink);
      let x = startX;
      headers.forEach((header, i) => { doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7).text(header.toUpperCase(), x + 6, y + 8, { width: widths[i] - 12 }); x += widths[i]; });
      y += 24;
      rows.forEach((row, rowIndex) => {
        if (y + rowHeight > usableBottom) { doc.addPage(); y = 46; }
        if (rowIndex % 2 === 0) doc.rect(startX, y, pageWidth, rowHeight).fill('#f7faf9');
        x = startX;
        row.forEach((cell, i) => { doc.fillColor(i === 0 ? COLORS.ink : COLORS.soft).font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).text(String(cell), x + 6, y + 7, { width: widths[i] - 12, height: rowHeight - 10, ellipsis: true }); x += widths[i]; });
        doc.moveTo(startX, y + rowHeight).lineTo(startX + pageWidth, y + rowHeight).strokeColor(COLORS.line).stroke();
        y += rowHeight;
      });
      doc.y = y + 3;
    };

    doc.rect(0, 0, doc.page.width, 165).fill(COLORS.ink);
    doc.fillColor('#66d2bf').font('Helvetica-Bold').fontSize(9).text('AMPM  /  AI STORE INTELLIGENCE', 46, 44);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(30).text('Daily operations report', 46, 70);
    doc.fillColor('#b9cbc6').font('Helvetica').fontSize(10).text(`${report.store.name}  •  ${report.period.start} — ${report.period.end}`, 46, 113);
    doc.roundedRect(46, 186, pageWidth, 72, 7).fillAndStroke(COLORS.pale, '#cce6df');
    doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(8).text('EXECUTIVE STATUS', 60, 202);
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(17).text('Store healthy · 2 actions need attention', 60, 219);
    doc.fillColor(COLORS.soft).font('Helvetica').fontSize(8).text(`${report.kpis.visitors} visitors today, ${report.inventory.outOfStockCount} products unavailable and ${report.security.reviewRequired} security event awaiting review.`, 60, 243);
    doc.y = 278;

    section('01', 'Customer flow', 'Traffic, dwell and conversion');
    metricGrid([
      { label: 'Visitors', value: report.kpis.visitors }, { label: 'Current occupancy', value: report.kpis.currentOccupancy },
      { label: 'Average dwell', value: report.kpis.averageDwell }, { label: 'Engagement', value: report.kpis.engagementRate },
      { label: 'Conversion estimate', value: report.kpis.conversionEstimate }, { label: 'Peak traffic', value: report.kpis.peakHour },
    ]);

    section('02', 'Theft protection', 'Security signals requiring human judgment');
    metricGrid([
      { label: 'Risk posture', value: report.security.riskScore }, { label: 'Potential events', value: report.security.potentialTheftEvents },
      { label: 'Awaiting review', value: report.security.reviewRequired }, { label: 'Resolved', value: report.security.resolvedEvents },
      { label: 'Unattended objects', value: report.security.unattendedObjects }, { label: 'Restricted access', value: report.security.restrictedAreaEvents },
    ]);
    table(['Time', 'Zone', 'Risk', 'Signal', 'Next action'], report.security.events.map((event) => [event.time, event.zone, event.severity, event.detail, event.action]), [42, 86, 48, 175, 155]);

    section('03', 'Shelf availability', 'Out-of-stock and low-stock action list');
    metricGrid([
      { label: 'Shelf availability', value: report.inventory.shelfAvailability }, { label: 'Out of stock', value: report.inventory.outOfStockCount }, { label: 'Low stock', value: report.inventory.lowStockCount },
    ]);
    table(['SKU', 'Product', 'Zone', 'Status', 'Action'], report.inventory.items.map((item) => [item.sku, item.item, item.zone, item.status, item.action]), [55, 145, 92, 78, 136]);

    section('04', 'Heat zones', 'Where customers stopped and engaged');
    table(['Zone', 'Visits', 'Avg dwell', 'Intensity', 'Operational insight'], report.zones.map((zone) => [zone.name, zone.visits, zone.averageDwell, zone.intensity, zone.insight]), [90, 55, 70, 70, 221]);

    section('05', 'Store operations', 'Queue, staffing and infrastructure health');
    metricGrid([
      { label: 'Peak queue', value: `${report.operations.queuePeak} people` }, { label: 'Average wait', value: report.operations.averageWait },
      { label: 'Staffing coverage', value: report.operations.staffingCoverage }, { label: 'Service alerts', value: report.operations.serviceAlerts },
      { label: 'Camera uptime', value: report.operations.cameraUptime }, { label: 'Edge health', value: report.operations.edgeHealth },
    ]);

    section('06', 'Cloud economics', 'Cost-efficient AI monitoring');
    metricGrid([
      { label: 'Per camera / month', value: money(report.cloudCost.monthlyPerCamera) }, { label: 'Fleet / month', value: money(report.cloudCost.monthlyTotal) },
      { label: 'Operating window', value: `${report.cloudCost.hoursPerDay}h/day` }, { label: 'Per camera / day', value: money(report.cloudCost.dailyPerCamera) },
      { label: 'Cameras', value: report.cloudCost.cameraCount }, { label: 'Projected saving', value: report.cloudCost.projectedSavings },
    ]);

    section('07', 'Action plan', 'Priorities for the next operating window');
    table(['Priority', 'Owner', 'Recommended action'], report.recommendations.map((item) => [item.priority, item.owner, item.action]), [70, 100, 336]);
    ensureSpace(80);
    doc.roundedRect(46, doc.y + 8, pageWidth, 58, 6).fill('#f3f6f5');
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(8).text('PRIVACY & DECISION NOTE', 59, doc.y + 20);
    doc.fillColor(COLORS.soft).font('Helvetica').fontSize(7).text('AI signals support store operations; they do not determine guilt or identity. Security events require authorized human review. Durable reporting contains operational metadata only and does not retain source video.', 59, doc.y + 34, { width: pageWidth - 26, lineGap: 2 });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      doc.fillColor('#87928f').font('Helvetica').fontSize(7).text(`AMPM AI Store  •  Confidential owner report  •  Generated ${new Date(report.generatedAt).toLocaleString('en-IN')}`, 46, doc.page.height - 33, { width: pageWidth - 50 });
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').text(`${i + 1} / ${range.count}`, doc.page.width - 82, doc.page.height - 33, { width: 36, align: 'right' });
    }
    doc.end();
  });
}

module.exports = { createStoreReport };
