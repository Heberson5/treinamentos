import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Award,
  Star
} from "lucide-react";
import { useActiveTimer } from "@/hooks/use-active-timer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/sanitize";
import { getVideoInfo } from "@/lib/video-utils";
import { QuizViewer } from "@/components/training/quiz-viewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { registrarEventoTentativa } from "@/lib/exam-events";

interface TrainingData {
  id: string;
  titulo: string;
  descricao: string | null;
  duracao_minutos: number | null;
  categoria: string | null;
  nivel: string | null;
  thumbnail_url: string | null;
  conteudo_completo?: string;
  avaliacao_obrigatoria?: boolean;
}

interface ProgressData {
  id: string;
  percentual_concluido: number;
  tempo_assistido_minutos: number;
  concluido: boolean;
  data_inicio: string | null;
}

export default function ExecutarTreinamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [training, setTraining] = useState<TrainingData | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canComplete, setCanComplete] = useState(false);
  const [quizApproved, setQuizApproved] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modo Avaliação (exame): esconde conteúdo e bloqueia retorno ao estudo
  const examStorageKey = id && user?.id ? `exam_started_${user.id}_${id}` : "";
  const [examMode, setExamMode] = useState(false);
  const [examKey, setExamKey] = useState(0); // força remount do QuizViewer ao reiniciar
  const [showExamWarning, setShowExamWarning] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [examSummary, setExamSummary] = useState<{ tentativas: number; reinicios: number; violacoes: number; pausas: number; ultimaNota: number; tempoEstudoMin: number } | null>(null);
  const studyStartRef = useRef<number>(Date.now());
  const prevVisibleRef = useRef<boolean>(true);

  const targetDuration = training?.duracao_minutos || 60;
  const minimumTimeRequired = Math.ceil(targetDuration * 0.5); // 50% do tempo

  const timer = useActiveTimer({
    targetDuration: targetDuration,
    autoStart: true,
    onTimeUpdate: useCallback((activeTime: number) => {
      // Verificar se atingiu 50% do tempo
      const minSeconds = minimumTimeRequired * 60;
      if (activeTime >= minSeconds && !canComplete) {
        setCanComplete(true);
        toast.success("Você atingiu o tempo mínimo! Pode concluir o treinamento.", {
          duration: 5000,
        });
      }
    }, [minimumTimeRequired, canComplete]),
    onCompletion: useCallback(() => {
      toast.success("Parabéns! Você completou 100% do tempo de estudo!", {
        duration: 5000,
      });
    }, [])
  });

  // Carregar treinamento
  useEffect(() => {
    async function loadTraining() {
      if (!id) return;
      
      setLoading(true);
      const { data, error } = await supabase
        .from("treinamentos")
        .select("id, titulo, descricao, duracao_minutos, categoria, nivel, thumbnail_url, conteudo_html, avaliacao_obrigatoria")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar treinamento:", error);
        toast.error("Erro ao carregar treinamento");
      } else if (data) {
        setTraining({
          ...data,
          conteudo_completo: data.conteudo_html || undefined,
          avaliacao_obrigatoria: data.avaliacao_obrigatoria || false
        });
      }

      // Check if training has quiz questions
      const { count } = await supabase
        .from("questoes_treinamento")
        .select("id", { count: "exact", head: true })
        .eq("treinamento_id", id);
      
      setHasQuiz((count || 0) > 0);

      // Check if user already approved
      if (user?.id) {
        const { data: approvedData } = await supabase
          .from("tentativas_avaliacao")
          .select("id")
          .eq("treinamento_id", id)
          .eq("usuario_id", user.id)
          .eq("aprovado", true)
          .limit(1);
        
        if (approvedData && approvedData.length > 0) {
          setQuizApproved(true);
        }
      }

      setLoading(false);
    }

    loadTraining();
  }, [id, user?.id]);

  // Se já iniciou a avaliação anteriormente (e não foi aprovado), volta direto ao modo avaliação
  useEffect(() => {
    if (!examStorageKey) return;
    if (quizApproved) {
      localStorage.removeItem(examStorageKey);
      return;
    }
    if (hasQuiz && localStorage.getItem(examStorageKey) === "1") {
      setExamMode(true);
    }
  }, [examStorageKey, hasQuiz, quizApproved]);

  // Em modo avaliação: trocar de aba / minimizar / sair => reinicia a avaliação
  useEffect(() => {
    if (!examMode || quizApproved || !id) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        sessionStorage.setItem("exam_violation", "1");
        registrarEventoTentativa("avaliacao_violacao", id, { motivo: "visibility_hidden" });
      } else if (sessionStorage.getItem("exam_violation") === "1") {
        sessionStorage.removeItem("exam_violation");
        setExamKey((k) => k + 1);
        registrarEventoTentativa("avaliacao_reiniciada", id, { motivo: "retorno_apos_violacao" });
        toast.error("Avaliação reiniciada: você saiu da tela antes de finalizar.", { duration: 6000 });
      }
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (id) registrarEventoTentativa("avaliacao_violacao", id, { motivo: "before_unload" });
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [examMode, quizApproved, id]);

  // Registrar início de estudo e detectar pausas (timer.isPageVisible)
  useEffect(() => {
    if (!id || examMode) return;
    if (prevVisibleRef.current && !timer.isPageVisible) {
      registrarEventoTentativa("estudo_pausado", id, { tempoAtivoSeg: timer.activeTime });
    } else if (!prevVisibleRef.current && timer.isPageVisible) {
      registrarEventoTentativa("estudo_retomado", id, { tempoAtivoSeg: timer.activeTime });
    }
    prevVisibleRef.current = timer.isPageVisible;
  }, [timer.isPageVisible, id, examMode, timer.activeTime]);

  useEffect(() => {
    if (id) {
      studyStartRef.current = Date.now();
      registrarEventoTentativa("estudo_iniciado", id, {});
    }
  }, [id]);

  const startExam = () => {
    if (examStorageKey) localStorage.setItem(examStorageKey, "1");
    if (id) registrarEventoTentativa("avaliacao_iniciada", id, { tempoEstudoSeg: timer.activeTime });
    setExamMode(true);
    setShowExamWarning(false);
  };

  const handleExamFinalizada = useCallback(async (info: { nota: number; aprovado: boolean; duracaoSegundos: number; tempoEstudoSegundos: number; numeroTentativa: number }) => {
    if (!id || !user?.id) return;
    await registrarEventoTentativa("avaliacao_finalizada", id, info);
    // Carregar resumo
    const [{ data: tentativas }, { data: eventos }] = await Promise.all([
      supabase.from("tentativas_avaliacao").select("nota").eq("treinamento_id", id).eq("usuario_id", user.id).order("criado_em", { ascending: false }),
      (supabase as any).from("tentativas_eventos").select("tipo_evento").eq("treinamento_id", id).eq("usuario_id", user.id),
    ]);
    const ev = (eventos || []) as Array<{ tipo_evento: string }>;
    setExamSummary({
      tentativas: tentativas?.length || 0,
      reinicios: ev.filter(e => e.tipo_evento === "avaliacao_reiniciada").length,
      violacoes: ev.filter(e => e.tipo_evento === "avaliacao_violacao").length,
      pausas: ev.filter(e => e.tipo_evento === "estudo_pausado").length,
      ultimaNota: info.nota,
      tempoEstudoMin: Math.floor(info.tempoEstudoSegundos / 60),
    });
    setShowSummary(true);
  }, [id, user?.id]);


  // Carregar ou criar progresso
  useEffect(() => {
    async function loadProgress() {
      if (!id || !user?.id) return;

      const { data, error } = await supabase
        .from("progresso_treinamentos")
        .select("*")
        .eq("treinamento_id", id)
        .eq("usuario_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erro ao carregar progresso:", error);
      } else if (data) {
        setProgressData(data);
      } else {
        // Criar novo registro de progresso
        const { data: newProgress, error: insertError } = await supabase
          .from("progresso_treinamentos")
          .insert({
            treinamento_id: id,
            usuario_id: user.id,
            percentual_concluido: 0,
            tempo_assistido_minutos: 0,
            data_inicio: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error("Erro ao criar progresso:", insertError);
        } else {
          setProgressData(newProgress);
        }
      }
    }

    loadProgress();
  }, [id, user?.id]);

  // Salvar progresso periodicamente
  useEffect(() => {
    const saveProgress = async () => {
      if (!progressData?.id || !user?.id) return;

      const tempoMinutos = Math.floor(timer.activeTime / 60);
      const percentual = Math.min(Math.round((timer.activeTime / (targetDuration * 60)) * 100), 100);

      await supabase
        .from("progresso_treinamentos")
        .update({
          tempo_assistido_minutos: tempoMinutos,
          percentual_concluido: percentual,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", progressData.id);
    };

    // Salvar a cada 30 segundos
    const interval = setInterval(saveProgress, 30000);
    return () => clearInterval(interval);
  }, [progressData?.id, user?.id, timer.activeTime, targetDuration]);

  const handleComplete = async () => {
    if (!canComplete) {
      toast.error(`Você precisa permanecer pelo menos ${minimumTimeRequired} minutos no treinamento.`);
      return;
    }
    // Mostrar diálogo de avaliação
    setShowRatingDialog(true);
  };

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      toast.error("Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }

    if (!progressData?.id || !user?.id || !id) return;

    setIsSubmitting(true);
    try {
      // Salvar avaliação
      const { error: ratingError } = await supabase
        .from("avaliacoes_treinamentos")
        .upsert({
          treinamento_id: id,
          usuario_id: user.id,
          nota: selectedRating,
          comentario: ratingComment || null
        }, { onConflict: 'treinamento_id,usuario_id' });

      if (ratingError) {
        console.error("Erro ao salvar avaliação:", ratingError);
        toast.error("Erro ao salvar avaliação");
      }

      // Concluir treinamento (validado no servidor: exige avaliação aprovada
      // quando o treinamento a torna obrigatória — não pode ser forjado pelo cliente)
      const { error } = await supabase.rpc("concluir_treinamento", {
        p_treinamento_id: id,
        p_tempo_assistido_minutos: Math.floor(timer.activeTime / 60),
        p_nota_avaliacao: selectedRating
      });

      if (error) {
        console.error("Erro ao concluir:", error);
        toast.error("Erro ao concluir treinamento");
      } else {
        toast.success("Treinamento concluído com sucesso! Obrigado pela avaliação.");
        navigate("/meus-treinamentos");
      }
    } finally {
      setIsSubmitting(false);
      setShowRatingDialog(false);
    }
  };

  // Conteúdos completos dos treinamentos por categoria
  const getTrainingContent = (titulo: string): string => {
    const contents: Record<string, string> = {
      "Introdução à LGPD - Lei Geral de Proteção de Dados": `
## Seção 1: O que é a LGPD?

[Imagem: https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&auto=format&fit=crop]

A **Lei Geral de Proteção de Dados (LGPD)** - Lei nº 13.709/2018 - é a legislação brasileira que regulamenta o tratamento de dados pessoais por pessoas físicas e jurídicas, públicas ou privadas.

### Por que a LGPD foi criada?

A LGPD surgiu em um contexto global de preocupação com a privacidade e a proteção dos dados pessoais dos cidadãos. Com o avanço da tecnologia e a digitalização de praticamente todos os aspectos da vida moderna, tornou-se essencial criar mecanismos legais para proteger as informações das pessoas.

**Principais motivações:**
• Aumento exponencial da coleta de dados pessoais
• Escândalos de vazamento de dados em grandes empresas
• Necessidade de harmonização com legislações internacionais (como o GDPR europeu)
• Proteção dos direitos fundamentais de liberdade e privacidade

---

## Seção 2: Conceitos Fundamentais

[Imagem: https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop]

### O que são Dados Pessoais?

Dado pessoal é toda informação relacionada a uma pessoa natural identificada ou identificável. Isso inclui:

• **Nome completo** - O identificador mais básico
• **CPF, RG, CNH** - Documentos de identificação
• **Endereço** - Residencial ou comercial
• **E-mail** - Pessoal ou profissional
• **Telefone** - Fixo ou celular
• **Dados de localização** - GPS, check-ins
• **Endereço IP** - Identificação na internet
• **Cookies** - Rastreamento de navegação

### Dados Pessoais Sensíveis

São dados que requerem proteção especial por revelarem aspectos íntimos da pessoa:

☑ Origem racial ou étnica
☑ Convicções religiosas
☑ Opiniões políticas
☑ Filiação sindical
☑ Dados de saúde
☑ Dados genéticos e biométricos
☑ Orientação sexual

**Importante:** O tratamento de dados sensíveis só é permitido com consentimento específico e destacado do titular ou nas hipóteses previstas em lei.

---

## Seção 3: Quem são os Agentes de Tratamento?

[Imagem: https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&auto=format&fit=crop]

### Controlador

O **controlador** é a pessoa natural ou jurídica, de direito público ou privado, a quem competem as decisões referentes ao tratamento de dados pessoais.

**Responsabilidades do Controlador:**
• Definir as finalidades do tratamento
• Determinar os meios de tratamento
• Garantir a segurança dos dados
• Atender aos direitos dos titulares

### Operador

O **operador** é a pessoa natural ou jurídica, de direito público ou privado, que realiza o tratamento de dados pessoais em nome do controlador.

**Características do Operador:**
• Atua seguindo instruções do controlador
• Não toma decisões sobre o tratamento
• Deve garantir a segurança dos dados
• Responde por danos causados pelo tratamento

### Encarregado (DPO)

O **Encarregado de Proteção de Dados** (Data Protection Officer - DPO) é a pessoa indicada pelo controlador para atuar como canal de comunicação entre o controlador, os titulares dos dados e a ANPD.

---

## Seção 4: Direitos dos Titulares

[Imagem: https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop]

A LGPD garante diversos direitos aos titulares dos dados. É fundamental conhecê-los:

### 1. Confirmação e Acesso
O titular pode confirmar a existência de tratamento e acessar seus dados pessoais.

### 2. Correção
Direito de solicitar a correção de dados incompletos, inexatos ou desatualizados.

### 3. Anonimização, Bloqueio ou Eliminação
Possibilidade de solicitar que dados desnecessários, excessivos ou tratados em desconformidade sejam anonimizados, bloqueados ou eliminados.

### 4. Portabilidade
Direito de receber os dados para transferência a outro fornecedor de serviço.

### 5. Eliminação
Solicitar a eliminação dos dados pessoais tratados com consentimento.

### 6. Informação sobre Compartilhamento
Saber com quais entidades públicas e privadas os dados foram compartilhados.

### 7. Revogação do Consentimento
Retirar o consentimento a qualquer momento.

---

## Seção 5: Bases Legais para Tratamento

[Imagem: https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop]

Para que o tratamento de dados pessoais seja lícito, deve estar fundamentado em uma das seguintes bases legais:

1. **Consentimento do titular** - Manifestação livre, informada e inequívoca
2. **Cumprimento de obrigação legal** - Quando exigido por lei
3. **Execução de políticas públicas** - Pela administração pública
4. **Estudos por órgão de pesquisa** - Com anonimização quando possível
5. **Execução de contrato** - Quando necessário para o contrato
6. **Exercício regular de direitos** - Em processos judiciais
7. **Proteção da vida** - Do titular ou de terceiro
8. **Tutela da saúde** - Procedimentos realizados por profissionais da saúde
9. **Legítimo interesse** - Do controlador ou terceiro
10. **Proteção do crédito** - Conforme legislação pertinente

---

## Seção 6: Boas Práticas no Dia a Dia

[Imagem: https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&auto=format&fit=crop]

### Como aplicar a LGPD na prática corporativa:

**No trabalho remoto:**
• Use apenas dispositivos autorizados pela empresa
• Evite redes Wi-Fi públicas para acessar dados sensíveis
• Mantenha a tela bloqueada quando se ausentar
• Não compartilhe credenciais de acesso

**No atendimento ao cliente:**
• Colete apenas dados estritamente necessários
• Informe claramente a finalidade da coleta
• Registre o consentimento quando aplicável
• Mantenha os dados atualizados

**Na comunicação:**
• Cuidado ao enviar e-mails com dados pessoais
• Verifique os destinatários antes de enviar
• Use cópia oculta (CCO) para múltiplos destinatários
• Não encaminhe dados sem autorização

**No descarte de documentos:**
• Destrua documentos físicos com triturador
• Delete arquivos digitais de forma segura
• Siga a política de retenção da empresa

---

## Seção 7: Sanções e Penalidades

[Imagem: https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop]

A LGPD prevê sanções administrativas para infrações, aplicadas pela ANPD:

### Tipos de Sanções

• **Advertência** - Com prazo para adoção de medidas corretivas
• **Multa simples** - Até 2% do faturamento, limitada a R$ 50 milhões por infração
• **Multa diária** - Observado o limite total
• **Publicização da infração** - Após apuração confirmada
• **Bloqueio dos dados** - Até regularização
• **Eliminação dos dados** - Referentes à infração
• **Suspensão do banco de dados** - Por até 6 meses
• **Proibição parcial ou total** - Das atividades de tratamento

**Lembre-se:** Além das sanções administrativas, a empresa pode ser responsabilizada civilmente por danos causados aos titulares.

---

## Seção 8: Avaliação de Conhecimentos

Agora que você completou o estudo, reflita sobre os seguintes pontos:

☑ Consigo identificar dados pessoais e dados sensíveis?
☑ Sei quais são os direitos dos titulares?
☑ Conheço as bases legais para tratamento?
☑ Aplico boas práticas no meu dia a dia?
☑ Sei a quem recorrer em caso de dúvidas?

**Parabéns por completar este treinamento!**

A proteção de dados é responsabilidade de todos. Continue aplicando esses conhecimentos e ajude a construir uma cultura de privacidade na organização.
      `,
      "Segurança da Informação para Colaboradores": `
## Seção 1: Introdução à Segurança da Informação

[Imagem: https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&auto=format&fit=crop]

A **Segurança da Informação** é o conjunto de práticas, políticas e tecnologias destinadas a proteger informações contra acessos não autorizados, alterações indevidas, destruição ou vazamento.

### Os Três Pilares da Segurança

**Confidencialidade** - Garantir que a informação seja acessível apenas por pessoas autorizadas.

**Integridade** - Assegurar que a informação não seja alterada de forma não autorizada.

**Disponibilidade** - Garantir que a informação esteja disponível quando necessário.

### Por que isso é importante para você?

• Você lida diariamente com informações da empresa
• Dados de clientes passam pelas suas mãos
• Um único descuido pode causar grandes prejuízos
• Você é a primeira linha de defesa

---

## Seção 2: Senhas Seguras

[Imagem: https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&auto=format&fit=crop]

### Como criar senhas fortes

Uma senha forte deve ter:
• No mínimo 12 caracteres
• Letras maiúsculas e minúsculas
• Números
• Caracteres especiais (!@#$%&*)

**Exemplos de senhas FRACAS:**
• 123456 (sequência numérica)
• senha123 (palavra comum + números)
• joao1985 (nome + data de nascimento)
• qwerty (sequência do teclado)

**Dicas para senhas FORTES:**
• Use frases: "MeuCachorro@Toby#2024!"
• Substitua letras: "S3gur@nc@D@1nf0"
• Combine palavras: "Café+Livro=Manhã2024"

### Práticas essenciais

☑ Nunca compartilhe sua senha com ninguém
☑ Não anote senhas em papéis ou post-its
☑ Use senhas diferentes para cada sistema
☑ Troque suas senhas periodicamente
☑ Considere usar um gerenciador de senhas

---

## Seção 3: Identificando Phishing

[Imagem: https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&auto=format&fit=crop]

### O que é Phishing?

Phishing é uma técnica de engenharia social usada para enganar usuários e obter informações confidenciais, como senhas e dados bancários.

### Sinais de alerta em e-mails

• **Remetente suspeito** - Endereços com erros ou domínios estranhos
• **Urgência excessiva** - "Sua conta será bloqueada em 24 horas!"
• **Erros gramaticais** - Textos mal escritos ou traduzidos
• **Links suspeitos** - Passe o mouse para ver o endereço real
• **Anexos inesperados** - Arquivos não solicitados
• **Pedidos de dados pessoais** - Bancos não pedem senhas por e-mail

### Exemplos de phishing comum

1. **Falso banco:** "Detectamos atividade suspeita, clique para verificar"
2. **Falsa empresa de entregas:** "Sua encomenda está retida, pague a taxa"
3. **Falso TI:** "Sua conta será desativada, atualize sua senha"
4. **Falso prêmio:** "Você ganhou! Clique para resgatar"

### O que fazer ao receber um e-mail suspeito?

• Não clique em links
• Não abra anexos
• Não responda
• Reporte ao time de TI
• Delete o e-mail

---

## Seção 4: Uso Seguro de Dispositivos

[Imagem: https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop]

### No computador

• **Bloqueie a tela** ao se ausentar (Windows+L ou Ctrl+Cmd+Q)
• **Mantenha o sistema atualizado** com os patches de segurança
• **Use apenas softwares autorizados** pela empresa
• **Faça backup regular** dos seus arquivos importantes
• **Não conecte dispositivos USB** desconhecidos

### No celular corporativo

• Configure bloqueio de tela com PIN ou biometria
• Não instale aplicativos de fontes desconhecidas
• Evite redes Wi-Fi públicas
• Mantenha o dispositivo sempre atualizado
• Reporte imediatamente se perder o aparelho

### Trabalho remoto

• Use apenas a VPN da empresa para acessos remotos
• Evite trabalhar em locais públicos com dados sensíveis
• Não deixe o computador em veículos
• Certifique-se de que sua rede doméstica é segura

---

## Seção 5: Redes Sociais e Engenharia Social

[Imagem: https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop]

### Cuidados nas redes sociais

• Não publique informações sobre a empresa
• Cuidado com o que compartilha sobre seu trabalho
• Não adicione pessoas desconhecidas
• Revise suas configurações de privacidade
• Pense antes de postar

### O que é Engenharia Social?

É a manipulação psicológica de pessoas para obter informações confidenciais. Os atacantes exploram:

• Confiança
• Autoridade
• Medo
• Urgência
• Curiosidade

### Táticas comuns

• **Pretexting:** Criar uma história falsa para ganhar confiança
• **Baiting:** Oferecer algo atrativo (pen drive "perdido")
• **Tailgating:** Seguir alguém autorizado para entrar em áreas restritas
• **Quid pro quo:** Oferecer ajuda em troca de informações

---

## Seção 6: Classificação e Proteção de Dados

[Imagem: https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop]

### Níveis de classificação

**Público** - Informações que podem ser divulgadas sem restrições

**Interno** - Uso restrito aos colaboradores da empresa

**Confidencial** - Acesso limitado a pessoas específicas

**Restrito** - Alto nível de sigilo, acesso muito controlado

### Como proteger informações confidenciais

• Armazene em locais seguros (digitais e físicos)
• Compartilhe apenas com pessoas autorizadas
• Use criptografia para arquivos sensíveis
• Descarte documentos de forma segura
• Nunca discuta assuntos confidenciais em locais públicos

### Mesa limpa e tela limpa

**Mesa limpa:**
• Guarde documentos sensíveis ao final do dia
• Não deixe papéis com informações à vista
• Destrua documentos antes de descartar

**Tela limpa:**
• Bloqueie o computador ao se ausentar
• Posicione o monitor para evitar visualização indevida
• Feche sistemas quando não estiver usando

---

## Seção 7: Incidentes de Segurança

[Imagem: https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&auto=format&fit=crop]

### O que é um incidente de segurança?

Qualquer evento que comprometa a confidencialidade, integridade ou disponibilidade das informações.

### Exemplos de incidentes

• Computador infectado por vírus
• E-mail suspeito recebido ou respondido
• Perda ou roubo de equipamento
• Acesso não autorizado a sistemas
• Vazamento de dados
• Compartilhamento indevido de informações

### Como reportar

1. Identifique o incidente
2. Não tente resolver sozinho
3. Contate imediatamente o time de TI/Segurança
4. Preserve evidências
5. Documente o que aconteceu
6. Siga as orientações recebidas

**Lembre-se:** Reportar rapidamente minimiza os danos!

---

## Seção 8: Resumo e Compromisso

Você aprendeu sobre:

☑ Os pilares da segurança da informação
☑ Como criar e gerenciar senhas seguras
☑ Identificar e-mails de phishing
☑ Usar dispositivos de forma segura
☑ Proteger informações confidenciais
☑ Reportar incidentes de segurança

**Seu compromisso:**

A segurança da informação é responsabilidade de todos. Cada ação conta para proteger nossa empresa, nossos clientes e você mesmo.

**Parabéns por completar este treinamento!**
      `,
      "Liderança e Gestão de Equipes": `
## Seção 1: Fundamentos da Liderança

[Imagem: https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop]

### O que é Liderança?

Liderança é a capacidade de influenciar, inspirar e guiar pessoas em direção a objetivos comuns. Diferente da gestão, que foca em processos e controle, a liderança está relacionada a **visão, motivação e desenvolvimento de pessoas**.

### Líder vs. Chefe

| **Líder** | **Chefe** |
|-----------|-----------|
| Inspira | Ordena |
| Desenvolve pessoas | Cobra resultados |
| Assume responsabilidade | Busca culpados |
| Pergunta "nós" | Diz "eu" |
| Mostra o caminho | Aponta erros |

### Estilos de Liderança

**Liderança Autocrática** - Decisões centralizadas no líder
• Vantagem: Decisões rápidas
• Desvantagem: Baixo engajamento da equipe

**Liderança Democrática** - Decisões compartilhadas
• Vantagem: Maior comprometimento
• Desvantagem: Processo mais lento

**Liderança Liberal (Laissez-faire)** - Autonomia total para a equipe
• Vantagem: Criatividade e inovação
• Desvantagem: Pode haver falta de direção

**Liderança Situacional** - Adapta-se ao contexto
• Vantagem: Flexibilidade
• Requisito: Alto autoconhecimento

---

## Seção 2: Inteligência Emocional

[Imagem: https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&auto=format&fit=crop]

### Os 5 Pilares de Daniel Goleman

**1. Autoconhecimento**
Reconhecer suas próprias emoções e como elas afetam seu comportamento e decisões.

**2. Autocontrole**
Gerenciar suas emoções de forma construtiva, especialmente em situações de pressão.

**3. Motivação**
Manter-se focado e persistente mesmo diante de obstáculos.

**4. Empatia**
Compreender as emoções e perspectivas dos outros.

**5. Habilidades Sociais**
Construir relacionamentos positivos e influenciar pessoas.

### Exercícios práticos

☑ Faça pausas antes de reagir emocionalmente
☑ Pratique a escuta ativa
☑ Peça feedback regularmente
☑ Observe sua linguagem corporal
☑ Reconheça suas emoções sem julgamento

---

## Seção 3: Comunicação para Líderes

[Imagem: https://images.unsplash.com/photo-1552581234-26160f608093?w=800&auto=format&fit=crop]

### Comunicação Assertiva

A comunicação assertiva é direta, clara e respeitosa. Ela permite expressar opiniões e necessidades sem agredir ou ser passivo.

**Características:**
• Clareza na mensagem
• Respeito mútuo
• Foco na solução
• Linguagem não agressiva

### Escuta Ativa

• Mantenha contato visual
• Não interrompa
• Faça perguntas esclarecedoras
• Demonstre interesse genuíno
• Parafraseie para confirmar entendimento

### Feedback Eficaz

**Modelo SBI (Situação-Comportamento-Impacto):**

1. **Situação:** Descreva o contexto específico
2. **Comportamento:** Relate o que foi observado
3. **Impacto:** Explique as consequências

**Exemplo:**
"Na reunião de ontem (Situação), quando você interrompeu o cliente várias vezes (Comportamento), ele ficou visivelmente desconfortável e encerrou a conversa antes do previsto (Impacto)."

---

## Seção 4: Delegação Eficaz

[Imagem: https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=800&auto=format&fit=crop]

### Por que delegar?

• Desenvolve a equipe
• Libera tempo para atividades estratégicas
• Aumenta a produtividade
• Prepara sucessores
• Melhora o engajamento

### Os 6 passos da delegação

1. **Selecione a tarefa** - Identifique o que pode ser delegado
2. **Escolha a pessoa certa** - Considere habilidades e desenvolvimento
3. **Explique claramente** - Defina expectativas e prazos
4. **Dê autoridade** - Permita autonomia para decisões
5. **Acompanhe sem microgerenciar** - Estabeleça checkpoints
6. **Reconheça e dê feedback** - Valorize o resultado

### O que NÃO delegar

• Questões confidenciais ou estratégicas
• Feedback e avaliações de desempenho
• Gestão de crises
• Desenvolvimento da sua equipe direta
• Tarefas que você mesmo precisa aprender

---

## Seção 5: Gestão de Conflitos

[Imagem: https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&auto=format&fit=crop]

### Tipos de conflito

**Conflito de tarefa** - Discordância sobre o trabalho em si
• Geralmente produtivo se bem gerenciado

**Conflito de relacionamento** - Questões pessoais
• Prejudicial ao ambiente e resultados

**Conflito de processo** - Como as coisas devem ser feitas
• Pode ser construtivo com mediação adequada

### Abordagens para resolução

**Evitar** - Adiar ou ignorar (temporário)
**Acomodar** - Ceder para manter harmonia
**Competir** - Impor sua posição
**Colaborar** - Buscar solução ganha-ganha
**Comprometer** - Cada lado cede um pouco

### Passos para mediar conflitos

1. Ouça todas as partes separadamente
2. Identifique os interesses reais
3. Reúna as partes em ambiente neutro
4. Estabeleça regras de diálogo
5. Facilite a busca por soluções
6. Formalize acordos
7. Acompanhe a implementação

---

## Seção 6: Motivação de Equipes

[Imagem: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop]

### Teoria dos Dois Fatores (Herzberg)

**Fatores Higiênicos** (evitam insatisfação):
• Salário
• Condições de trabalho
• Políticas da empresa
• Relacionamento com colegas

**Fatores Motivacionais** (geram satisfação):
• Reconhecimento
• Responsabilidade
• Crescimento profissional
• Natureza do trabalho

### Estratégias de motivação

☑ **Reconheça publicamente** - Celebre conquistas
☑ **Dê autonomia** - Permita decisões
☑ **Estabeleça propósito** - Conecte ao significado maior
☑ **Ofereça desafios** - Tarefas que desenvolvam
☑ **Crie pertencimento** - Fortaleça o time
☑ **Seja exemplo** - Demonstre os valores

### Conversas de carreira

Realize periodicamente conversas sobre:
• Aspirações profissionais
• Pontos fortes e áreas de desenvolvimento
• Próximos passos na carreira
• Como você pode apoiar

---

## Seção 7: Desenvolvimento de Equipe

[Imagem: https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop]

### As fases de um time (Tuckman)

**Forming (Formação)**
• Membros se conhecendo
• Comportamentos cautelosos
• Dependência do líder

**Storming (Conflito)**
• Surgem divergências
• Disputa por posições
• Momento crítico para o líder

**Norming (Normatização)**
• Regras são estabelecidas
• Cooperação aumenta
• Papéis ficam claros

**Performing (Desempenho)**
• Alta produtividade
• Autonomia do time
• Foco em resultados

### Construindo times de alta performance

• Estabeleça metas claras e compartilhadas
• Defina papéis e responsabilidades
• Promova diversidade de pensamento
• Crie ambiente de segurança psicológica
• Celebre conquistas coletivas

---

## Seção 8: O Líder como Coach

[Imagem: https://images.unsplash.com/photo-1515169067868-5387ec356754?w=800&auto=format&fit=crop]

### Modelo GROW

**G - Goal (Meta)**
O que você quer alcançar?

**R - Reality (Realidade)**
Qual é a situação atual?

**O - Options (Opções)**
Quais são as alternativas?

**W - Will (Vontade)**
O que você vai fazer?

### Perguntas poderosas

• "O que é mais importante para você nesta situação?"
• "Se não houvesse limitações, o que você faria?"
• "O que você já tentou? O que funcionou?"
• "Qual seria o primeiro passo?"
• "Como posso apoiá-lo?"

### Desenvolvendo potenciais

• Identifique talentos e pontos fortes
• Delegue projetos desafiadores
• Ofereça mentoria e sponsorship
• Conecte pessoas a oportunidades
• Dê feedback frequente e construtivo

---

## Seção 9: Gestão de Performance

[Imagem: https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop]

### Ciclo de gestão de performance

1. **Planejamento** - Definir metas e expectativas
2. **Acompanhamento** - Reuniões regulares de progresso
3. **Avaliação** - Análise de resultados
4. **Desenvolvimento** - Planos de ação e crescimento

### Metas SMART

• **S**pecific (Específica)
• **M**easurable (Mensurável)
• **A**chievable (Alcançável)
• **R**elevant (Relevante)
• **T**ime-bound (Com prazo)

### One-on-Ones eficazes

**Frequência:** Semanal ou quinzenal

**Estrutura sugerida:**
• Atualizações do colaborador (10 min)
• Discussão de desafios (15 min)
• Feedback e coaching (10 min)
• Próximos passos (5 min)

---

## Seção 10: Reflexão Final

[Imagem: https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop]

### Sua jornada de liderança

Liderança é uma jornada contínua de aprendizado. Os melhores líderes:

☑ Buscam autoconhecimento constantemente
☑ Investem no desenvolvimento da equipe
☑ Comunicam-se com clareza e empatia
☑ Tomam decisões com coragem
☑ Mantêm-se humildes e abertos a feedback
☑ Celebram conquistas e aprendem com erros

### Compromisso de liderança

**Escolha 3 áreas para desenvolver:**
• Inteligência emocional
• Comunicação
• Delegação
• Gestão de conflitos
• Motivação de equipe
• Coaching
• Gestão de performance

**Parabéns por completar este treinamento de Liderança e Gestão de Equipes!**

Continue sua jornada de desenvolvimento e lembre-se: grandes líderes desenvolvem outros líderes.
      `,
      "Ética Profissional e Código de Conduta": `
## Seção 1: O que é Ética Profissional?

[Imagem: https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop]

A **ética profissional** é o conjunto de normas e valores que orientam o comportamento no ambiente de trabalho. Ela define o que é certo e errado nas relações profissionais, guiando nossas decisões e ações.

### Por que a ética importa?

• Constrói confiança e credibilidade
• Fortalece a reputação da empresa
• Cria um ambiente de trabalho saudável
• Evita problemas legais e financeiros
• Retém talentos e clientes

### Princípios fundamentais

**Integridade** - Agir de acordo com valores morais, mesmo quando ninguém está observando.

**Honestidade** - Ser verdadeiro em todas as comunicações e relacionamentos.

**Responsabilidade** - Assumir as consequências de suas ações e decisões.

**Respeito** - Tratar todos com dignidade, independente de cargo ou função.

**Justiça** - Ser imparcial e equitativo no tratamento das pessoas.

---

## Seção 2: Nosso Código de Conduta

[Imagem: https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop]

O Código de Conduta é o documento que formaliza as expectativas de comportamento ético na empresa. Ele deve ser conhecido e seguido por todos os colaboradores.

### Compromissos fundamentais

☑ Cumprir todas as leis e regulamentos aplicáveis
☑ Agir com integridade em todas as situações
☑ Proteger os ativos e informações da empresa
☑ Tratar colegas, clientes e parceiros com respeito
☑ Reportar violações ou suspeitas de má conduta
☑ Evitar conflitos de interesse

### Consequências do descumprimento

O não cumprimento do Código de Conduta pode resultar em:
• Advertência verbal ou escrita
• Suspensão
• Demissão por justa causa
• Responsabilização civil ou criminal

---

## Seção 3: Conflito de Interesses

[Imagem: https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop]

### O que é conflito de interesse?

Ocorre quando seus interesses pessoais podem interferir na sua capacidade de agir no melhor interesse da empresa.

### Exemplos comuns

• Contratar familiares para a empresa
• Ter participação societária em fornecedores
• Aceitar presentes de clientes ou fornecedores
• Usar informações privilegiadas para benefício próprio
• Trabalhar paralelamente para concorrentes

### Como evitar

1. **Identifique** - Reconheça situações potenciais
2. **Declare** - Informe seu gestor ou RH
3. **Afaste-se** - Não participe de decisões que envolvam o conflito
4. **Documente** - Registre formalmente a situação

**Na dúvida, sempre pergunte!** É melhor questionar antes do que se arrepender depois.

---

## Seção 4: Relacionamento com Colegas

[Imagem: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop]

### Respeito e colaboração

O ambiente de trabalho deve ser livre de:
• Discriminação de qualquer natureza
• Assédio moral ou sexual
• Bullying e intimidação
• Fofocas e comentários depreciativos

### Assédio moral

É toda conduta abusiva que atente contra a dignidade da pessoa, de forma repetitiva.

**Exemplos:**
• Humilhações públicas
• Isolamento do colaborador
• Atribuição de tarefas impossíveis
• Críticas constantes e injustificadas
• Ameaças veladas

### Assédio sexual

Qualquer conduta de natureza sexual não desejada que cause constrangimento.

**Exemplos:**
• Comentários sobre aparência física
• Piadas de cunho sexual
• Contato físico indesejado
• Propostas inapropriadas
• Chantagem para obter favores

**Importante:** Se você presenciar ou sofrer qualquer tipo de assédio, denuncie pelos canais apropriados.

---

## Seção 5: Uso de Recursos da Empresa

[Imagem: https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&auto=format&fit=crop]

### Recursos disponíveis

Os recursos da empresa devem ser usados exclusivamente para fins profissionais:
• Equipamentos (computadores, telefones, veículos)
• Materiais de escritório
• Sistemas e softwares
• Informações e dados

### Boas práticas

☑ Use os recursos com responsabilidade
☑ Proteja equipamentos contra danos
☑ Não instale softwares não autorizados
☑ Evite uso pessoal excessivo
☑ Reporte problemas ou defeitos
☑ Devolva equipamentos ao se desligar

### Internet e e-mail corporativo

• Não acesse conteúdos impróprios
• Não envie correntes ou spam
• Não compartilhe credenciais
• Lembre-se: as comunicações podem ser monitoradas

---

## Seção 6: Anticorrupção e Compliance

[Imagem: https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop]

### Lei Anticorrupção (12.846/2013)

A empresa e seus colaboradores devem cumprir a legislação anticorrupção, que proíbe:
• Prometer, oferecer ou dar vantagem indevida a agente público
• Financiar ou patrocinar práticas ilícitas
• Fraudar licitações ou contratos públicos

### Suborno e propina

**Nunca** ofereça, prometa ou aceite:
• Dinheiro ou equivalentes
• Presentes de valor significativo
• Viagens ou hospedagens
• Favores pessoais
• Qualquer benefício em troca de vantagens comerciais

### Presentes e hospitalidades

**Aceitáveis:**
• Brindes de valor simbólico (canetas, agendas)
• Refeições ocasionais de negócios
• Convites para eventos profissionais

**Não aceitáveis:**
• Presentes de valor elevado
• Viagens pagas por terceiros
• Dinheiro ou equivalentes
• Qualquer coisa que comprometa sua imparcialidade

---

## Seção 7: Canais de Denúncia

[Imagem: https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&auto=format&fit=crop]

### Por que denunciar?

• Proteger a empresa e os colegas
• Manter um ambiente ético
• Evitar problemas maiores
• Cumprir seu dever como colaborador

### Como denunciar

A empresa disponibiliza canais seguros e confidenciais:
• Canal de ética (telefone/e-mail/plataforma)
• Gestor direto ou RH
• Comitê de Ética

### Garantias do denunciante

☑ Confidencialidade da identidade
☑ Proteção contra retaliação
☑ Acompanhamento da investigação
☑ Feedback sobre a conclusão

### O que acontece após a denúncia?

1. Recebimento e registro
2. Análise preliminar
3. Investigação (se aplicável)
4. Deliberação
5. Aplicação de medidas
6. Comunicação ao denunciante

**Importante:** Denúncias de má-fé também são passíveis de punição.

---

## Seção 8: Situações do Dia a Dia

### Caso 1: O presente do fornecedor

*João recebeu um convite do fornecedor para um almoço de negócios, seguido de ingressos para um show de alto valor.*

**O que fazer?**
Aceitar o almoço de negócios é aceitável, pois faz parte do relacionamento comercial. Porém, os ingressos para o show devem ser recusados por representarem presente de valor significativo.

### Caso 2: Informação privilegiada

*Maria ouviu uma conversa sobre uma possível fusão da empresa. Seu marido trabalha no mercado financeiro.*

**O que fazer?**
Maria não deve compartilhar essa informação com ninguém, inclusive seu marido. O uso de informação privilegiada é crime e pode ter graves consequências.

### Caso 3: Comportamento do colega

*Pedro percebeu que seu colega está usando materiais da empresa para uso pessoal e levando para casa.*

**O que fazer?**
Pedro deve reportar a situação pelos canais apropriados. Não reportar pode torná-lo cúmplice da má conduta.

---

## Seção 9: Compromisso Ético

[Imagem: https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop]

### Reflexão final

A ética não é apenas seguir regras, mas fazer o que é certo, mesmo quando ninguém está olhando. Cada decisão que você toma reflete seus valores e impacta a cultura da empresa.

### Seu compromisso

☑ Li e compreendi o Código de Conduta
☑ Comprometo-me a agir com integridade
☑ Reportarei situações de violação
☑ Buscarei orientação em caso de dúvidas
☑ Serei exemplo de conduta ética

**Parabéns por completar este treinamento!**

Lembre-se: a ética é responsabilidade de todos. Sua conduta faz a diferença!
      `,
      "Gestão do Tempo e Produtividade": `
## Seção 1: Entendendo a Gestão do Tempo

[Imagem: https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop]

A **gestão do tempo** é a habilidade de planejar e controlar como você divide suas horas entre diferentes atividades. Quando bem executada, ela permite que você trabalhe de forma mais inteligente, não mais dura.

### Por que é importante?

• Reduz o estresse e a ansiedade
• Aumenta a produtividade e eficiência
• Melhora o equilíbrio vida-trabalho
• Permite alcançar metas mais rapidamente
• Libera tempo para o que realmente importa

### Os ladrões de tempo

**Interrupções frequentes** - Colegas, telefonemas, notificações
**Reuniões improdutivas** - Sem pauta ou objetivo claro
**E-mails excessivos** - Verificar constantemente a caixa de entrada
**Procrastinação** - Adiar tarefas importantes
**Falta de planejamento** - Começar o dia sem direção
**Perfeccionismo** - Gastar tempo demais em detalhes

---

## Seção 2: Matriz de Eisenhower

[Imagem: https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&auto=format&fit=crop]

A **Matriz de Eisenhower** é uma ferramenta para priorização baseada em urgência e importância.

### Os 4 quadrantes

**Quadrante 1: Urgente e Importante (FAZER)**
• Crises e emergências
• Prazos imediatos
• Problemas críticos
→ Faça imediatamente!

**Quadrante 2: Importante, não Urgente (AGENDAR)**
• Planejamento estratégico
• Desenvolvimento pessoal
• Prevenção de problemas
• Relacionamentos
→ Dedique tempo de qualidade!

**Quadrante 3: Urgente, não Importante (DELEGAR)**
• Interrupções
• Algumas reuniões
• Alguns e-mails
→ Delegue quando possível!

**Quadrante 4: Não Urgente, não Importante (ELIMINAR)**
• Redes sociais sem propósito
• Reuniões desnecessárias
• Atividades que não agregam
→ Elimine ou minimize!

### Dica de ouro
Invista mais tempo no **Quadrante 2**. Quanto mais você previne e planeja, menos emergências terá no Quadrante 1.

---

## Seção 3: Técnica Pomodoro

[Imagem: https://images.unsplash.com/photo-1513530534585-c7b1394c6d51?w=800&auto=format&fit=crop]

### O que é?

Criada por Francesco Cirillo, a técnica usa um timer para dividir o trabalho em intervalos focados, geralmente de 25 minutos.

### Como funciona

1. **Escolha uma tarefa** para trabalhar
2. **Configure o timer** para 25 minutos
3. **Trabalhe focado** até o timer tocar
4. **Faça uma pausa curta** de 5 minutos
5. **Após 4 pomodoros**, faça uma pausa longa de 15-30 minutos

### Benefícios

☑ Mantém o foco intenso
☑ Combate a procrastinação
☑ Reduz a fadiga mental
☑ Facilita a estimativa de tempo
☑ Cria senso de urgência positiva

### Dicas para aplicar

• Use aplicativos de timer ou um cronômetro simples
• Durante o pomodoro, nada de distrações
• Se surgir algo, anote e volte depois
• Ajuste o tempo conforme sua necessidade
• Respeite as pausas – elas são essenciais

---

## Seção 4: Time Blocking

[Imagem: https://images.unsplash.com/photo-1435527173128-983b87201f4d?w=800&auto=format&fit=crop]

### O que é Time Blocking?

É a prática de dividir seu dia em blocos de tempo dedicados a tarefas específicas. Em vez de uma lista de tarefas, você agenda quando cada coisa será feita.

### Como implementar

**Passo 1:** Liste todas as suas tarefas e responsabilidades

**Passo 2:** Estime o tempo necessário para cada uma

**Passo 3:** Agrupe tarefas similares

**Passo 4:** Aloque blocos no calendário

**Passo 5:** Respeite os blocos como compromissos

### Exemplo de dia com Time Blocking

• 08:00-09:00 - Planejamento e e-mails
• 09:00-11:00 - Trabalho focado em projetos
• 11:00-11:30 - Pausa e café
• 11:30-12:00 - Reuniões rápidas
• 12:00-13:00 - Almoço
• 13:00-15:00 - Reuniões e colaboração
• 15:00-16:30 - Trabalho focado
• 16:30-17:00 - Revisão e planejamento do próximo dia

### Importante

• Inclua buffers entre blocos
• Reserve tempo para imprevistos
• Bloqueie tempo para pausas
• Seja realista nas estimativas

---

## Seção 5: A Regra dos Dois Minutos

[Imagem: https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop]

### O conceito

Se uma tarefa pode ser feita em **menos de dois minutos**, faça imediatamente. Não adie, não anote, não agende – apenas faça.

### Por que funciona?

• O tempo para anotar e lembrar depois seria maior
• Evita acúmulo de pequenas pendências
• Mantém a mente livre para tarefas maiores
• Cria sensação de progresso

### Exemplos

**Faça agora (menos de 2 min):**
• Responder e-mail simples
• Arquivar documento
• Fazer ligação rápida
• Confirmar reunião

**Agende para depois (mais de 2 min):**
• Elaborar relatório
• Preparar apresentação
• Análise detalhada
• Reunião complexa

### Atenção

Não use a regra para evitar tarefas importantes. Se você está fazendo apenas "coisas de 2 minutos" o dia todo, algo está errado.

---

## Seção 6: Planejamento Semanal e Diário

[Imagem: https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=800&auto=format&fit=crop]

### Planejamento semanal

Dedique 30-60 minutos no início ou final da semana para:

1. **Revisar** a semana anterior
2. **Identificar** prioridades da semana
3. **Agendar** compromissos e blocos de trabalho
4. **Antecipar** possíveis obstáculos
5. **Definir** 3-5 resultados-chave

### Planejamento diário

Reserve 10-15 minutos, preferencialmente no dia anterior:

☑ Liste as tarefas do dia
☑ Identifique as 3 mais importantes (MIT)
☑ Estime o tempo de cada uma
☑ Bloqueie no calendário
☑ Revise compromissos

### As 3 MITs (Most Important Tasks)

Toda manhã, identifique as **3 tarefas mais importantes** do dia. Mesmo que você não complete mais nada, essas devem ser concluídas.

**Critérios para escolher:**
• Maior impacto nos resultados
• Maior urgência ou prazo
• Desbloqueiam outras atividades

---

## Seção 7: Gerenciando E-mails

[Imagem: https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=800&auto=format&fit=crop]

### O problema

• Profissionais recebem em média 120 e-mails por dia
• Verificar constantemente reduz a produtividade em 40%
• Leva em média 23 minutos para retomar o foco após interrupção

### Estratégias eficazes

**Defina horários específicos**
Verifique e-mails em horários determinados (ex: 9h, 13h, 17h)

**Use a regra 4D**
• **Delete** - Elimine o que não é relevante
• **Do** - Faça se levar menos de 2 minutos
• **Delegate** - Encaminhe para quem deve resolver
• **Defer** - Agende para depois se precisar de mais tempo

**Organize com pastas/labels**
• Ação necessária
• Aguardando resposta
• Referência
• Projetos específicos

### Boas práticas

• Desative notificações
• Escreva assuntos claros
• Seja objetivo no texto
• Use "responder a todos" com moderação
• Desinscreva-se de newsletters que não lê

---

## Seção 8: Reuniões Produtivas

[Imagem: https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop]

### Antes de agendar, pergunte

• Esta reunião é realmente necessária?
• Poderia ser um e-mail ou mensagem?
• Quem precisa participar?
• Qual o objetivo e resultado esperado?

### Preparando reuniões eficientes

1. **Defina objetivo claro** - O que queremos decidir/resolver?
2. **Crie pauta** - Tópicos com tempo estimado
3. **Limite participantes** - Apenas quem é essencial
4. **Defina duração** - Comece com 30 min, não 1 hora
5. **Envie materiais antes** - Para que todos venham preparados

### Durante a reunião

• Comece no horário
• Siga a pauta
• Documente decisões e ações
• Defina responsáveis e prazos
• Termine no horário (ou antes!)

### Depois da reunião

• Envie ata com ações definidas
• Acompanhe o cumprimento
• Avalie se a reunião foi produtiva

---

## Seção 9: Combatendo a Procrastinação

[Imagem: https://images.unsplash.com/photo-1493612276216-ee3925520721?w=800&auto=format&fit=crop]

### Por que procrastinamos?

• **Medo do fracasso** - E se eu não conseguir?
• **Perfeccionismo** - Se não for perfeito, não faço
• **Tarefa muito grande** - Não sei por onde começar
• **Falta de motivação** - Não vejo sentido
• **Cansaço ou estresse** - Sem energia para começar

### Estratégias para vencer

**Divida em partes pequenas**
Uma tarefa de 4 horas vira 8 tarefas de 30 minutos.

**Comece pelo mais difícil**
"Coma o sapo" logo cedo, quando tem mais energia.

**Use a regra dos 5 minutos**
Comprometa-se a trabalhar apenas 5 minutos. Geralmente, você continua.

**Elimine distrações**
Feche abas, silencie notificações, avise que está focado.

**Recompense-se**
Após completar tarefas difíceis, dê-se uma pequena recompensa.

---

## Seção 10: Criando Hábitos de Produtividade

[Imagem: https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=800&auto=format&fit=crop]

### O poder dos hábitos

Hábitos eliminam a necessidade de decidir. Quanto mais comportamentos produtivos se tornam automáticos, menos energia mental você gasta.

### Como criar novos hábitos

1. **Comece pequeno** - Um hábito de cada vez
2. **Conecte a hábitos existentes** - Depois de X, faço Y
3. **Torne fácil** - Remova barreiras
4. **Seja consistente** - Mesmo horário/contexto
5. **Acompanhe o progresso** - Marque no calendário

### Hábitos de pessoas produtivas

☑ Acordar no mesmo horário
☑ Planejar o dia na noite anterior
☑ Começar pelas tarefas importantes
☑ Fazer pausas regulares
☑ Exercitar-se regularmente
☑ Dormir o suficiente
☑ Revisar e refletir semanalmente

### Plano de ação pessoal

Escolha **uma técnica** deste treinamento para implementar:
• Matriz de Eisenhower
• Pomodoro
• Time Blocking
• Regra dos 2 minutos
• Planejamento diário
• Gerenciamento de e-mails
• Reuniões produtivas

Pratique por 21 dias e avalie os resultados.

**Parabéns por completar este treinamento de Gestão do Tempo e Produtividade!**

Lembre-se: produtividade não é fazer mais coisas, é fazer as coisas certas.
      `
    };

    // Retorna conteúdo específico ou genérico
    if (contents[titulo]) {
      return contents[titulo];
    }

    // Conteúdo genérico para treinamentos não mapeados
    return `
## Seção 1: Introdução

[Imagem: https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop]

Bem-vindo ao treinamento **${titulo}**. Este módulo foi desenvolvido para fornecer conhecimentos essenciais sobre o tema, com aplicação prática no seu dia a dia profissional.

### Objetivos de aprendizagem

Ao final deste treinamento, você será capaz de:
• Compreender os conceitos fundamentais
• Aplicar as melhores práticas
• Identificar situações relevantes no trabalho
• Tomar decisões mais informadas

---

## Seção 2: Conceitos Fundamentais

[Imagem: https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop]

Nesta seção, exploraremos os principais conceitos que formam a base do nosso aprendizado.

### Definições importantes

Os fundamentos que veremos a seguir são essenciais para o entendimento completo do tema:

• **Conceito 1** - Explicação detalhada do primeiro conceito
• **Conceito 2** - Explicação detalhada do segundo conceito
• **Conceito 3** - Explicação detalhada do terceiro conceito

### Por que isso importa?

Compreender esses conceitos permite:
☑ Melhor tomada de decisão
☑ Comunicação mais eficaz
☑ Resultados superiores
☑ Crescimento profissional

---

## Seção 3: Aplicação Prática

[Imagem: https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&auto=format&fit=crop]

Agora vamos ver como aplicar o que aprendemos na prática do dia a dia.

### Situações comuns

1. Primeiro cenário de aplicação
2. Segundo cenário de aplicação
3. Terceiro cenário de aplicação

### Dicas práticas

• Sempre avalie o contexto antes de agir
• Busque orientação quando necessário
• Documente suas decisões
• Aprenda com cada experiência

---

## Seção 4: Conclusão

[Imagem: https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop]

### Resumo do aprendizado

☑ Compreendemos os conceitos fundamentais
☑ Vimos aplicações práticas
☑ Identificamos melhores práticas
☑ Estamos preparados para aplicar no trabalho

**Parabéns por completar este treinamento!**

Continue aplicando o que aprendeu e busque sempre aprimorar seus conhecimentos.
    `;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Carregando treinamento...</p>
        </div>
      </div>
    );
  }

  if (!training) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Card className="p-6">
          <p className="text-muted-foreground">Treinamento não encontrado.</p>
        </Card>
      </div>
    );
  }

  // Usa conteúdo do banco de dados primeiro, depois fallback para hardcoded
  const content = training.conteudo_completo || getTrainingContent(training.titulo);
  const progressPercent = Math.min(Math.round((timer.activeTime / (targetDuration * 60)) * 100), 100);
  const minimumTimeReachedPercent = Math.min(Math.round((timer.activeTime / (minimumTimeRequired * 60)) * 100), 100);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header com controles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">{training.titulo}</h1>
        </div>

        {/* Cronômetro: exibido apenas na tela de treinamento, não na avaliação */}
        {!examMode && (
          <div className="flex items-center gap-3">
            <Badge
              variant={timer.isPageVisible ? "default" : "secondary"}
              className="gap-2"
            >
              {timer.isPageVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {timer.isPageVisible ? "Ativo" : "Pausado"}
            </Badge>

            <Badge variant="outline" className="gap-2 text-sm">
              <Clock className="h-3 w-3" />
              {timer.formattedActiveTime} / {timer.formattedTargetTime}
            </Badge>
          </div>
        )}
      </div>

      {/* Modo Avaliação: mostra somente o quiz */}
      {examMode && id && hasQuiz && !quizApproved ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Avaliação em andamento
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Permaneça nesta tela até finalizar. Sair, trocar de aba ou fechar o navegador irá reiniciar a avaliação.
            </p>
          </CardHeader>
          <CardContent>
            <QuizViewer
              key={examKey}
              treinamentoId={id}
              notaMinima={7}
              tempoEstudoSegundos={timer.activeTime}
              onTentativaFinalizada={handleExamFinalizada}
              onAprovado={() => {
                setQuizApproved(true);
                if (examStorageKey) localStorage.removeItem(examStorageKey);
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Card de progresso do tempo */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Tempo de Estudo
                </CardTitle>
                {!timer.isPageVisible && (
                  <Badge variant="destructive" className="gap-1">
                    <Pause className="h-3 w-3" />
                    Timer pausado - volte para esta aba
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso do tempo</span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    Tempo mínimo obrigatório (50% = {minimumTimeRequired} min)
                    {canComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </span>
                  <span>{minimumTimeReachedPercent}%</span>
                </div>
                <Progress
                  value={minimumTimeReachedPercent}
                  className={`h-2 ${canComplete ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}`}
                />
              </div>

              <div className={`p-3 rounded-lg text-sm ${
                canComplete
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}>
                {canComplete ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Você atingiu o tempo mínimo! Pode concluir o treinamento quando quiser.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      Permaneça pelo menos {minimumTimeRequired} minutos para poder concluir.
                      Faltam {Math.max(0, Math.ceil((minimumTimeRequired * 60 - timer.activeTime) / 60))} minutos.
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                ⚠️ Se você fechar esta página, o tempo será reiniciado.
                Alternar entre abas apenas pausa o contador.
              </p>
            </CardContent>
          </Card>

          {/* Conteúdo do treinamento */}
          <Card>
            <CardContent className="p-6 md:p-8">
              <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
                {renderFormattedContent(content)}
              </div>
            </CardContent>
          </Card>

          {/* Iniciar Avaliação (após tempo mínimo) */}
          {id && hasQuiz && !quizApproved && canComplete && (
            <Card className="sticky bottom-4 mb-4">
              <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Você atingiu o tempo mínimo. Quando iniciar a avaliação, o conteúdo será ocultado.
                </div>
                <Button size="lg" className="gap-2 w-full md:w-auto" onClick={() => setShowExamWarning(true)}>
                  <Award className="h-5 w-5" />
                  Iniciar Avaliação
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Botão de conclusão - sem quiz ou já aprovado */}
          {(!hasQuiz || quizApproved) && (
            <Card className="sticky bottom-4">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    {canComplete ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        ✓ Pronto para concluir!
                      </span>
                    ) : (
                      <span>
                        Complete pelo menos {minimumTimeRequired} minutos de estudo para concluir.
                      </span>
                    )}
                  </div>
                  <Button
                    size="lg"
                    onClick={handleComplete}
                    disabled={!canComplete}
                    className="gap-2 w-full md:w-auto"
                  >
                    <Award className="h-5 w-5" />
                    Concluir Treinamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {hasQuiz && !quizApproved && !canComplete && (
            <Card className="sticky bottom-4">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                Complete pelo menos {minimumTimeRequired} minutos de estudo para liberar a avaliação.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Diálogo de aviso antes de iniciar a avaliação */}
      <Dialog open={showExamWarning} onOpenChange={setShowExamWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Atenção antes de iniciar
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">
                Ao iniciar a avaliação, o conteúdo do treinamento será ocultado e você não poderá voltar a estudá-lo.
              </span>
              <span className="block">
                Você deve permanecer nesta tela até finalizar. Se trocar de aba, minimizar, fechar o navegador ou sair do sistema, a avaliação será reiniciada do zero.
              </span>
              <span className="block font-medium text-foreground">
                Deseja iniciar agora?
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExamWarning(false)}>
              Cancelar
            </Button>
            <Button onClick={startExam} className="gap-2">
              <Award className="h-4 w-4" />
              Iniciar Avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Diálogo de Avaliação */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Avalie o Treinamento
            </DialogTitle>
            <DialogDescription>
              Sua avaliação nos ajuda a melhorar nossos treinamentos. Como você classificaria esta experiência?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Estrelas de avaliação */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRating(star)}
                    onMouseEnter={() => setRatingHover(star)}
                    onMouseLeave={() => setRatingHover(0)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`h-10 w-10 transition-colors ${
                        star <= (ratingHover || selectedRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedRating === 0 && "Selecione uma nota"}
                {selectedRating === 1 && "Muito ruim"}
                {selectedRating === 2 && "Ruim"}
                {selectedRating === 3 && "Regular"}
                {selectedRating === 4 && "Bom"}
                {selectedRating === 5 && "Excelente"}
              </span>
            </div>

            {/* Comentário opcional */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comentário (opcional)
              </label>
              <Textarea
                placeholder="Conte-nos mais sobre sua experiência..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRatingDialog(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitRating}
              disabled={selectedRating === 0 || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                "Concluindo..."
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Concluir e Avaliar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resumo da avaliação */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Resumo da sua avaliação
            </DialogTitle>
            <DialogDescription>
              Veja como foi sua jornada de estudo e avaliação neste treinamento.
            </DialogDescription>
          </DialogHeader>
          {examSummary && (
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Tentativas</p><p className="text-2xl font-bold">{examSummary.tentativas}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Última nota</p><p className="text-2xl font-bold">{examSummary.ultimaNota.toFixed(1)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Reinícios</p><p className="text-2xl font-bold">{examSummary.reinicios}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Saídas da tela</p><p className="text-2xl font-bold">{examSummary.violacoes}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Pausas no estudo</p><p className="text-2xl font-bold">{examSummary.pausas}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Tempo de estudo</p><p className="text-2xl font-bold">{examSummary.tempoEstudoMin} min</p></div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowSummary(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Função para renderizar conteúdo formatado
function renderFormattedContent(text: string) {
  if (!text) return null;

  const sections = text.split(/(?=## Seção \d+:)/).filter(Boolean);
  
  if (sections.length === 0) {
    return renderTextSection(text);
  }

  return (
    <div className="space-y-8">
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="space-y-4">
          {renderTextSection(section)}
        </div>
      ))}
    </div>
  );
}

function renderTextSection(text: string) {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let currentList: string[] = [];
  let currentCheckList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  // Alinhamento definido no editor (negrito/itálico/cor visual do editor não
  // sobrevivem ao salvar, mas o alinhamento precisa — senão "justificado"
  // fica só cosmético dentro do editor e nunca aparece pra quem estuda.
  let currentAlign: "center" | "right" | "justify" | null = null;

  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 ml-4">
            {currentList.map((item, i) => (
              <li key={i} className="text-base leading-relaxed">{item}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 ml-4">
            {currentList.map((item, i) => (
              <li key={i} className="text-base leading-relaxed">{item}</li>
            ))}
          </ul>
        );
      }
      currentList = [];
      listType = null;
    }
    if (currentCheckList.length > 0) {
      elements.push(
        <div key={`check-${elements.length}`} className="space-y-2 ml-4">
          {currentCheckList.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-base">{item}</span>
            </div>
          ))}
        </div>
      );
      currentCheckList = [];
    }
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmedLine = line.trim();

    if (trimmedLine === '' || trimmedLine === '---') {
      flushList();
      if (trimmedLine === '---') {
        elements.push(<hr key={`hr-${index}`} className="my-6 border-border" />);
      }
      index++;
      continue;
    }

    // Marcadores de alinhamento (vindos do editor moderno)
    const alignStartMatch = trimmedLine.match(/^\[\[align:(center|right|justify)\]\]$/);
    if (alignStartMatch) {
      flushList();
      currentAlign = alignStartMatch[1] as "center" | "right" | "justify";
      index++;
      continue;
    }
    if (trimmedLine === '[[/align]]') {
      flushList();
      currentAlign = null;
      index++;
      continue;
    }

    // Seção/Heading ##
    if (trimmedLine.startsWith('## ')) {
      flushList();
      const headingText = trimmedLine.replace(/^## /, '').replace(/Seção \d+:\s*/, '');
      elements.push(
        <h2 key={`h2-${index}`} className="text-xl font-bold text-primary mt-8 mb-4">
          {headingText}
        </h2>
      );
      index++;
      continue;
    }

    // Subheading ###
    if (trimmedLine.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index}`} className="text-lg font-semibold mt-6 mb-3">
          {trimmedLine.replace(/^### /, '')}
        </h3>
      );
      index++;
      continue;
    }

    // Imagem [Imagem: URL]
    if (trimmedLine.startsWith('[Imagem:')) {
      flushList();
      const urlMatch = trimmedLine.match(/\[Imagem:\s*(.+?)\]/);
      if (urlMatch) {
        elements.push(
          <div key={`img-${index}`} className="my-6 rounded-lg overflow-hidden">
            <img 
              src={urlMatch[1]} 
              alt="Conteúdo do treinamento"
              className="w-full h-auto max-h-[400px] object-cover rounded-lg shadow-md"
              loading="lazy"
            />
          </div>
        );
      }
      index++;
      continue;
    }

    // Vídeo [Vídeo: URL]
    if (trimmedLine.startsWith('[Vídeo:') || trimmedLine.startsWith('[Video:')) {
      flushList();
      const urlMatch = trimmedLine.match(/\[V[íi]deo:\s*(.+?)\]/);
      if (urlMatch) {
        const videoInfo = getVideoInfo(urlMatch[1]);
        if (videoInfo.embedUrl) {
          elements.push(
            <div key={`video-${index}`} className="my-6 rounded-lg overflow-hidden aspect-video shadow-md">
              <iframe
                src={videoInfo.embedUrl}
                title="Vídeo do treinamento"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          );
        }
      }
      index++;
      continue;
    }

    // Checklist ☑
    if (trimmedLine.startsWith('☑')) {
      flushList();
      currentCheckList.push(trimmedLine.replace(/^☑\s*/, ''));
      index++;
      continue;
    }

    // Lista numerada
    if (/^\d+\.\s/.test(trimmedLine)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      currentList.push(trimmedLine.replace(/^\d+\.\s*/, ''));
      index++;
      continue;
    }

    // Lista com marcador
    if (trimmedLine.startsWith('•') || trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      currentList.push(trimmedLine.replace(/^[•\-\*]\s*/, ''));
      index++;
      continue;
    }

    // Tabela markdown
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      flushList();
      // Coletar todas as linhas da tabela
      const tableLines: string[] = [trimmedLine];
      let nextIdx = index + 1;
      while (nextIdx < lines.length && lines[nextIdx].trim().startsWith('|') && lines[nextIdx].trim().endsWith('|')) {
        tableLines.push(lines[nextIdx].trim());
        nextIdx++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (row: string) => row.split('|').filter(Boolean).map(c => c.trim());
        const headers = parseRow(tableLines[0]);
        const isSeparator = (row: string) => /^\|[\s\-:|]+\|$/.test(row);
        const dataStart = isSeparator(tableLines[1]) ? 2 : 1;
        const dataRows = tableLines.slice(dataStart).map(parseRow);
        
        elements.push(
          <div key={`table-${index}`} className="overflow-x-auto my-4">
            <table className="w-full border-collapse border border-border rounded-lg text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {headers.map((h, hi) => (
                    <th key={hi} className="border border-border px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-border px-3 py-2">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      // Pula direto pra depois da última linha da tabela já consumida —
      // sem isso, o loop principal reprocessava cada linha da tabela de
      // novo como início de uma nova tabela, duplicando o conteúdo.
      index = nextIdx;
      continue;
    }

    // Texto em negrito **texto**
    flushList();
    let processedText = trimmedLine
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

    elements.push(
      <p
        key={`p-${index}`}
        className={`text-base leading-relaxed mb-3${currentAlign ? ` text-${currentAlign}` : ""}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedText) }}
      />
    );
    index++;
  }

  flushList();
  return <>{elements}</>;
}
