import { describe, expect, it } from "vitest"
import { base64UrlParaBytes } from "./push-util"

describe("push", () => {
  it("converte a chave pública (base64 url) em bytes", () => {
    const bytes = base64UrlParaBytes("AQID_-8")
    expect(Array.from(bytes)).toEqual([1, 2, 3, 255, 239])
  })
})
