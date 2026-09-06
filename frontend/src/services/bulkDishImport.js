/**
 * Bulk dish Excel helpers — columns match Add Dish form / CreateDishDto.
 * Images are matched by filename (imageFile), never embedded as Base64.
 */
import * as XLSX from 'xlsx';
import { IMAGE_MAX_BYTES, validateImageFile } from './mediaApi';

export const BULK_EXCEL_COLUMNS = [
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
];

export const BULK_MAX_ROWS = 500;
export const BULK_API_BATCH_SIZE = 25;
export const BULK_UPLOAD_CONCURRENCY = 3;

const EXAMPLE_MARKER = 'EXAMPLE — delete this row before import';

export function downloadBulkDishTemplate() {
  const rows = [
    {
      name: 'Pav Bhaji',
      price: 120,
      category: 'Main Course',
      imageFile: 'pav-bhaji.jpg',
      description: EXAMPLE_MARKER,
      calories: 350,
      protein: 8,
      carbohydrates: 40,
      fat: 12,
      ingredients: 'Potato, Tomato, Butter',
      allergens: 'Dairy',
      isVeg: true,
      isVegan: false,
      isJain: false,
      available: true,
      published: true,
    },
    {
      name: 'Masala Dosa',
      price: 90,
      category: 'South Indian',
      imageFile: 'masala-dosa.jpg',
      description: EXAMPLE_MARKER,
      calories: 280,
      protein: 6,
      carbohydrates: 45,
      fat: 8,
      ingredients: 'Rice, Potato, Spices',
      allergens: '',
      isVeg: true,
      isVegan: true,
      isJain: false,
      available: true,
      published: true,
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(rows, { header: BULK_EXCEL_COLUMNS });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Dishes');
  XLSX.writeFile(book, 'dilyum-bulk-dishes-template.xlsx');
}

function cellStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function parseBool(v, defaultValue) {
  if (v == null || v === '') return defaultValue;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'veg'].includes(s)) return true;
  if (['false', 'no', 'n', '0', 'non-veg', 'nonveg'].includes(s)) return false;
  return defaultValue;
}

function parseOptionalNumber(v) {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

const HEADER_ALIASES = {
  name: 'name',
  dishname: 'name',
  dish: 'name',
  price: 'price',
  category: 'category',
  imagefile: 'imageFile',
  image: 'imageFile',
  filename: 'imageFile',
  description: 'description',
  calories: 'calories',
  protein: 'protein',
  carbohydrates: 'carbohydrates',
  carbs: 'carbohydrates',
  fat: 'fat',
  ingredients: 'ingredients',
  allergens: 'allergens',
  isveg: 'isVeg',
  veg: 'isVeg',
  isvegan: 'isVegan',
  vegan: 'isVegan',
  isjain: 'isJain',
  jain: 'isJain',
  available: 'available',
  published: 'published',
};

/**
 * @param {ArrayBuffer} buffer
 * @returns {{ rows: object[], warnings: string[] }}
 */
export function parseBulkDishExcel(buffer) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    const err = new Error('Excel file could not be parsed.');
    err.code = 'VALIDATION';
    throw err;
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const err = new Error('Excel file has no sheets.');
    err.code = 'VALIDATION';
    throw err;
  }

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });
  if (!raw.length) {
    const err = new Error('Excel sheet is empty.');
    err.code = 'VALIDATION';
    throw err;
  }

  const headerRow = raw[0];
  const colMap = {};
  headerRow.forEach((h, i) => {
    const key = HEADER_ALIASES[normalizeHeader(h)];
    if (key) colMap[key] = i;
  });

  if (colMap.name == null || colMap.price == null || colMap.category == null) {
    const err = new Error(
      'Required column "name", "price", or "category" is missing.',
    );
    err.code = 'VALIDATION';
    throw err;
  }

  const warnings = [];
  const rows = [];

  for (let r = 1; r < raw.length; r += 1) {
    const line = raw[r] || [];
    const get = (key) =>
      colMap[key] != null ? line[colMap[key]] : undefined;

    const name = cellStr(get('name'));
    const description = cellStr(get('description'));
    const allEmpty = line.every((c) => cellStr(c) === '');
    if (allEmpty) continue;

    // Skip template example rows
    if (/^EXAMPLE\b/i.test(description) || /delete this row/i.test(description)) {
      warnings.push(`Row ${r + 1}: skipped example row.`);
      continue;
    }

    rows.push({
      row: r + 1,
      name,
      price: get('price'),
      category: cellStr(get('category')),
      imageFile: cellStr(get('imageFile')),
      description,
      calories: get('calories'),
      protein: get('protein'),
      carbohydrates: get('carbohydrates'),
      fat: get('fat'),
      ingredients: cellStr(get('ingredients')),
      allergens: cellStr(get('allergens')),
      isVeg: get('isVeg'),
      isVegan: get('isVegan'),
      isJain: get('isJain'),
      available: get('available'),
      published: get('published'),
    });
  }

  if (rows.length > BULK_MAX_ROWS) {
    const err = new Error(
      `Too many rows (${rows.length}). Maximum is ${BULK_MAX_ROWS} per import.`,
    );
    err.code = 'VALIDATION';
    throw err;
  }

  if (!rows.length) {
    const err = new Error('No dish rows found (example rows are skipped).');
    err.code = 'VALIDATION';
    throw err;
  }

  return { rows, warnings };
}

