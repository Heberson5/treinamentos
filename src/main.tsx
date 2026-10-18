import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import '@fontsource-variable/inter'
import './index.css'
import { registerServiceWorker } from './lib/pwa'
import { registrarRetornoDeRecuperacao } from './lib/senha'
import { iniciarRegistroDeErros } from './lib/registrar-erro'

// Precisa rodar antes do cliente do Supabase limpar a URL do link de recuperação
registrarRetornoDeRecuperacao();
registerServiceWorker();
iniciarRegistroDeErros();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
