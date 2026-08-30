import React from 'react';
import './Loader.css';

/**
 * Global DilYum loader.
 * variant: "page" | "inline" | "fullscreen"
 */
export default function Loader({
  label = 'Loading…',
  variant = 'page',
  className = '',
}) {
  return (
    <div
      className={`dy-loader dy-loader-${variant}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="dy-loader-spinner" aria-hidden="true" />
      {label ? <span className="dy-loader-label">{label}</span> : null}
    </div>
  );
}
