import React, { useEffect, useId, useRef, useState } from 'react';
import { IMAGE_ACCEPT, validateImageFile } from '../services/mediaApi';

/**
 * Dual image input: paste URL or choose from device.
 * Uploaded file takes priority over URL until removed.
 */
export default function ImageUploadField({
  label,
  url = '',
  file = null,
  onUrlChange,
  onFileChange,
  className = '',
  disabled = false,
}) {
  const inputId = useId();
  const fileRef = useRef(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) {
      setObjectUrl('');
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const previewSrc = objectUrl || url || '';
  const usingUpload = Boolean(file);

  const openPicker = () => {
    if (disabled) return;
    setError('');
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const onPick = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const check = validateImageFile(picked);
    if (!check.ok) {
      setError(check.message);
      onFileChange?.(null);
      e.target.value = '';
      return;
    }
    setError('');
    onFileChange?.(picked);
  };

  const onRemove = () => {
    setError('');
    onFileChange?.(null);
    onUrlChange?.('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={`image-upload-field ${className}`}>
      <span className="image-upload-label">{label}</span>

      <input
        type="url"
        className="image-upload-url"
        value={url}
        disabled={disabled || usingUpload}
        placeholder="Paste image URL (https://…)"
        onChange={(e) => {
          setError('');
          onUrlChange?.(e.target.value);
        }}
        aria-label={`${label} URL`}
      />

      <div className="image-upload-or" aria-hidden="true">
        OR
      </div>

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        className="image-upload-input"
        disabled={disabled}
        onChange={onPick}
      />

      {!previewSrc ? (
        <button
          type="button"
          className="admin-btn admin-btn-secondary image-upload-choose"
          onClick={openPicker}
          disabled={disabled}
        >
          Choose Image
        </button>
      ) : (
        <div className="image-upload-preview-wrap">
          <div className="image-upload-preview">
            <img src={previewSrc} alt="" />
          </div>
          <div className="image-upload-actions">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={openPicker}
              disabled={disabled}
            >
              Change Image
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={onRemove}
              disabled={disabled}
            >
              Remove
            </button>
          </div>
          {usingUpload ? (
            <p className="image-upload-hint">
              Device upload selected — this image will be used (URL ignored until removed).
            </p>
          ) : (
            <p className="image-upload-hint">Using image URL.</p>
          )}
        </div>
      )}

      {error ? <em className="admin-field-error">{error}</em> : null}
    </div>
  );
}
