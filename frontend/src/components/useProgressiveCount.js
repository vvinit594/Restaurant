import { useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 24;

/**
 * Renders a long list in windows. Filtering still runs on the full list;
 * only the painted slice grows as the sentinel nears the viewport.
 */
export function useProgressiveCount(total, resetKey) {
  const [count, setCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setCount(PAGE_SIZE);
  }, [resetKey]);

  const visibleCount = Math.min(count, total);
  const hasMore = visibleCount < total;

  useEffect(() => {
    if (!hasMore) return undefined;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver !== 'function') {
      setCount(total);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCount((current) => Math.min(total, current + PAGE_SIZE));
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, total, count]);

  return { visibleCount, sentinelRef, hasMore };
}
