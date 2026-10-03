// Editor moderno de treinamentos estilo Word com seções/páginas
import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  Trash2,
  GripVertical,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Video,
  Quote,
  Minus,
  List,
  ListOrdered,
  CheckSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
  Settings,
  Copy,
  MoreVertical,
  Sparkles,
  Loader2,
  Upload,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Maximize2,
  Bold,
  Italic,
  Underline,
  Eye,
  Save,
  ArrowLeft,
  Layers,
  PanelLeft,
  X,
  Palette,
  Building2,
  Clock,
  ChevronDown,
  ChevronUp,
  Table2,
  CircleCheck,
  ImagePlus,
  CircleHelp,
} from "lucide-react";
import { useAIRewrite } from "@/hooks/use-ai-rewrite";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { InlineRichText } from "@/components/training/inline-rich-text";

// Types
export interface ContentBlock {
  id: string;
  type: "text" | "heading" | "image" | "video" | "divider" | "quote" | "list" | "checklist" | "numbered-list" | "table";
  content: string;
  level?: 1 | 2 | 3;
  align?: "left" | "center" | "right" | "justify";
  mediaUrl?: string;
  caption?: string;
  listItems?: string[];
  checkItems?: { text: string; checked: boolean }[];
  tableData?: string[][];
  tableHeaders?: string[];
  // Estilos de texto
  fontSize?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
  textColor?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
}

export interface TrainingSection {
  id: string;
  title: string;
  blocks: ContentBlock[];
}

export interface TrainingData {
  titulo: string;
  subtitulo: string;
  descricao: string;
  categoria: string;
  nivel?: string;
  duracao: string;
  status: "ativo" | "inativo" | "rascunho";
  instrutor: string;
  instrutor_id?: string;
  departamento: string;
  departamento_id?: string;
  empresa_id?: string;
  capa?: string;
  sections: TrainingSection[];
}

