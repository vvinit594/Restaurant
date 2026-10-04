import React from 'react';

export function readPage(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    items,
    page: Number(data?.page) || 1,
    totalPages: Number(data?.totalPages) || 1,
    total: Number(data?.total) || 0,
  };
}

export default function ListPagination({
  page = 1,
  totalPages = 1,
  total = 0,
  noun = 'records',
  onPage,
  disabled = false,
}) {
  if (!total) return null;
  return (
    <div className="loyalty-pagination">
      <span className="admin-muted">
        Page {page} of {totalPages} · {total} {noun}
      </span>
      <div className="admin-row-actions">
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          disabled={disabled || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
