import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-safe-t pb-safe-b">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Ops! Ocorreu um erro na interface.
            </h1>
            <p className="text-sm text-muted-foreground">
              Algo deu errado ao exibir esta tela. Tente recarregar a página; se o
              problema persistir, entre em contato com o suporte.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button onClick={() => window.location.reload()} className="min-h-11">
                Recarregar página
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => (window.location.href = "/")}
              >
                Voltar ao início
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
