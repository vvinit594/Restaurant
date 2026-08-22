import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Renders a QR PNG for a public URL. Download via canvas/data URL.
 */
export default function QrCodeImage({
  value,
  size = 220,
  alt = 'QR code',
  className = '',
}) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!value) {
      setDataUrl('');
      return undefined;
    }
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: { dark: '#1c1917', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (alive) {
          setDataUrl(url);
          setError('');
        }
      })
      .catch(() => {
        if (alive) setError('Could not generate QR image.');
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (error) return <p className="admin-muted">{error}</p>;
  if (!dataUrl) return <div className="admin-skeleton" style={{ width: size, height: size }} />;

  return (
    <img
      className={className}
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: 12, background: '#fff' }}
    />
  );
}

export async function downloadQrPng(value, filename = 'dilyum-qr.png') {
  const dataUrl = await QRCode.toDataURL(value, {
    width: 1024,
    margin: 2,
    color: { dark: '#1c1917', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
