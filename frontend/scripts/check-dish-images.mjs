/**
 * ponytail: catches category-style wrong images on key dishes.
 * Run: node scripts/check-dish-images.mjs
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { getImageUrl } = require(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/dishImages.js'));

const KEBAB = 'photo-1599487488170';
const CHOCO_SHAKE = 'photo-1572490122747';

const cases = [
  ['dessert', 'Gulab Jamun', '15014919'],
  ['dessert', 'Fruit Salad', '1519996529931'],
  ['dessert', 'Fresh Fruit Plate', '1490474418585'],
  ['lassi', 'Mango Lassi', '1546173159'],
  ['lassi', 'Sweet Lassi', '1550583724'],
  ['falooda', 'Royal Falooda', '1553530666'],
  ['kulfi', 'Malai Kulfi', '1570197788417'],
  ['south_indian', 'Masala Dosa', '1668236543090'],
  ['pav_bhaji', 'Pav Bhaji', '5410400'],
];

let failed = 0;
for (const [cat, name, mustInclude] of cases) {
  const url = getImageUrl(cat, name);
  if (!url.includes(mustInclude)) {
    console.error('FAIL', name, 'got', url, 'expected to include', mustInclude);
    failed += 1;
  }
  if (url.includes(KEBAB) && !/kabab|kebab|seekh|tikka|tandoor/i.test(name)) {
    console.error('FAIL kebab image on', name);
    failed += 1;
  }
}

const lassi = getImageUrl('lassi', 'Salt Lassi');
if (lassi.includes(CHOCO_SHAKE)) {
  console.error('FAIL Salt Lassi still chocolate shake');
  failed += 1;
}
const gulab = getImageUrl('dessert', 'Gulab Jamun');
const fruit = getImageUrl('dessert', 'Fruit Salad');
if (gulab === fruit) {
  console.error('FAIL Gulab Jamun and Fruit Salad share an image');
  failed += 1;
}

// Category must not override name (old bug: dessert → kebab)
const dessertWrong = ['Gulab Jamun', 'Fruit Salad', 'Fresh Fruit Plate'];
for (const name of dessertWrong) {
  const url = getImageUrl('dessert', name);
  if (url.includes(KEBAB)) {
    console.error('FAIL dessert still mapped to kebab:', name);
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('OK: dish image mapping checks passed');
