import React, { useState } from 'react';
import { ChevronUp20Regular, ChevronDown20Regular } from '@fluentui/react-icons';

/**
 * CopilotTable - Data table component with sortable columns
 *
 * Based on the Coworker Design System.
 */

export type SortDirection = 'asc' | 'desc' | null;

export interface TableColumn<T = any> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface CopilotTableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  onSort?: (columnKey: string, direction: SortDirection) => void;
  onRowClick?: (row: T, index: number) => void;
  onRowHover?: (row: T, index: number) => void;
  onRowLeave?: () => void;
  selectedRowIndex?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  defaultSortColumn?: string | null;
  defaultSortDirection?: SortDirection;
}

const sizeStyles = {
  sm: {
    header: "px-3 py-2 text-xs",
    cell: "px-3 py-2 text-xs"
  },
  md: {
    header: "px-4 py-3 text-sm",
    cell: "px-4 py-3 text-sm"
  },
  lg: {
    header: "px-5 py-4 text-sm",
    cell: "px-5 py-4 text-sm"
  },
};

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export const CopilotTable = <T extends Record<string, any>>({
  columns,
  data,
  onSort,
  onRowClick,
  onRowHover,
  onRowLeave,
  selectedRowIndex,
  size = 'md',
  className,
  defaultSortColumn = null,
  defaultSortDirection = null,
}: CopilotTableProps<T>) => {
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  const handleSort = (columnKey: string, sortable?: boolean) => {
    if (!sortable) return;

    let newDirection: SortDirection = 'asc';

    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (sortDirection === 'desc') {
        newDirection = null;
      }
    }

    setSortColumn(newDirection ? columnKey : null);
    setSortDirection(newDirection);

    if (onSort) {
      onSort(columnKey, newDirection);
    }
  };

  // Sort data internally
  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle nulls
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? -1 : 1;
      if (bVal == null) return sortDirection === 'asc' ? 1 : -1;

      // Date comparison
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  const handleRowClick = (row: T, index: number) => {
    if (onRowClick) {
      onRowClick(row, index);
    }
  };

  return (
    <div className={cn("bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full" style={{ tableLayout: 'auto' }}>
          <thead className="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "text-left font-semibold text-[hsl(var(--text-primary))] whitespace-nowrap",
                    sizeStyles[size].header,
                    column.sortable && "cursor-pointer select-none hover:bg-[hsl(var(--secondary-hover))] transition-colors"
                  )}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column.key, column.sortable)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="flex flex-col">
                        <ChevronUp20Regular
                          className={cn(
                            "w-3 h-3 -mb-1",
                            sortColumn === column.key && sortDirection === 'asc'
                              ? 'text-brand-purple'
                              : 'text-[hsl(var(--text-disabled))]'
                          )}
                        />
                        <ChevronDown20Regular
                          className={cn(
                            "w-3 h-3 -mt-1",
                            sortColumn === column.key && sortDirection === 'desc'
                              ? 'text-brand-purple'
                              : 'text-[hsl(var(--text-disabled))]'
                          )}
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  "group border-b border-[hsl(var(--border))] last:border-b-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-[hsl(var(--muted))]",
                  selectedRowIndex === rowIndex && "bg-[hsl(var(--brand-background))]"
                )}
                onClick={() => handleRowClick(row, rowIndex)}
                onMouseEnter={() => onRowHover?.(row, rowIndex)}
                onMouseLeave={() => onRowLeave?.()}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "text-[hsl(var(--text-primary))] whitespace-nowrap",
                      sizeStyles[size].cell,
                      typeof row[column.key] === 'number' && "font-numeric"
                    )}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="text-center py-8 text-[hsl(var(--text-subtle))] text-sm">
          No data available
        </div>
      )}
    </div>
  );
};

export default CopilotTable;
