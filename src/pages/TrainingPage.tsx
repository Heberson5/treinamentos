// src/pages/TrainingPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useTraining } from "@/contexts/training-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveTimer } from "@/hooks/use-active-timer";
import { Volume2, VolumeX, ArrowLeft, ChevronDown } from "lucide-react";

/* ================= Helpers ================= */
const isYouTube = (u: string) =>
  !!u && /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)/i.test(u);

const getYouTubeId = (u: string): string | null => {
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    const v = url.searchParams.get("v");
    if (v) return v;
    const parts = url.pathname.split("/");
    const idx = parts.findIndex((p) => p === "embed");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {}
  return null;
};

function formatHMS(total: number) {
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Tenta achar a URL do vídeo em diferentes formatos de treinamento */
function resolveVideoUrl(t: any): string {
  if (!t) return "";
  // campos diretos comuns
  if (t.videoUrl) return String(t.videoUrl);
  if (t.video) return String(t.video);
  if (t.url) return String(t.url);
  // blocos/conteúdos
  if (Array.isArray(t.conteudos) && t.conteudos.length) {
    // prioriza tipo 'video'
    const byType = t.conteudos.find((c: any) => (c?.tipo || c?.type) === "video" && (c?.url || c?.src));
    if (byType) return String(byType.url || byType.src);
    // primeiro que tiver url/src
    const any = t.conteudos.find((c: any) => c?.url || c?.src);
    if (any) return String(any.url || any.src);
  }
  // capas às vezes vêm com vídeo (menos comum)
  if (t.capa && /\.(mp4|webm|ogg)(\?.*)?$/i.test(t.capa)) return String(t.capa);
  return "";
}

/* ================= Página ================= */
export default function TrainingPage() {
  const params = useParams();
  const navigate = useNavigate();
  const rawId = params.id ?? "";
  const normalizedId = decodeURIComponent(rawId);

  const { getTrainingById, accessTraining } = useTraining();

  // Busca tolerante: string ou number
  const training = useMemo(() => {
    const t = getTrainingById(normalizedId as any);
    if (t) return t;
    const asNum = Number(normalizedId);
    if (!Number.isNaN(asNum)) return getTrainingById(String(asNum) as any);
    return undefined;
  }, [getTrainingById, normalizedId]);

  const videoUrl = resolveVideoUrl(training);
  const [muted, setMuted] = useState(true);
  const [techOpen, setTechOpen] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Timer: conta só com aba visível/focada
  const timer = useActiveTimer({ autoStart: true });

  // marca acesso
  useEffect(() => {
    if (training?.id != null) accessTraining(Number(training.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training?.id]);

  // tenta autoplay em HTML5 (YouTube usa param no src)
  useEffect(() => {
    setVideoError(null);
    if (!videoRef.current || !videoUrl) return;
    if (isYouTube(videoUrl)) return;
    const v = videoRef.current;
    v.muted = true;
    v.play().catch(() => {
      // alguns navegadores bloqueiam; usuário pode clicar Play
    });
  }, [videoUrl]);

  // Treinamentos do banco (id UUID) são estudados na tela de estudo
  if (!training && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(normalizedId)) {
    return <Navigate to={`/executar-treinamento/${normalizedId}`} replace />;
  }

  if (!training) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Card className="p-6">Treinamento não encontrado.</Card>
      </div>
    );
  }

  const title = training.titulo || "Treinamento";
  const isYT = isYouTube(videoUrl);
  const ytId = isYT ? getYouTubeId(videoUrl) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        </div>
        <Badge variant="secondary" className="text-sm">
          Tempo nesta tela: {timer.formattedActiveTime}
        </Badge>
      </div>

      {/* Player */}
      <Card className="p-0 overflow-hidden">
        <div className="relative bg-black aspect-video">
          {!videoUrl ? (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground p-4 text-center">
              Nenhum vídeo associado a este treinamento.
            </div>
          ) : isYT && ytId ? (
            <iframe
              className="absolute inset-0 w-full h-full border-0"
              // autoplay + mudo (navegadores exigem mudo p/ autoplay)
              src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&autoplay=1&mute=1&playsinline=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                muted={muted}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-contain bg-black"
                onError={() => setVideoError("Não foi possível carregar o vídeo. Verifique a URL ou as permissões (CORS).")}
              />
              <div className="absolute top-3 right-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setMuted((m) => !m)}
                  className="gap-2"
                  title={muted ? "Ativar som" : "Silenciar"}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {muted ? "Mudo" : "Som"}
                </Button>
              </div>
            </>
          )}
        </div>
        {videoError && (
          <div className="p-3 text-sm text-destructive">
            {videoError}
          </div>
        )}
      </Card>

      {/* Detalhes técnicos (diagnóstico) */}
      <Card className="p-0 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40"
          onClick={() => setTechOpen((o) => !o)}
        >
          <span>⚙ Detalhes técnicos</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${techOpen ? "rotate-180" : ""}`} />
        </button>
        {techOpen && (
          <div className="px-4 pb-4 text-sm">
            <div><b>ID (rota):</b> {normalizedId}</div>
            <div><b>ID (objeto):</b> {String(training.id)}</div>
            <div className="break-all">
              <b>URL detectada:</b> {videoUrl || "(vazio)"}
            </div>
            <div><b>Tipo:</b> {isYT ? "YouTube (embed)" : "HTML5 (video tag)"}</div>
            {!isYT && videoUrl && videoUrl.startsWith("http://") && (
              <div className="text-amber-500">
                Aviso: URLs HTTP podem ser bloqueadas em sites HTTPS (mixed content).
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Descrição (se houver) */}
      {training.descricao && (
        <Card className="p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {training.descricao}
          </div>
        </Card>
      )}
    </div>
  );
}
