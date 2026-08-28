require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function isD(v) {
  return typeof v === 'string' && v.startsWith('data:image/');
}
function isH(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v);
}

(async () => {
  const rs = await p.restaurant.findMany({
    select: { id: true, logoUrl: true, coverImageUrl: true },
  });
  const ds = await p.dish.findMany({
    select: { id: true, imageUrl: true },
  });
  let b64 = 0;
  let http = 0;
  let empty = 0;
  const samples = [];
  for (const r of rs) {
    for (const [field, val] of [
      ['logoUrl', r.logoUrl],
      ['coverImageUrl', r.coverImageUrl],
    ]) {
      if (isD(val)) {
        b64 += 1;
        if (samples.length < 5) samples.push(`restaurant ${r.id} ${field} base64 len=${val.length}`);
      } else if (isH(val)) http += 1;
      else if (!val) empty += 1;
      else samples.push(`restaurant ${r.id} ${field} other=${String(val).slice(0, 60)}`);
    }
  }
  for (const d of ds) {
    if (isD(d.imageUrl)) {
      b64 += 1;
      if (samples.length < 8) samples.push(`dish ${d.id} imageUrl base64 len=${d.imageUrl.length}`);
    } else if (isH(d.imageUrl)) http += 1;
    else if (!d.imageUrl) empty += 1;
    else samples.push(`dish ${d.id} other=${String(d.imageUrl).slice(0, 60)}`);
  }
  console.log(
    JSON.stringify(
      {
        restaurants: rs.length,
        dishes: ds.length,
        base64Fields: b64,
        httpFields: http,
        emptyFields: empty,
        samples,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
