import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.BRIEFINTEL_DATA_DIR || '/home/openclaw/.openclaw/workspace-d-business/briefintel-site-data';
const BRIEFS_FILE = path.join(DATA_DIR, 'briefs.json');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const OPS_FILE = path.join(DATA_DIR, 'ops_events.json');

async function ensureDir() { await fs.mkdir(DATA_DIR, { recursive: true }); }

async function readJsonFile(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return []; }
}

async function writeJsonFile(file, data) {
  await ensureDir();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

export async function readBriefs() { return readJsonFile(BRIEFS_FILE); }
export async function readJobs() { return readJsonFile(JOBS_FILE); }
export async function readOpsEvents() { return readJsonFile(OPS_FILE); }

export async function appendOpsEvent(event) {
  const events = await readOpsEvents();
  const next = [{ ...event, at: new Date().toISOString() }, ...events].slice(0, 1000);
  await writeJsonFile(OPS_FILE, next);
}

export async function upsertJob(job) {
  const jobs = await readJobs();
  const key = job.payment_intent || job.id;
  const idx = jobs.findIndex((j) => (j.payment_intent || j.id) === key);
  if (idx >= 0) jobs[idx] = { ...jobs[idx], ...job };
  else jobs.unshift(job);
  await writeJsonFile(JOBS_FILE, jobs.slice(0, 1000));
}
