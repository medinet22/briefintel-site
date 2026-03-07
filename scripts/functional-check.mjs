import fs from 'fs/promises';
import checkoutHandler from '../api/checkout.js';
import briefHandler from '../api/brief.js';

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function testCheckoutValidation() {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  const req = { method: 'POST', body: { tipo: 'competitor-intel' }, headers: {} };
  const res = createRes();
  await checkoutHandler(req, res);
  assert([400, 500].includes(res._out.statusCode), `checkout expected 400/500 got ${res._out.statusCode}`);
}

async function testBriefValidation() {
  const req = { method: 'POST', body: { tipo_reporte: 'competitor-intel' }, headers: {} };
  const res = createRes();
  await briefHandler(req, res);
  assert(res._out.statusCode === 400, `brief expected 400 got ${res._out.statusCode}`);
}

async function testBriefSuccess() {
  const beforeRaw = await fs.readFile('/tmp/briefs.json', 'utf8').catch(() => '[]');
  const before = JSON.parse(beforeRaw || '[]');

  const req = {
    method: 'POST',
    headers: { 'user-agent': 'functional-test', 'x-forwarded-for': '127.0.0.1' },
    body: {
      tipo_reporte: 'competitor-intel',
      empresa_nombre: 'RemittVen',
      empresa_web: 'remittven.com',
      sector: 'fintech',
      tamano: '2-10',
      sujeto_nombre: 'Curiara',
      sujeto_web: 'curiara.com',
      decision: 'Necesitamos decidir si debemos competir por precio o por velocidad en el corredor principal.',
      preguntas_clave: '1) Donde estan creciendo mas rapido? 2) Que mensajes usan para conversion? 3) Que debilidades operativas muestran?',
      email: 'ops@remittven.com',
      consent: 'on',
      session_id: 'cs_test_123',
    },
  };
  const res = createRes();
  await briefHandler(req, res);
  assert(res._out.statusCode === 200, `brief expected 200 got ${res._out.statusCode}`);

  const parsed = JSON.parse(res._out.body || '{}');
  assert(parsed.ok === true, 'brief response not ok');

  const afterRaw = await fs.readFile('/tmp/briefs.json', 'utf8');
  const after = JSON.parse(afterRaw);
  assert(Array.isArray(after), 'briefs file is not array');
  assert(after.length >= before.length, 'brief not persisted');
}

await testCheckoutValidation();
await testBriefValidation();
await testBriefSuccess();
console.log('FUNCTIONAL_OK');
