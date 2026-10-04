import { format } from 'date-fns'

export interface CalendarEvent {
  title: string
  description: string
  startDate: Date
  endDate: Date
  location?: string
  url?: string
}

/**
 * Gera um arquivo .ics para adicionar evento ao calendário
 */
export function generateICSFile(event: CalendarEvent): string {
  const formatICSDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss")
  }

  const escapeICSText = (text: string) => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Training Portal//Course Calendar//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(event.startDate)}`,
    `DTEND:${formatICSDate(event.endDate)}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `UID:course-${Date.now()}@trainingportal.com`,
    `SUMMARY:${escapeICSText(event.title)}`,
    `DESCRIPTION:${escapeICSText(event.description)}`,
    event.location ? `LOCATION:${escapeICSText(event.location)}` : '',
    event.url ? `URL:${event.url}` : '',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Lembrete: ${escapeICSText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n')

  return icsContent
}

/**
 * Faz download do arquivo .ics
 */
export function downloadICSFile(event: CalendarEvent, filename?: string): void {
  const icsContent = generateICSFile(event)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `${event.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Gera link para adicionar evento ao Google Calendar
 */
export function generateGoogleCalendarLink(event: CalendarEvent): string {
  const formatGoogleDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss")
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(event.endDate)}`,
    ...(event.location && { location: event.location }),
    ...(event.url && { sprop: `website:${event.url}` })
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Gera link para adicionar evento ao Outlook Calendar (Web)
 */
export function generateOutlookCalendarLink(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    body: event.description,
    startdt: event.startDate.toISOString(),
    enddt: event.endDate.toISOString(),
    ...(event.location && { location: event.location })
  })

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

/**
 * Gera links para todos os calendários suportados
 */
export function generateCalendarLinks(event: CalendarEvent) {
  return {
    google: generateGoogleCalendarLink(event),
    outlook: generateOutlookCalendarLink(event),
    ics: generateICSFile(event)
  }
}
