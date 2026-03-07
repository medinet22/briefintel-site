import { json, readBriefs, readJobs, readOpsEvents } from './_lib.js';

const ALERTS = {
  lowBriefToPaidRate: 0.4,
  staleQueuedHours: 6,
  minBriefs24h: 1,
};

function toDate(value) {
  const d = new Date(value || 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inLastHours(value, hours) {
  const d = toDate(value);
  if (!d) return false;
  return Date.now() - d.getTime() <= hours * 60 * 60 * 1000;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const key = req.headers['x-admin-key'];
  if (!process.env.BRIEFINTEL_ADMIN_KEY || key !== process.env.BRIEFINTEL_ADMIN_KEY) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  const [briefs, jobs, opsEvents] = await Promise.all([readBriefs(), readJobs(), readOpsEvents()]);

  const briefs24h = briefs.filter((b) => inLastHours(b.createdAt, 24));
  const jobs24h = jobs.filter((j) => inLastHours(j.createdAt, 24));
  const queued = jobs.filter((j) => j.status === 'queued');
  const staleQueued = queued.filter((j) => !inLastHours(j.createdAt, ALERTS.staleQueuedHours));

  const paidCount = jobs.length;
  const briefCount = briefs.length;
  const briefToPaidRate = briefCount > 0 ? Number((paidCount / briefCount).toFixed(3)) : 0;

  const alerts = [];
  if (briefCount > 0 && briefToPaidRate < ALERTS.lowBriefToPaidRate) {
    alerts.push({
      level: 'warning',
      code: 'LOW_BRIEF_TO_PAID_RATE',
      message: `Conversión brief→pago baja (${(briefToPaidRate * 100).toFixed(1)}%).`,
    });
  }

  if (staleQueued.length > 0) {
    alerts.push({
      level: 'warning',
      code: 'STALE_QUEUED_JOBS',
      message: `${staleQueued.length} jobs en cola por más de ${ALERTS.staleQueuedHours}h.`,
    });
  }

  if (briefs24h.length < ALERTS.minBriefs24h) {
    alerts.push({
      level: 'info',
      code: 'LOW_DAILY_VOLUME',
      message: 'Volumen de briefs 24h por debajo de objetivo mínimo.',
    });
  }

  const byType = jobs.reduce((acc, job) => {
    const keyType = job.tipo || 'unknown';
    acc[keyType] = (acc[keyType] || 0) + 1;
    return acc;
  }, {});

  return json(res, 200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    metrics: {
      briefs_total: briefCount,
      briefs_24h: briefs24h.length,
      paid_jobs_total: paidCount,
      paid_jobs_24h: jobs24h.length,
      queued_jobs_total: queued.length,
      stale_queued_jobs: staleQueued.length,
      brief_to_paid_rate: briefToPaidRate,
      ops_events_24h: opsEvents.filter((e) => inLastHours(e.at, 24)).length,
    },
    breakdown: {
      paid_jobs_by_type: byType,
    },
    alerts,
  });
}