interface ModernTrainingEditorProps {
  initialData?: Partial<TrainingData>;
  onSave: (data: TrainingData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  /** Abas exibidas no centro do cabeçalho (ex.: Conteúdo / Avaliação) */
  headerCenter?: ReactNode;
  /** Quando informado, substitui a área de edição (mantendo o cabeçalho) */
  bodyOverride?: ReactNode;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createEmptyBlock = (type: ContentBlock["type"] = "text"): ContentBlock => ({
  id: generateId(),
  type,
  content: "",
  align: "left",
  level: type === "heading" ? 2 : undefined,
  listItems: type === "list" || type === "numbered-list" ? [""] : undefined,
  checkItems: type === "checklist" ? [{ text: "", checked: false }] : undefined,
  tableHeaders: type === "table" ? ["Coluna 1", "Coluna 2", "Coluna 3"] : undefined,
  tableData: type === "table" ? [["", "", ""], ["", "", ""]] : undefined,
  fontSize: "base",
});

const createEmptySection = (title = "Nova Seção"): TrainingSection => ({
  id: generateId(),
  title,
  blocks: [createEmptyBlock("text")],
});

// Cores predefinidas para o texto
const TEXT_COLORS = [
  { name: "Padrão", value: "" },
  { name: "Preto", value: "text-black" },
  { name: "Cinza", value: "text-gray-600" },
  { name: "Vermelho", value: "text-red-600" },
  { name: "Laranja", value: "text-orange-600" },
  { name: "Amarelo", value: "text-yellow-600" },
  { name: "Verde", value: "text-green-600" },
  { name: "Azul", value: "text-blue-600" },
  { name: "Roxo", value: "text-purple-600" },
  { name: "Rosa", value: "text-pink-600" },
];

// Tamanhos de fonte
const FONT_SIZES = [
  { name: "Extra Pequeno", value: "xs" },
  { name: "Pequeno", value: "sm" },
  { name: "Normal", value: "base" },
  { name: "Grande", value: "lg" },
  { name: "Extra Grande", value: "xl" },
  { name: "2x Grande", value: "2xl" },
  { name: "3x Grande", value: "3xl" },
];

interface Departamento {
  id: string;
  nome: string;
  empresa_id: string | null;
}

interface Empresa {
  id: string;
  nome: string;
  nome_fantasia: string | null;
}

// Definidos fora do componente do editor: dentro dele, a cada alteração o React
// recriaria os botões e o primeiro clique depois de digitar se perdia.
function ToolbarButton({
  label,
  onClick,
  disabled,
  active,
  children,
  keepFocus,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
  keepFocus?: boolean;
}) {
  return (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onMouseDown={(e) => keepFocus && e.preventDefault()}
        onClick={onClick}
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
          active && "bg-foreground text-background hover:bg-foreground hover:text-background"
        )}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom">{label}</TooltipContent>
  </Tooltip>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
}



export function ModernTrainingEditor({
  initialData,
  onSave,
  onCancel,
  isEditing = false,
  headerCenter,
  bodyOverride,
}: ModernTrainingEditorProps) {
  const { user } = useAuth();
  const { canUploadVideo } = usePermissions();
  const { rewriteText, checkAIAccess } = useAIRewrite();
  const [showAIButton, setShowAIButton] = useState(false);
  const [rewritingBlockId, setRewritingBlockId] = useState<string | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<{ sectionIndex: number; blockId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadContext, setUploadContext] = useState<{
    sectionId: string;
    blockId?: string;
    type: "image" | "video";
  } | null>(null);

  // Departamentos, instrutores e empresas do Supabase
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [instrutores, setInstrutores] = useState<{ id: string; nome: string }[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Editor state
  const [activeSection, setActiveSection] = useState(0);
  const [showSidebar, setShowSidebar] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);
  const [showSettings, setShowSettings] = useState(() => typeof window === "undefined" || window.innerWidth >= 1280);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [focusListItem, setFocusListItem] = useState<{ blockId: string; index: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [mediaDialogData, setMediaDialogData] = useState<{
    sectionId: string;
    position: number;
    type: "image" | "video";
  } | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");

  // Form data
  const [formData, setFormData] = useState<TrainingData>({
    titulo: initialData?.titulo || "",
    subtitulo: initialData?.subtitulo || "",
    descricao: initialData?.descricao || "",
    categoria: initialData?.categoria || "",
    nivel: initialData?.nivel || "basico",
    duracao: initialData?.duracao || "",
    status: initialData?.status || "rascunho",
    instrutor: initialData?.instrutor || "",
    instrutor_id: initialData?.instrutor_id || "",
    departamento: initialData?.departamento || "",
    departamento_id: initialData?.departamento_id || "",
    empresa_id: initialData?.empresa_id || user?.empresa_id || "",
    capa: initialData?.capa,
    sections: initialData?.sections || [createEmptySection("Introdução")],
  });

  // Carregar departamentos e empresas do Supabase
  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        // Carregar departamentos
        const { data: depData, error: depError } = await supabase
          .from("departamentos")
          .select("id, nome, empresa_id")
          .eq("ativo", true);

        if (depError) {
          console.error("Erro ao carregar departamentos:", depError);
        } else {
          setDepartamentos(depData || []);
        }

        // Carregar instrutores (perfis com role instrutor, admin ou master)
        const { data: instData } = await supabase
          .from("perfis")
          .select("id, nome")
          .eq("ativo", true)
          .order("nome");
        
        if (instData) {
          setInstrutores(instData);
        }

        // Carregar empresas (apenas para master)
        if (user?.role === "master") {
          const { data: empData, error: empError } = await supabase
            .from("empresas")
            .select("id, nome, nome_fantasia")
            .eq("ativo", true);

          if (empError) {
            console.error("Erro ao carregar empresas:", empError);
          } else {
            setEmpresas(empData || []);
          }
        }

        // Carregar categorias
        const { data: catData } = await supabase
          .from("categorias" as any)
          .select("id, nome")
          .eq("ativo", true)
          .order("nome");
        if (catData) setCategorias(catData as any);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [user?.role]);

  // Filtrar departamentos pela empresa selecionada
  const departamentosFiltrados = formData.empresa_id
    ? departamentos.filter(
        (d) => !d.empresa_id || d.empresa_id === formData.empresa_id
      )
    : departamentos;

  // Alterações pendentes (comparadas ao que foi aberto)
  const serialized = useMemo(() => JSON.stringify(formData), [formData]);
  const initialSnapshot = useRef(serialized);
  const isDirty = serialized !== initialSnapshot.current;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Ctrl/⌘ + S salva
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave(formDataRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  // Check AI access
  useEffect(() => {
    const check = async () => {
      if (user?.role === "master" || user?.role === "admin" || user?.role === "instrutor") {
        const { enabled } = await checkAIAccess();
        setShowAIButton(enabled || user?.role === "master");
      }
    };
    check();
  }, [user, checkAIAccess]);

  // Section management
  const addSection = () => {
    const newSection = createEmptySection(`Seção ${formData.sections.length + 1}`);
    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setActiveSection(formData.sections.length);
  };

  const deleteSection = (index: number) => {
    if (formData.sections.length === 1) return;
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
    if (activeSection >= index && activeSection > 0) {
      setActiveSection(activeSection - 1);
    }
  };

  const duplicateSection = (index: number) => {
    const sectionToCopy = formData.sections[index];
    const newSection: TrainingSection = {
      ...sectionToCopy,
      id: generateId(),
      title: `${sectionToCopy.title} (cópia)`,
      blocks: sectionToCopy.blocks.map((block) => ({ ...block, id: generateId() })),
    };
    setFormData((prev) => ({
      ...prev,
      sections: [
        ...prev.sections.slice(0, index + 1),
        newSection,
        ...prev.sections.slice(index + 1),
      ],
    }));
  };

  const updateSectionTitle = (index: number, title: string) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) =>
        i === index ? { ...section, title } : section
      ),
    }));
  };

  // Block management
  const addBlock = (sectionIndex: number, type: ContentBlock["type"], position?: number) => {
    const newBlock = createEmptyBlock(type);
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) => {
        if (i !== sectionIndex) return section;
        const insertAt = position !== undefined && position >= 0 ? position + 1 : section.blocks.length;
        return {
          ...section,
          blocks: [...section.blocks.slice(0, insertAt), newBlock, ...section.blocks.slice(insertAt)],
        };
      }),
    }));
    setActiveBlockId(newBlock.id);
    return newBlock.id;
  };

  const updateBlock = (sectionIndex: number, blockId: string, updates: Partial<ContentBlock>) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) =>
        i === sectionIndex
          ? { ...section, blocks: section.blocks.map((block) => (block.id === blockId ? { ...block, ...updates } : block)) }
          : section
      ),
    }));
  };

  const deleteBlock = (sectionIndex: number, blockId: string) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) => {
        if (i !== sectionIndex) return section;
        const blocks = section.blocks.filter((block) => block.id !== blockId);
        return { ...section, blocks: blocks.length > 0 ? blocks : [createEmptyBlock("text")] };
      }),
    }));
  };

  // Drag and drop
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "section") {
      const newSections = Array.from(formData.sections);
      const [removed] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, removed);
      setFormData((prev) => ({ ...prev, sections: newSections }));
      if (activeSection === source.index) {
        setActiveSection(destination.index);
      }
      return;
    }

    // Block drag within same section
    if (source.droppableId === destination.droppableId) {
      const sectionIndex = parseInt(source.droppableId.replace("section-", ""));
      const newBlocks = Array.from(formData.sections[sectionIndex].blocks);
      const [removed] = newBlocks.splice(source.index, 1);
      newBlocks.splice(destination.index, 0, removed);

      setFormData((prev) => ({
        ...prev,
        sections: prev.sections.map((section, i) => (i === sectionIndex ? { ...section, blocks: newBlocks } : section)),
      }));
    }
  };

  // File upload - aceita todos os tipos de imagem
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadContext) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const sectionIndex = formData.sections.findIndex((s) => s.id === uploadContext.sectionId);

      if (uploadContext.blockId) {
        updateBlock(sectionIndex, uploadContext.blockId, { mediaUrl: result });
      } else if (mediaDialogData) {
        const newBlock = createEmptyBlock(uploadContext.type);
        newBlock.mediaUrl = result;
        addBlock(sectionIndex, uploadContext.type, mediaDialogData.position);
      }
    };
    reader.readAsDataURL(file);

    setUploadContext(null);
    setShowMediaDialog(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // AI rewrite
  const handleAIRewrite = async (sectionIndex: number, blockId: string, content: string) => {
    if (!content.trim()) return;

    setRewritingBlockId(blockId);
    const rewritten = await rewriteText(content);
    if (rewritten) {
      updateBlock(sectionIndex, blockId, { content: rewritten });
    }
    setRewritingBlockId(null);
  };

  // Add media via URL
  const handleAddMediaUrl = () => {
    if (!mediaDialogData || !mediaUrl.trim()) return;

    const newBlock = createEmptyBlock(mediaDialogData.type);
    newBlock.mediaUrl = mediaUrl;

    setFormData((prev) => {
      const newSections = [...prev.sections];
      const section = newSections[activeSection];
      const insertAt = mediaDialogData.position + 1;
      section.blocks = [
        ...section.blocks.slice(0, insertAt),
        newBlock,
        ...section.blocks.slice(insertAt),
      ];
      return { ...prev, sections: newSections };
    });

    setMediaUrl("");
    setShowMediaDialog(false);
    setMediaDialogData(null);
  };

  // Cover image upload
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData((prev) => ({ ...prev, capa: event.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Render preview block with proper formatting
  const renderPreviewBlock = (block: ContentBlock) => {
    const fontSizeClass = {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
    }[block.fontSize || "base"];

    const alignClass = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
      justify: "text-justify",
    }[block.align || "left"];

    const textStyles = cn(
      fontSizeClass,
      alignClass,
      block.textColor,
      block.isBold && "font-bold",
      block.isItalic && "italic",
      block.isUnderline && "underline"
    );

    switch (block.type) {
      case "heading":
        const HeadingTag = `h${block.level || 2}` as "h1" | "h2" | "h3";
        const headingSize = {
          1: "text-3xl font-bold",
          2: "text-2xl font-semibold",
          3: "text-xl font-medium",
        }[block.level || 2];
        return block.content ? (
          <HeadingTag 
            key={block.id} 
            className={cn(
              headingSize, 
              alignClass, 
              block.textColor,
              block.isBold && "font-bold",
              block.isItalic && "italic",
              block.isUnderline && "underline"
            )}
          >
            {block.content}
          </HeadingTag>
        ) : null;
      
      case "text":
        return block.content ? (
          <div key={block.id} className={textStyles}>
            {block.content.split('\n').map((line, i) => (
              <p key={i} className="mb-2 last:mb-0">
                {line || <br />}
              </p>
            ))}
          </div>
        ) : null;
      
      case "quote":
        return block.content ? (
          <blockquote
            key={block.id}
            className={cn(
              "border-l-4 border-primary pl-4 py-2 italic bg-muted/30 rounded-r-md",
              textStyles
            )}
          >
            {block.content}
          </blockquote>
        ) : null;
      
      case "image":
        return block.mediaUrl ? (
          <figure key={block.id} className={alignClass}>
            <img 
              src={block.mediaUrl} 
              alt={block.caption || ""} 
              className="max-w-full rounded-lg shadow-md" 
            />
            {block.caption && (
              <figcaption className="text-sm text-muted-foreground mt-2">
                {block.caption}
              </figcaption>
            )}
          </figure>
        ) : null;
      
      case "video":
        return block.mediaUrl ? (
          <div key={block.id} className={cn("aspect-video", alignClass)}>
            {block.mediaUrl.includes("youtube") || block.mediaUrl.includes("youtu.be") ? (
              <iframe
                src={block.mediaUrl
                  .replace("watch?v=", "embed/")
                  .replace("youtu.be/", "youtube.com/embed/")}
                className="w-full h-full rounded-lg"
                allowFullScreen
              />
            ) : block.mediaUrl.includes("vimeo") ? (
              <iframe
                src={block.mediaUrl.replace("vimeo.com/", "player.vimeo.com/video/")}
                className="w-full h-full rounded-lg"
                allowFullScreen
              />
            ) : (
              <video src={block.mediaUrl} controls className="w-full h-full rounded-lg" />
            )}
          </div>
        ) : null;
      
      case "list":
        return (block.listItems?.filter(item => item.trim()).length) ? (
          <ul key={block.id} className="list-disc list-inside space-y-1 ml-4">
            {block.listItems?.filter(item => item.trim()).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : null;
      
      case "numbered-list":
        return (block.listItems?.filter(item => item.trim()).length) ? (
          <ol key={block.id} className="list-decimal list-inside space-y-1 ml-4">
            {block.listItems?.filter(item => item.trim()).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        ) : null;
      
      case "checklist":
        return (block.checkItems?.filter(item => item.text.trim()).length) ? (
          <div key={block.id} className="space-y-2">
            {block.checkItems?.filter(item => item.text.trim()).map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={item.checked} 
                  readOnly 
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className={item.checked ? "line-through text-muted-foreground" : ""}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        ) : null;
      
      case "table":
        return (block.tableHeaders && block.tableData) ? (
          <div key={block.id} className="overflow-x-auto my-4">
            <table className="w-full border-collapse border border-border rounded-lg text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {block.tableHeaders.map((header, hi) => (
                    <th key={hi} className="border border-border px-3 py-2 text-left font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.tableData.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-border px-3 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null;

      case "divider":
        return <Separator key={block.id} className="my-6" />;
      
      default:
        return null;
    }
  };

  // Render preview content
  const renderPreviewContent = () => {
    return (
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{formData.titulo || "Sem título"}</DialogTitle>
            {formData.subtitulo && (
              <p className="text-lg text-muted-foreground">{formData.subtitulo}</p>
            )}
            {formData.descricao && (
              <p className="text-sm text-muted-foreground mt-2">{formData.descricao}</p>
            )}
          </DialogHeader>

          <div className="space-y-8 mt-6">
            {formData.capa && (
              <div className="aspect-video rounded-lg overflow-hidden shadow-md">
                <img src={formData.capa} alt={formData.titulo} className="w-full h-full object-cover" />
              </div>
            )}

            {formData.sections.map((section, sectionIndex) => (
              <div key={section.id} className="space-y-4">
                <div className="flex items-center gap-3 border-b pb-2">
                  <Badge variant="outline" className="shrink-0">
                    Seção {sectionIndex + 1}
                  </Badge>
                  <h2 className="text-xl font-bold">{section.title}</h2>
                </div>
                <div className="space-y-4 pl-2">
                  {section.blocks.map((block) => renderPreviewBlock(block))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Render block
  const renderBlock = (block: ContentBlock, sectionIndex: number, blockIndex: number) => {
    const alignClass = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
      justify: "text-justify",
    }[block.align || "left"];

    const fontSizeClass = {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
    }[block.fontSize || "base"];

    const blockContent = () => {
      switch (block.type) {
        case "heading":
          const headingClass = block.level === 3
            ? "text-lg md:text-lg font-semibold"
            : "text-xl md:text-2xl font-semibold tracking-tight";

          return (
            <Input
              value={block.content}
              onChange={(e) => updateBlock(sectionIndex, block.id, { content: e.target.value })}
              placeholder={block.level === 3 ? "Subtítulo" : "Título"}
              className={cn(
                "h-auto border-none bg-transparent px-0 py-1 shadow-none focus-visible:ring-0",
                headingClass
              )}
            />
          );

        case "text":
          return (
            <InlineRichText
              value={block.content}
              onChange={(content) => updateBlock(sectionIndex, block.id, { content })}
              placeholder="Comece a digitar seu conteúdo aqui..."
              ariaLabel="Texto"
              className={cn("text-[16.5px] leading-[1.8] text-foreground/90 [&>div+div]:mt-0", alignClass)}
            />
          );

        case "quote":
          return (
            <div className="border-l-4 border-primary/60 pl-4 py-1">
              <InlineRichText
                value={block.content}
                onChange={(content) => updateBlock(sectionIndex, block.id, { content })}
                placeholder="Digite uma citação..."
                ariaLabel="Citação"
                className={cn("text-[16.5px] leading-[1.8] italic text-muted-foreground", alignClass)}
              />
            </div>
          );

        case "image":
          return (
            <div className={cn("space-y-2", alignClass === "text-center" ? "mx-auto" : alignClass === "text-right" ? "ml-auto" : "")}>
              {block.mediaUrl ? (
                <div className="relative group/media">
                  <img
                    src={block.mediaUrl}
                    alt={block.caption || "Imagem"}
                    className="max-w-full h-auto rounded-lg shadow-md"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity"
                    onClick={() => updateBlock(sectionIndex, block.id, { mediaUrl: undefined })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Input
                    value={block.caption || ""}
                    onChange={(e) => updateBlock(sectionIndex, block.id, { caption: e.target.value })}
                    placeholder="Legenda da imagem (opcional)"
                    className="mt-2 text-center text-sm text-muted-foreground border-none shadow-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center bg-muted/20 hover:bg-muted/30 transition-colors">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Arraste uma imagem ou clique para fazer upload</p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadContext({
                          sectionId: formData.sections[sectionIndex].id,
                          blockId: block.id,
                          type: "image",
                        });
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  <div className="mt-4">
                    <Input
                      placeholder="Ou cole uma URL de imagem..."
                      className="max-w-md mx-auto"
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          updateBlock(sectionIndex, block.id, { mediaUrl: e.target.value });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            updateBlock(sectionIndex, block.id, { mediaUrl: input.value });
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );

        case "video":
          return (
            <div className={cn("space-y-2", alignClass === "text-center" ? "mx-auto" : alignClass === "text-right" ? "ml-auto" : "")}>
              {block.mediaUrl ? (
                <div className="relative group/media">
                  {block.mediaUrl.includes("youtube") || block.mediaUrl.includes("youtu.be") || block.mediaUrl.includes("vimeo") ? (
                    <div className="aspect-video rounded-lg overflow-hidden shadow-md">
                      <iframe
                        src={block.mediaUrl
                          .replace("watch?v=", "embed/")
                          .replace("youtu.be/", "youtube.com/embed/")}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <video src={block.mediaUrl} controls className="max-w-full rounded-lg shadow-md" />
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity"
                    onClick={() => updateBlock(sectionIndex, block.id, { mediaUrl: undefined })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Input
                    value={block.caption || ""}
                    onChange={(e) => updateBlock(sectionIndex, block.id, { caption: e.target.value })}
                    placeholder="Legenda do vídeo (opcional)"
                    className="mt-2 text-center text-sm text-muted-foreground border-none shadow-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center bg-muted/20 hover:bg-muted/30 transition-colors">
                  <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {canUploadVideo
                      ? "Cole uma URL do YouTube, Vimeo ou faça upload"
                      : "Cole uma URL do YouTube, Vimeo ou outro provedor de vídeo"}
                  </p>
                  {canUploadVideo && (
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUploadContext({
                            sectionId: formData.sections[sectionIndex].id,
                            blockId: block.id,
                            type: "video",
                          });
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  )}
                  <div className="mt-4">
                    <Input
                      placeholder="Cole a URL do vídeo..."
                      className="max-w-md mx-auto"
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          updateBlock(sectionIndex, block.id, { mediaUrl: e.target.value });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            updateBlock(sectionIndex, block.id, { mediaUrl: input.value });
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );

        case "divider":
          return <Separator className="my-6" />;

        case "list":
        case "numbered-list": {
          const items = block.listItems && block.listItems.length > 0 ? block.listItems : [""];
          const setItems = (listItems: string[], focusIndex?: number) => {
            updateBlock(sectionIndex, block.id, { listItems });
            if (focusIndex !== undefined) setFocusListItem({ blockId: block.id, index: focusIndex });
          };
          return (
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={`${block.id}-${i}-${items.length}`} className="flex items-start gap-2.5">
                  <span className={cn("mt-[3px] shrink-0 text-[16.5px] leading-[1.8] tabular-nums", block.type === "list" ? "w-3 text-primary" : "min-w-[20px] text-muted-foreground")}>
                    {block.type === "list" ? "•" : `${i + 1}.`}
                  </span>
                  <InlineRichText
                    singleLine
                    value={item}
                    autoFocus={focusListItem?.blockId === block.id && focusListItem.index === i}
                    onChange={(value) => {
                      const next = [...items];
                      next[i] = value;
                      updateBlock(sectionIndex, block.id, { listItems: next });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const next = [...items];
                        next.splice(i + 1, 0, "");
                        setItems(next, i + 1);
                      }
                      if (e.key === "Backspace" && !e.currentTarget.textContent && items.length > 1) {
                        e.preventDefault();
                        const next = [...items];
                        next.splice(i, 1);
                        setItems(next, Math.max(0, i - 1));
                      }
                    }}
                    placeholder="Item da lista..."
                    ariaLabel={`Item ${i + 1}`}
                    className="flex-1 py-[3px] text-[16.5px] leading-[1.8] text-foreground/90"
                  />
                </div>
              ))}
            </div>
          );
        }

        case "checklist":
          return (
            <div className="space-y-2">
              {(block.checkItems || [{ text: "", checked: false }]).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => {
                      const newItems = [...(block.checkItems || [])];
                      newItems[i] = { ...newItems[i], checked: e.target.checked };
                      updateBlock(sectionIndex, block.id, { checkItems: newItems });
                    }}
                    className="h-4 w-4 rounded border-muted-foreground"
                  />
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...(block.checkItems || [])];
                      newItems[i] = { ...newItems[i], text: e.target.value };
                      updateBlock(sectionIndex, block.id, { checkItems: newItems });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const newItems = [...(block.checkItems || [])];
                        newItems.splice(i + 1, 0, { text: "", checked: false });
                        updateBlock(sectionIndex, block.id, { checkItems: newItems });
                      }
                      if (e.key === "Backspace" && item.text === "" && (block.checkItems?.length || 0) > 1) {
                        e.preventDefault();
                        const newItems = [...(block.checkItems || [])];
                        newItems.splice(i, 1);
                        updateBlock(sectionIndex, block.id, { checkItems: newItems });
                      }
                    }}
                    placeholder="Item do checklist..."
                    className={cn(
                      "flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent",
                      item.checked && "line-through text-muted-foreground"
                    )}
                  />
                </div>
              ))}
            </div>
          );

        case "table":
          return (
            <div className="space-y-2 overflow-x-auto">
              <table className="w-full border-collapse border border-border rounded-lg">
                <thead>
                  <tr>
                    {(block.tableHeaders || ["Col 1", "Col 2"]).map((header, hi) => (
                      <th key={hi} className="border border-border p-1">
                        <Input
                          value={header}
                          onChange={(e) => {
                            const newHeaders = [...(block.tableHeaders || [])];
                            newHeaders[hi] = e.target.value;
                            updateBlock(sectionIndex, block.id, { tableHeaders: newHeaders });
                          }}
                          className="border-none shadow-none focus-visible:ring-0 bg-transparent font-semibold text-center h-8"
                          placeholder={`Coluna ${hi + 1}`}
                        />
                      </th>
                    ))}
                    <th className="w-8 border border-border">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        const newHeaders = [...(block.tableHeaders || []), `Col ${(block.tableHeaders?.length || 0) + 1}`];
                        const newData = (block.tableData || []).map(row => [...row, ""]);
                        updateBlock(sectionIndex, block.id, { tableHeaders: newHeaders, tableData: newData });
                      }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(block.tableData || [[]]).map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="border border-border p-1">
                          <Input
                            value={cell}
                            onChange={(e) => {
                              const newData = (block.tableData || []).map(r => [...r]);
                              newData[ri][ci] = e.target.value;
                              updateBlock(sectionIndex, block.id, { tableData: newData });
                            }}
                            className="border-none shadow-none focus-visible:ring-0 bg-transparent h-8"
                            placeholder="..."
                          />
                        </td>
                      ))}
                      <td className="w-8 border border-border">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
                          const newData = (block.tableData || []).filter((_, i) => i !== ri);
                          if (newData.length === 0) newData.push(Array(block.tableHeaders?.length || 2).fill(""));
                          updateBlock(sectionIndex, block.id, { tableData: newData });
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button variant="outline" size="sm" onClick={() => {
                const cols = block.tableHeaders?.length || 2;
                const newData = [...(block.tableData || []), Array(cols).fill("")];
                updateBlock(sectionIndex, block.id, { tableData: newData });
              }}>
                <Plus className="h-3 w-3 mr-1" /> Linha
              </Button>
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <Draggable draggableId={block.id} index={blockIndex} key={block.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            onFocusCapture={() => setActiveBlockId(block.id)}
            onMouseDownCapture={() => setActiveBlockId(block.id)}
            className={cn(
              "group relative mb-3 rounded-lg px-3 -mx-3 py-1 transition-colors",
              activeBlockId === block.id ? "bg-primary/[0.04] ring-1 ring-primary/30" : "hover:bg-muted/40",
              snapshot.isDragging && "shadow-lg bg-card ring-2 ring-primary"
            )}
          >
            {/* Block toolbar */}
            <div className="absolute -left-10 top-1 hidden sm:flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div {...provided.dragHandleProps} className="cursor-grab p-1 rounded hover:bg-muted">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteBlock(sectionIndex, block.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Excluir bloco</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Block content */}
            <div className="py-1">{blockContent()}</div>

            {/* Add block button */}
            <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-6 w-6 rounded-full shadow-md">
                    <Plus className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "text", blockIndex)}>
                    <Type className="h-4 w-4 mr-2" /> Texto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "heading", blockIndex)}>
                    <Heading2 className="h-4 w-4 mr-2" /> Título
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "image", blockIndex)}>
                    <ImageIcon className="h-4 w-4 mr-2" /> Imagem
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "video", blockIndex)}>
                    <Video className="h-4 w-4 mr-2" /> Vídeo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "quote", blockIndex)}>
                    <Quote className="h-4 w-4 mr-2" /> Citação
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "list", blockIndex)}>
                    <List className="h-4 w-4 mr-2" /> Marcadores
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "numbered-list", blockIndex)}>
                    <ListOrdered className="h-4 w-4 mr-2" /> Numeração
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "checklist", blockIndex)}>
                    <CheckSquare className="h-4 w-4 mr-2" /> Checklist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "table", blockIndex)}>
                    <Table2 className="h-4 w-4 mr-2" /> Tabela
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => addBlock(sectionIndex, "divider", blockIndex)}>
                    <Minus className="h-4 w-4 mr-2" /> Divisor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const activeSectionData = formData.sections[activeSection];
  const activeBlockIndex = activeSectionData ? activeSectionData.blocks.findIndex((b) => b.id === activeBlockId) : -1;
  const activeBlock = activeBlockIndex >= 0 ? activeSectionData.blocks[activeBlockIndex] : null;
  const isTextLike = !!activeBlock && (activeBlock.type === "text" || activeBlock.type === "quote");
  const blockStyle = !activeBlock
    ? ""
    : activeBlock.type === "text"
    ? "p"
    : activeBlock.type === "quote"
    ? "quote"
    : activeBlock.type === "heading"
    ? (activeBlock.level === 3 ? "h3" : "h2")
    : "";

  const changeBlockStyle = (style: string) => {
    if (!activeBlock) return;
    const plain = (t: string) => t.replace(/\*\*|\*/g, "").replace(/\s*\n+\s*/g, " ").trim();
    if (style === "p") updateBlock(activeSection, activeBlock.id, { type: "text" });
    if (style === "quote") updateBlock(activeSection, activeBlock.id, { type: "quote" });
    if (style === "h2" || style === "h3") {
      updateBlock(activeSection, activeBlock.id, {
        type: "heading",
        level: style === "h3" ? 3 : 2,
        content: activeBlock.type === "heading" ? activeBlock.content : plain(activeBlock.content),
      });
    }
  };

  // Negrito/itálico agem sobre o texto selecionado no bloco ativo
  const applyInline = (command: "bold" | "italic") => {
    document.execCommand(command);
  };

  const insertBlock = (type: ContentBlock["type"]) => {
    addBlock(activeSection, type, activeBlockIndex >= 0 ? activeBlockIndex : undefined);
  };

  const displaySectionTitle = (title: string) => title.replace(/^Seção\s+\d+\s*:\s*/i, "") || "Sem título";

  return (
    <TooltipProvider delayDuration={300}>
    <div className="h-screen flex flex-col bg-background">
      {/* Cabeçalho */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-2 sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9 shrink-0" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 lg:max-w-[440px]">
          <Input
            value={formData.titulo}
            onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
            placeholder="Título do treinamento"
            aria-label="Título do treinamento"
            className="h-auto w-full truncate border-none bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0 md:text-[15px]"
          />
          <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground sm:text-xs">
            {isDirty ? (
              <>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Alterações não salvas
              </>
            ) : (
              <>
                <CircleCheck className="h-3 w-3 shrink-0 text-emerald-600" />
                Nenhuma alteração pendente
              </>
            )}
            <span className="hidden sm:inline">· {formData.sections.length} {formData.sections.length === 1 ? "seção" : "seções"}</span>
          </p>
        </div>

        {headerCenter && <div className="hidden flex-1 justify-center md:flex">{headerCenter}</div>}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Select
            value={formData.status}
            onValueChange={(value: "ativo" | "inativo" | "rascunho") =>
              setFormData((prev) => ({ ...prev, status: value }))
            }
          >
            <SelectTrigger className="h-9 w-[104px] text-xs sm:w-[124px] sm:text-sm" aria-label="Situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="ativo">Publicado</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="hidden h-9 sm:inline-flex" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 lg:mr-2" />
            <span className="hidden lg:inline">Pré-visualizar</span>
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-9 w-9 text-muted-foreground md:inline-flex"
                onClick={() => window.open("/ajuda?tela=/admin/treinamentos/editar", "_blank", "noopener")}
                aria-label="Ajuda do editor"
              >
                <CircleHelp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ajuda do editor (abre em outra aba)</TooltipContent>
          </Tooltip>

          {!bodyOverride && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showSettings ? "secondary" : "outline"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setShowSettings((v) => !v)}
                  aria-label="Detalhes do treinamento"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Detalhes do treinamento</TooltipContent>
            </Tooltip>
          )}

          <Button onClick={() => onSave(formData)} className="h-9">
            <Save className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Salvar</span>
          </Button>
        </div>
      </header>
      {headerCenter && <div className="flex justify-center border-b bg-card px-3 py-2 md:hidden">{headerCenter}</div>}

      {bodyOverride ? (
        <div className="flex-1 overflow-y-auto bg-muted/30">
          <div className="mx-auto w-full max-w-5xl p-3 sm:p-6">{bodyOverride}</div>
        </div>
      ) : (
      <div className="relative flex flex-1 overflow-hidden">
        {/* Seções */}
        {showSidebar && (
          <aside className="absolute inset-0 z-30 flex w-full flex-col border-r bg-card sm:relative sm:inset-auto sm:w-64">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h3 className="text-sm font-semibold">Seções</h3>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addSection} aria-label="Nova seção">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Nova seção</TooltipContent>
                </Tooltip>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSidebar(false)} aria-label="Ocultar seções">
                  <X className="h-4 w-4 sm:hidden" />
                  <PanelLeft className="hidden h-4 w-4 sm:block" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="sections" type="section">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5 px-2 pb-4">
                      {formData.sections.map((section, index) => (
                        <Draggable key={section.id} draggableId={section.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "group flex cursor-pointer items-center gap-1.5 rounded-lg py-2 pl-1 pr-1.5 text-sm transition-colors",
                                activeSection === index
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-foreground/80 hover:bg-muted",
                                snapshot.isDragging && "bg-card shadow-lg"
                              )}
                              onClick={() => {
                                setActiveSection(index);
                                setActiveBlockId(null);
                                if (window.innerWidth < 640) setShowSidebar(false);
                              }}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab px-0.5 text-muted-foreground/40 group-hover:text-muted-foreground" aria-label="Arrastar seção">
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>
                              <span className={cn("w-5 shrink-0 text-xs tabular-nums", activeSection === index ? "text-primary" : "text-muted-foreground")}>
                                {index + 1}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{displaySectionTitle(section.title)}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Ações da seção"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => duplicateSection(index)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => deleteSection(index)}
                                    disabled={formData.sections.length === 1}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </ScrollArea>
          </aside>
        )}

        {/* Área de edição */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/30">
          <div className="flex-1 overflow-y-auto">
            {/* Barra de ferramentas única */}
            <div className="sticky top-0 z-20 flex justify-center px-2 pt-3 sm:px-4 sm:pt-4">
              <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border bg-card/95 p-1 shadow-sm backdrop-blur">
                {!showSidebar && (
                  <>
                    <ToolbarButton label="Mostrar seções" onClick={() => setShowSidebar(true)}>
                      <PanelLeft className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarDivider />
                  </>
                )}
                <Select value={blockStyle} onValueChange={changeBlockStyle} disabled={!activeBlock || !blockStyle}>
                  <SelectTrigger className="h-8 w-[118px] shrink-0 border-none bg-transparent text-xs shadow-none focus:ring-0" aria-label="Estilo do bloco">
                    <SelectValue placeholder="Estilo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p">Parágrafo</SelectItem>
                    <SelectItem value="h2">Título</SelectItem>
                    <SelectItem value="h3">Subtítulo</SelectItem>
                    <SelectItem value="quote">Citação</SelectItem>
                  </SelectContent>
                </Select>
                <ToolbarDivider />
                <ToolbarButton label="Negrito (Ctrl+B)" keepFocus disabled={!isTextLike} onClick={() => applyInline("bold")}>
                  <Bold className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton label="Itálico (Ctrl+I)" keepFocus disabled={!isTextLike} onClick={() => applyInline("italic")}>
                  <Italic className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarDivider />
                {([
                  ["left", AlignLeft, "Alinhar à esquerda"],
                  ["center", AlignCenter, "Centralizar"],
                  ["right", AlignRight, "Alinhar à direita"],
                  ["justify", AlignJustify, "Justificar"],
                ] as const).map(([value, Icon, label]) => (
                  <ToolbarButton
                    key={value}
                    label={label}
                    keepFocus
                    disabled={!isTextLike}
                    active={isTextLike && (activeBlock?.align || "left") === value}
                    onClick={() => activeBlock && updateBlock(activeSection, activeBlock.id, { align: value })}
                  >
                    <Icon className="h-4 w-4" />
                  </ToolbarButton>
                ))}
                <ToolbarDivider />
                <ToolbarButton label="Lista com marcadores" onClick={() => insertBlock("list")}>
                  <List className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton label="Lista numerada" onClick={() => insertBlock("numbered-list")}>
                  <ListOrdered className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton label="Imagem" onClick={() => insertBlock("image")}>
                  <ImagePlus className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton label="Vídeo" onClick={() => insertBlock("video")}>
                  <Video className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton label="Tabela" onClick={() => insertBlock("table")}>
                  <Table2 className="h-4 w-4" />
                </ToolbarButton>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label="Inserir bloco" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Plus className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Inserir bloco</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => insertBlock("text")}>
                      <Type className="mr-2 h-4 w-4" /> Parágrafo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlock("heading")}>
                      <Heading2 className="mr-2 h-4 w-4" /> Título
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlock("quote")}>
                      <Quote className="mr-2 h-4 w-4" /> Citação
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlock("checklist")}>
                      <CheckSquare className="mr-2 h-4 w-4" /> Checklist
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => insertBlock("divider")}>
                      <Minus className="mr-2 h-4 w-4" /> Divisor
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {showAIButton && (
                  <>
                    <ToolbarDivider />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={!isTextLike || !activeBlock?.content.trim() || rewritingBlockId === activeBlock?.id}
                          onClick={() => activeBlock && handleAIRewrite(activeSection, activeBlock.id, activeBlock.content)}
                          className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-40"
                        >
                          {rewritingBlockId && rewritingBlockId === activeBlock?.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          IA
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Reescrever o bloco com IA</TooltipContent>
                    </Tooltip>
                  </>
                )}
                <ToolbarButton
                  label="Editar em tela maior"
                  disabled={!isTextLike}
                  onClick={() => activeBlock && setExpandedBlock({ sectionIndex: activeSection, blockId: activeBlock.id })}
                >
                  <Maximize2 className="h-4 w-4" />
                </ToolbarButton>
              </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="mx-auto w-full max-w-3xl px-2 pb-16 pt-3 sm:px-6 sm:pt-4">
                <div className="rounded-xl border bg-card px-4 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-14 sm:py-10">
                  {!/^Seção\s+\d/i.test(activeSectionData?.title || "") && (
                    <div className="mb-1 text-xs font-semibold text-primary">Seção {activeSection + 1}</div>
                  )}
                  <Input
                    value={activeSectionData?.title || ""}
                    onChange={(e) => updateSectionTitle(activeSection, e.target.value)}
                    onFocus={() => setActiveBlockId(null)}
                    placeholder="Nome da seção"
                    aria-label="Nome da seção"
                    className="mb-5 h-auto border-none bg-transparent p-0 text-xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-[28px]"
                  />
                  <Droppable droppableId={`section-${activeSection}`} type="block">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[240px]">
                        {activeSectionData?.blocks.map((block, blockIndex) =>
                          renderBlock(block, activeSection, blockIndex)
                        )}
                        {provided.placeholder}

                        {activeSectionData?.blocks.length === 0 && (
                          <div className="py-10 text-center text-muted-foreground">
                            <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
                            <p className="text-sm">Esta seção está vazia</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                  <button
                    type="button"
                    onClick={() => addBlock(activeSection, "text")}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Plus className="h-4 w-4" /> Adicionar parágrafo
                  </button>
                </div>

                {/* Navegação entre seções */}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={activeSection === 0}
                    onClick={() => { setActiveSection(activeSection - 1); setActiveBlockId(null); }}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">Seção anterior</span>
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {activeSection + 1} de {formData.sections.length}
                  </span>
                  {activeSection === formData.sections.length - 1 ? (
                    <Button variant="ghost" size="sm" onClick={addSection}>
                      <Plus className="mr-1 h-4 w-4" />
                      Nova seção
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setActiveSection(activeSection + 1); setActiveBlockId(null); }}
                    >
                      <span className="hidden sm:inline">Próxima seção</span>
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </DragDropContext>
          </div>
        </main>

        {/* Detalhes do treinamento */}
        {showSettings && (
          <aside className="absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l bg-card shadow-xl sm:w-80 xl:relative xl:z-auto xl:shadow-none">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h3 className="text-sm font-semibold">Detalhes do treinamento</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7 xl:hidden" onClick={() => setShowSettings(false)} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Descrição</Label>
                  <Textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Resumo exibido no catálogo"
                    className="min-h-[72px] resize-none text-sm"
                    maxLength={500}
                  />
                </div>
                {/* Seleção de empresa para master */}
                {user?.role === "master" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Empresa
                    </Label>
                    <Select
                      value={formData.empresa_id || ""}
                      onValueChange={(value) => {
                        setFormData((prev) => ({
                          ...prev,
                          empresa_id: value,
                          departamento: "",
                          departamento_id: "",
                        }));
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id} value={empresa.id}>
                            {empresa.nome_fantasia || empresa.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, categoria: value }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.length > 0 ? (
                        categorias.map((cat) => (
                          <SelectItem key={cat.id} value={cat.nome}>
                            {cat.nome}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="Onboarding">Onboarding</SelectItem>
                          <SelectItem value="Segurança">Segurança</SelectItem>
                          <SelectItem value="Compliance">Compliance</SelectItem>
                          <SelectItem value="Vendas">Vendas</SelectItem>
                          <SelectItem value="Técnico">Técnico</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Nível</Label>
                  <Select
                    value={formData.nivel || "basico"}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, nivel: value }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basico">Básico</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Departamento</Label>
                  <Select
                    value={formData.departamento_id || formData.departamento}
                    onValueChange={(value) => {
                      if (value === "todos") {
                        setFormData((prev) => ({ ...prev, departamento: "Todos", departamento_id: "" }));
                      } else {
                        const dep = departamentosFiltrados.find(d => d.id === value);
                        setFormData((prev) => ({ ...prev, departamento: dep?.nome || value, departamento_id: value }));
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Departamentos</SelectItem>
                      {departamentosFiltrados.length > 0 ? (
                        departamentosFiltrados.map((dep) => (
                          <SelectItem key={dep.id} value={dep.id}>
                            {dep.nome}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none" disabled>Nenhum departamento encontrado</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Duração estimada</Label>
                  <div className="relative">
                    <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={formData.duracao}
                      onChange={(e) => {
                        // Auto-format to 00:00
                        let val = e.target.value.replace(/[^0-9:]/g, "");
                        if (val.length === 2 && !val.includes(":") && formData.duracao.length < val.length) {
                          val = val + ":";
                        }
                        if (val.length > 5) val = val.slice(0, 5);
                        setFormData((prev) => ({ ...prev, duracao: val }));
                      }}
                      placeholder="00:00"
                      maxLength={5}
                      className="h-9 text-sm pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Capa do treinamento</Label>
                  <div className="relative">
                    {formData.capa ? (
                      <div className="relative group">
                        <img
                          src={formData.capa}
                          alt="Capa"
                          className="w-full aspect-[16/8] object-cover rounded-lg"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setFormData((prev) => ({ ...prev, capa: undefined }))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="block border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">Clique para upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCoverUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Instrutor</Label>
                  <Select
                    value={formData.instrutor_id || ""}
                    onValueChange={(value) => {
                      const perfil = instrutores.find(i => i.id === value);
                      setFormData((prev) => ({ ...prev, instrutor_id: value, instrutor: perfil?.nome || "" }));
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione o instrutor" />
                    </SelectTrigger>
                    <SelectContent>
                      {instrutores.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
            </div>
          </aside>
        )}
      </div>
      )}

      {/* Hidden file input - aceita todos tipos de imagem */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={uploadContext?.type === "image" ? "image/*" : "video/*"}
        onChange={handleFileUpload}
      />

      {/* Preview dialog */}
      {renderPreviewContent()}

      {/* Editor expandido — tela maior pra formatar textos longos com mais conforto */}
      {expandedBlock && (() => {
        const block = formData.sections[expandedBlock.sectionIndex]?.blocks.find(
          (b) => b.id === expandedBlock.blockId
        );
        if (!block) return null;
        const alignClass = {
          left: "text-left",
          center: "text-center",
          right: "text-right",
          justify: "text-justify",
        }[block.align || "left"];
        return (
          <Dialog open onOpenChange={(open) => !open && setExpandedBlock(null)}>
            <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
              <DialogHeader className="p-4 border-b shrink-0">
                <DialogTitle>Editar conteúdo em tela maior</DialogTitle>
                <DialogDescription>Selecione um trecho e use Ctrl+B para negrito ou Ctrl+I para itálico.</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-hidden p-4">
                <div className="h-full overflow-y-auto rounded-lg border bg-card px-6 py-5">
                  <InlineRichText
                    autoFocus
                    value={block.content}
                    onChange={(content) =>
                      updateBlock(expandedBlock.sectionIndex, expandedBlock.blockId, { content })
                    }
                    placeholder="Comece a digitar seu conteúdo aqui..."
                    ariaLabel="Texto em tela maior"
                    className={cn("mx-auto max-w-3xl text-[17px] leading-[1.85]", alignClass)}
                  />
                </div>
              </div>
              <DialogFooter className="p-4 border-t shrink-0">
                <Button onClick={() => setExpandedBlock(null)}>Concluído</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
    </TooltipProvider>
  );
}
