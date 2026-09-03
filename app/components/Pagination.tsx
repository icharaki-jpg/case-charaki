import { toPersianDigits } from "../lib/cases";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav className="pagination" aria-label="صفحه‌بندی">
      <span className="pagination-summary">
        صفحه {toPersianDigits(page)} از {toPersianDigits(pageCount)}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="صفحه قبل"
        >
          <span aria-hidden="true">→</span>
          قبلی
        </button>
        <button
          type="button"
          className="pagination-button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          aria-label="صفحه بعد"
        >
          بعدی
          <span aria-hidden="true">←</span>
        </button>
      </div>
    </nav>
  );
}
