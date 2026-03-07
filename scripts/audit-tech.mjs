import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import funnelHandler from '../api/funnel.js';

function createRes() {
  const out = { statusCode: 200, headers: {}, body: '' };
  return {
    status(code) { out.statusCode = code; return this; },
    setHeader(k, v) { out.headers[k] = v; return this; },
    send(v) { out.body = v; return this; },
    json(v) { out.body = JSON.stringify(v); return this; },
    end() { return this; },
    _out: out,
  };
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

run('npm run smoke');
run('npm run functional');

process.env.BRIEFINTEL_ADMIN_KEY = process.env.BRIEFINTEL_ADMIN_KEY || 'local-admin-key';
const req = { method: 'GET', headers: { 'x-admin-key': process.env.BRIEFINTEL_ADMIN_KEY } };
const res = createRes();
await funnelHandler(req, res);
if (res._out.statusCode !== 200) {
  throw new Error(`funnel endpoint failed with ${res._out.statusCode}`);
}

const payload = JSON.parse(res._out.body || '{}');
await fs.mkdir(new URL('../audit', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../audit/web-audit.json', import.meta.url), JSON.stringify(payload, null, 2));

console.log('AUDIT_TECH_OK');
console.log(JSON.stringify(payload.metrics, null, 2));
