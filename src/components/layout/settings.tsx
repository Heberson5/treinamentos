import { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Info } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Peças visuais compartilhadas pelas telas de Sistema (Planos, Integrações,
// Permissões, Configurações, Landing Page, Financeiro e Arquitetura).
// Seguem o mesmo padrão das telas de gestão: superfícies discretas, cor de
// destaque vinda de --primary (respeita a identidade configurada) e nada de
// gradientes fixos.

// ---------------------------------------------------------------------------
// Faixa de métricas (mesmo desenho da tela de Usuários)
// ---------------------------------------------------------------------------
export type Tom = "neutro" | "primario" | "sucesso" | "alerta" | "perigo"

const TOM_TEXTO: Record<Tom, string> = {
  neutro: "text-foreground",
  primario: "text-primary",
  sucesso: "text-emerald-600 dark:text-emerald-400",
  alerta: "text-amber-600 dark:text-amber-400",
  perigo: "text-red-600 dark:text-red-400",
}

export interface Metrica {
  label: string
  value: ReactNode
  hint?: ReactNode
  tom?: Tom
}

export function MetricStrip({ items, className }: { items: Metrica[]; className?: string }) {
  const cols =
    items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
  return (
    <Card
      className={cn(
        "grid grid-cols-2 divide-x divide-y overflow-hidden lg:divide-y-0",
        cols,
        items.length > 4 && "lg:grid-cols-5",
        className,
      )}
    >
      {items.map((m) => (
        <div key={m.label} className="min-w-0 px-5 py-4">
          <div className="truncate text-xs font-medium text-muted-foreground">{m.label}</div>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <span className={cn("truncate text-xl font-semibold tabular-nums sm:text-2xl", TOM_TEXTO[m.tom || "neutro"])}>
              {m.value}
            </span>
          </div>
          {m.hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{m.hint}</div>}
        </div>
      ))}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Etiqueta de situação com ponto colorido
// ---------------------------------------------------------------------------
const TOM_PILL: Record<Tom, string> = {
  neutro: "bg-muted text-muted-foreground",
  primario: "bg-primary/10 text-primary",
  sucesso: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  alerta: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  perigo: "bg-red-500/10 text-red-700 dark:text-red-400",
}
const TOM_PONTO: Record<Tom, string> = {
  neutro: "bg-muted-foreground/60",
  primario: "bg-primary",
  sucesso: "bg-emerald-500",
  alerta: "bg-amber-500",
  perigo: "bg-red-500",
}

export function StatusPill({ tom = "neutro", children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TOM_PILL[tom],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TOM_PONTO[tom])} />
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Navegação lateral de abas (vira faixa rolável no celular)
// ---------------------------------------------------------------------------
export interface AbaConfig {
  value: string
  label: string
  icon?: LucideIcon
  /** Texto curto exibido abaixo do nome no computador. */
  hint?: string
}

interface SettingsTabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
  abas: AbaConfig[]
  children: ReactNode
  className?: string
}

export function SettingsTabs({ value, defaultValue, onValueChange, abas, children, className }: SettingsTabsProps) {
  return (
    <Tabs
      value={value}
      defaultValue={defaultValue ?? abas[0]?.value}
      onValueChange={onValueChange}
      className={cn("lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-8", className)}
    >
      <TabsList
        className={cn(
          "mb-5 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-card p-1 [scrollbar-width:none]",
          "lg:sticky lg:top-20 lg:mb-0 lg:flex-col lg:items-stretch lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0",
        )}
      >
        {abas.map((aba) => {
          const Icon = aba.icon
          return (
            <TabsTrigger
              key={aba.value}
              value={aba.value}
              className={cn(
                "shrink-0 justify-start gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-muted-foreground",
                "hover:bg-muted hover:text-foreground",
                "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none",
                "lg:w-full lg:py-2.5",
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="flex min-w-0 flex-col items-start text-left">
                <span>{aba.label}</span>
                {aba.hint && (
                  <span className="hidden truncate text-[11.5px] font-normal text-muted-foreground lg:block">{aba.hint}</span>
                )}
              </span>
            </TabsTrigger>
          )
        })}
      </TabsList>
      <div className="min-w-0 space-y-6">{children}</div>
    </Tabs>
  )
}

// ---------------------------------------------------------------------------
// Bloco de configurações: título, conteúdo e rodapé com ações
// ---------------------------------------------------------------------------
interface SettingsSectionProps {
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  /** Ações no canto do cabeçalho (ex.: interruptor geral, botão secundário). */
  actions?: ReactNode
  /** Rodapé com os botões de salvar. */
  footer?: ReactNode
  children?: ReactNode
  className?: string
  contentClassName?: string
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  actions,
  footer,
  children,
  className,
  contentClassName,
}: SettingsSectionProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-6 text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children !== undefined && children !== null && (
        <div className={cn("space-y-5 p-5", contentClassName)}>{children}</div>
      )}
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">{footer}</div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Linha de opção: texto à esquerda, controle à direita
// ---------------------------------------------------------------------------
export function SettingRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode
  description?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0", className)}>
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Lista de SettingRow separadas por linhas finas. */
export function SettingList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y", className)}>{children}</div>
}

// ---------------------------------------------------------------------------
// Campo de formulário: rótulo, controle e dica
// ---------------------------------------------------------------------------
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Observação discreta (substitui os quadros coloridos grandes)
// ---------------------------------------------------------------------------
const TOM_NOTA: Record<"info" | "alerta" | "perigo", string> = {
  info: "border-border bg-muted/40 text-muted-foreground [&_svg]:text-primary",
  alerta: "border-amber-500/30 bg-amber-500/[0.06] text-amber-900 dark:text-amber-200 [&_svg]:text-amber-600",
  perigo: "border-red-500/30 bg-red-500/[0.06] text-red-900 dark:text-red-200 [&_svg]:text-red-600",
}

export function InfoNote({
  children,
  icon: Icon = Info,
  tom = "info",
  className,
}: {
  children: ReactNode
  icon?: LucideIcon
  tom?: "info" | "alerta" | "perigo"
  className?: string
}) {
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-5", TOM_NOTA[tom], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
