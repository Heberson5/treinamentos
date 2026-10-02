import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type PeriodValue = "7d" | "30d" | "90d" | "1y" | "custom"

interface PeriodFilterProps {
  value: PeriodValue
  onChange: (value: PeriodValue) => void
  customStartDate?: Date
  customEndDate?: Date
  onCustomDateChange?: (start: Date | undefined, end: Date | undefined) => void
}

export function PeriodFilter({ value, onChange, customStartDate, customEndDate, onCustomDateChange }: PeriodFilterProps) {
  const [isDateOpen, setIsDateOpen] = useState(false)

  const formatDateRange = () => {
    if (!customStartDate && !customEndDate) return "Selecione o período"
    const start = customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR }) : ""
    const end = customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR }) : ""
    return `${start} - ${end}`
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select value={value} onValueChange={(v) => onChange(v as PeriodValue)}>
        <SelectTrigger className="w-[188px]">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="90d">Últimos 90 dias</SelectItem>
          <SelectItem value="1y">Último ano</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {value === "custom" && (
        <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[260px] justify-start text-left font-normal",
                !customStartDate && !customEndDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-col sm:flex-row gap-2 p-3">
              <div>
                <p className="text-sm font-medium mb-2">Data Inicial</p>
                <Calendar
                  mode="single"
                  selected={customStartDate}
                  onSelect={(date) => onCustomDateChange?.(date, customEndDate)}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Data Final</p>
                <Calendar
                  mode="single"
                  selected={customEndDate}
                  onSelect={(date) => onCustomDateChange?.(customStartDate, date)}
                  locale={ptBR}
                  disabled={(date) => customStartDate ? date < customStartDate : false}
                  className="p-3 pointer-events-auto"
                />
              </div>
            </div>
            <div className="p-3 border-t">
              <Button size="sm" className="w-full" onClick={() => setIsDateOpen(false)}>
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

export function getStartDateFromPeriod(period: PeriodValue, customStart?: Date): Date {
  const now = new Date()
  switch (period) {
    case "7d": return new Date(new Date().setDate(now.getDate() - 7))
    case "30d": return new Date(new Date().setDate(now.getDate() - 30))
    case "90d": return new Date(new Date().setDate(now.getDate() - 90))
    case "1y": return new Date(new Date().setFullYear(now.getFullYear() - 1))
    case "custom": return customStart || new Date(new Date().setDate(now.getDate() - 30))
    default: return new Date(new Date().setDate(now.getDate() - 30))
  }
}
