import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { usePermissions } from "@/hooks/use-permissions"

// Barra a tela de quem não tem a permissão (tela Permissões) e o leva para o
// destino. O servidor também recusa a ação; isto evita mostrar uma tela que
// não funcionaria.
export function ExigePermissao({ permissao, destino, children }: { permissao: string; destino: string; children: ReactNode }) {
  const { has } = usePermissions()
  if (!has(permissao)) return <Navigate to={destino} replace />
  return <>{children}</>
}
