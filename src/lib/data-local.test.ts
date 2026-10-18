import { describe, expect, it } from "vitest"
import { dataLocal, fimDoDia, inicioDoDia } from "./data-local"

describe("datas no fuso local", () => {
  it("23h32 do dia 17 continua sendo dia 17", () => {
    expect(dataLocal(new Date(2026, 9, 17, 23, 32, 47))).toBe("2026-10-17")
    expect(dataLocal(new Date(2026, 0, 1, 0, 0, 1))).toBe("2026-01-01")
  })
  it("o dia inteiro local entra no filtro", () => {
    expect(inicioDoDia("2026-10-17")).toBe(new Date(2026, 9, 17, 0, 0, 0, 0).toISOString())
    expect(fimDoDia("2026-10-17")).toBe(new Date(2026, 9, 17, 23, 59, 59, 999).toISOString())
    const registro = new Date(2026, 9, 17, 23, 32, 47).toISOString()
    expect(registro >= inicioDoDia("2026-10-17") && registro <= fimDoDia("2026-10-17")).toBe(true)
  })
})
