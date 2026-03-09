"use client";

import * as React from "react";
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
    type PaginationState,
    type VisibilityState,
    type RowSelectionState,
    type OnChangeFn,
} from "@tanstack/react-table";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowUp02Icon,
    ArrowDown02Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Settings05Icon,
} from "@hugeicons/core-free-icons";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    toolbar?: (columnToggle: React.ReactNode) => React.ReactNode;
    onRowClick?: (row: TData) => void;
    emptyMessage?: string;
    globalFilter?: string;
    onGlobalFilterChange?: (value: string) => void;
    className?: string;
    rowClassName?: string;
    pageSize?: number;
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    getRowId?: (originalRow: TData, index: number, parent?: any) => string;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    toolbar,
    onRowClick,
    emptyMessage = "No results.",
    globalFilter,
    onGlobalFilterChange,
    className,
    rowClassName,
    pageSize: defaultPageSize = 10,
    rowSelection,
    onRowSelectionChange,
    getRowId,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: defaultPageSize,
    });

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        onRowSelectionChange,
        getRowId,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
            pagination,
            ...(rowSelection !== undefined && { rowSelection }),
        },
        onGlobalFilterChange,
    });

    const toggleableColumns = table
        .getAllColumns()
        .filter((column) => column.getCanHide());

    const columnToggle =
        toggleableColumns.length > 0 ? (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="xs"
                        className="h-7 px-2 gap-1"
                    >
                        <HugeiconsIcon
                            icon={Settings05Icon}
                            strokeWidth={2}
                            className="size-3"
                        />
                        <span className="text-xs">Columns</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
                        Toggle columns
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {toggleableColumns.map((column) => (
                        <DropdownMenuCheckboxItem
                            key={column.id}
                            className="text-xs capitalize"
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) =>
                                column.toggleVisibility(!!value)
                            }
                        >
                            {typeof column.columnDef.header === "string"
                                ? column.columnDef.header
                                : column.id}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        ) : null;

    return (
        <div className={cn("flex flex-col", className)}>
            {toolbar && (
                <div className="shrink-0 pb-3">{toolbar(columnToggle)}</div>
            )}
            <div className="border border-border overflow-x-hidden">
                <table className="w-full table-fixed caption-bottom text-xs">
                    <colgroup>
                        {table.getVisibleLeafColumns().map((column) => (
                            <col
                                key={column.id}
                                style={{ width: column.getSize() }}
                            />
                        ))}
                    </colgroup>
                    <TableHeader className="bg-background">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={cn(
                                            header.column.getCanSort() &&
                                                "cursor-pointer select-none",
                                        )}
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div
                                                className={cn(
                                                    "flex items-center gap-1",
                                                    (
                                                        header.column.columnDef
                                                            .meta as {
                                                            align?: string;
                                                        }
                                                    )?.align === "right" &&
                                                        "justify-end",
                                                    (
                                                        header.column.columnDef
                                                            .meta as {
                                                            align?: string;
                                                        }
                                                    )?.align === "center" &&
                                                        "justify-center",
                                                )}
                                            >
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}
                                                {header.column.getIsSorted() ===
                                                    "asc" && (
                                                    <HugeiconsIcon
                                                        icon={ArrowUp02Icon}
                                                        strokeWidth={2}
                                                        className="size-3 shrink-0"
                                                    />
                                                )}
                                                {header.column.getIsSorted() ===
                                                    "desc" && (
                                                    <HugeiconsIcon
                                                        icon={ArrowDown02Icon}
                                                        strokeWidth={2}
                                                        className="size-3 shrink-0"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected() && "selected"
                                    }
                                    className={cn(
                                        onRowClick && "cursor-pointer",
                                        rowClassName,
                                    )}
                                    onClick={() => onRowClick?.(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className="overflow-hidden"
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </table>
            </div>
            <div className="shrink-0 flex items-center justify-between gap-4 pt-2">
                <div className="text-[11px] text-muted-foreground tabular-nums">
                    Page {table.getState().pagination.pageIndex + 1} of{" "}
                    {table.getPageCount()} &middot;{" "}
                    {table.getFilteredRowModel().rows.length} row
                    {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon-xs"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <HugeiconsIcon
                                icon={ArrowLeft01Icon}
                                strokeWidth={2}
                                className="size-3"
                            />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-xs"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                strokeWidth={2}
                                className="size-3"
                            />
                        </Button>
                    </div>
                    <Select
                        value={String(table.getState().pagination.pageSize)}
                        onValueChange={(value) =>
                            table.setPageSize(Number(value))
                        }
                    >
                        <SelectTrigger
                            size="sm"
                            className="h-6 w-13.25 text-[11px] px-1.5 gap-1"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {[10, 25, 50, 100].map((size) => (
                                <SelectItem
                                    key={size}
                                    value={String(size)}
                                    className="text-[11px]"
                                >
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
