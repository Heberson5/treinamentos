import { useNavigate } from "react-router-dom";
import { useTraining } from "@/contexts/training-context";
import { useDepartments } from "@/contexts/department-context";
import { useToast } from "@/hooks/use-toast";
import { usePlans } from "@/contexts/plans-context";
import {
  ModernTrainingEditor,
  TrainingData,
} from "@/components/training/modern-training-editor";

export default function NovoTreinamentoModerno() {
  const navigate = useNavigate();
  const { trainings, createTraining } = useTraining();
  const { departments } = useDepartments();
  const { toast } = useToast();
  const { planos, getLimiteRecurso } = usePlans();

  // Plano do portal para cálculo de limite de treinamentos
  const planoPortalId = import.meta.env.VITE_PLANO_PORTAL_ID || "premium";
  const planoPortal =
    planos.find((p) => p.id === planoPortalId) ||
    planos.find((p) => (p as any).popular) ||
    planos[0];

  const limiteTreinamentosPlano = planoPortal
    ? getLimiteRecurso(planoPortal.id, "treinamentos")
    : undefined;

  const handleSave = (data: TrainingData) => {
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

    if (!data.departamento || data.departamento.trim() === "") {
      toast({
        title: "Campo obrigatório",
        description: "Selecione um departamento para o treinamento.",
        variant: "destructive",
      });
      return;
    }

    if (!data.duracao || data.duracao.trim() === "") {
      toast({
        title: "Campo obrigatório",
        description: "Informe a duração estimada do treinamento.",
        variant: "destructive",
      });
      return;
    }

    // Validação de limite de treinamentos
    const statusContaParaLimite = data.status === "ativo" || data.status === "inativo";

    if (statusContaParaLimite && typeof limiteTreinamentosPlano === "number") {
      const cadastrados = trainings.filter(
        (t) => t.status === "ativo" || t.status === "inativo"
      ).length;

      if (cadastrados + 1 > limiteTreinamentosPlano) {
        toast({
          title: "Limite de treinamentos atingido",
          description: `O plano ${planoPortal?.nome ?? ""} permite até ${limiteTreinamentosPlano} treinamentos cadastrados.`,
          variant: "destructive",
        });
        return;
      }
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
                return block.align && block.align !== "left"
                  ? `[[align:${block.align}]]\n${block.content}\n[[/align]]`
                  : block.content;
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

    // Extrair primeiro vídeo
    let videoUrl = "";
    for (const section of data.sections) {
      const videoBlock = section.blocks.find((b) => b.type === "video" && b.mediaUrl);
      if (videoBlock?.mediaUrl) {
        videoUrl = videoBlock.mediaUrl;
        break;
      }
    }

    createTraining({
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
      title: "Treinamento criado",
      description: "O treinamento foi criado com sucesso.",
    });

    navigate("/admin/treinamentos");
  };

  const handleCancel = () => {
    navigate("/admin/treinamentos");
  };

  return (
    <ModernTrainingEditor
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
