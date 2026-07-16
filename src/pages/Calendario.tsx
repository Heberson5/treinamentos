import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Calendar as CalendarIcon, Plus, Clock, Users, MapPin, BookOpen,
  ChevronLeft, ChevronRight, Filter, Bell, Edit3, Trash2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { AddToCalendarButton } from "@/components/training/AddToCalendarButton"
import { registrarAuditoria } from "@/lib/audit-utils"

interface CalendarEvent {
  id: string
  title: string
  description: string
  date: string
  time: string
  duration: string
  type: "treinamento" | "prova" | "certificacao" | "evento" | "revisao"
  participants?: number
  instructor?: string
  location?: string
  status: "agendado" | "em-andamento" | "concluido" | "cancelado"
  cor: string
  usuario_id?: string
  criado_por_role?: string
}

const EVENT_COLORS = [
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "red", label: "Vermelho", class: "bg-red-500" },
  { value: "green", label: "Verde", class: "bg-green-500" },
  { value: "purple", label: "Roxo", class: "bg-purple-500" },
  { value: "amber", label: "Âmbar", class: "bg-amber-500" },
  { value: "pink", label: "Rosa", class: "bg-pink-500" },
  { value: "teal", label: "Teal", class: "bg-teal-500" },
  { value: "indigo", label: "Índigo", class: "bg-indigo-500" },
]

const getColorClass = (cor: string) => {
  return EVENT_COLORS.find(c => c.value === cor)?.class || "bg-blue-500"
}

