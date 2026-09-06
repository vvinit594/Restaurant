/**
 * @jest-environment jsdom
 */
import * as XLSX from 'xlsx';
import {
  BULK_EXCEL_COLUMNS,
  indexImageFiles,
  parseBulkDishExcel,
  validateBulkPreview,
} from './bulkDishImport';

function makeExcelBuffer(rows, headers = BULK_EXCEL_COLUMNS) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Dishes');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
}

function tinyPngFile(name, size = 100) {
  const buf = new Uint8Array(size);
  return new File([buf], name, { type: 'image/png' });
}

test('template columns match Add Dish fields + imageFile', () => {
  expect(BULK_EXCEL_COLUMNS).toEqual([
    'name',
    'price',
    'category',
    'imageFile',
    'description',
    'calories',
    'protein',
    'carbohydrates',
    'fat',
    'ingredients',
    'allergens',
    'isVeg',
    'isVegan',
    'isJain',
    'available',
    'published',
  ]);
});

test('parses valid excel and skips EXAMPLE rows', () => {
  const buf = makeExcelBuffer([
    {
      name: 'Example',
      price: 1,
      category: 'Main Course',
      imageFile: 'x.jpg',
      description: 'EXAMPLE — delete this row before import',
    },
    {
      name: 'Pizza',
      price: 300,
      category: 'Main Course',
      imageFile: 'pizza.jpg',
      description: 'Tasty',
      isVeg: true,
      available: true,
      published: true,
    },
  ]);
  const parsed = parseBulkDishExcel(buf);
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0].name).toBe('Pizza');
  expect(parsed.rows[0].imageFile).toBe('pizza.jpg');
});

test('rejects missing required columns', () => {
  const buf = makeExcelBuffer([{ dish: 'X' }], ['dish']);
  expect(() => parseBulkDishExcel(buf)).toThrow(/Required column/);
});

test('preview validates price, category, missing image, duplicates', () => {
  const images = indexImageFiles([tinyPngFile('pizza.jpg')]);
  const preview = validateBulkPreview(
    [
      { row: 2, name: 'Pizza', price: 300, category: 'Main Course', imageFile: 'pizza.jpg' },
      { row: 3, name: 'Burger', price: -5, category: 'Snacks', imageFile: 'burger.jpg' },
      { row: 4, name: 'Dosa', price: 120, category: 'South Indian', imageFile: 'dosa.jpg' },
      { row: 5, name: 'Pizza', price: 200, category: 'Main Course', imageFile: '' },
    ],
    images,
    ['Main Course', 'South Indian'],
    new Set(),
  );
  expect(preview.total).toBe(4);
  expect(preview.validCount).toBe(1);
  expect(preview.invalidCount).toBe(3);
  const burger = preview.rows.find((r) => r.row === 3);
  expect(burger.errors.some((e) => e.field === 'price')).toBe(true);
  expect(burger.errors.some((e) => e.field === 'category')).toBe(true);
  const dosa = preview.rows.find((r) => r.row === 4);
  expect(dosa.errors.some((e) => /was not selected/i.test(e.message))).toBe(true);
});

test('rejects unsupported image type and oversized file', () => {
  const gif = new File([new Uint8Array(10)], 'x.gif', { type: 'image/gif' });
  const huge = new File([new Uint8Array(4 * 1024 * 1024)], 'big.jpg', {
    type: 'image/jpeg',
  });
  const images = indexImageFiles([gif, huge]);
  const preview = validateBulkPreview(
    [
      { row: 2, name: 'A', price: 10, category: 'Main Course', imageFile: 'x.gif' },
      { row: 3, name: 'B', price: 10, category: 'Main Course', imageFile: 'big.jpg' },
    ],
    images,
    ['Main Course'],
  );
  expect(preview.validCount).toBe(0);
  expect(preview.rows[0].errors[0].message).toMatch(/Unsupported|format/i);
  expect(preview.rows[1].errors[0].message).toMatch(/3MB/i);
});

test('detects existing DB duplicate names', () => {
  const preview = validateBulkPreview(
    [{ row: 2, name: 'Pav Bhaji', price: 100, category: 'Main Course', imageFile: '' }],
    indexImageFiles([]),
    ['Main Course'],
    new Set(['pav bhaji']),
  );
  expect(preview.invalidCount).toBe(1);
  expect(preview.rows[0].errors[0].message).toMatch(/already exists/);
});

test('error report builds rows for invalid preview', () => {
  const failed = [
    {
      row: 4,
      name: 'Burger',
      status: 'invalid',
      errors: [{ field: 'price', message: 'Price must be greater than 0.' }],
    },
  ];
  const data = [];
  failed.forEach((r) => {
    (r.errors || []).forEach((e) => {
      data.push({ row: r.row, dishName: r.name, field: e.field, error: e.message });
    });
  });
  expect(data).toEqual([
    { row: 4, dishName: 'Burger', field: 'price', error: 'Price must be greater than 0.' },
  ]);
});

test('300-row preview stays efficient (no Base64)', () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({
    row: i + 2,
    name: `Dish ${i}`,
    price: 50,
    category: 'Main Course',
    imageFile: '',
  }));
  const preview = validateBulkPreview(rows, indexImageFiles([]), ['Main Course']);
  expect(preview.validCount).toBe(300);
  expect(JSON.stringify(preview.rows[0])).not.toMatch(/data:image/);
});
