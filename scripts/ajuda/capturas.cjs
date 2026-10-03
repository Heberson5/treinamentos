// Junta as capturas de todos os papéis. Cada arquivo em ./capturas exporta
// uma lista de itens (ver colaborador.cjs para o formato).
const fs = require("fs")
const path = require("path")

const dir = path.join(__dirname, "capturas")
module.exports = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".cjs") && !f.startsWith("_"))
  .sort()
  .flatMap((f) => require(path.join(dir, f)))
