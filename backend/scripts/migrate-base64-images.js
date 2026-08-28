/**
 * Migrate Base64 data-URL image fields → Supabase Storage public URLs.
 *
 * Idempotent: skips rows that are already http(s) URLs (or empty).
 * Safe: uploads first, verifies public URL, then updates the DB row.
 * Does NOT delete old data until the new URL is written.
 *
 * Usage (from backend/):
 *   node scripts/migrate-base64-images.js
 *   node scripts/migrate-base64-images.js --dry-run
 *
 * Requires:
 *   DATABASE_URL
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();
const BUCKET = 'media';
const MAX_BYTES = 5 * 1024 * 1024;
const dryRun = process.argv.includes('--dry-run');

function isDataImage(value) {
  return typeof value === 'string' && value.trim().startsWith('data:image/');
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function parseDataUrl(raw) {
  const match = String(raw || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) throw new Error('Not a valid data:image Base64 URL');
  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  return { mime, buffer };
}

function extFor(mime) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

function getSupabase() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before migrating.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureBucket(client) {
  const { data } = await client.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await client.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  });
  if (error && !/already exists/i.test(error.message || '')) {
    throw new Error(`Could not create bucket "${BUCKET}": ${error.message}`);
  }
}

async function uploadOne(client, buffer, mime, storageKey) {
  if (buffer.length > MAX_BYTES) {
    throw new Error(`Image exceeds 5MB (${buffer.length} bytes)`);
  }
  const { error } = await client.storage.from(BUCKET).upload(storageKey, buffer, {
    contentType: mime,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw new Error(error.message || 'Upload failed');
  const { data } = client.storage.from(BUCKET).getPublicUrl(storageKey);
  if (!data?.publicUrl) throw new Error('Missing public URL after upload');
  return data.publicUrl;
}

async function migrateField({ client, table, id, field, value, storageKey }) {
  if (!isDataImage(value)) {
    return { skipped: true, reason: 'not-base64' };
  }
  if (dryRun) {
    return { skipped: true, reason: 'dry-run', bytes: value.length };
  }

  const { mime, buffer } = parseDataUrl(value);
  const url = await uploadOne(client, buffer, mime, storageKey);

  // Verify URL is reachable (HEAD preferred; fall back to GET range)
  const probe = await fetch(url, { method: 'HEAD' }).catch(() => null);
  if (probe && !probe.ok && probe.status !== 405) {
    const getProbe = await fetch(url, {
      headers: { Range: 'bytes=0-0' },
    }).catch(() => null);
    if (!getProbe || !getProbe.ok) {
      throw new Error(`Uploaded but URL not reachable: ${url}`);
    }
  }

  if (table === 'restaurant') {
    await prisma.restaurant.update({
      where: { id },
      data: { [field]: url },
    });
  } else if (table === 'dish') {
    await prisma.dish.update({
      where: { id },
      data: { [field]: url },
    });
  }

  return { ok: true, url, storageKey };
}

async function main() {
  const client = getSupabase();
  await ensureBucket(client);

  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, logoUrl: true, coverImageUrl: true },
  });
  const dishes = await prisma.dish.findMany({
    select: { id: true, restaurantId: true, imageUrl: true },
  });

  const jobs = [];

  for (const r of restaurants) {
    if (isDataImage(r.logoUrl)) {
      jobs.push({
        table: 'restaurant',
        id: r.id,
        field: 'logoUrl',
        value: r.logoUrl,
        storageKey: `restaurants/${r.id}/logo/${randomUUID()}.jpg`,
      });
    }
    if (isDataImage(r.coverImageUrl)) {
      jobs.push({
        table: 'restaurant',
        id: r.id,
        field: 'coverImageUrl',
        value: r.coverImageUrl,
        storageKey: `restaurants/${r.id}/cover/${randomUUID()}.jpg`,
      });
    }
  }

  for (const d of dishes) {
    if (isDataImage(d.imageUrl)) {
      const ext = (() => {
        try {
          return extFor(parseDataUrl(d.imageUrl).mime);
        } catch {
          return 'jpg';
        }
      })();
      jobs.push({
        table: 'dish',
        id: d.id,
        field: 'imageUrl',
        value: d.imageUrl,
        storageKey: `dishes/${d.restaurantId}/${d.id}/${randomUUID()}.${ext}`,
      });
    }
  }

  console.log(
    `Found ${jobs.length} Base64 image field(s) to migrate` +
      (dryRun ? ' (dry-run)' : '') +
      '.',
  );

  let ok = 0;
  let fail = 0;
  for (const job of jobs) {
    try {
      // Fix storage key extension from actual mime when possible
      if (!dryRun) {
        const { mime } = parseDataUrl(job.value);
        job.storageKey = job.storageKey.replace(/\.[a-z0-9]+$/i, `.${extFor(mime)}`);
      }
      const result = await migrateField({ client, ...job });
      if (result.ok) {
        ok += 1;
        console.log(`OK ${job.table}.${job.field} ${job.id} → ${result.url}`);
      } else {
        console.log(`SKIP ${job.table}.${job.field} ${job.id}: ${result.reason}`);
      }
    } catch (err) {
      fail += 1;
      console.error(`FAIL ${job.table}.${job.field} ${job.id}:`, err.message || err);
    }
  }

  // Report remaining Base64 (should be 0 after successful run)
  const remainingRestaurants = await prisma.restaurant.findMany({
    select: { id: true, logoUrl: true, coverImageUrl: true },
  });
  const remainingDishes = await prisma.dish.findMany({
    select: { id: true, imageUrl: true },
  });
  const stillBase64 = [
    ...remainingRestaurants.flatMap((r) => [
      isDataImage(r.logoUrl) ? `restaurant ${r.id} logoUrl` : null,
      isDataImage(r.coverImageUrl) ? `restaurant ${r.id} coverImageUrl` : null,
    ]),
    ...remainingDishes.map((d) =>
      isDataImage(d.imageUrl) ? `dish ${d.id} imageUrl` : null,
    ),
  ].filter(Boolean);

  console.log(`Done. migrated=${ok} failed=${fail} remainingBase64=${stillBase64.length}`);
  if (stillBase64.length) {
    console.log('Remaining Base64 fields:');
    stillBase64.forEach((line) => console.log(' -', line));
  }

  // Idempotency note: http URLs are never re-uploaded on re-run.
  const httpSample = remainingRestaurants.find(
    (r) => isHttpUrl(r.logoUrl) || isHttpUrl(r.coverImageUrl),
  );
  if (httpSample) {
    console.log('Sample http image URL present (good).');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
