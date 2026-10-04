import { CalendarDays } from "lucide-react"
import { AssinarCalendario } from "@/components/calendario/assinar-calendario"
import { InfoNote, SettingsSection } from "@/components/layout/settings"

// Integração com Google Agenda, Outlook e Apple Calendário por assinatura
// iCal: cada pessoa gera o próprio link (não depende de conta Google/Microsoft
// da empresa nem de permissões de acesso à agenda de ninguém).
export function CalendarIntegrationCard() {
  return (
    <div className="space-y-6">
      <SettingsSection
        icon={CalendarDays}
        title="Prazos no calendário"
        description="Google Agenda, Outlook e calendário do celular, por assinatura (iCal)"
      >
        <AssinarCalendario />
      </SettingsSection>
      <InfoNote>
        Cada colaborador gera o próprio link em <strong className="font-medium text-foreground">Calendário → Sincronizar</strong>.
        O link mostra só os treinamentos daquela pessoa (respeitando empresa e departamento) e a plataforma não acessa a agenda de ninguém.
      </InfoNote>
    </div>
  )
}
