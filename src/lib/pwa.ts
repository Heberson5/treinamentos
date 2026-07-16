/**
 * Registra o service worker do PWA.
 * IMPORTANTE: NÃO registramos dentro de iframes nem em ambiente local de desenvolvimento,
 * para evitar cache stale e bloqueio de navegação durante o desenvolvimento.
 * Em produção (domínio próprio), o SW é registrado normalmente.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  })();

  const hostname = window.location.hostname;
  const isPreviewHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  if (isInIframe || isPreviewHost) {
    // Em ambientes de preview, garantir que nenhum SW antigo permaneça registrado
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Forçar verificação de atualização periodicamente
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("[PWA] Falha ao registrar service worker:", err);
      });
  });
}

/**
 * Detecta se a aplicação está rodando em modo standalone (instalada como app).
 */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}
