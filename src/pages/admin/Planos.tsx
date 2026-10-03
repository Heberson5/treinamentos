import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Check, Users, Pencil, X, Save, EyeOff, Infinity, CalendarClock, Percent } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { MetricStrip, SettingsSection, InfoNote, StatusPill } from "@/components/layout/settings"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { usePlans, ICONES_PLANOS, Plano, RECURSOS_SISTEMA, RecursoPlano, RecursoId } from "@/contexts/plans-context"
import { toast } from "@/hooks/use-toast"

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function Planos() {
  const { planos, atualizarPlano, recursosSistema, descontoAnual, atualizarDescontoAnual, calcularPrecoAnual } = usePlans()
  const [editandoPlano, setEditandoPlano] = useState<Plano | null>(null)
  const [formData, setFormData] = useState<Partial<Plano>>({})

  const handleEdit = (plano: Plano) => {
    setEditandoPlano(plano)
    setFormData({ ...plano })
  }

  const handleSave = async () => {
    if (editandoPlano && formData) {
      await atualizarPlano(editandoPlano.id, formData)
      toast({
        title: "Plano atualizado",
        description: `O plano ${formData.nome} foi atualizado com sucesso.`
      })
      setEditandoPlano(null)
      setFormData({})
    }
  }

  const handleToggleAtivo = async (plano: Plano) => {
    const novoEstado = !plano.ativo
    await atualizarPlano(plano.id, { ativo: novoEstado })
    toast({
      title: novoEstado ? "Plano ativado" : "Plano desativado",
      description: novoEstado 
        ? `O plano ${plano.nome} foi ativado e agora aparecerá na página inicial.`
        : `O plano ${plano.nome} foi desativado e não aparecerá mais na página inicial.`
    })
  }

  const handleToggleRecurso = (recursoId: RecursoId, habilitado: boolean) => {
    setFormData(prev => ({
      ...prev,
      recursos: (prev.recursos || []).map(r => 
        r.recursoId === recursoId ? { ...r, habilitado } : r
      )
    }))
  }

  const handleUpdateRecursoLimite = (recursoId: RecursoId, limite: number | undefined) => {
    setFormData(prev => ({
      ...prev,
      recursos: (prev.recursos || []).map(r => 
        r.recursoId === recursoId ? { ...r, limite } : r
      )
    }))
  }

  const handleUpdateRecursoDescricao = (recursoId: RecursoId, descricaoCustomizada: string) => {
    setFormData(prev => ({
      ...prev,
      recursos: (prev.recursos || []).map(r => 
        r.recursoId === recursoId ? { ...r, descricaoCustomizada } : r
      )
    }))
  }

  const getIconComponent = (iconName: string) => {
    return ICONES_PLANOS[iconName] || Users
  }

  const getRecursoFromForm = (recursoId: RecursoId): RecursoPlano | undefined => {
    return formData.recursos?.find(r => r.recursoId === recursoId)
  }

  const categorias = [
    { id: "usuarios", nome: "Usuários" },
    { id: "treinamento", nome: "Treinamento" },
    { id: "relatorios", nome: "Relatórios" },
    { id: "suporte", nome: "Suporte" },
    { id: "integracao", nome: "Integrações" },
    { id: "enterprise", nome: "Enterprise" }
  ]

  const getRecursosHabilitadosCount = (plano: Plano) => {
    return plano.recursos.filter(r => r.habilitado).length
  }

  const ativos = planos.filter((p) => p.ativo)
  const popular = planos.find((p) => p.popular && p.ativo)
  const precos = ativos.map((p) => p.preco)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Preços, limites e recursos de cada plano. As alterações aparecem automaticamente na página inicial."
      />

      <MetricStrip
        items={[
          { label: "Planos ativos", value: ativos.length, hint: `de ${planos.length} cadastrados` },
          { label: "Mais popular", value: popular?.nome || "—", hint: popular ? `${brl(popular.preco)}${popular.periodo}` : "Nenhum destacado" },
          {
            label: "Faixa de preço",
            value: precos.length ? brl(Math.min(...precos)) : "—",
            hint: precos.length > 1 ? `até ${brl(Math.max(...precos))}` : undefined,
          },
          {
            label: "Desconto anual",
            value: descontoAnual.habilitado ? `${descontoAnual.percentual}%` : "Desligado",
            tom: descontoAnual.habilitado ? "sucesso" : "neutro",
            hint: descontoAnual.habilitado ? "aplicado na página inicial" : undefined,
          },
        ]}
      />

      <SettingsSection
        icon={CalendarClock}
        title="Desconto para Pagamento Anual"
        description="Percentual aplicado automaticamente para quem escolhe pagar por ano na página de divulgação."
        actions={
          <div className="flex items-center gap-3">
            <div className="relative w-24">
              <Input
                id="percentualDesconto"
                type="number"
                min={0}
                max={50}
                value={descontoAnual.percentual}
                onChange={(e) => atualizarDescontoAnual({ percentual: Math.min(50, Math.max(0, parseInt(e.target.value) || 0)) })}
                className="h-9 pr-8 text-right tabular-nums"
                disabled={!descontoAnual.habilitado}
                aria-label="Percentual de desconto"
              />
              <Percent className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Switch
              checked={descontoAnual.habilitado}
              aria-label="Desconto anual ativo"
              onCheckedChange={(checked) => {
                atualizarDescontoAnual({ habilitado: checked })
                toast({
                  title: checked ? "Desconto anual habilitado" : "Desconto anual desabilitado",
                  description: checked
                    ? `Desconto de ${descontoAnual.percentual}% será exibido na página inicial.`
                    : "A opção de pagamento anual foi removida da página inicial.",
                })
              }}
            />
          </div>
        }
        contentClassName="p-0"
      >
        {descontoAnual.habilitado && ativos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-medium">Plano</th>
                  <th className="px-3 py-2.5 text-right font-medium">12 × mensal</th>
                  <th className="px-3 py-2.5 text-right font-medium">Anual com desconto</th>
                  <th className="px-5 py-2.5 text-right font-medium">Economia</th>
                </tr>
              </thead>
              <tbody>
                {ativos.map((plano) => {
                  const { precoAnual, precoComDesconto, economia } = calcularPrecoAnual(plano.preco)
                  return (
                    <tr key={plano.id} className="border-b last:border-0">
                      <td className="px-5 py-2.5 font-medium">{plano.nome}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground line-through">{brl(precoAnual)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{brl(precoComDesconto)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{brl(economia)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </SettingsSection>

      <InfoNote icon={EyeOff}>
        Plano desativado deixa de aparecer na página inicial, mas as empresas que já estão nele continuam funcionando normalmente.
        Os recursos marcados em cada plano liberam as funções correspondentes do sistema.
      </InfoNote>

      {/* Planos */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {planos.map((plano) => {
          const IconComponent = getIconComponent(plano.icon)
          const recursosHabilitados = plano.recursos.filter((r) => r.habilitado)

          return (
            <Card
              key={plano.id}
              className={cn(
                "flex flex-col",
                !plano.ativo && "border-dashed bg-muted/20",
                plano.popular && plano.ativo && "border-primary/60 ring-1 ring-primary/30",
              )}
            >
              <div className="flex items-start justify-between gap-3 p-5 pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white", plano.cor, !plano.ativo && "opacity-50")}>
                    <IconComponent className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{plano.nome}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusPill tom={plano.ativo ? "sucesso" : "neutro"}>{plano.ativo ? "Ativo" : "Desativado"}</StatusPill>
                      {plano.popular && plano.ativo && <StatusPill tom="primario">Mais Popular</StatusPill>}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleEdit(plano)} aria-label={`Editar ${plano.nome}`}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                </Button>
              </div>

              <div className="px-5">
                <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">
                  {brl(plano.preco)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{plano.periodo}</span>
                </p>
                {plano.descricao && <p className="mt-2 text-sm text-muted-foreground">{plano.descricao}</p>}
              </div>

              <div className="mt-4 flex-1 space-y-3 border-t px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {plano.id === "enterprise"
                    ? `${plano.limiteUsuarios} usuários + pacotes adicionais`
                    : `Até ${plano.limiteUsuarios} usuários`}
                </div>
                {plano.id === "enterprise" && (
                  <p className="text-xs text-muted-foreground">
                    Pacote adicional: {brl(plano.precoPacoteAdicional || 0)}/mês a cada {plano.usuariosPorPacote} usuários
                  </p>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {getRecursosHabilitadosCount(plano)} {getRecursosHabilitadosCount(plano) === 1 ? "recurso incluído" : "recursos incluídos"}
                  </p>
                  <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                    {recursosHabilitados.map((recurso) => (
                      <li key={recurso.recursoId} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="min-w-0 flex-1">
                          {recurso.descricaoCustomizada || recursosSistema.find((r) => r.id === recurso.recursoId)?.nome}
                        </span>
                        {recurso.limite !== undefined && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">até {recurso.limite}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
                <Label htmlFor={`ativo-${plano.id}`} className="text-[13px] text-muted-foreground">
                  Visível na página inicial
                </Label>
                <Switch id={`ativo-${plano.id}`} checked={plano.ativo} onCheckedChange={() => handleToggleAtivo(plano)} />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Dialog de Edição */}
      <Dialog open={editandoPlano !== null} onOpenChange={(open) => !open && setEditandoPlano(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plano - {editandoPlano?.nome}</DialogTitle>
            <DialogDescription>
              Altere as configurações do plano. As mudanças serão refletidas na página inicial e nas permissões do sistema.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="geral">Informações Gerais</TabsTrigger>
              <TabsTrigger value="recursos">Recursos e Permissões</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-6 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Plano</Label>
                  <Input
                    id="nome"
                    value={formData.nome || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preco">Preço (R$)</Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    value={formData.preco || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, preco: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="limiteUsuarios">Limite de Usuários Base</Label>
                  <Input
                    id="limiteUsuarios"
                    type="number"
                    value={formData.limiteUsuarios || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, limiteUsuarios: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodo">Período</Label>
                  <Input
                    id="periodo"
                    value={formData.periodo || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, periodo: e.target.value }))}
                    placeholder="/mês, /ano, etc"
                  />
                </div>
              </div>

              {editandoPlano?.id === "enterprise" && (
                <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="precoPacote">Preço do Pacote Adicional (R$)</Label>
                    <Input
                      id="precoPacote"
                      type="number"
                      step="0.01"
                      value={formData.precoPacoteAdicional || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, precoPacoteAdicional: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usuariosPacote">Usuários por Pacote</Label>
                    <Input
                      id="usuariosPacote"
                      type="number"
                      value={formData.usuariosPorPacote || 5}
                      onChange={(e) => setFormData(prev => ({ ...prev, usuariosPorPacote: parseInt(e.target.value) || 5 }))}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="popular"
                    checked={formData.popular || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, popular: checked }))}
                  />
                  <Label htmlFor="popular">Marcar como Popular</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="ativo"
                    checked={formData.ativo !== false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                  />
                  <Label htmlFor="ativo">Plano Ativo</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recursos" className="space-y-6 py-4">
              <div className="space-y-6">
                {categorias.map(categoria => {
                  const recursosCategoria = recursosSistema.filter(r => r.categoria === categoria.id)
                  if (recursosCategoria.length === 0) return null

                  return (
                    <div key={categoria.id} className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{categoria.nome}</h3>
                      <div className="divide-y rounded-lg border">
                        {recursosCategoria.map(recurso => {
                          const recursoPlano = getRecursoFromForm(recurso.id)
                          const habilitado = recursoPlano?.habilitado ?? false
                          const limite = recursoPlano?.limite
                          const descricaoCustomizada = recursoPlano?.descricaoCustomizada || ""

                          return (
                            <div key={recurso.id} className={cn("space-y-3 p-4", habilitado && "bg-primary/[0.03]")}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    id={recurso.id}
                                    checked={habilitado}
                                    onCheckedChange={(checked) => handleToggleRecurso(recurso.id, !!checked)}
                                  />
                                  <div>
                                    <Label htmlFor={recurso.id} className="font-medium cursor-pointer">
                                      {recurso.nome}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">{recurso.descricao}</p>
                                  </div>
                                </div>
                                {habilitado && (
                                  <StatusPill tom={limite === undefined ? "primario" : "neutro"}>
                                    {limite === undefined ? (
                                      <span className="flex items-center gap-1">
                                        <Infinity className="h-3 w-3" /> Ilimitado
                                      </span>
                                    ) : (
                                      `Limite: ${limite}`
                                    )}
                                  </StatusPill>
                                )}
                              </div>

                              {habilitado && (
                                <div className="grid grid-cols-1 gap-4 pl-7 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className="text-sm">Limite (deixe vazio para ilimitado)</Label>
                                    <Input
                                      type="number"
                                      placeholder="Ilimitado"
                                      value={limite ?? ""}
                                      onChange={(e) => handleUpdateRecursoLimite(
                                        recurso.id, 
                                        e.target.value ? parseInt(e.target.value) : undefined
                                      )}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm">Descrição para exibição</Label>
                                    <Input
                                      placeholder={recurso.nome}
                                      value={descricaoCustomizada}
                                      onChange={(e) => handleUpdateRecursoDescricao(recurso.id, e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditandoPlano(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
