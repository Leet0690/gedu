import React, { memo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) {
  const firstRow = (currentPage - 1) * itemsPerPage + 1;
  const lastRow = Math.min(currentPage * itemsPerPage, totalItems);

  const goFirst = useCallback(() => onPageChange(1), [onPageChange]);
  const goPrev = useCallback(() => onPageChange(currentPage - 1), [onPageChange, currentPage]);
  const goNext = useCallback(() => onPageChange(currentPage + 1), [onPageChange, currentPage]);
  const goLast = useCallback(() => onPageChange(totalPages), [onPageChange, totalPages]);
  const goPage = useCallback((p) => () => onPageChange(p), [onPageChange]);
  const handleSizeChange = useCallback((e) => onItemsPerPageChange(Number(e.target.value)), [onItemsPerPageChange]);

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, 5, '…', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages);
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="pagination-bar">
      {totalItems > 0 && (
        <span className="pagination-info">
          Affichage <strong>{firstRow}–{lastRow}</strong> sur <strong>{totalItems}</strong> résultats
        </span>
      )}

      <div className="pagination-pages">
        <button className="pagination-btn nav" onClick={goFirst} disabled={currentPage === 1}>
          <ChevronsLeft size={13} />
        </button>
        <button className="pagination-btn nav" onClick={goPrev} disabled={currentPage === 1}>
          <ChevronLeft size={13} /> Préc.
        </button>

        {getPageNumbers().map((p, i) =>
          p === '…'
            ? <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
            : <button key={i} className={`pagination-btn${p === currentPage ? ' active' : ''}`} onClick={goPage(p)}>
                {p}
              </button>
        )}

        <button className="pagination-btn nav" onClick={goNext} disabled={currentPage === totalPages}>
          Suiv. <ChevronRight size={13} />
        </button>
        <button className="pagination-btn nav" onClick={goLast} disabled={currentPage === totalPages}>
          <ChevronsRight size={13} />
        </button>
      </div>

      {onItemsPerPageChange && (
        <select
          className="pagination-size-select"
          value={itemsPerPage}
          onChange={handleSizeChange}
        >
          {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      )}
    </div>
  );
});

export default Pagination;
