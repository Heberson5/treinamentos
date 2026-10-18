import { describe, expect, it } from "vitest"
import { icsDosPrazos } from "./agenda-prazos"

describe("agenda dos prazos (.ics)", () => {
  const ics = icsDosPrazos(
    [
      { id: "t1", titulo: "LGPD na prática, módulo 1; parte 2", prazo: "2026-10-31", url: "https://exemplo.com.br/executar-treinamento/t1" },
      { id: "t2", titulo: "Sem data", prazo: "" },
    ],
    "Treinamentos",
    new Date("2026-10-18T12:00:00Z"),
  )
  it("gera um evento de dia inteiro por prazo, com lembrete na véspera", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain("DTSTART;VALUE=DATE:20261031")
    expect(ics).toContain("DTEND;VALUE=DATE:20261101")
    expect(ics).toContain("TRIGGER:-P1D")
  })
  it("escapa vírgula e ponto e vírgula do título", () => {
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:Prazo: LGPD na prática\\, módulo 1\; parte 2")
  })
  it("usa CRLF e nenhuma linha passa de 75 bytes", () => {
    for (const l of ics.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
  })
})
