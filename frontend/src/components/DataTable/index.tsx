import React, { useState, useCallback } from "react";
import { cn } from "../../lib/cn";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  emptyState?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  searchable,
  searchPlaceholder = "Search…",
  searchFilter,
  emptyState,
  loading,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");

  const filteredRows = useCallback(() => {
    if (!searchable || !query.trim() || !searchFilter) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((row) => searchFilter(row, q));
  }, [rows, query, searchable, searchFilter])();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {searchable && (
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-outline pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m0 0A7 7 0 1116.65 16.65z"
            />
          </svg>
          <input
            id="table-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full h-[38px] rounded-md border border-outline-variant pl-9 pr-3 text-[14px] text-navy placeholder:text-outline bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-outline-variant">
        <table className="min-w-full divide-y divide-outline-variant" role="table">
          <thead className="bg-surface-low">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-navy-secondary",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant bg-white">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-surface-container rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  {emptyState ?? (
                    <span className="text-sm text-navy-secondary">No results found.</span>
                  )}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "h-12 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-surface-low"
                  )}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") onRowClick(row);
                        }
                      : undefined
                  }
                  role={onRowClick ? "button" : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-3 text-sm text-navy", col.className)}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
