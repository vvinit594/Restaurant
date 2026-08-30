require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const { URL } = require('url');

function req(method, urlStr, headers, body) {
  const u = new URL(urlStr);
  return new Promise((resolve, reject) => {
    const r = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: d.slice(0, 300) }),
        );
      },
    );
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const c = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const key = `restaurants/pending/logo/put-test-${Date.now()}.jpg`;
  const { data, error } = await c.storage.from('media').createSignedUploadUrl(key);
  if (error) throw error;

  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
    'base64',
  );

  const put = await req(
    'PUT',
    data.signedUrl,
    {
      'Content-Type': 'image/jpeg',
      Authorization: `Bearer ${data.token}`,
      'Content-Length': String(jpeg.length),
    },
    jpeg,
  );
  console.log('PUT', put.status, put.body.slice(0, 200));

  const { data: pub } = c.storage.from('media').getPublicUrl(key);
  const head = await req('HEAD', pub.publicUrl, {}, null);
  console.log('PUBLIC_HEAD', head.status);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
