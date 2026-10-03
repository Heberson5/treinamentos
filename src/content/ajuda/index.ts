import {
  BookOpen, Building2, ChartColumnBig, ClipboardCheck, Copy, Crown, CreditCard, FilePlus2,
  GraduationCap, KeyRound, LayoutDashboard, LibraryBig, Megaphone, Palette, PenLine, PlayCircle,
  Presentation, Rocket, ShieldCheck, Smartphone, UserCog, UserPlus, Users, Wallet, Award,
  Settings2, ArrowLeftRight, Plug, FileSpreadsheet, type LucideIcon,
} from "lucide-react"
import type { Guia, InfoPrint, PapelAjuda } from "./tipos"
import { guiasColaborador } from "./guias/colaborador"
import { guiasInstrutor } from "./guias/instrutor"
import { guiasAdministrador } from "./guias/administrador"
import { guiasMaster } from "./guias/master"
import printsGerados from "./prints.json"

export type { Guia, PassoGuia, PapelAjuda, PerguntaFrequente, InfoPrint, MarcaPrint } from "./tipos"
export { perguntasFrequentes } from "./perguntas"

export const ICONES_AJUDA: Record<string, LucideIcon> = {
  BookOpen, Building2, ChartColumnBig, ClipboardCheck, Copy, Crown, CreditCard, FilePlus2,
  GraduationCap, KeyRound, LayoutDashboard, LibraryBig, Megaphone, Palette, PenLine, PlayCircle,
  Presentation, Rocket, ShieldCheck, Smartphone, UserCog, UserPlus, Users, Wallet, Award,
  Settings2, ArrowLeftRight, Plug, FileSpreadsheet,
}

export const PAPEIS_AJUDA: { id: PapelAjuda; nome: string; icone: LucideIcon; descricao: string }[] = [
  { id: "usuario", nome: "Colaborador", icone: GraduationCap, descricao: "Quem faz os treinamentos" },
  { id: "instrutor", nome: "Instrutor", icone: Presentation, descricao: "Quem cria e acompanha treinamentos" },
  { id: "admin", nome: "Administrador", icone: ShieldCheck, descricao: "Quem administra a empresa na plataforma" },
  { id: "master", nome: "Master", icone: Crown, descricao: "Quem administra a plataforma inteira" },
]

const NIVEL: Record<PapelAjuda, number> = { usuario: 0, instrutor: 1, admin: 2, master: 3 }

export function nivelPapel(papel: string | undefined | null): number {
  return NIVEL[(papel as PapelAjuda) || "usuario"] ?? 0
}

/** Cada pessoa vê os guias do seu acesso e dos acessos abaixo dele. */
export function podeVerPapel(papelUsuario: string | undefined | null, papelConteudo: PapelAjuda) {
  return nivelPapel(papelUsuario) >= NIVEL[papelConteudo]
}

export const todosOsGuias: Guia[] = [...guiasColaborador, ...guiasInstrutor, ...guiasAdministrador, ...guiasMaster]

export function guiasVisiveis(papelUsuario: string | undefined | null) {
  return todosOsGuias.filter((g) => podeVerPapel(papelUsuario, g.papel))
}

export function encontrarGuia(id: string | undefined) {
  return todosOsGuias.find((g) => g.id === id)
}

/** Guia mais adequado para a tela atual (botão "?"). Prefere o do próprio papel. */
export function guiaDaTela(pathname: string, papelUsuario: string | undefined | null): Guia | undefined {
  const candidatos = guiasVisiveis(papelUsuario)
    .map((g) => {
      const rota = (g.rotas || []).filter((r) => pathname === r || pathname.startsWith(r + "/")).sort((a, b) => b.length - a.length)[0]
      return rota ? { g, tamanho: rota.length } : null
    })
    .filter(Boolean) as { g: Guia; tamanho: number }[]
  const meu = nivelPapel(papelUsuario)
  candidatos.sort((a, b) => b.tamanho - a.tamanho || Math.abs(nivelPapel(a.g.papel) - meu) - Math.abs(nivelPapel(b.g.papel) - meu))
  return candidatos[0]?.g
}

export const infoPrints = printsGerados as Record<string, InfoPrint>

export const urlPrint = (chave: string) => `/ajuda/prints/${chave}.webp`

/** Texto simples para busca (sem acentos, minúsculo). */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function textoDoGuia(g: Guia) {
  return normalizar([g.titulo, g.resumo, g.tema, ...g.passos.flatMap((p) => [p.titulo, p.texto, ...(p.pontos || [])])].join(" "))
}
