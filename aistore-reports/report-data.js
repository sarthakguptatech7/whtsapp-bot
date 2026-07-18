const DEFAULT_REPORT = Object.freeze({
  store: {
    name: 'AMPM Indiranagar',
    code: 'BLR-014',
    address: '100 Feet Road, Indiranagar, Bengaluru',
    operatingHours: '08:00–22:00',
  },
  period: {
    label: 'Daily report',
    start: '18 Jul 2026, 08:00',
    end: '18 Jul 2026, 22:00',
  },
  kpis: {
    visitors: 486,
    entries: 486,
    exits: 471,
    currentOccupancy: 15,
    averageDwell: '6m 42s',
    engagementRate: '69.8%',
    conversionEstimate: '31.4%',
    peakHour: '18:00–19:00',
  },
  security: {
    riskScore: 'Low',
    potentialTheftEvents: 2,
    resolvedEvents: 1,
    reviewRequired: 1,
    unattendedObjects: 0,
    restrictedAreaEvents: 0,
    events: [
      { time: '17:42', zone: 'Personal care aisle', severity: 'Medium', detail: 'Shelf interaction followed by concealed hand movement', action: 'Review 14-second event clip' },
      { time: '20:08', zone: 'Exit corridor', severity: 'Low', detail: 'Exit signal without matching checkout-zone dwell', action: 'Matched to staff movement' },
    ],
  },
  inventory: {
    outOfStockCount: 3,
    lowStockCount: 5,
    shelfAvailability: '94.2%',
    items: [
      { sku: 'BEV-012', item: 'Coca-Cola Zero 500ml', zone: 'Cold beverages', status: 'Out of stock', lastSeen: '15:20', action: 'Restock 12 units' },
      { sku: 'SNK-044', item: 'Lays Magic Masala 52g', zone: 'Snacks aisle', status: 'Out of stock', lastSeen: '18:05', action: 'Restock 18 units' },
      { sku: 'DAI-021', item: 'Greek Yoghurt 90g', zone: 'Dairy chiller', status: 'Out of stock', lastSeen: '19:12', action: 'Check backroom stock' },
      { sku: 'PER-113', item: 'Handwash refill 750ml', zone: 'Personal care', status: 'Low stock', lastSeen: '21:00', action: 'Restock 6 units' },
    ],
  },
  zones: [
    { name: 'Entrance', visits: 486, averageDwell: '0m 42s', intensity: 'Very high', insight: 'Strong evening arrivals' },
    { name: 'Promo island', visits: 304, averageDwell: '3m 16s', intensity: 'High', insight: '78% customer engagement' },
    { name: 'Center aisle', visits: 267, averageDwell: '4m 08s', intensity: 'Medium', insight: 'Best dwell, low conversion' },
    { name: 'Checkout', visits: 148, averageDwell: '2m 31s', intensity: 'Medium', insight: 'Queue peaked at 6 customers' },
  ],
  operations: {
    queuePeak: 6,
    averageWait: '2m 18s',
    longestWait: '6m 04s',
    staffingCoverage: '91%',
    serviceAlerts: 2,
    cameraUptime: '99.8%',
    camerasOnline: 6,
    camerasTotal: 6,
    edgeHealth: 'Healthy',
  },
  cloudCost: {
    cameraCount: 6,
    monthlyPerCamera: 2000,
    monthlyTotal: 12000,
    dailyPerCamera: 65.75,
    hoursPerDay: 12,
    projectedSavings: '₹1,08,000/month vs staffed monitoring',
  },
  recommendations: [
    { priority: 'Critical', owner: 'Floor team', action: 'Restock three unavailable products before the morning opening window.' },
    { priority: 'High', owner: 'Store manager', action: 'Review the 17:42 theft-risk event and record the outcome.' },
    { priority: 'Medium', owner: 'Merchandising', action: 'Move a high-conversion beverage offer to the center aisle heat zone.' },
    { priority: 'Medium', owner: 'Shift lead', action: 'Add one checkout associate between 18:00 and 19:30.' },
  ],
});

function mergeReport(input = {}) {
  return {
    ...DEFAULT_REPORT,
    ...input,
    store: { ...DEFAULT_REPORT.store, ...(input.store || {}) },
    period: { ...DEFAULT_REPORT.period, ...(input.period || {}) },
    kpis: { ...DEFAULT_REPORT.kpis, ...(input.kpis || {}) },
    security: { ...DEFAULT_REPORT.security, ...(input.security || {}) },
    inventory: { ...DEFAULT_REPORT.inventory, ...(input.inventory || {}) },
    operations: { ...DEFAULT_REPORT.operations, ...(input.operations || {}) },
    cloudCost: { ...DEFAULT_REPORT.cloudCost, ...(input.cloudCost || {}) },
    zones: input.zones || DEFAULT_REPORT.zones,
    recommendations: input.recommendations || DEFAULT_REPORT.recommendations,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { DEFAULT_REPORT, mergeReport };
