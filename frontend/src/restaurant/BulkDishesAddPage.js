import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../admin/components/Toast';
import { IMAGE_ACCEPT, uploadImage } from '../services/mediaApi';
import {
  BULK_API_BATCH_SIZE,
  BULK_UPLOAD_CONCURRENCY,
  chunkArray,
  downloadBulkDishTemplate,
  downloadBulkErrorReport,
  indexImageFiles,
  parseBulkDishExcel,
  revokePreviewThumbs,
  validateBulkPreview,
} from '../services/bulkDishImport';
import {
  bulkCreateDishes,
  getCategories,
  getRestaurantMenu,
} from '../services/restaurantMenuApi';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';

const STEP_UPLOAD = 'upload';
const STEP_PREVIEW = 'preview';
const STEP_IMPORTING = 'importing';
const STEP_DONE = 'done';

export default function BulkDishesAddPage() {
  const { user } = useRestaurantAuth();
  const { push } = useToast();
  const excelInputRef = useRef(null);
  const imagesInputRef = useRef(null);

  const [step, setStep] = useState(STEP_UPLOAD);
  const [categories, setCategories] = useState([]);
  const [existingNames, setExistingNames] = useState(new Set());
  const [excelFile, setExcelFile] = useState(null);
  const [excelRows, setExcelRows] = useState([]);
  const [imageIndex, setImageIndex] = useState({ map: new Map(), count: 0, files: [] });
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({
    imagesDone: 0,
    imagesTotal: 0,
    dishesDone: 0,
    dishesTotal: 0,
  });
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cats, menu] = await Promise.all([
          getCategories(),
          getRestaurantMenu().catch(() => []),
        ]);
        if (!alive) return;
        setCategories(cats || []);
        setExistingNames(
          new Set((menu || []).map((d) => String(d.name || '').trim().toLowerCase())),
        );
      } catch {
        /* preview still works; server validates */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preview?.rows) revokePreviewThumbs(preview.rows);
    };
  }, [preview]);

  const onExcelChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      push('Please select an .xlsx or .xls file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      push('Excel file must be smaller than 5MB.', 'error');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseBulkDishExcel(buffer);
      setExcelFile(file);
      setExcelRows(parsed.rows);
      setPreview(null);
      setStep(STEP_UPLOAD);
      setResult(null);
      if (parsed.warnings.length) {
        push(`Loaded ${parsed.rows.length} rows (${parsed.warnings.length} example rows skipped).`);
      } else {
        push(`Loaded ${parsed.rows.length} dish rows from Excel.`);
      }
    } catch (err) {
      push(err.message || 'Excel file could not be parsed.', 'error');
    }
  };

  const onImagesChange = (e) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files?.length) return;
    const indexed = indexImageFiles(files);
    setImageIndex(indexed);
    setPreview(null);
    setResult(null);
    push(`${indexed.count} image${indexed.count === 1 ? '' : 's'} selected.`);
  };

  const onValidatePreview = () => {
    if (!excelRows.length) {
      push('Select an Excel file first.', 'error');
      return;
    }
    if (preview?.rows) revokePreviewThumbs(preview.rows);
    const next = validateBulkPreview(
      excelRows,
      imageIndex,
      categories,
      existingNames,
    );
    setPreview(next);
    setStep(STEP_PREVIEW);
    setResult(null);
  };

  const onCancelPreview = () => {
    if (preview?.rows) revokePreviewThumbs(preview.rows);
    setPreview(null);
    setStep(STEP_UPLOAD);
  };

  const onImportValid = async () => {
    if (!preview || importing) return;
    const validRows = preview.rows.filter((r) => r.status === 'valid' && r.payload);
    if (!validRows.length) {
      push('No valid rows to import.', 'error');
      return;
    }

    setImporting(true);
    setStep(STEP_IMPORTING);
    const needImages = validRows.filter((r) => r.payload._imageFile);
    setProgress({
      imagesDone: 0,
      imagesTotal: needImages.length,
      dishesDone: 0,
      dishesTotal: validRows.length,
    });

    const failedDuringImport = [];
    let imported = 0;
    let imagesUploaded = 0;

    try {
      // 1) Upload images via existing signed Supabase flow
      const withUrls = [];
      const queue = [...validRows];

      const uploadOne = async (row) => {
        const payload = { ...row.payload };
        const file = payload._imageFile;
        delete payload._imageFile;
        if (file) {
          try {
            const uploaded = await uploadImage(file, {
              kind: 'dish',
              restaurantId: user?.restaurantId,
            });
            payload.imageUrl = uploaded.url;
            imagesUploaded += 1;
            setProgress((p) => ({ ...p, imagesDone: p.imagesDone + 1 }));
          } catch (err) {
            failedDuringImport.push({
              row: row.row,
              name: row.name,
              field: 'imageFile',
              message: err.message || 'Image upload failed.',
            });
            setProgress((p) => ({ ...p, imagesDone: p.imagesDone + 1 }));
            return null;
          }
        }
        return payload;
      };

      // Controlled concurrency for uploads
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(BULK_UPLOAD_CONCURRENCY, queue.length) },
        async () => {
          while (cursor < queue.length) {
            const idx = cursor;
            cursor += 1;
            const payload = await uploadOne(queue[idx]);
            if (payload) withUrls.push(payload);
          }
        },
      );
      await Promise.all(workers);

      // 2) Create dishes in JSON batches (restaurant from JWT only)
      const batches = chunkArray(withUrls, BULK_API_BATCH_SIZE);
      for (const batch of batches) {
        try {
          const clean = batch.map((d) => {
            const body = { ...d };
            Object.keys(body).forEach((k) => {
              if (body[k] === undefined || Number.isNaN(body[k])) delete body[k];
            });
            return body;
          });
          const res = await bulkCreateDishes(clean);
          imported += Number(res?.imported || clean.length);
          setProgress((p) => ({
            ...p,
            dishesDone: Math.min(p.dishesTotal, p.dishesDone + clean.length),
          }));
        } catch (err) {
          const detailRows = err?.data?.rows || [];
          if (Array.isArray(detailRows) && detailRows.length) {
            detailRows
              .filter((r) => r.status === 'invalid')
              .forEach((r) => {
                (r.errors || []).forEach((e) => {
                  failedDuringImport.push({
                    row: r.row,
                    name: r.name,
                    field: e.field,
                    message: e.message,
                  });
                });
              });
          } else {
            batch.forEach((d) => {
              failedDuringImport.push({
                row: d.row,
                name: d.name,
                field: 'import',
                message: err.message || 'Import failed for this batch.',
              });
            });
          }
          setProgress((p) => ({
            ...p,
            dishesDone: Math.min(p.dishesTotal, p.dishesDone + batch.length),
          }));
        }
      }

      const skippedInvalid = preview.invalidCount;
      setResult({
        imported,
        skippedInvalid,
        importErrors: failedDuringImport,
        imagesUploaded,
      });
      setStep(STEP_DONE);
      if (imported > 0) {
        push(`Imported ${imported} dish${imported === 1 ? '' : 'es'}.`);
      } else {
        push('No dishes were imported.', 'error');
      }
    } catch (err) {
      push(err.message || 'Bulk import failed.', 'error');
      setStep(STEP_PREVIEW);
    } finally {
      setImporting(false);
    }
  };

  const failedTotal =
    (result?.skippedInvalid || 0) + (result?.importErrors?.length || 0);

  return (
    <div className="admin-page bulk-dishes-page">
      <div className="admin-page-header">
        <div>
          <h1>Bulk Add Dishes</h1>
          <p className="admin-muted">
            Add hundreds of dishes at once using an Excel spreadsheet and matching
            image files. Saving to <strong>{user?.restaurantName}</strong> only.
          </p>
        </div>
        <Link to="/restaurant/menu" className="admin-btn admin-btn-ghost">
          Cancel
        </Link>
      </div>

      {step === STEP_UPLOAD || step === STEP_PREVIEW ? (
        <div className="admin-form-card bulk-dishes-card">
          <ol className="bulk-steps">
            <li>Download Template</li>
            <li>Fill Excel</li>
            <li>Select Excel</li>
            <li>Select Images</li>
            <li>Validate &amp; Preview</li>
            <li>Import Dishes</li>
          </ol>

          <div className="bulk-section">
            <h2>1. Download Template</h2>
            <p className="admin-muted">
              Includes all Add Dish fields. Example rows are marked — delete them
              before importing. Put image filenames in the <code>imageFile</code>{' '}
              column (do not embed images in Excel).
            </p>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => downloadBulkDishTemplate()}
            >
              Download Excel Template
            </button>
          </div>

          <hr className="bulk-divider" />

          <div className="bulk-section">
            <h2>2. Upload Excel</h2>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              hidden
              onChange={onExcelChange}
            />
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => excelInputRef.current?.click()}
            >
              Choose Excel File
            </button>
            {excelFile ? (
              <p className="bulk-file-ok">✓ {excelFile.name} ({excelRows.length} rows)</p>
            ) : null}
          </div>

          <div className="bulk-section">
            <h2>3. Upload Dish Images</h2>
            <p className="admin-muted">
              Select JPG, PNG, or WebP files whose names match the{' '}
              <code>imageFile</code> column (max 3MB each).
            </p>
            <input
              ref={imagesInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              hidden
              onChange={onImagesChange}
            />
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => imagesInputRef.current?.click()}
            >
              Choose Images
            </button>
            {imageIndex.count > 0 ? (
              <div className="bulk-image-summary">
                <p className="bulk-file-ok">
                  ✓ {imageIndex.count} image{imageIndex.count === 1 ? '' : 's'} selected
                </p>
                <ul className="bulk-image-list">
                  {imageIndex.files.slice(0, 12).map((f) => (
                    <li key={f.name}>{f.name}</li>
                  ))}
                  {imageIndex.files.length > 12 ? (
                    <li>…and {imageIndex.files.length - 12} more</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={onValidatePreview}
              disabled={!excelRows.length}
            >
              Validate &amp; Preview
            </button>
          </div>
        </div>
      ) : null}

      {step === STEP_PREVIEW && preview ? (
        <div className="admin-form-card bulk-dishes-card bulk-preview-card">
          <h2>Import Preview</h2>
          <div className="bulk-summary">
            <span>{preview.total} Total</span>
            <span className="bulk-ok">{preview.validCount} Valid</span>
            <span className="bulk-bad">{preview.invalidCount} Errors</span>
          </div>
          {preview.invalidCount > 0 ? (
            <p className="admin-muted">
              {preview.invalidCount} row{preview.invalidCount === 1 ? '' : 's'} will
              not be imported.
            </p>
          ) : null}

          <div className="bulk-table-wrap">
            <table className="bulk-preview-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Dish</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Image</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={r.status === 'valid' ? '' : 'is-error'}>
                    <td>{r.row}</td>
                    <td>
                      <div className="bulk-dish-cell">
                        {r.thumbUrl ? (
                          <img src={r.thumbUrl} alt="" className="bulk-thumb" />
                        ) : (
                          <span className="bulk-thumb-placeholder" />
                        )}
                        <span>{r.name || '—'}</span>
                      </div>
                    </td>
                    <td>{r.category || '—'}</td>
                    <td>{r.price != null ? `₹${r.price}` : '—'}</td>
                    <td>{r.imageFile || '—'}</td>
                    <td>
                      {r.status === 'valid' ? (
                        <span className="bulk-ok">✓ Valid</span>
                      ) : (
                        <span className="bulk-bad" title={r.errors.map((e) => e.message).join('; ')}>
                          ✗ {r.errors[0]?.message || 'Invalid'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={onCancelPreview}
              disabled={importing}
            >
              Cancel
            </button>
            {preview.invalidCount > 0 ? (
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => downloadBulkErrorReport(preview.rows)}
              >
                Download Error Report
              </button>
            ) : null}
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={onImportValid}
              disabled={importing || preview.validCount === 0}
            >
              Import {preview.validCount} Valid Dish{preview.validCount === 1 ? '' : 'es'}
            </button>
          </div>
        </div>
      ) : null}

      {step === STEP_IMPORTING ? (
        <div className="admin-form-card bulk-dishes-card">
          <h2>Importing dishes…</h2>
          <ProgressBar
            label="Images"
            done={progress.imagesDone}
            total={progress.imagesTotal}
          />
          <ProgressBar
            label="Dishes"
            done={progress.dishesDone}
            total={progress.dishesTotal}
          />
          <p className="admin-muted">
            {progress.dishesDone} / {progress.dishesTotal} processed
          </p>
        </div>
      ) : null}

      {step === STEP_DONE && result ? (
        <div className="admin-form-card bulk-dishes-card">
          <h2>Bulk Import Complete</h2>
          <div className="bulk-summary">
            <span className="bulk-ok">✓ {result.imported} dishes imported</span>
            <span className="bulk-bad">✗ {failedTotal} rows failed / skipped</span>
            <span>Images uploaded: {result.imagesUploaded}</span>
          </div>
          {result.importErrors?.length ? (
            <ul className="bulk-error-list">
              {result.importErrors.slice(0, 20).map((e, i) => (
                <li key={`${e.row}-${i}`}>
                  Row {e.row}: {e.name || '—'} — {e.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="admin-form-actions">
            <Link to="/restaurant/menu" className="admin-btn admin-btn-primary">
              View All Dishes
            </Link>
            {(preview?.invalidCount > 0 || result.importErrors?.length > 0) && (
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => {
                  if (preview?.rows) downloadBulkErrorReport(preview.rows);
                  else if (result.importErrors?.length) {
                    downloadBulkErrorReport(
                      result.importErrors.map((e) => ({
                        row: e.row,
                        name: e.name,
                        status: 'invalid',
                        errors: [{ field: e.field, message: e.message }],
                      })),
                    );
                  }
                }}
              >
                Download Error Report
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => {
                if (preview?.rows) revokePreviewThumbs(preview.rows);
                setExcelFile(null);
                setExcelRows([]);
                setImageIndex({ map: new Map(), count: 0, files: [] });
                setPreview(null);
                setResult(null);
                setStep(STEP_UPLOAD);
              }}
            >
              Import More
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProgressBar({ label, done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="bulk-progress">
      <div className="bulk-progress-label">
        <span>{label}</span>
        <span>{total ? `${pct}%` : '—'}</span>
      </div>
      <div className="bulk-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="bulk-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
