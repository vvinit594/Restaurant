/**
 * Probe production CORS for /api/v1/media/upload.
 * Usage: node scripts/probe-media-cors.js
 */
const FormData = require('form-data');
const https = require('https');

const HOST = 'restaurant-seven-smoky.vercel.app';
const ORIGIN = 'https://www.dilyum.live';

function request(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: HOST, path, method, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            acao: res.headers['access-control-allow-origin'] || null,
            acac: res.headers['access-control-allow-credentials'] || null,
            methods: res.headers['access-control-allow-methods'] || null,
            body: data.slice(0, 200),
          }),
        );
      },
    );
    req.on('error', reject);
    if (body) body.pipe(req);
    else req.end();
  });
}

async function main() {
  const options = await request('OPTIONS', '/api/v1/media/upload', {
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  console.log('OPTIONS', options);

  const form = new FormData();
  form.append('file', Buffer.alloc(32, 1), {
    filename: 't.jpg',
    contentType: 'image/jpeg',
  });
  form.append('kind', 'logo');
  const post = await request('POST', '/api/v1/media/upload', {
    headers: {
      ...form.getHeaders(),
      Origin: ORIGIN,
      Authorization: 'Bearer invalid',
    },
    body: form,
  });
  console.log('POST small', post);

  const formBig = new FormData();
  formBig.append('file', Buffer.alloc(4_600_000, 1), {
    filename: 'big.jpg',
    contentType: 'image/jpeg',
  });
  const postBig = await request('POST', '/api/v1/media/upload', {
    headers: {
      ...formBig.getHeaders(),
      Origin: ORIGIN,
      Authorization: 'Bearer invalid',
    },
    body: formBig,
  });
  console.log('POST 4.6MB (Vercel platform)', postBig);

  const ok =
    options.acao === ORIGIN &&
    post.acao === ORIGIN &&
    post.status === 401;
  if (!ok) process.exitCode = 1;
  if (postBig.status === 413 && !postBig.acao) {
    console.log(
      'NOTE: 413 FUNCTION_PAYLOAD_TOO_LARGE has no CORS headers (Vercel edge). Keep uploads <= 3MB.',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
