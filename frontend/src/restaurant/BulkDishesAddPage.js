import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../admin/components/Toast';
import { IMAGE_ACCEPT, uploadImage } from '../services/mediaApi';
import {
  BULK_API_BATCH_SIZE,
  BULK_UPLOAD_CONCURRENCY,
  buildImageMatchSummary,
  chunkArray,
  downloadBulkDishTemplate,
  downloadBulkErrorReport,
  extractImagesFromZip,
  indexImageFiles,
  parseBulkDishExcel,
  revokePreviewThumbs,
  supportsDirectoryUpload,
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

const EMPTY_IMAGES = {
  map: new Map(),
  count: 0,
  files: [],
  supported: [],
  unsupported: [],
  oversized: [],
  duplicates: [],
  byType: { jpg: 0, png: 0, webp: 0 },
  totalBytes: 0,
  totalBytesLabel: '0 B',
  scannedCount: 0,
  source: 'folder',
};

export default function BulkDishesAddPage() {
  const { user } = useRestaurantAuth();
  const { push } = useToast();
  const excelInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const zipInputRef = useRef(null);
  const manualInputRef = useRef(null);
  const folderSupported = useMemo(() => supportsDirectoryUpload(), []);

  const [step, setStep] = useState(STEP_UPLOAD);
  const [categories, setCategories] = useState([]);
  const [existingNames, setExistingNames] = useState(new Set());
  const [excelFile, setExcelFile] = useState(null);
  const [excelRows, setExcelRows] = useState([]);
  const [imageIndex, setImageIndex] = useState(EMPTY_IMAGES);
  const [matchDetailsOpen, setMatchDetailsOpen] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({
    phase: 'images',
    imagesDone: 0,
    imagesTotal: 0,
    dishesDone: 0,
    dishesTotal: 0,
  });
  const [result, setResult] = useState(null);
  const [retryRows, setRetryRows] = useState([]);

  const matchSummary = useMemo(
    () =>
      excelRows.length && imageIndex.scannedCount > 0
        ? buildImageMatchSummary(excelRows, imageIndex)
        : null,
    [excelRows, imageIndex],
  );

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

  const applyImageIndex = (indexed, toastMsg) => {
    setImageIndex(indexed);
    setPreview(null);
    setResult(null);
    setRetryRows([]);
    setMatchDetailsOpen(false);
    setStep(STEP_UPLOAD);
    if (toastMsg) push(toastMsg);
  };

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
      const parsed = await parseBulkDishExcel(buffer);
      setExcelFile(file);
      setExcelRows(parsed.rows);
      setPreview(null);
      setStep(STEP_UPLOAD);
      setResult(null);
      setRetryRows([]);
      if (parsed.warnings.length) {
        push(`Loaded ${parsed.rows.length} rows (${parsed.warnings.length} example rows skipped).`);
      } else {
        push(`Loaded ${parsed.rows.length} dish rows from Excel.`);
      }
    } catch (err) {
      push(err.message || 'Excel file could not be parsed.', 'error');
    }
  };

  const onFolderChange = (e) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files?.length) return;
    const indexed = indexImageFiles(files, { source: 'folder' });
    applyImageIndex(
      indexed,
      `✓ ${indexed.count} image${indexed.count === 1 ? '' : 's'} detected in folder.`,
    );
  };

  const onZipChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setZipBusy(true);
    try {
      const indexed = await extractImagesFromZip(file);
      applyImageIndex(
        indexed,
        `✓ ${indexed.count} image${indexed.count === 1 ? '' : 's'} extracted from ZIP (client-side only).`,
      );
    } catch (err) {
      push(err.message || 'Could not read ZIP file.', 'error');
    } finally {
      setZipBusy(false);
    }
  };

  const onManualImagesChange = (e) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files?.length) return;
    const indexed = indexImageFiles(files, { source: 'manual' });
    applyImageIndex(
      indexed,
      `${indexed.count} image${indexed.count === 1 ? '' : 's'} selected.`,
    );
  };

  const onValidatePreview = async () => {
    if (!excelRows.length) {
      push('Select an Excel file first.', 'error');
      return;
    }

    // Refresh existing dish names so duplicate preview matches the server.
    let names = existingNames;
    try {
      const menu = await getRestaurantMenu();
      names = new Set(
        (menu || []).map((d) => String(d.name || '').trim().toLowerCase()),
      );
      setExistingNames(names);
    } catch {
      /* keep cached names; server still validates */
    }

    if (preview?.rows) revokePreviewThumbs(preview.rows);
    const next = validateBulkPreview(
      excelRows,
      imageIndex,
      categories,
      names,
    );
    setPreview(next);
    setStep(STEP_PREVIEW);
    setResult(null);
    setRetryRows([]);

    if (next.invalidCount > 0 && next.validCount === 0) {
      push(
        'All rows have errors. Duplicate names already on your menu must be renamed in Excel or removed under All Dishes.',
        'error',
      );
    } else if (next.invalidCount > 0) {
      push(
        `${next.validCount} valid, ${next.invalidCount} with errors (duplicates will be skipped).`,
      );
    }
  };

  const onCancelPreview = () => {
    if (preview?.rows) revokePreviewThumbs(preview.rows);
    setPreview(null);
    setStep(STEP_UPLOAD);
  };

  const uploadRowsWithRetry = async (rows, { maxAttempts = 2 } = {}) => {
    const withUrls = [];
    const failed = [];
    let imagesUploaded = 0;
    const needImages = rows.filter((r) => r.payload?._imageFile);
    setProgress((p) => ({
      ...p,
      phase: 'images',
      imagesDone: 0,
      imagesTotal: needImages.length,
    }));

    const queue = [...rows];
    let cursor = 0;

    const uploadOne = async (row) => {
      const payload = { ...row.payload };
      const file = payload._imageFile;
      delete payload._imageFile;
      if (!file) return payload;

      let lastErr = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const uploaded = await uploadImage(file, {
            kind: 'dish',
            restaurantId: user?.restaurantId,
          });
          payload.imageUrl = uploaded.url;
          imagesUploaded += 1;
          setProgress((p) => ({ ...p, imagesDone: p.imagesDone + 1 }));
          return payload;
        } catch (err) {
          lastErr = err;
        }
      }
      failed.push({
        row: row.row,
        name: row.name,
        field: 'imageFile',
        message: lastErr?.message || 'Image upload failed.',
        previewRow: row,
      });
      setProgress((p) => ({ ...p, imagesDone: p.imagesDone + 1 }));
      return null;
    };

    const workers = Array.from(
      { length: Math.min(BULK_UPLOAD_CONCURRENCY, Math.max(queue.length, 1)) },
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
    return { withUrls, failed, imagesUploaded };
  };

  const createDishBatches = async (withUrls) => {
    let imported = 0;
    const failedDuringImport = [];
    setProgress((p) => ({
      ...p,
      phase: 'dishes',
      dishesDone: 0,
      dishesTotal: withUrls.length,
    }));

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
        imported += Number(res?.imported || 0);
        const failedFromApi = Array.isArray(res?.rows)
          ? res.rows.filter((r) => r.status === 'invalid')
          : [];
        failedFromApi.forEach((r) => {
          (r.errors || []).forEach((e) => {
            failedDuringImport.push({
              row: r.row,
              name: r.name,
              field: e.field,
              message: e.message,
            });
          });
        });
        setProgress((p) => ({
          ...p,
          dishesDone: Math.min(p.dishesTotal, p.dishesDone + clean.length),
        }));
      } catch (err) {
        const detailRows = err?.data?.rows || [];
        const reason =
          (typeof err?.data?.message === 'string' && err.data.message) ||
          err.message ||
          'Bulk import failed. The server could not create the dish records.';
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
              message: reason,
            });
          });
        }
        setProgress((p) => ({
          ...p,
          dishesDone: Math.min(p.dishesTotal, p.dishesDone + batch.length),
        }));
      }
    }
    return { imported, failedDuringImport };
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

    try {
      const { withUrls, failed: uploadFailed, imagesUploaded } =
        await uploadRowsWithRetry(validRows, { maxAttempts: 2 });

      const { imported, failedDuringImport } = await createDishBatches(withUrls);
      const allErrors = [...uploadFailed.map(({ previewRow, ...rest }) => rest), ...failedDuringImport];
      const retryable = uploadFailed
        .map((f) => f.previewRow)
        .filter(Boolean);

      setRetryRows(retryable);
      setResult({
        imported,
        skippedInvalid: preview.invalidCount,
        importErrors: allErrors,
        imagesUploaded,
      });
      setStep(STEP_DONE);
      if (imported > 0) {
        push(`Imported ${imported} dish${imported === 1 ? '' : 'es'}.`);
      } else {
        const dupHint = failedDuringImport.some((e) =>
          /already exists/i.test(e.message || ''),
        );
        push(
          dupHint
            ? 'No dishes imported — these names already exist under All Dishes. Rename them in Excel or remove the existing dishes, then try again.'
            : 'No dishes were imported.',
          'error',
        );
      }
    } catch (err) {
      push(err.message || 'Bulk import failed.', 'error');
      setStep(STEP_PREVIEW);
    } finally {
      setImporting(false);
    }
  };

  const onRetryFailedUploads = async () => {
    if (!retryRows.length || importing) return;
    setImporting(true);
    setStep(STEP_IMPORTING);
    try {
      const { withUrls, failed: uploadFailed, imagesUploaded } =
        await uploadRowsWithRetry(retryRows, { maxAttempts: 2 });
      const { imported, failedDuringImport } = await createDishBatches(withUrls);
      const allErrors = [
        ...uploadFailed.map(({ previewRow, ...rest }) => rest),
        ...failedDuringImport,
      ];
      setRetryRows(uploadFailed.map((f) => f.previewRow).filter(Boolean));
      setResult((prev) => ({
        imported: (prev?.imported || 0) + imported,
        skippedInvalid: prev?.skippedInvalid || 0,
        importErrors: allErrors,
        imagesUploaded: (prev?.imagesUploaded || 0) + imagesUploaded,
      }));
      setStep(STEP_DONE);
      if (imported > 0) push(`Retry imported ${imported} more dish${imported === 1 ? '' : 'es'}.`);
      else push('Retry did not import any dishes.', 'error');
    } catch (err) {
      push(err.message || 'Retry failed.', 'error');
      setStep(STEP_DONE);
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
            Add hundreds of dishes at once using an Excel spreadsheet and a folder of
            matching image files. Saving to <strong>{user?.restaurantName}</strong> only.
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
            <li>Select Image Folder</li>
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
              onClick={() => {
                downloadBulkDishTemplate().catch((err) => {
                  push(err.message || 'Could not download the template.', 'error');
                });
              }}
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
            <h2>3. Select Dish Image Folder</h2>
            <p className="admin-muted">
              Select the folder containing all dish images. Filenames must match the{' '}
              <code>imageFile</code> column in Excel (nested folders are OK). Images are
              not uploaded until you confirm import.
            </p>

            <input
              ref={folderInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              {...{ webkitdirectory: '', directory: '' }}
              hidden
              onChange={onFolderChange}
            />
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={onZipChange}
            />
            <input
              ref={manualInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              hidden
              onChange={onManualImagesChange}
            />

            <div className="bulk-image-actions">
              {folderSupported ? (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => folderInputRef.current?.click()}
                >
                  Select Image Folder
                </button>
              ) : (
                <p className="bulk-warn">
                  Folder selection is not supported in this browser. Use ZIP upload or
                  select images manually.
                </p>
              )}
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                disabled={zipBusy}
                onClick={() => zipInputRef.current?.click()}
              >
                {zipBusy ? 'Reading ZIP…' : 'Upload ZIP'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => manualInputRef.current?.click()}
              >
                Select Images Manually
              </button>
            </div>

            {imageIndex.count > 0 || imageIndex.scannedCount > 0 ? (
              <div className="bulk-image-summary">
                <p className="bulk-file-ok">
                  ✓ {imageIndex.count} image{imageIndex.count === 1 ? '' : 's'} detected
                  {imageIndex.source === 'zip'
                    ? ' (from ZIP)'
                    : imageIndex.source === 'manual'
                      ? ' (manual)'
                      : ' (from folder)'}
                </p>
                <ul className="bulk-type-stats">
                  <li>JPG {imageIndex.byType?.jpg || 0}</li>
                  <li>PNG {imageIndex.byType?.png || 0}</li>
                  <li>WEBP {imageIndex.byType?.webp || 0}</li>
                  <li>Total size {imageIndex.totalBytesLabel}</li>
                </ul>
                {imageIndex.unsupported?.length ? (
                  <p className="bulk-warn">
                    {imageIndex.unsupported.length} unsupported file
                    {imageIndex.unsupported.length === 1 ? '' : 's'} ignored
                  </p>
                ) : null}
                {imageIndex.duplicates?.length ? (
                  <p className="bulk-warn">
                    {imageIndex.duplicates.length} duplicate filename
                    {imageIndex.duplicates.length === 1 ? '' : 's'} — resolve before import
                  </p>
                ) : null}

                {matchSummary && excelRows.length ? (
                  <div className="bulk-match-box">
                    <h3>Image Matching</h3>
                    <div className="bulk-summary">
                      <span>Excel rows: {matchSummary.excelRows}</span>
                      <span>Images detected: {matchSummary.imagesDetected}</span>
                    </div>
                    <div className="bulk-summary">
                      <span className="bulk-ok">✓ Matched: {matchSummary.matchedCount}</span>
                      <span className="bulk-bad">✗ Missing: {matchSummary.missingCount}</span>
                      <span className="bulk-warn-text">⚠ Extra: {matchSummary.extraCount}</span>
                      {matchSummary.ambiguousCount ? (
                        <span className="bulk-warn-text">
                          ⚠ Ambiguous: {matchSummary.ambiguousCount}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => setMatchDetailsOpen((v) => !v)}
                    >
                      {matchDetailsOpen ? 'Hide Matching Details' : 'View Matching Details'}
                    </button>
                    {matchDetailsOpen ? (
                      <div className="bulk-match-details">
                        {matchSummary.missingCount ? (
                          <div>
                            <strong>Missing Images</strong>
                            <p className="admin-muted">
                              Referenced by Excel but not found in the selected folder.
                              Those rows will not be marked valid.
                            </p>
                            <ul className="bulk-image-list">
                              {matchSummary.missing.slice(0, 40).map((n) => (
                                <li key={`m-${n}`}>✗ {n}</li>
                              ))}
                              {matchSummary.missing.length > 40 ? (
                                <li>…and {matchSummary.missing.length - 40} more</li>
                              ) : null}
                            </ul>
                          </div>
                        ) : null}
                        {matchSummary.extraCount ? (
                          <div>
                            <strong>Extra Images</strong>
                            <p className="admin-muted">
                              Present in the folder but not referenced by Excel. They will
                              not be uploaded.
                            </p>
                            <ul className="bulk-image-list">
                              {matchSummary.extra.slice(0, 40).map((n) => (
                                <li key={`e-${n}`}>⚠ {n}</li>
                              ))}
                              {matchSummary.extra.length > 40 ? (
                                <li>…and {matchSummary.extra.length - 40} more</li>
                              ) : null}
                            </ul>
                          </div>
                        ) : null}
                        {matchSummary.ambiguousCount ? (
                          <div>
                            <strong>Duplicate Filenames</strong>
                            <ul className="bulk-image-list">
                              {matchSummary.ambiguous.map((n) => (
                                <li key={`a-${n}`}>⚠ {n}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                onClick={() => {
                  downloadBulkErrorReport(preview.rows).catch((err) => {
                    push(err.message || 'Could not download the error report.', 'error');
                  });
                }}
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
          <h2>
            {progress.phase === 'images'
              ? 'Uploading dish images…'
              : 'Creating dishes…'}
          </h2>
          <ProgressBar
            label={`Images ${progress.imagesDone} / ${progress.imagesTotal}`}
            done={progress.imagesDone}
            total={progress.imagesTotal}
          />
          <ProgressBar
            label={`Dishes ${progress.dishesDone} / ${progress.dishesTotal}`}
            done={progress.dishesDone}
            total={progress.dishesTotal}
          />
        </div>
      ) : null}

      {step === STEP_DONE && result ? (
        <div className="admin-form-card bulk-dishes-card">
          <h2>Bulk Import Complete</h2>
          <div className="bulk-summary">
            <span className="bulk-ok">✓ {result.imported} dishes imported</span>
            <span className="bulk-ok">✓ {result.imagesUploaded} images uploaded</span>
            <span className="bulk-bad">✗ {failedTotal} rows failed / skipped</span>
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
            {retryRows.length ? (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={importing}
                onClick={onRetryFailedUploads}
              >
                Retry Failed Uploads ({retryRows.length})
              </button>
            ) : null}
            {(preview?.invalidCount > 0 || result.importErrors?.length > 0) && (
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => {
                  const report = preview?.rows
                    ? downloadBulkErrorReport(preview.rows)
                    : result.importErrors?.length
                      ? downloadBulkErrorReport(
                          result.importErrors.map((e) => ({
                            row: e.row,
                            name: e.name,
                            status: 'invalid',
                            errors: [{ field: e.field, message: e.message }],
                          })),
                        )
                      : null;
                  report?.catch((err) => {
                    push(err.message || 'Could not download the error report.', 'error');
                  });
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
                setImageIndex(EMPTY_IMAGES);
                setPreview(null);
                setResult(null);
                setRetryRows([]);
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
      <div
        className="bulk-progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="bulk-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
