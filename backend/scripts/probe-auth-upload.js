require('dotenv').config();
const FormData = require('form-data');
const https = require('https');

function req(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(
      { hostname: 'restaurant-seven-smoky.vercel.app', path, method, headers },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: d.slice(0, 1200),
          }),
        );
      },
    );
    r.on('error', reject);
    if (body && body.pipe) body.pipe(r);
    else {
      if (body) r.write(body);
      r.end();
    }
  });
}

(async () => {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  console.log('hasLoginCreds', Boolean(email && password));

  const login = await req(
    'POST',
    '/api/v1/auth/admin/login',
    {
      Origin: 'https://www.dilyum.live',
      'Content-Type': 'application/json',
    },
    JSON.stringify({ email, password }),
  );
  console.log(
    'LOGIN',
    login.status,
    'acao',
    login.headers['access-control-allow-origin'] || 'NONE',
  );

  let token;
  try {
    token = JSON.parse(login.body).accessToken;
  } catch {
    /* ignore */
  }
  console.log('token', token ? 'SET' : 'NONE');
  if (!token) {
    console.log(login.body);
    process.exit(1);
  }

  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
    'base64',
  );
  const form = new FormData();
  form.append('file', jpeg, { filename: 'logo.jpg', contentType: 'image/jpeg' });
  form.append('kind', 'logo');
  form.append('restaurantId', 'pending');

  const post = await req(
    'POST',
    '/api/v1/media/upload',
    {
      ...form.getHeaders(),
      Origin: 'https://www.dilyum.live',
      Authorization: `Bearer ${token}`,
    },
    form,
  );
  console.log(
    'UPLOAD',
    post.status,
    'acao',
    post.headers['access-control-allow-origin'] || 'NONE',
  );
  console.log('BODY', post.body);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