/**
 * Build a filename → File map (case-insensitive basename).
 * @param {FileList|File[]} files
 */
export function indexImageFiles(files) {
  const map = new Map();
  const list = Array.from(files || []);
  for (const file of list) {
    const base = String(file.name || '').split(/[/\\]/).pop() || '';
    map.set(base.toLowerCase(), file);
  }
  return { map, count: list.length, files: list };
}

/**
 * Client-side preview validation (backend still authoritative).
 * @param {object[]} excelRows
 * @param {{ map: Map<string, File>, count: number }} images
 * @param {string[]} categoryNames
 * @param {Set<string>} [existingDishNames]
 */
export function validateBulkPreview(
  excelRows,
  images,
  categoryNames,
  existingDishNames = new Set(),
) {
  const cats = new Set(
    (categoryNames || []).map((c) => String(c).trim().toLowerCase()),
  );
  const seen = new Map();
  const results = [];

  for (const raw of excelRows) {
    const errors = [];
    const name = cellStr(raw.name);
    const category = cellStr(raw.category);
    const price = Number(raw.price);
    const imageFile = cellStr(raw.imageFile);

    if (!name) errors.push({ field: 'name', message: 'Dish name is required.' });
    else if (name.length > 200) {
      errors.push({ field: 'name', message: 'Dish name must be at most 200 characters.' });
    }

    if (!Number.isFinite(price) || price < 0.01) {
      errors.push({ field: 'price', message: 'Price must be greater than 0.' });
    }

    if (!category) {
      errors.push({ field: 'category', message: 'Category is required.' });
    } else if (!cats.has(category.toLowerCase())) {
      errors.push({
        field: 'category',
        message: `Category "${category}" does not exist for this restaurant.`,
      });
    }

    let matchedFile = null;
    let thumbUrl = '';
    if (imageFile) {
      if (!/\.(jpe?g|png|webp)$/i.test(imageFile)) {
        errors.push({
          field: 'imageFile',
          message: 'Unsupported image type. Use JPG, PNG, or WebP.',
        });
      } else {
        matchedFile = images.map.get(imageFile.toLowerCase()) || null;
        if (!matchedFile) {
          errors.push({
            field: 'imageFile',
            message: `Image "${imageFile}" was not selected.`,
          });
        } else {
          const check = validateImageFile(matchedFile);
          if (!check.ok) {
            errors.push({ field: 'imageFile', message: check.message });
          } else {
            thumbUrl =
              typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
                ? URL.createObjectURL(matchedFile)
                : '';
          }
        }
      }
    }

    for (const key of ['calories', 'protein', 'carbohydrates', 'fat']) {
      const n = parseOptionalNumber(raw[key]);
      if (n !== undefined && Number.isNaN(n)) {
        errors.push({ field: key, message: `${key} must be a number ≥ 0.` });
      } else if (n !== undefined && n < 0) {
        errors.push({ field: key, message: `${key} must be a number ≥ 0.` });
      }
    }

    if (name) {
      const key = name.toLowerCase();
      if (existingDishNames.has(key)) {
        errors.push({
          field: 'name',
          message: 'A dish with this name already exists.',
        });
      }
      const first = seen.get(key);
      if (first != null) {
        errors.push({
          field: 'name',
          message: `Duplicate dish name in this import (also row ${first}).`,
        });
      } else {
        seen.set(key, raw.row);
      }
    }

    const status = errors.length ? 'invalid' : 'valid';
    results.push({
      row: raw.row,
      name,
      category,
      price: Number.isFinite(price) ? price : null,
      imageFile,
      matchedFile,
      thumbUrl,
      status,
      errors,
      payload: status === 'valid'
        ? {
            row: raw.row,
            name,
            price,
            category,
            description: cellStr(raw.description) || undefined,
            calories: parseOptionalNumber(raw.calories),
            protein: parseOptionalNumber(raw.protein),
            carbohydrates: parseOptionalNumber(raw.carbohydrates),
            fat: parseOptionalNumber(raw.fat),
            ingredients: cellStr(raw.ingredients) || undefined,
            allergens: cellStr(raw.allergens) || undefined,
            isVeg: parseBool(raw.isVeg, true),
            isVegan: parseBool(raw.isVegan, false),
            isJain: parseBool(raw.isJain, false),
            available: parseBool(raw.available, true),
            published: parseBool(raw.published, true),
            _imageFile: matchedFile || null,
          }
        : null,
    });
  }

  const valid = results.filter((r) => r.status === 'valid');
  const invalid = results.filter((r) => r.status === 'invalid');

  return {
    total: results.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    rows: results,
    imageMaxBytes: IMAGE_MAX_BYTES,
  };
}

export function revokePreviewThumbs(previewRows) {
  (previewRows || []).forEach((r) => {
    if (r?.thumbUrl) URL.revokeObjectURL(r.thumbUrl);
  });
}

export function downloadBulkErrorReport(previewRows) {
  const failed = (previewRows || []).filter((r) => r.status === 'invalid');
  const data = [];
  failed.forEach((r) => {
    (r.errors || []).forEach((e) => {
      data.push({
        row: r.row,
        dishName: r.name || '',
        field: e.field,
        error: e.message,
      });
    });
  });
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Errors');
  XLSX.writeFile(book, 'dilyum-bulk-import-errors.xlsx');
}

export function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
