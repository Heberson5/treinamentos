import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { CalendarClock, Loader2 } from "lucide-react"

interface DemoRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultEmail?: string
}

export function DemoRequestDialog({ open, onOpenChange, defaultEmail }: DemoRequestDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nome, setNome] = useState("")
  const [empresa, setEmpresa] = useState("")
  const [email, setEmail] = useState(defaultEmail || "")
  const [telefone, setTelefone] = useState("")
  const [mensagem, setMensagem] = useState("")

  const resetForm = () => {
    setNome("")
    setEmpresa("")
    setEmail("")
    setTelefone("")
    setMensagem("")
  }

  const handleSubmit = async () => {
    if (!nome.trim() || !email.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe ao menos seu nome e e-mail.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from("leads_demonstracao").insert({
        nome: nome.trim(),
        empresa: empresa.trim() || null,
        email: email.trim(),
        telefone: telefone.trim() || null,
        mensagem: mensagem.trim() || null,
      })

      if (error) throw error

      toast({
        title: "Solicitação enviada!",
        description: "Nossa equipe entrará em contato em breve para agendar sua demonstração.",
      })
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error("Erro ao solicitar demonstração:", error)
      toast({
        title: "Erro",
        description: "Não foi possível enviar sua solicitação. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Agendar uma demonstração
          </DialogTitle>
          <DialogDescription>
            Preencha seus dados e nossa equipe entrará em contato para agendar o melhor horário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="demo-nome">Nome *</Label>
            <Input id="demo-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-empresa">Empresa</Label>
            <Input id="demo-empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da sua empresa" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-email">Email *</Label>
            <Input id="demo-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-telefone">Telefone</Label>
            <Input id="demo-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-mensagem">Mensagem</Label>
            <Textarea id="demo-mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Conte um pouco sobre sua necessidade (opcional)" rows={3} />
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            "Solicitar Demonstração"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
