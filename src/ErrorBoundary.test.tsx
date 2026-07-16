import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function Bomb(): JSX.Element {
  throw new Error("Boom");
}

describe("ErrorBoundary", () => {
  it("renderiza os filhos normalmente quando não há erro", () => {
    render(
      <ErrorBoundary>
        <p>Conteúdo normal</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("Conteúdo normal")).toBeInTheDocument();
  });

  it("exibe a tela de fallback quando um filho lança um erro", () => {
    // React loga o erro no console durante o teste; suprimimos para não poluir a saída.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText("Ops! Ocorreu um erro na interface.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recarregar página/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
