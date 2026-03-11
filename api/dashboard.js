import fs from 'fs/promises';
import path from 'path';
import { readBriefs, readJobs, readOpsEvents, json } from './_lib.js';

const TMP_FUNNEL_FILE = '/tmp/briefintel/funnel.json';
const REPORTS_DASHBOARD_URL = process.env.BRIEFINTEL_REPORTS_DASHBOARD_URL || 'http://localhost:4242/dashboard';

async function readLocalFunnel() {
  try {
    const raw = await fs.readFile(TMP_FUNNEL_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      exists: true,
      path: path.basename(TMP_FUNNEL_FILE),
      data: parsed,
    };
  } catch {
    return {
      exists: false,
      path: path.basename(TMP_FUNNEL_FILE),
      data: null,
    };
  }
}

async function fetchReportsMetrics(adminKey) {
  try {
    const resp = await fetch(REPORTS_DASHBOARD_URL, {
      method: 'GET',
      headers: { 'x-admin-key': adminKey },
    });

    const text = await resp.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }

    if (!resp.ok) {
      return { ok: false, status: resp.status, error: body?.error || 'fetch_failed', body };
    }

    return { ok: true, status: resp.status, metrics: body };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const key = req.headers['x-admin-key'];
  if (!process.env.BRIEFINTEL_ADMIN_KEY || key !== process.env.BRIEFINTEL_ADMIN_KEY) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  const [briefs, jobs, opsEvents, localFunnel, reportsDashboard] = await Promise.all([
    readBriefs(),
    readJobs(),
    readOpsEvents(),
    readLocalFunnel(),
    fetchReportsMetrics(key),
  ]);

  return json(res, 200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    site: {
      briefs_total: briefs.length,
      jobs_total: jobs.length,
      ops_events_total: opsEvents.length,
    },
    funnel_local_tmp: localFunnel,
    reports_server: reportsDashboard,
  });
}
