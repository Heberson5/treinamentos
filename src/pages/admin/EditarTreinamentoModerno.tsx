import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTraining, Training } from "@/contexts/training-context";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import {
  ModernTrainingEditor,
  TrainingData,
  TrainingSection,
  ContentBlock,
} from "@/components/training/modern-training-editor";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuizEditor } from "@/components/training/quiz-editor";

interface TrainingDB {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  nivel: string | null;
  duracao_minutos: number | null;
  obrigatorio: boolean | null;
  publicado: boolean | null;
  empresa_id: string | null;
  departamento_id: string | null;
  instrutor_id: string | null;
  thumbnail_url: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  conteudo_html: string | null;
}

// Função para converter texto markdown-like em seções
function parseTextToSections(texto: string): TrainingSection[] {
  if (!texto || texto.trim() === "") {
    return [
      {
        id: `section-${Date.now()}`,
        title: "Conteúdo Principal",
        blocks: [
          {
            id: `block-${Date.now()}`,
            type: "text",
            content: "",
            align: "left",
          },
        ],
      },
    ];
  }

  const sections: TrainingSection[] = [];
  const sectionParts = texto.split(/\n---\n/);

  sectionParts.forEach((part, sectionIndex) => {
    const lines = part.trim().split("\n");
    let sectionTitle = `Seção ${sectionIndex + 1}`;
    const blocks: ContentBlock[] = [];
    let currentTextContent = "";

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Detectar título da seção (## Título)
      if (trimmedLine.startsWith("## ")) {
        if (currentTextContent.trim()) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "text",
            content: currentTextContent.trim(),
            align: "left",
          });
          currentTextContent = "";
        }
        sectionTitle = trimmedLine.replace(/^## /, "");
        return;
      }

      // Detectar títulos (# ## ###)
      if (trimmedLine.startsWith("# ")) {
        if (currentTextContent.trim()) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "text",
            content: currentTextContent.trim(),
            align: "left",
          });
          currentTextContent = "";
        }
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "heading",
          level: 1,
          content: trimmedLine.replace(/^# /, ""),
          align: "left",
        });
        return;
      }

      if (trimmedLine.startsWith("### ")) {
        if (currentTextContent.trim()) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "text",
            content: currentTextContent.trim(),
            align: "left",
          });
          currentTextContent = "";
        }
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "heading",
          level: 3,
          content: trimmedLine.replace(/^### /, ""),
          align: "left",
        });
        return;
      }

      // Detectar imagem
      if (trimmedLine.startsWith("[Imagem:")) {
        if (currentTextContent.trim()) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "text",
            content: currentTextContent.trim(),
            align: "left",
          });
          currentTextContent = "";
        }
        const url = trimmedLine.replace(/^\[Imagem: /, "").replace(/\]$/, "");
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "image",
          content: "",
          mediaUrl: url,
          align: "center",
        });
        return;
      }

      // Detectar vídeo
      if (trimmedLine.startsWith("[Vídeo:")) {
        if (currentTextContent.trim()) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "text",
            content: currentTextContent.trim(),
            align: "left",
          });
          currentTextContent = "";
        }
        const url = trimmedLine.replace(/^\[Vídeo: /, "").replace(/\]$/, "");
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "video",
          content: "",
          mediaUrl: url,
          align: "center",
        });
        return;
      }

      // Detectar divisor
      if (trimmedLine === "---") {
        if (currentTextContent.trim()) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "text",
            content: currentTextContent.trim(),
            align: "left",
          });
          currentTextContent = "";
        }
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "divider",
          content: "",
        });
        return;
      }

      // Texto normal
      currentTextContent += (currentTextContent ? "\n" : "") + line;
    });

    // Adicionar texto restante
    if (currentTextContent.trim()) {
      blocks.push({
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "text",
        content: currentTextContent.trim(),
        align: "left",
      });
    }

    // Se não houver blocos, adicionar um vazio
    if (blocks.length === 0) {
      blocks.push({
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "text",
        content: "",
        align: "left",
      });
    }

    sections.push({
      id: `section-${Date.now()}-${sectionIndex}`,
      title: sectionTitle,
      blocks,
    });
  });

  return sections.length > 0 ? sections : [
    {
      id: `section-${Date.now()}`,
      title: "Conteúdo Principal",
      blocks: [
        {
          id: `block-${Date.now()}`,
          type: "text",
          content: "",
          align: "left",
        },
      ],
    },
  ];
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "00:30";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export default function EditarTreinamentoModerno() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTrainingById, updateTraining, createTraining } = useTraining();
  const { toast } = useToast();
  const { user, verificarRole } = useAuth();
  const [training, setTraining] = useState<Training | null>(null);
  const [dbTraining, setDbTraining] = useState<TrainingDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFromDatabase, setIsFromDatabase] = useState(false);

  useEffect(() => {
    const loadTraining = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      // Primeiro, tentar buscar do contexto local (IDs numéricos).
      // Importante: usar um regex de "é inteiro" em vez de parseInt()+isNaN —
      // parseInt() lê só os dígitos do início da string e ignora o resto, então
      // um UUID do banco como "3fcacb8b-..." virava erroneamente o id numérico
      // 3, abrindo o treinamento legado errado em vez do real.
      if (/^\d+$/.test(id)) {
        const numericId = parseInt(id, 10);
        const found = getTrainingById(numericId);
        if (found) {
          setTraining(found);
          setIsFromDatabase(false);
          setLoading(false);
          return;
        }
      }

      // Se não encontrou no contexto, buscar do Supabase (UUID)
      try {
        const { data, error } = await supabase
          .from("treinamentos")
          .select("*, conteudo_html")
          .eq("id", id)
          .single();

        if (error) {
          console.error("Erro ao buscar treinamento:", error);
          toast({
            title: "Treinamento não encontrado",
            description: "O treinamento solicitado não foi encontrado.",
            variant: "destructive",
          });
          navigate("/admin/treinamentos");
          return;
        }

        if (data) {
          setDbTraining(data);
          setIsFromDatabase(true);
        } else {
          toast({
            title: "Treinamento não encontrado",
            description: "O treinamento solicitado não foi encontrado.",
            variant: "destructive",
          });
          navigate("/admin/treinamentos");
        }
      } catch (error) {
        console.error("Erro:", error);
        toast({
          title: "Erro",
          description: "Ocorreu um erro ao carregar o treinamento.",
          variant: "destructive",
        });
        navigate("/admin/treinamentos");
      } finally {
        setLoading(false);
      }
    };

    loadTraining();
  }, [id, getTrainingById, navigate, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!training && !dbTraining) {
    return null;
  }

  // Dados iniciais baseados na fonte (contexto ou banco)
  // Usa conteudo_html se disponível, caso contrário usa descricao
  const initialData: Partial<TrainingData> = isFromDatabase && dbTraining
    ? {
        titulo: dbTraining.titulo,
        subtitulo: "",
        descricao: dbTraining.descricao || "",
        categoria: dbTraining.categoria || "Geral",
        nivel: dbTraining.nivel || "basico",
        duracao: formatDuration(dbTraining.duracao_minutos),
        status: dbTraining.publicado ? "ativo" : "rascunho",
        instrutor: "",
        instrutor_id: dbTraining.instrutor_id || "",
        departamento: "",
        departamento_id: dbTraining.departamento_id || "",
        empresa_id: dbTraining.empresa_id || "",
        capa: dbTraining.thumbnail_url || "",
        sections: parseTextToSections(dbTraining.conteudo_html || dbTraining.descricao || ""),
      }
    : training
    ? {
        titulo: training.titulo,
        subtitulo: training.subtitulo || "",
        descricao: training.descricao,
        categoria: training.categoria,
        duracao: training.duracao,
        status: training.status,
        instrutor: training.instrutor,
        departamento: training.departamento || "",
        capa: training.capa,
        sections: parseTextToSections(training.texto || ""),
      }
    : {};

  const handleSave = async (data: TrainingData) => {
    // Validações obrigatórias
    if (!data.titulo.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Preencha o título do treinamento.",
        variant: "destructive",
      });
      return;
    }

    if (!data.categoria || data.categoria.trim() === "") {
      toast({
        title: "Campo obrigatório",
        description: "Selecione uma categoria para o treinamento.",
        variant: "destructive",
      });
      return;
    }

    // Departamento é opcional - pode não haver departamentos cadastrados

    if (!data.duracao || data.duracao.trim() === "") {
      toast({
        title: "Campo obrigatório",
        description: "Informe a duração estimada do treinamento.",
        variant: "destructive",
      });
      return;
    }

    // Converter seções em texto consolidado
    const textoConsolidado = data.sections
      .map((section) => {
        const sectionContent = section.blocks
          .map((block) => {
            switch (block.type) {
              case "heading":
                return `${"#".repeat(block.level || 2)} ${block.content}`;
              case "text":
              case "quote":
                return block.content;
              case "image":
                return block.mediaUrl ? `[Imagem: ${block.caption || block.mediaUrl}]` : "";
              case "video":
                return block.mediaUrl ? `[Vídeo: ${block.caption || block.mediaUrl}]` : "";
              case "list":
                return (block.listItems || []).map((item) => `• ${item}`).join("\n");
              case "checklist":
                return (block.checkItems || [])
                  .map((item) => `${item.checked ? "☑" : "☐"} ${item.text}`)
                  .join("\n");
              case "divider":
                return "---";
              default:
                return "";
            }
          })
          .filter(Boolean)
          .join("\n\n");

        return `## ${section.title}\n\n${sectionContent}`;
      })
      .join("\n\n---\n\n");

    // Extrair primeira imagem como capa se não tiver
    let capa = data.capa;
    if (!capa) {
      for (const section of data.sections) {
        const imageBlock = section.blocks.find((b) => b.type === "image" && b.mediaUrl);
        if (imageBlock?.mediaUrl) {
          capa = imageBlock.mediaUrl;
          break;
        }
      }
    }

    // Se é do banco de dados, salvar no Supabase
    if (isFromDatabase && dbTraining) {
      // Converter duração para minutos
      let duracaoMinutos = 30;
      // Handle 00:00 format
      const timeMatch = data.duracao.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        duracaoMinutos = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      } else {
        const duracaoMatch = data.duracao.match(/(\d+)h?\s*(\d*)min?/);
        if (duracaoMatch) {
          const hours = parseInt(duracaoMatch[1]) || 0;
          const mins = parseInt(duracaoMatch[2]) || 0;
          if (data.duracao.includes("h")) {
            duracaoMinutos = hours * 60 + mins;
          } else {
            duracaoMinutos = hours || mins;
          }
        }
      }

      // Validar UUIDs - valores como "Todos" ou nomes não são UUIDs válidos
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeUuid = (val: string | undefined | null) => val && uuidRegex.test(val) ? val : null;

      // Master é quem mantém os modelos globais — deve editar o modelo em si,
      // não criar uma cópia. Só usuários de empresa (sem permissão de editar
      // o modelo compartilhado) recebem uma cópia própria ao salvar.
      const isGlobalModel = !dbTraining.empresa_id && !verificarRole("master");

      if (isGlobalModel) {
        // Criar uma cópia se for um modelo padrão (empresa_id IS NULL)
        const { error } = await supabase
          .from("treinamentos")
          .insert({
            titulo: data.titulo,
            descricao: data.descricao || textoConsolidado.slice(0, 500),
            conteudo_html: textoConsolidado,
            categoria: data.categoria,
            duracao_minutos: duracaoMinutos,
            publicado: data.status === "ativo",
            thumbnail_url: capa || null,
            empresa_id: user?.empresa_id,
            departamento_id: safeUuid(data.departamento_id),
            instrutor_id: safeUuid(data.instrutor_id),
            nivel: data.nivel || null,
          });

        if (error) {
          console.error("Erro ao criar cópia:", error);
          toast({
            title: "Erro",
            description: "Não foi possível criar uma cópia do modelo.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Modelo padrão mantido",
          description: "O modelo original foi mantido e uma cópia foi criada para sua empresa.",
        });
      } else {
        const { error } = await supabase
          .from("treinamentos")
          .update({
            titulo: data.titulo,
            descricao: data.descricao || textoConsolidado.slice(0, 500),
            conteudo_html: textoConsolidado,
            categoria: data.categoria,
            duracao_minutos: duracaoMinutos,
            publicado: data.status === "ativo",
            thumbnail_url: capa || null,
            empresa_id: safeUuid(data.empresa_id) || dbTraining.empresa_id,
            departamento_id: safeUuid(data.departamento_id),
            instrutor_id: safeUuid(data.instrutor_id),
            nivel: data.nivel || null,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", dbTraining.id);

        if (error) {
          console.error("Erro ao atualizar:", error);
          toast({
            title: "Erro",
            description: "Não foi possível salvar as alterações.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Treinamento atualizado",
          description: "As alterações foram salvas com sucesso.",
        });
      }
    } else if (training) {
      // Extrair primeiro vídeo
      let videoUrl = "";
      for (const section of data.sections) {
        const videoBlock = section.blocks.find((b) => b.type === "video" && b.mediaUrl);
        if (videoBlock?.mediaUrl) {
          videoUrl = videoBlock.mediaUrl;
          break;
        }
      }

      updateTraining(training.id, {
        titulo: data.titulo,
        subtitulo: data.subtitulo,
        descricao: data.descricao || textoConsolidado.slice(0, 200) + "...",
        texto: textoConsolidado,
        videoUrl,
        categoria: data.categoria,
        duracao: data.duracao,
        status: data.status,
        instrutor: data.instrutor,
        departamento: data.departamento,
        capa,
      });

      toast({
        title: "Treinamento atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    }

    navigate("/admin/treinamentos");
  };

  const handleCancel = () => {
    navigate("/admin/treinamentos");
  };

  const handleQuizSettingsChange = async (settings: { avaliacao_obrigatoria: boolean; nota_minima: number }) => {
    if (dbTraining) {
      await supabase.from("treinamentos").update({
        avaliacao_obrigatoria: settings.avaliacao_obrigatoria,
        nota_minima: settings.nota_minima
      }).eq("id", dbTraining.id);
    }
  };

  return (
    <Tabs defaultValue="conteudo" className="space-y-4">
      <TabsList>
        <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
        <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
      </TabsList>
      <TabsContent value="conteudo">
        <ModernTrainingEditor
          initialData={initialData}
          onSave={handleSave}
          onCancel={handleCancel}
          isEditing
        />
      </TabsContent>
      <TabsContent value="avaliacao">
        {dbTraining ? (
          <QuizEditor
            treinamentoId={dbTraining.id}
            avaliacaoObrigatoria={false}
            notaMinima={7}
            conteudoTreinamento={dbTraining.conteudo_html || ""}
            onSettingsChange={handleQuizSettingsChange}
          />
        ) : id ? (
          <QuizEditor
            treinamentoId={id}
            conteudoTreinamento={training?.texto || ""}
            onSettingsChange={() => {}}
          />
        ) : (
          <p className="text-muted-foreground text-center py-8">Salve o treinamento primeiro para adicionar avaliações.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
