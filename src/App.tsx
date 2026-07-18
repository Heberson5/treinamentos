import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { ThemeProvider } from "@/components/theme-provider";
import { MainLayout } from "@/components/layout/main-layout";
import { LoginForm } from "@/components/auth/login-form";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { TrainingProvider } from "@/contexts/training-context";
import { PlansProvider } from "@/contexts/plans-context";
import { IntegrationProvider } from "@/contexts/integration-context";
import { DepartmentProvider } from "@/contexts/department-context";
import { EmpresaFilterProvider } from "@/contexts/empresa-filter-context";

// Rotas carregadas sob demanda (code-splitting) para reduzir o bundle inicial em dispositivos móveis
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MeusTreinamentos = lazy(() => import("./pages/MeusTreinamentos"));
const Catalogo = lazy(() => import("./pages/Catalogo"));
const TrainingPage = lazy(() => import("./pages/TrainingPage"));
const ExecutarTreinamento = lazy(() => import("./pages/ExecutarTreinamento"));
const GestaoTreinamentos = lazy(() => import("./pages/admin/GestaoTreinamentos"));
const NovoTreinamentoModerno = lazy(() => import("./pages/admin/NovoTreinamentoModerno"));
const EditarTreinamentoModerno = lazy(() => import("./pages/admin/EditarTreinamentoModerno"));
const Usuarios = lazy(() => import("./pages/admin/Usuarios"));
const Cargos = lazy(() => import("./pages/admin/Cargos"));
const Departamentos = lazy(() => import("./pages/admin/Departamentos"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Index = lazy(() => import("./pages/Index"));
const Checkout = lazy(() => import("./pages/Checkout"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const SobreNos = lazy(() => import("./pages/SobreNos"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Calendario = lazy(() => import("./pages/Calendario"));
const EmpresasSupabase = lazy(() => import("./pages/admin/EmpresasSupabase"));
const Planos = lazy(() => import("./pages/admin/Planos"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const Permissoes = lazy(() => import("./pages/admin/Permissoes"));
const Configuracoes = lazy(() => import("./pages/admin/Configuracoes"));
const Integracoes = lazy(() => import("./pages/admin/Integracoes"));
const DashboardExecutivo = lazy(() => import("./pages/admin/DashboardExecutivo"));
const LandingPageEditor = lazy(() => import("./pages/admin/LandingPageEditor"));
const Financeiro = lazy(() => import("./pages/admin/Financeiro"));
const Categorias = lazy(() => import("./pages/admin/Categorias"));
const ArquiteturaSistema = lazy(() => import("./pages/admin/ArquiteturaSistema"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const errorToast = (query.meta as { errorToast?: { title: string; description?: string } } | undefined)?.errorToast;
      if (errorToast) {
        toast({
          title: errorToast.title,
          description: errorToast.description || (error as Error).message,
          variant: "destructive",
        });
      }
    },
  }),
});

// Loading screen component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const userRole = user?.role || 'usuario';
  const isAdminOrHigher = ['master', 'admin', 'instrutor'].includes(userRole);
  const isMaster = userRole === 'master';
  const isAdminOrMaster = ['master', 'admin'].includes(userRole);

  // CRITICAL: Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Default redirect based on role
  const defaultRoute = isAdminOrHigher ? "/dashboard" : "/meus-treinamentos";

  // Pré-visualização da landing page: renderizada fora do layout administrativo
  // (sem sidebar/header) para refletir fielmente como o visitante verá a página.
  if (window.location.pathname === "/preview-landing" && isAuthenticated && isMaster) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Index />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/auth" element={<LoginForm />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/termos-de-uso" element={<TermosDeUso />} />
          <Route path="/sobre-nos" element={<SobreNos />} />
          <Route path="*" element={<Index />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <MainLayout onLogout={logout}>
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/login" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/auth" element={<Navigate to={defaultRoute} replace />} />
        
        {/* Rotas acessíveis por todos */}
        <Route path="/meus-treinamentos" element={<MeusTreinamentos />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/treinamento/:id" element={<TrainingPage />} />
        <Route path="/executar-treinamento/:id" element={<ExecutarTreinamento />} />
        <Route path="/calendario" element={<Calendario />} />

        {/* Rotas para admin/instrutor/master */}
        <Route path="/dashboard" element={isAdminOrHigher ? <Dashboard /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/relatorios" element={isAdminOrHigher ? <Relatorios /> : <Navigate to="/meus-treinamentos" replace />} />

        {/* Rotas administrativas */}
        <Route path="/admin/treinamentos" element={isAdminOrHigher ? <GestaoTreinamentos /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/treinamentos/novo" element={isAdminOrHigher ? <NovoTreinamentoModerno /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/treinamentos/editar/:id" element={isAdminOrHigher ? <EditarTreinamentoModerno /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/usuarios" element={isAdminOrMaster ? <Usuarios /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/cargos" element={isAdminOrMaster ? <Cargos /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/departamentos" element={isAdminOrMaster ? <Departamentos /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/categorias" element={isAdminOrMaster ? <Categorias /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/integracoes" element={isAdminOrMaster ? <Integracoes /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/analytics" element={isAdminOrMaster ? <Analytics /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/executivo" element={isAdminOrMaster ? <DashboardExecutivo /> : <Navigate to="/meus-treinamentos" replace />} />

        {/* Rotas exclusivas Master */}
        <Route path="/admin/empresas" element={isMaster ? <EmpresasSupabase /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/planos" element={isMaster ? <Planos /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/permissoes" element={isMaster ? <Permissoes /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/configuracoes" element={isMaster ? <Configuracoes /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/landing-page" element={isMaster ? <LandingPageEditor /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/financeiro" element={isMaster ? <Financeiro /> : <Navigate to="/meus-treinamentos" replace />} />
        <Route path="/admin/arquitetura" element={isMaster ? <ArquiteturaSistema /> : <Navigate to="/meus-treinamentos" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </MainLayout>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <EmpresaFilterProvider>
                <PlansProvider>
                  <DepartmentProvider>
                    <IntegrationProvider>
                      <TrainingProvider>
                        <AppContent />
                      </TrainingProvider>
                    </IntegrationProvider>
                  </DepartmentProvider>
                </PlansProvider>
              </EmpresaFilterProvider>
            </AuthProvider>
          </BrowserRouter>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;