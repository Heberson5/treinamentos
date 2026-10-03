import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BookOpen, LifeBuoy } from "lucide-react"
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { useSupabaseTrainings } from "@/hooks/use-supabase-trainings"
import { useAuth } from "@/contexts/auth-context"
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
    <CommandDialog open={open} onOpenChange={onOpenChange}>
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

  return (
    <>
      <CommandInput placeholder="Buscar páginas e treinamentos…" />
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