export default function Calendario() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isReminderOpen, setIsReminderOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month")
  const [filterType, setFilterType] = useState<string>("todos")
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const { toast } = useToast()
  const { formatDate } = useBrazilianDate()
  const { user } = useAuth()

  const canEditEvents = user?.role === "master" || user?.role === "admin" || user?.role === "instrutor"

  const [newEvent, setNewEvent] = useState({
    title: "", description: "", date: "", time: "", duration: "",
    type: "treinamento" as CalendarEvent["type"], participants: 0, instructor: "", location: "", cor: "blue"
  })

  const [newReminder, setNewReminder] = useState({
    titulo: "", descricao: "", data: "", hora: "", tipo: "revisao", cor: "amber"
  })

  const resetForm = () => {
    setNewEvent({ title: "", description: "", date: "", time: "", duration: "", type: "treinamento", participants: 0, instructor: "", location: "", cor: "blue" })
    setEditingEvent(null)
  }

  // Load events from lembretes table
  const loadEvents = async () => {
    if (!user) return
    const { data } = await supabase
      .from("lembretes")
      .select("*")
      .order("data_lembrete", { ascending: true })

    if (data) {
      const mapped: CalendarEvent[] = data.map((l: any) => {
        const dt = new Date(l.data_lembrete)
        return {
          id: l.id,
          title: l.titulo,
          description: l.descricao || "",
          date: dt.toISOString().split("T")[0],
          time: dt.toTimeString().slice(0, 5),
          duration: "1h",
          type: (l.tipo || "evento") as CalendarEvent["type"],
          status: "agendado" as const,
          cor: l.cor || "blue",
          usuario_id: l.usuario_id,
          criado_por_role: l.criado_por_role || "usuario",
        }
      })
      setEvents(mapped)
    }
  }

  useEffect(() => { loadEvents() }, [user])

  const canEditEvent = (event: CalendarEvent) => {
    if (canEditEvents) return true
    // Users can edit their own reminders
    return event.usuario_id === user?.id
  }

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      toast({ title: "Campos obrigatórios", description: "Título, data e horário são obrigatórios", variant: "destructive" })
      return
    }
    if (!user) return

    const dataLembrete = new Date(`${newEvent.date}T${newEvent.time}`)
    
    if (editingEvent) {
      await supabase.from("lembretes").update({
        titulo: newEvent.title,
        descricao: newEvent.description || null,
        data_lembrete: dataLembrete.toISOString(),
        tipo: newEvent.type,
        cor: newEvent.cor,
      } as any).eq("id", editingEvent.id)
      toast({ title: "Evento atualizado!" })
      registrarAuditoria({ acao: "editar", menu: "calendario", descricao: `Editou evento: ${newEvent.title}` })
    } else {
      await supabase.from("lembretes").insert({
        usuario_id: user.id,
        titulo: newEvent.title,
        descricao: newEvent.description || null,
        data_lembrete: dataLembrete.toISOString(),
        tipo: newEvent.type,
        cor: newEvent.cor,
        criado_por_role: user.role,
      } as any)
      toast({ title: "Evento criado!", description: "Evento adicionado ao calendário." })
      registrarAuditoria({ acao: "criar", menu: "calendario", descricao: `Criou evento: ${newEvent.title}` })
    }

    setIsCreateOpen(false)
    resetForm()
    loadEvents()
  }

  const handleCreateReminder = async () => {
    if (!newReminder.titulo || !newReminder.data || !newReminder.hora) {
      toast({ title: "Campos obrigatórios", description: "Título, data e hora são obrigatórios", variant: "destructive" })
      return
    }
    if (!user) return

    const dataLembrete = new Date(`${newReminder.data}T${newReminder.hora}`)
    
    await supabase.from("lembretes").insert({
      usuario_id: user.id,
      titulo: newReminder.titulo,
      descricao: newReminder.descricao || null,
      data_lembrete: dataLembrete.toISOString(),
      tipo: newReminder.tipo,
      cor: newReminder.cor,
      criado_por_role: user.role,
    } as any)

    setIsReminderOpen(false)
    setNewReminder({ titulo: "", descricao: "", data: "", hora: "", tipo: "revisao", cor: "amber" })
    toast({ title: "Lembrete criado!", description: "Salvo no sistema e disponível no calendário." })
    registrarAuditoria({ acao: "criar", menu: "calendario", local: "lembretes", descricao: `Criou lembrete: ${newReminder.titulo}` })
    loadEvents()
  }

  const handleDeleteEvent = async (id: string) => {
    await supabase.from("lembretes").delete().eq("id", id)
    toast({ title: "Evento removido" })
    setSelectedEvent(null)
    loadEvents()
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event)
    setNewEvent({
      title: event.title, description: event.description, date: event.date,
      time: event.time, duration: event.duration, type: event.type,
      participants: event.participants || 0, instructor: event.instructor || "",
      location: event.location || "", cor: event.cor,
    })
    setIsCreateOpen(true)
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "treinamento": return "Treinamento"
      case "prova": return "Prova"
      case "certificacao": return "Certificação"
      case "evento": return "Evento"
      case "revisao": return "Revisão"
      default: return "Outro"
    }
  }

  const filteredEvents = filterType === "todos" ? events : events.filter(e => e.type === filterType)

  // Calendar generation
  const generateMonthCalendar = () => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    const calendar = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      const dateStr = date.toISOString().split("T")[0]
      const dayEvents = filteredEvents.filter(e => e.date === dateStr)
      calendar.push({ date, isCurrentMonth: date.getMonth() === month, events: dayEvents })
    }
    return calendar
  }

  const generateWeekCalendar = () => {
    const startOfWeek = new Date(selectedDate)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const dateStr = date.toISOString().split("T")[0]
      const dayEvents = filteredEvents.filter(e => e.date === dateStr)
      days.push({ date, events: dayEvents })
    }
    return days
  }

  const generateDayEvents = () => {
    const dateStr = selectedDate.toISOString().split("T")[0]
    return filteredEvents.filter(e => e.date === dateStr)
  }

  const changeDate = (dir: number) => {
    const d = new Date(selectedDate)
    if (viewMode === "month") d.setMonth(d.getMonth() + dir)
    else if (viewMode === "week") d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setSelectedDate(d)
  }

  const parseDuration = (dur: string): number => {
    const hMatch = dur.match(/(\d+)\s*h/)
    const mMatch = dur.match(/(\d+)\s*m/)
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0) || 60
  }

  const headerLabel = () => {
    if (viewMode === "month") return selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    if (viewMode === "week") {
      const start = new Date(selectedDate)
      start.setDate(start.getDate() - start.getDay())
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      return `${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}/${end.getFullYear()}`
    }
    return selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const ColorPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="flex gap-2 flex-wrap">
      {EVENT_COLORS.map(c => (
        <button key={c.value} type="button" onClick={() => onChange(c.value)}
          className={`w-7 h-7 rounded-full ${c.class} transition-all ${value === c.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'}`}
          title={c.label} />
      ))}
    </div>
  )

  const DurationInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="relative">
      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="1h 30min" className="pl-10" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calendário</h1>
          <p className="text-muted-foreground mt-1">Gerencie eventos, treinamentos e lembretes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="treinamento">Treinamentos</SelectItem>
              <SelectItem value="prova">Provas</SelectItem>
              <SelectItem value="certificacao">Certificações</SelectItem>
              <SelectItem value="evento">Eventos</SelectItem>
              <SelectItem value="revisao">Revisões</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Bell className="mr-2 h-4 w-4" /> Lembrete</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Lembrete</DialogTitle>
                <DialogDescription>Crie um alerta que será salvo no sistema.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Título *</Label><Input value={newReminder.titulo} onChange={(e) => setNewReminder({...newReminder, titulo: e.target.value})} placeholder="Ex: Revisar Segurança" /></div>
                <div className="space-y-2"><Label>Descrição</Label><Textarea value={newReminder.descricao} onChange={(e) => setNewReminder({...newReminder, descricao: e.target.value})} rows={2} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Data *</Label><Input type="date" value={newReminder.data} onChange={(e) => setNewReminder({...newReminder, data: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Hora *</Label><Input type="time" value={newReminder.hora} onChange={(e) => setNewReminder({...newReminder, hora: e.target.value})} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={newReminder.tipo} onValueChange={(v) => setNewReminder({...newReminder, tipo: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revisao">Revisão</SelectItem>
                      <SelectItem value="treinamento">Treinamento</SelectItem>
                      <SelectItem value="evento">Evento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Cor</Label><ColorPicker value={newReminder.cor} onChange={(v) => setNewReminder({...newReminder, cor: v})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsReminderOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateReminder} className="bg-gradient-primary">Criar Lembrete</Button>
              </div>
            </DialogContent>
          </Dialog>

          {canEditEvents && (
            <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) resetForm() }}>
              <DialogTrigger asChild><Button className="bg-gradient-primary"><Plus className="mr-2 h-4 w-4" /> Novo Evento</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingEvent ? "Editar Evento" : "Criar Novo Evento"}</DialogTitle>
                  <DialogDescription>{editingEvent ? "Atualize as informações do evento." : "Adicione um evento ao calendário."}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Título *</Label><Input value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} /></div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={newEvent.type} onValueChange={(v: any) => setNewEvent({...newEvent, type: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="treinamento">Treinamento</SelectItem>
                          <SelectItem value="prova">Prova</SelectItem>
                          <SelectItem value="certificacao">Certificação</SelectItem>
                          <SelectItem value="evento">Evento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Descrição</Label><Textarea value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} rows={2} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Data *</Label><Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Horário *</Label><Input type="time" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Duração</Label><DurationInput value={newEvent.duration} onChange={(v) => setNewEvent({...newEvent, duration: v})} /></div>
                  </div>
                  <div className="space-y-2"><Label>Cor do evento</Label><ColorPicker value={newEvent.cor} onChange={(v) => setNewEvent({...newEvent, cor: v})} /></div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm() }}>Cancelar</Button>
                  <Button onClick={handleCreateEvent} className="bg-gradient-primary">{editingEvent ? "Atualizar" : "Criar Evento"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-base sm:text-xl font-semibold capitalize">{headerLabel()}</h2>
          <Button variant="outline" size="icon" onClick={() => changeDate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["month", "week", "day"] as const).map(m => (
            <Button key={m} variant={viewMode === m ? "default" : "ghost"} size="sm" onClick={() => setViewMode(m)} className="px-3 sm:px-4">
              {m === "month" ? "Mês" : m === "week" ? "Semana" : "Dia"}
            </Button>
          ))}
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === "month" && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {generateMonthCalendar().map((day, i) => (
                <div key={i} onClick={() => { setSelectedDate(day.date); setViewMode("day") }}
                  className={`min-h-[60px] sm:min-h-[90px] p-1 border rounded-lg cursor-pointer transition-colors hover:bg-accent/30
                    ${day.isCurrentMonth ? 'bg-background' : 'bg-muted/20 opacity-50'}
                    ${day.date.toDateString() === new Date().toDateString() ? 'ring-2 ring-primary' : ''}`}>
                  <div className="text-sm font-medium mb-1 px-1">{day.date.getDate()}</div>
                  <div className="space-y-0.5">
                    {day.events.slice(0, 3).map(e => (
                      <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded text-white truncate ${getColorClass(e.cor)}`}
                        onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e) }}>
                        {e.time} {e.title}
                      </div>
                    ))}
                    {day.events.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{day.events.length - 3} mais</div>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WEEK VIEW */}
      {viewMode === "week" && (
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[640px]">
              {generateWeekCalendar().map((day, i) => (
                <div key={i} className={`border rounded-lg p-2 min-h-[220px] sm:min-h-[300px] ${day.date.toDateString() === new Date().toDateString() ? 'ring-2 ring-primary' : ''}`}>
                  <div className="text-center mb-2">
                    <div className="text-xs text-muted-foreground">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][day.date.getDay()]}</div>
                    <div className="text-lg font-bold">{day.date.getDate()}</div>
                  </div>
                  <div className="space-y-1">
                    {day.events.map(e => (
                      <div key={e.id} className={`text-xs p-1.5 rounded text-white cursor-pointer ${getColorClass(e.cor)}`}
                        onClick={() => setSelectedEvent(e)}>
                        <div className="font-medium truncate">{e.time}</div>
                        <div className="truncate">{e.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DAY VIEW */}
      {viewMode === "day" && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4 capitalize">
              {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            {generateDayEvents().length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Nenhum evento neste dia</p>
              </div>
            ) : (
              <div className="space-y-3">
                {generateDayEvents().sort((a,b) => a.time.localeCompare(b.time)).map(event => (
                  <div key={event.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/30 transition-colors">
                    <div className={`w-1 self-stretch rounded-full ${getColorClass(event.cor)}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{event.time}</span>
                        <span className="text-lg font-medium">{event.title}</span>
                        <Badge variant="secondary" className="text-xs">{getTypeLabel(event.type)}</Badge>
                      </div>
                      {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      {canEditEvent(event) && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditEvent(event)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteEvent(event.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <AddToCalendarButton
                        courseName={event.title}
                        courseDescription={event.description}
                        startDate={new Date(`${event.date}T${event.time}`)}
                        endDate={new Date(new Date(`${event.date}T${event.time}`).getTime() + parseDuration(event.duration) * 60000)}
                        location={event.location}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Event detail dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getColorClass(selectedEvent.cor)}`} />
                  {selectedEvent.title}
                </DialogTitle>
                <DialogDescription>{selectedEvent.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Badge variant="secondary">{getTypeLabel(selectedEvent.type)}</Badge>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> {formatDate(selectedEvent.date)} às {selectedEvent.time}</p>
                  {selectedEvent.duration && <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> Duração: {selectedEvent.duration}</p>}
                  {selectedEvent.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {selectedEvent.location}</p>}
                </div>
                <div className="flex gap-2">
                  {canEditEvent(selectedEvent) && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedEvent(null); handleEditEvent(selectedEvent) }}>
                        <Edit3 className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteEvent(selectedEvent.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </Button>
                    </>
                  )}
                  <AddToCalendarButton
                    courseName={selectedEvent.title}
                    courseDescription={selectedEvent.description}
                    startDate={new Date(`${selectedEvent.date}T${selectedEvent.time}`)}
                    endDate={new Date(new Date(`${selectedEvent.date}T${selectedEvent.time}`).getTime() + parseDuration(selectedEvent.duration) * 60000)}
                    location={selectedEvent.location}
                    variant="outline"
                    size="sm"
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
