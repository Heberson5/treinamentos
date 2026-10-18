import { describe, expect, it } from "vitest"
import { classificarFalhaEnvio } from "../../supabase/functions/_shared/entrega"

const para = "ana@empresa.com.br"

describe("falhas de envio de e-mail", () => {
  it("caixa inexistente conta como problema do endereço", () => {
    expect(classificarFalhaEnvio({ responseCode: 550, response: "550 5.1.1 User unknown", rejected: [para] }, para)).toBe("destinatario")
    expect(classificarFalhaEnvio({ code: "EENVELOPE", responseCode: 553, message: "Recipient address rejected" }, para)).toBe("destinatario")
    expect(classificarFalhaEnvio({ responseCode: 552, response: "552 mailbox full", rejected: [para] }, para)).toBe("destinatario")
  })
  it("problema do servidor ou da conexão não conta", () => {
    expect(classificarFalhaEnvio({ code: "ETIMEDOUT", message: "Connection timeout" }, para)).toBe("temporaria")
    expect(classificarFalhaEnvio({ responseCode: 535, response: "535 Authentication failed" }, para)).toBe("temporaria")
    expect(classificarFalhaEnvio({ responseCode: 554, response: "554 rejected as spam (blacklist)" }, para)).toBe("temporaria")
    expect(classificarFalhaEnvio({ responseCode: 450, response: "450 try again later", rejected: [para] }, para)).toBe("temporaria")
    expect(classificarFalhaEnvio({ responseCode: 421, response: "421 rate limit exceeded" }, para)).toBe("temporaria")
  })
  it("sem informação não suspende ninguém", () => {
    expect(classificarFalhaEnvio(null, para)).toBe("temporaria")
    expect(classificarFalhaEnvio({ message: "algo estranho" }, para)).toBe("temporaria")
  })
})
