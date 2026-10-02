import { useState } from "react"
import {
  BookOpen, Landmark, Users, ShieldCheck, Target, Table2, Lock, HeartPulse, Headset,
  MessagesSquare, Scale, Briefcase, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS: Array<[RegExp, LucideIcon]> = [
  [/tribut|fiscal|contab|financ/i, Landmark],
  [/recursos humanos|rh|integra|equipe|colabor/i, Users],
  [/compliance|lgpd|ética|etica|conduta/i, ShieldCheck],
  [/lideran|gest[aã]o|produtiv/i, Target],
  [/t[eé]cnic|excel|planilha|sistema/i, Table2],
  [/seguran/i, Lock],
  [/sa[uú]de|bem-estar|mental/i, HeartPulse],
  [/atendimento|cliente|vendas/i, Headset],
  [/comunica/i, MessagesSquare],
  [/jur[ií]dic|legal/i, Scale],
  [/comercial|neg[oó]cio/i, Briefcase],
]

function hashHue(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360
  return h
}

interface TrainingThumbProps {
  src?: string | null
  category?: string | null
  title?: string
  className?: string
  iconClassName?: string
}

// Capa do treinamento. Sem imagem (ou se ela falhar), mostra um gradiente
// estável por categoria com um ícone, em vez de um quadro vazio.
export function TrainingThumb({ src, category, title, className, iconClassName = "h-8 w-8" }: TrainingThumbProps) {
  const [failed, setFailed] = useState(false)
  const hasImage = !!src && !src.startsWith("/api/placeholder") && !failed

  if (hasImage) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        <img src={src!} alt={title || ""} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      </div>
    )
  }

  const key = category || title || "Geral"
  const Icon = CATEGORY_ICONS.find(([re]) => re.test(key))?.[1] || BookOpen
  const hue = hashHue(key)
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 35) % 360} 65% 38%))` }}
    >
      <div className="absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="absolute -top-8 right-10 h-20 w-20 rounded-full bg-white/10" />
      <div className="absolute inset-0 grid place-items-center text-white/90">
        <Icon className={iconClassName} strokeWidth={1.5} />
      </div>
    </div>
  )
}
