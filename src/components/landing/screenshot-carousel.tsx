import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ScreenshotCarouselProps {
  images: string[]
  autoplay?: boolean
  autoplaySpeed?: number
  transition?: "slide" | "fade"
}

export function ScreenshotCarousel({
  images,
  autoplay = true,
  autoplaySpeed = 5,
  transition = "slide",
}: ScreenshotCarouselProps) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!autoplay || images.length <= 1) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length)
    }, Math.max(1, autoplaySpeed) * 1000)
    return () => clearInterval(timer)
  }, [images.length, autoplay, autoplaySpeed])

  if (images.length === 0) return null

  const goTo = (index: number) => setCurrent((index + images.length) % images.length)

  const transitionStyle =
    transition === "fade"
      ? { transitionProperty: "opacity", transitionDuration: "700ms" }
      : { transitionProperty: "transform, opacity", transitionDuration: "700ms" }

  return (
    <section className="py-16 md:py-20 bg-accent/20 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Conheça a plataforma
          </h2>
          <p className="text-lg text-muted-foreground">
            Uma prévia da experiência que sua equipe vai ter
          </p>
        </div>

        <div className="relative" style={{ perspective: "1400px" }}>
          <div className="relative h-[260px] sm:h-[340px] md:h-[420px] flex items-center justify-center">
            {images.map((src, index) => {
              const offset = index - current
              const abs = Math.abs(offset)
              const visible = abs <= 2

              const translateX = offset * 46
              const rotateY = offset * -35
              const scale = offset === 0 ? 1 : 1 - Math.min(abs, 2) * 0.16
              const zIndex = 100 - abs
              const opacity = visible ? (offset === 0 ? 1 : 1 - abs * 0.35) : 0

              return (
                <button
                  key={src + index}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Ver imagem ${index + 1}`}
                  className="absolute w-[70%] sm:w-[55%] md:w-[45%] aspect-video rounded-2xl overflow-hidden border shadow-xl bg-card cursor-pointer"
                  style={{
                    transform: `translateX(${translateX}%) rotateY(${rotateY}deg) scale(${scale})`,
                    zIndex,
                    opacity,
                    pointerEvents: visible ? "auto" : "none",
                    ...transitionStyle,
                  }}
                >
                  <img
                    src={src}
                    alt={`Prévia da plataforma ${index + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              )
            })}
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                aria-label="Imagem anterior"
                className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground rounded-full p-2 shadow z-[200] transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                aria-label="Próxima imagem"
                className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground rounded-full p-2 shadow z-[200] transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="flex justify-center gap-2 mt-6">
                {images.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Ir para imagem ${index + 1}`}
                    onClick={() => goTo(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === current ? "w-6 bg-primary" : "w-2 bg-primary/30"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
