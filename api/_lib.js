import fs from 'fs/promises';
import path from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────────
// En Vercel /tmp persiste dentro de la misma ejecución pero no entre invocaciones.
// Para persistencia real hay que usar una DB; por ahora /tmp es suficiente para MVP.
const DATA_DIR     = '/tmp/briefintel';
const BRIEFS_FILE  = path.join(DATA_DIR, 'briefs.json');
const JOBS_FILE    = path.join(DATA_DIR, 'jobs.json');
const OPS_FILE     = path.join(DATA_DIR, 'ops_events.json');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeJsonFile(file, data) {
  await ensureDir();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

export async function readBriefs() {
  return readJsonFile(BRIEFS_FILE);
}

export async function readJobs() {
  return readJsonFile(JOBS_FILE);
}

export async function readOpsEvents() {
  return readJsonFile(OPS_FILE);
}

export async function appendOpsEvent(event) {
  const events = await readOpsEvents();
  const next = [{ ...event, ts: new Date().toISOString() }, ...events].slice(0, 1000);
  await writeJsonFile(OPS_FILE, next);
}

export async function appendJob(job) {
  const jobs = await readJobs();
  const next = [job, ...jobs].slice(0, 500);
  await writeJsonFile(JOBS_FILE, next);
}
