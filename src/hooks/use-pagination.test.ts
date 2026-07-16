import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePagination } from "./use-pagination";

const items = Array.from({ length: 45 }, (_, i) => i + 1);

describe("usePagination", () => {
  it("retorna a primeira página por padrão", () => {
    const { result } = renderHook(() => usePagination(items, 20));
    expect(result.current.page).toBe(1);
    expect(result.current.paginated).toEqual(items.slice(0, 20));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.totalItems).toBe(45);
  });

  it("navega para a página seguinte", () => {
    const { result } = renderHook(() => usePagination(items, 20));
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.paginated).toEqual(items.slice(20, 40));
  });

  it("nunca ultrapassa o total de páginas", () => {
    const { result } = renderHook(() => usePagination(items, 20));
    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(3);
    expect(result.current.paginated).toEqual(items.slice(40, 45));
  });

  it("volta para a página 1 quando resetKey muda", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => usePagination(items, 20, resetKey),
      { initialProps: { resetKey: "a" } }
    );
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    rerender({ resetKey: "b" });
    expect(result.current.page).toBe(1);
  });

  it("lida com lista vazia sem quebrar", () => {
    const { result } = renderHook(() => usePagination([] as number[], 20));
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.paginated).toEqual([]);
  });
});
