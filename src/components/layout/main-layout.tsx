import { ReactNode } from "react"
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


  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background pt-[env(safe-area-inset-top)]">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header onLogout={onLogout} />
          <main
            className={`flex-1 p-3 sm:p-6 overflow-auto ${
              isMobile ? "pb-24" : ""
            }`}
          >
            {children}
          </main>
        </div>
        {/* Bottom navigation visible apenas em mobile */}
        <MobileBottomNav />
        {/* Prompt de instalação como PWA */}
        <PWAInstallPrompt />
        {/* Pop-up de avisos/notícias internas */}
        <PopupDisplay />
      </div>
    </SidebarProvider>
  )
}
