import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BookOpen, FilePlus2, LifeBuoy, ShieldCheck, UserRound, Users } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { useSupabaseTrainings } from "@/hooks/use-supabase-trainings"
import { useAuth } from "@/contexts/auth-context"
import { usePermissions } from "@/hooks/use-permissions"
import { filtrarBusca } from "@/lib/busca"
import type { NavGroup, NavItem } from "./use-navigation"

interface CommandSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: NavGroup[]
  helpItem?: NavItem | null
}

interface GuiaBusca {
  id: string
  titulo: string
  resumo: string
}

export function CommandSearch({ open, onOpenChange, groups, helpItem }: CommandSearchProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} filter={filtrarBusca}>
      {open && <SearchContent groups={groups} helpItem={helpItem} close={() => onOpenChange(false)} />}
    </CommandDialog>
  )
}

function SearchContent({ groups, helpItem, close }: { groups: NavGroup[]; helpItem?: NavItem | null; close: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { trainings } = useSupabaseTrainings({ includeProgress: false })
  const [guias, setGuias] = useState<GuiaBusca[]>([])

  // Os guias da Ajuda só são carregados quando a busca é aberta
  useEffect(() => {
    if (!helpItem) return
    let ativo = true
    import("@/content/ajuda").then((m) => {
      if (ativo) setGuias(m.guiasVisiveis(user?.role).map((g) => ({ id: g.id, titulo: g.titulo, resumo: g.resumo })))
    })
    return () => {
      ativo = false
    }
  }, [helpItem, user?.role])

  const go = (url: string) => {
    close()
    navigate(url)
  }

  // O que a pessoa pode ver na busca vem das mesmas regras do sistema: o menu já
  // vem filtrado pelo papel, os treinamentos e as pessoas vêm do banco com o
  // controle de acesso (RLS). O que ela não pode acessar nunca aparece aqui.
  const papel = user?.role || "usuario"
  const { has } = usePermissions()
  const podeCriarTreinamento = ["master", "admin", "instrutor"].includes(papel) && has("trainings.create")
  const podeVerPessoas = ["master", "admin"].includes(papel) && has("users.view")
  const podeImportar = podeVerPessoas && has("users.create") && has("users.import")
  const { data: pessoas = [] } = useQuery({
    queryKey: ["busca-pessoas", user?.id],
    enabled: podeVerPessoas,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("listar_usuarios_visiveis_admin")
      return ((data || []) as Array<{ id: string; nome: string; email: string; cargo: string | null }>).slice(0, 300)
    },
  })

  return (
    <>
      <CommandInput placeholder={podeVerPessoas ? "Buscar páginas, treinamentos e pessoas…" : "Buscar páginas e treinamentos…"} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g.id} heading={g.label}>
            {g.items.map((item) => (
              <CommandItem key={item.url} value={`${g.label} ${item.title}`} onSelect={() => go(item.url)}>
                <item.icon className="mr-2 text-muted-foreground" />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading="Minha conta">
          <CommandItem value="minha conta meus dados e privacidade lgpd" onSelect={() => go("/meus-dados")}>
            <ShieldCheck className="mr-2 text-muted-foreground" />
            Meus dados e privacidade
          </CommandItem>
          {podeCriarTreinamento && (
            <CommandItem value="criar novo treinamento" onSelect={() => go("/admin/treinamentos/novo")}>
              <FilePlus2 className="mr-2 text-muted-foreground" />
              Criar novo treinamento
            </CommandItem>
          )}
          {podeImportar && (
            <CommandItem value="importar usuarios planilha csv" onSelect={() => go("/admin/usuarios?importar=1")}>
              <Users className="mr-2 text-muted-foreground" />
              Importar usuários por planilha
            </CommandItem>
          )}
        </CommandGroup>
        {helpItem && (
          <CommandGroup heading={helpItem.title}>
            <CommandItem value={`${helpItem.title} central de ajuda`} onSelect={() => go(helpItem.url)}>
              <LifeBuoy className="mr-2 text-muted-foreground" />
              Central de ajuda
            </CommandItem>
            {guias.map((g) => (
              <CommandItem key={g.id} value={`ajuda como ${g.titulo} ${g.resumo}`} onSelect={() => go(`/ajuda/${g.id}`)}>
                <LifeBuoy className="mr-2 text-muted-foreground" />
                <span className="truncate">{g.titulo}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {pessoas.length > 0 && (
          <CommandGroup heading="Pessoas">
            {pessoas.map((p) => (
              <CommandItem key={p.id} value={`pessoa ${p.nome} ${p.email} ${p.cargo ?? ""}`} onSelect={() => go(`/admin/usuarios?busca=${encodeURIComponent(p.email)}`)}>
                <UserRound className="mr-2 text-muted-foreground" />
                <span className="truncate">{p.nome}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">{p.email}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {trainings.length > 0 && (
          <CommandGroup heading="Treinamentos">
            {trainings.slice(0, 50).map((t) => (
              <CommandItem key={t.id} value={`treinamento ${t.titulo} ${t.categoria ?? ""}`} onSelect={() => go(`/executar-treinamento/${t.id}`)}>
                <BookOpen className="mr-2 text-muted-foreground" />
                <span className="truncate">{t.titulo}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </>
  )
}
