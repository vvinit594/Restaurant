/**
 * Read-only Razorpay Live diagnostic. Prints status and error text only.
 * Never prints keys, secrets, plan ids, or customer payloads.
 */
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    let value = t.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = value.trim();
  }
  return out;
}

function mode(keyId) {
  if (!keyId) return 'missing';
  if (keyId.startsWith('rzp_live_')) return 'live';
  if (keyId.startsWith('rzp_test_')) return 'test';
  return 'unknown-prefix';
}

function shape(value, prefix) {
  if (!value) return 'missing';
  if (value.startsWith(prefix)) return `present-${prefix}`;
  return 'present-unexpected-shape';
}

async function razorpay(env, method, apiPath) {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${apiPath}`, {
    method,
    headers: { Authorization: `Basic ${auth}` },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const err = body && body.error ? body.error : null;
  const item = body && body.item ? body.item : null;
  return {
    status: res.status,
    code: err ? err.code || null : null,
    description: err ? err.description || null : null,
    reason: err ? err.reason || null : null,
    field: err ? err.field || null : null,
    period: body ? body.period || null : null,
    interval: body && body.interval != null ? body.interval : null,
    amount: item && item.amount != null ? item.amount : null,
    currency: item ? item.currency || null : null,
  };
}

async function main() {
  const env = loadEnv(path.join(__dirname, '..', '.env.local'));
  const keyId = env.RAZORPAY_KEY_ID || '';
  const secret = env.RAZORPAY_KEY_SECRET || '';
  const monthly = env.RAZORPAY_MONTHLY_PLAN_ID || '';
  const launch = env.RAZORPAY_LAUNCH_PLAN_ID || '';
  const webhook = env.RAZORPAY_WEBHOOK_SECRET || '';
  console.log(JSON.stringify({
    keyMode: mode(keyId),
    secret: secret ? 'present' : 'missing',
    webhook: webhook ? 'present' : 'missing',
    monthlyPlan: shape(monthly, 'plan_'),
    launchPlan: shape(launch, 'plan_'),
    quotedKey: keyId.startsWith('"') || keyId.startsWith("'"),
  }));
  if (!keyId || !secret) return;
  const monthlyResult = monthly
    ? await razorpay(env, 'GET', `/plans/${encodeURIComponent(monthly)}`)
    : { status: 0, description: 'plan-id-missing' };
  const launchResult = launch
    ? await razorpay(env, 'GET', `/plans/${encodeURIComponent(launch)}`)
    : { status: 0, description: 'plan-id-missing' };
  console.log('monthly', JSON.stringify(monthlyResult));
  console.log('launch', JSON.stringify(launchResult));
}

main().catch((err) => {
  console.error('diag-failed', err.name || 'Error');
  process.exitCode = 1;
});
