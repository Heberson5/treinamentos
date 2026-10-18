import { ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Header } from "@/components/layout/header"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { PWAInstallPrompt } from "@/components/layout/pwa-install-prompt"
import { PopupDisplay } from "@/components/popups/popup-display"
import { useCompanyTheme } from "@/hooks/use-company-theme"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIdleLogout } from "@/hooks/use-idle-logout"
import { useOnlineUsers } from "@/hooks/use-online-users"
import { TrocaSenhaObrigatoria } from "@/components/auth/trocar-senha-dialog"
import { AvisoPrivacidade } from "@/components/lgpd/aviso-privacidade"

// Primeiro item ao apertar Tab: pula o menu e vai direto ao conteúdo
function LinkPularParaConteudo() {
  return (
    <a
      href="#conteudo-principal"
      onClick={(e) => {
        e.preventDefault()
        const alvo = document.getElementById("conteudo-principal")
        alvo?.focus()
        alvo?.scrollIntoView({ block: "start" })
      }}
      className="sr-only fixed left-3 top-3 z-[100] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Pular para o conteúdo
    </a>
  )
}

interface MainLayoutProps {
  children: ReactNode
  onLogout?: () => void
}

export function MainLayout({ children, onLogout }: MainLayoutProps) {
  // Hook para aplicar tema da empresa quando Master filtra
  useCompanyTheme();
  // Logoff automático por inatividade / fechar navegador
  useIdleLogout();
  // Registra o usuário atual no canal de presença global
  useOnlineUsers();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  // Telas de foco (estudo do treinamento e editor) ocupam a tela inteira,
  // sem menu lateral nem cabeçalho — mas os hooks acima continuam ativos.
  const focusMode = /^\/(executar-treinamento\/|admin\/treinamentos\/(novo|editar\/))/.test(pathname);

  if (focusMode) {
    return (
      <SidebarProvider>
        <div className="min-h-screen w-full bg-background pt-[env(safe-area-inset-top)]">
          <LinkPularParaConteudo />
          <div id="conteudo-principal" role="main" tabIndex={-1} className="outline-none">{children}</div>
          <PWAInstallPrompt />
          <PopupDisplay />
          <TrocaSenhaObrigatoria />
          <AvisoPrivacidade />
        </div>
      </SidebarProvider>
    );
  }


  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background pt-[env(safe-area-inset-top)]">
        <LinkPularParaConteudo />
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header onLogout={onLogout} />
          <main
            id="conteudo-principal"
            tabIndex={-1}
            className={`outline-none flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7 overflow-auto ${
              isMobile ? "pb-24" : ""
            }`}
          >
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
        {/* Bottom navigation visible apenas em mobile */}
        <MobileBottomNav />
        {/* Prompt de instalação como PWA */}
        <PWAInstallPrompt />
        {/* Pop-up de avisos/notícias internas */}
        <PopupDisplay />
        {/* Troca de senha obrigatória (link de recuperação ou primeiro acesso) */}
        <TrocaSenhaObrigatoria />
        <AvisoPrivacidade />
      </div>
    </SidebarProvider>
  )
}
