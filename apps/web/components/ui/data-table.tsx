import type { ReactNode } from "react";
import { clsx } from "clsx";

type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  className?: string;
  emptyMessage?: string;
};

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  className = "",
  emptyMessage = "No data",
}: DataTableProps<T>) {
  return (
    <div
      className={clsx(
        "overflow-x-auto rounded-b70-md border border-[var(--b70-border)] bg-[var(--b70-card)]",
        className,
      )}
    >
      <table className="w-full min-w-[400px] text-left small">
        <thead>
          <tr className="border-b border-[var(--b70-border)] bg-[var(--b70-bg)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  "px-4 py-3 font-semibold text-[var(--b70-text-muted)] uppercase tracking-wider",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--b70-border)]">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-[var(--b70-text-muted)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="transition-colors hover:bg-[var(--b70-border)]/20"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "px-4 py-3 text-[var(--b70-text)]",
                      col.className,
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
