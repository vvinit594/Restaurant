import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from './components/Loader';
import SiteNavbar from './components/SiteNavbar';
import './App.css';

const HomeMenu = lazy(() => import(/* webpackChunkName: "home-menu" */ './home/HomeMenu'));

function App() {
  const navigate = useNavigate();

  const scrollToSearch = () => {
    navigate('/restaurants');
  };

  return (
    <div className="app">
      <SiteNavbar />
      <HeroSection onExploreMenu={scrollToSearch} />
      <Suspense
        fallback={
          <main id="menu-section" className="menu-container">
            <Loader label="Loading menu…" />
          </main>
        }
      >
        <HomeMenu />
      </Suspense>
    </div>
  );
}

function HeroSection({ onExploreMenu }) {
  const videoRef = useRef(null);
  const [loadVideo, setLoadVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(Boolean(mq.matches));
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;

    // Load on mobile and desktop; still defer slightly so first paint isn't blocked.
    // Respect Save-Data / very slow networks only.
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    const saveData = Boolean(connection?.saveData);
    const slowNet = /2g/.test(String(connection?.effectiveType || ''));
    if (saveData || slowNet) return undefined;

    let cancelled = false;
    const enable = () => {
      if (!cancelled) setLoadVideo(true);
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(enable, { timeout: 1800 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const t = window.setTimeout(enable, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!loadVideo || !videoRef.current) return;
    const el = videoRef.current;
    const play = () => {
      el.play().catch(() => {});
    };
    if (el.readyState >= 2) play();
    else el.addEventListener('loadeddata', play, { once: true });
  }, [loadVideo]);

  return (
    <section className="hero-section" aria-label="DilYum hero">
      {loadVideo ? (
        <video
          ref={videoRef}
          className={'hero-video-bg' + (videoReady ? ' is-ready' : '')}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/dilyum-logo.png"
          onLoadedData={() => setVideoReady(true)}
        >
          <source src="/hero-food.mp4" type="video/mp4" />
        </video>
      ) : null}

      <div className="hero-dark-overlay">
        <img
          src="/dilyum-logo.png"
          alt="DilYum - Dil Bole Yum"
          className="hero-center-logo"
          fetchPriority="high"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />

        <p className="hero-subtitle">
          Authentic Indian Flavors • Live Kitchen • Scan & Order Smart
        </p>

        <button type="button" className="hero-explore-btn" onClick={onExploreMenu}>
          Explore Food Menu & Restaurants →
        </button>

        <div className="hero-feature-row" aria-label="App highlights">
          <div className="feature-pill">
            <strong>300+</strong>
            <span>menu items</span>
          </div>
          <div className="feature-pill">
            <strong>Fuzzy</strong>
            <span>search enabled</span>
          </div>
          <div className="feature-pill">
            <strong>Mobile</strong>
            <span>friendly layout</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default App;
