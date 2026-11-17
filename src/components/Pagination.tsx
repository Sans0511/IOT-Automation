import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
}

function pageHref(basePath: string, page: number): string {
  return page === 1 ? basePath : `${basePath}?page=${page}`;
}

export function Pagination({ page, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
      aria-label="Pagination"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Page {page} of {totalPages}
      </p>

      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={pageHref(basePath, previousPage)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-600">
            Previous
          </span>
        )}

        {page < totalPages ? (
          <Link
            href={pageHref(basePath, nextPage)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-600">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
