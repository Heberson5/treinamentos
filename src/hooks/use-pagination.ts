import { useEffect, useMemo, useState } from "react";

/**
 * Pagina um array já carregado/filtrado em memória.
 * `resetKey` deve mudar sempre que os filtros mudarem, para voltar à página 1.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return { page: safePage, setPage, totalPages, paginated, totalItems: items.length };
}
