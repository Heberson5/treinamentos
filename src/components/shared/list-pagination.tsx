import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface ListPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}

function getPageNumbers(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("ellipsis");
    result.push(p);
  });
  return result;
}

export function ListPagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: ListPaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
      <p className="text-xs text-muted-foreground order-2 sm:order-1">
        Mostrando {start}–{end} de {totalItems}
      </p>

      {/* Mobile: só prev/next + indicador de página */}
      <div className="flex sm:hidden items-center gap-2 order-1">
        <PaginationLink
          href="#"
          size="default"
          className="min-h-9 px-3"
          onClick={(e) => {
            e.preventDefault();
            if (page > 1) onPageChange(page - 1);
          }}
          aria-disabled={page <= 1}
        >
          Anterior
        </PaginationLink>
        <span className="text-sm text-muted-foreground px-1">
          {page} / {totalPages}
        </span>
        <PaginationLink
          href="#"
          size="default"
          className="min-h-9 px-3"
          onClick={(e) => {
            e.preventDefault();
            if (page < totalPages) onPageChange(page + 1);
          }}
          aria-disabled={page >= totalPages}
        >
          Próxima
        </PaginationLink>
      </div>

      {/* Desktop: paginação numerada completa */}
      <Pagination className="hidden sm:flex mx-0 w-auto order-2">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
              className={page <= 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          {pageNumbers.map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
              className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
