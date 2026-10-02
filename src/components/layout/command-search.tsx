import { useNavigate } from "react-router-dom"
import { BookOpen } from "lucide-react"
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { useSupabaseTrainings } from "@/hooks/use-supabase-trainings"
import type { NavGroup } from "./use-navigation"

interface CommandSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: NavGroup[]
}

export function CommandSearch({ open, onOpenChange, groups }: CommandSearchProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {open && <SearchContent groups={groups} close={() => onOpenChange(false)} />}
    </CommandDialog>
  )
}

function SearchContent({ groups, close }: { groups: NavGroup[]; close: () => void }) {
  const navigate = useNavigate()
  const { trainings } = useSupabaseTrainings({ includeProgress: false })

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
        {trainings.length > 0 && (
          <CommandGroup heading="Treinamentos">
            {trainings.slice(0, 50).map((t) => (
              <CommandItem key={t.id} value={`treinamento ${t.titulo} ${t.categoria ?? ""}`} onSelect={() => go(`/treinamento/${t.id}`)}>
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
