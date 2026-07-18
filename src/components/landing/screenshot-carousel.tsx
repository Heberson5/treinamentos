import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ScreenshotCarouselProps {
  images: string[]
}

export function ScreenshotCarousel({ images }: ScreenshotCarouselProps) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [images.length])

  if (images.length === 0) return null

  const goTo = (index: number) => setCurrent((index + images.length) % images.length)

  return (
    <section className="py-16 bg-accent/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Conheça a plataforma
          </h2>
          <p className="text-lg text-muted-foreground">
            Uma prévia da experiência que sua equipe vai ter
          </p>
        </div>

        <div className="relative rounded-2xl overflow-hidden border shadow-lg bg-card">
          <div className="relative aspect-video w-full">
            {images.map((src, index) => (
              <img
                key={src + index}
                src={src}
                alt={`Prévia da plataforma ${index + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                  index === current ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              />
            ))}
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                aria-label="Imagem anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground rounded-full p-2 shadow transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                aria-label="Próxima imagem"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground rounded-full p-2 shadow transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
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
