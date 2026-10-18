import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"

// A conta tem verificação em duas etapas e esta sessão ainda só confirmou a
// senha (aal1)? Enquanto isso for verdade o app mostra a tela do código.
// "versao" muda quando o código é confirmado: os dados do app são recarregados
// (sem recarregar a página), porque o banco só libera o Master em aal2.
export function useSegundoFator(userId?: string) {
  const [carregando, setCarregando] = useState(true)
  const [pendente, setPendente] = useState(false)
  const [versao, setVersao] = useState(0)

  const verificar = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const exige = !error && data?.nextLevel === "aal2" && data?.currentLevel !== "aal2"
    setPendente((antes) => {
      if (antes && !exige) setVersao((v) => v + 1)
      return exige
    })
    setCarregando(false)
  }, [])

  useEffect(() => {
    if (!userId) {
      setPendente(false)
      setCarregando(false)
      return
    }
    setCarregando(true)
    void verificar()
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "MFA_CHALLENGE_VERIFIED" || evento === "SIGNED_IN") setTimeout(() => void verificar(), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [userId, verificar])

  return { carregando, pendente, versao, reverificar: verificar }
}
