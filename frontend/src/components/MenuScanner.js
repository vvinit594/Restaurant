import React, { useRef } from 'react';

function MenuScanner({ onUpload, scanning, onCameraClick }) {
  const fileInputRef = useRef(null);

  return (
    <section className="hero-section" id="hero">
      <div className="hero-copy">
        <p className="eyebrow">AI Menu Scanner</p>
        <h2>Upload your menu image or PDF and extract delicious dishes instantly.</h2>
        <p className="hero-desc">
          Drag and drop a file, pick from your device, or use your camera for fast menu scanning.
        </p>
        <div className="scanner-card">
          <div className="upload-area" onClick={() => fileInputRef.current.click()}>
            <div className="upload-icon">📤</div>
            <h3>Drag & drop your menu here</h3>
            <p>or browse files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={onUpload}
              hidden
            />
          </div>

          <div className="scanner-actions">
            <button className="camera-button" onClick={onCameraClick}>
              📷 Use Camera / Webcam
            </button>
            {scanning && (
              <div className="scanner-status">
                <div className="spinner" />
                <p>Scanning menu items with AI...</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="hero-image">
        <div className="mock-phone">
          <div className="mock-header">MenuScanner</div>
          <div className="mock-content">
            <p>Sample scan results appear here once your menu is uploaded.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MenuScanner;
