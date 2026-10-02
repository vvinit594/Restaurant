/**
 * Bulk dish Excel helpers — columns match Add Dish form / CreateDishDto.
 * Images are matched by filename (imageFile), never embedded as Base64.
 */
import { IMAGE_MAX_BYTES, IMAGE_ERROR_SIZE, validateImageFile } from './mediaApi';

let xlsxModulePromise;

function loadXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }
  return xlsxModulePromise;
}

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

export async function downloadBulkDishTemplate() {
  const XLSX = await loadXlsx();
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
export async function parseBulkDishExcel(buffer) {
  const XLSX = await loadXlsx();
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

const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i;
const ZIP_MAX_BYTES = 80 * 1024 * 1024;

/** Basename from File.name or webkitRelativePath (folder uploads). */
export function imageBasename(file) {
  const rel = String(file?.webkitRelativePath || '').replace(/\\/g, '/');
  const fromRel = rel.split('/').pop();
  const fromName = String(file?.name || '').replace(/\\/g, '/').split('/').pop();
  return String(fromRel || fromName || '').trim();
}

export function imageExtKind(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return 'other';
  if (m[1] === 'jpeg' || m[1] === 'jpg') return 'jpg';
  if (m[1] === 'png') return 'png';
  if (m[1] === 'webp') return 'webp';
  return 'other';
}

export function supportsDirectoryUpload() {
  if (typeof document === 'undefined') return false;
  const input = document.createElement('input');
  return 'webkitdirectory' in input || 'directory' in input;
}

function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Index image File objects from a folder picker, ZIP extract, or manual multi-select.
 * Matching key = case-insensitive basename only (nested paths OK).
 * Duplicate basenames are tracked and excluded from the match map.
 * @param {FileList|File[]} files
 * @param {{ source?: 'folder'|'zip'|'manual' }} [opts]
 */
export function indexImageFiles(files, opts = {}) {
  const list = Array.from(files || []);
  const byBase = new Map(); // lower → File[]
  const supported = [];
  const unsupported = [];
  const byType = { jpg: 0, png: 0, webp: 0 };
  let totalBytes = 0;

  for (const file of list) {
    const base = imageBasename(file);
    if (!base || base.startsWith('.')) continue;
    totalBytes += Number(file.size) || 0;

    if (!IMAGE_EXT_RE.test(base)) {
      unsupported.push({ name: base, reason: 'Unsupported format' });
      continue;
    }

    const key = base.toLowerCase();
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key).push(file);
  }

  const map = new Map();
  const duplicates = [];
  const filesOut = [];
  const oversized = [];

  for (const [key, group] of byBase.entries()) {
    if (group.length > 1) {
      duplicates.push({
        name: imageBasename(group[0]),
        count: group.length,
        paths: group.map((f) => f.webkitRelativePath || f.name),
      });
      // Do not silently pick one — matching will fail until resolved
      continue;
    }
    const file = group[0];
    const base = imageBasename(file);
    const kind = imageExtKind(base);
    if (kind in byType) byType[kind] += 1;

    if (file.size > IMAGE_MAX_BYTES) {
      oversized.push({ name: base, size: file.size, reason: IMAGE_ERROR_SIZE });
    }

    map.set(key, file);
    supported.push(file);
    filesOut.push(file);
  }

  return {
    map,
    count: supported.length,
    files: filesOut,
    supported,
    unsupported,
    oversized,
    duplicates,
    byType,
    totalBytes,
    totalBytesLabel: formatBytes(totalBytes),
    scannedCount: list.length,
    source: opts.source || 'folder',
  };
}

/**
 * Match Excel imageFile values against an indexed folder/ZIP.
 * Extra images are listed but never uploaded unless referenced.
 */
export function buildImageMatchSummary(excelRows, imageIndex) {
  const needed = new Map(); // lower basename → display name
  (excelRows || []).forEach((row) => {
    const name = cellStr(row.imageFile);
    if (!name) return;
    const key = name.replace(/\\/g, '/').split('/').pop().toLowerCase();
    if (!key) return;
    if (!needed.has(key)) needed.set(key, name.replace(/\\/g, '/').split('/').pop());
  });

  const matched = [];
  const missing = [];
  const ambiguous = [];

  for (const [key, display] of needed.entries()) {
    const dup = (imageIndex.duplicates || []).find(
      (d) => d.name.toLowerCase() === key,
    );
    if (dup) {
      ambiguous.push(display);
      continue;
    }
    if (imageIndex.map?.has(key)) matched.push(display);
    else missing.push(display);
  }

  const neededKeys = new Set(needed.keys());
  const extra = (imageIndex.supported || imageIndex.files || [])
    .map((f) => imageBasename(f))
    .filter((name) => name && !neededKeys.has(name.toLowerCase()));

  return {
    excelRows: (excelRows || []).length,
    excelWithImage: needed.size,
    imagesDetected: imageIndex.count || 0,
    scannedCount: imageIndex.scannedCount || 0,
    matchedCount: matched.length,
    missingCount: missing.length,
    extraCount: extra.length,
    ambiguousCount: ambiguous.length,
    matched,
    missing,
    extra,
    ambiguous,
    byType: imageIndex.byType || { jpg: 0, png: 0, webp: 0 },
    unsupported: imageIndex.unsupported || [],
    duplicates: imageIndex.duplicates || [],
    totalBytesLabel: imageIndex.totalBytesLabel || formatBytes(0),
    source: imageIndex.source || 'folder',
  };
}

/**
 * Client-side ZIP extract — never sent to Nest/Vercel.
 * Returns File objects for supported image entries only.
 * @param {File} zipFile
 */
export async function extractImagesFromZip(zipFile) {
  if (!zipFile) {
    const err = new Error('ZIP file is required.');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!/\.zip$/i.test(zipFile.name || '')) {
    const err = new Error('Please select a .zip file.');
    err.code = 'VALIDATION';
    throw err;
  }
  if (zipFile.size > ZIP_MAX_BYTES) {
    const err = new Error('ZIP file must be smaller than 80MB.');
    err.code = 'VALIDATION';
    throw err;
  }

  let JSZip;
  try {
    JSZip = (await import('jszip')).default;
  } catch {
    const err = new Error('ZIP support is unavailable in this build.');
    err.code = 'VALIDATION';
    throw err;
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(zipFile);
  } catch {
    const err = new Error('ZIP file could not be read.');
    err.code = 'VALIDATION';
    throw err;
  }

  const files = [];
  const entries = Object.values(zip.files || {});
  for (const entry of entries) {
    if (!entry || entry.dir) continue;
    const path = String(entry.name || '').replace(/\\/g, '/');
    if (path.includes('__MACOSX/') || /(^|\/)\./.test(path)) continue;
    const base = path.split('/').pop() || '';
    if (!IMAGE_EXT_RE.test(base)) continue;

    const blob = await entry.async('blob');
    const type = /\.png$/i.test(base)
      ? 'image/png'
      : /\.webp$/i.test(base)
        ? 'image/webp'
        : 'image/jpeg';
    const file = new File([blob], base, { type, lastModified: Date.now() });
    // Preserve relative path for diagnostics (not used as storage key)
    try {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: path,
        configurable: true,
      });
    } catch {
      /* ignore */
    }
    files.push(file);
  }

  if (!files.length) {
    const err = new Error('No JPG, PNG, or WebP images found in the ZIP.');
    err.code = 'VALIDATION';
    throw err;
  }

  return indexImageFiles(files, { source: 'zip' });
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
      const baseName = imageFile.replace(/\\/g, '/').split('/').pop();
      if (!IMAGE_EXT_RE.test(baseName)) {
        errors.push({
          field: 'imageFile',
          message: 'Unsupported image type. Use JPG, PNG, or WebP.',
        });
      } else {
        const key = baseName.toLowerCase();
        const dup = (images.duplicates || []).find(
          (d) => String(d.name || '').toLowerCase() === key,
        );
        if (dup) {
          errors.push({
            field: 'imageFile',
            message: `Duplicate filename "${baseName}" found in the image folder (${dup.count} files).`,
          });
        } else {
          matchedFile = images.map?.get(key) || null;
          if (!matchedFile) {
            errors.push({
              field: 'imageFile',
              message: `Image "${baseName}" was not found in the selected image folder.`,
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
          message:
            'A dish with this name already exists. Rename it in Excel or delete/edit it under All Dishes.',
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

export async function downloadBulkErrorReport(previewRows) {
  const XLSX = await loadXlsx();
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
