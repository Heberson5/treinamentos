import { useRef, useState, type ReactNode, type CSSProperties } from "react"
import { cn } from "@/lib/utils"

interface TiltCardProps {
  children: ReactNode
  className?: string
  /** Intensidade máxima da rotação em graus. */
  maxTilt?: number
  /** Aplica um leve realce de brilho que segue o cursor. */
  glare?: boolean
}

/**
 * Envolve qualquer card e aplica uma leve inclinação 3D ao passar o mouse,
 * dando sensação de profundidade sem depender de nenhuma lib de animação.
 */
export function TiltCard({ children, className, maxTilt = 8, glare = true }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({})
  const [glareStyle, setGlareStyle] = useState<CSSProperties>({ opacity: 0 })
  // Skip the tilt/glare math entirely under reduced motion, rather than
  // relying on a CSS transition-duration override to hide a transform
  // that would otherwise still snap to the cursor on every mousemove.
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion.current) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const rotateY = (px - 0.5) * maxTilt * 2
    const rotateX = (0.5 - py) * maxTilt * 2

    setStyle({
      transform: `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`,
      transition: "transform 60ms linear",
    })

    if (glare) {
      setGlareStyle({
        opacity: 1,
        background: `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.35), transparent 60%)`,
      })
    }
  }

  const handleMouseLeave = () => {
    if (reducedMotion.current) return
    setStyle({
      transform: "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)",
      transition: "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
    })
    setGlareStyle({ opacity: 0, transition: "opacity 300ms ease" })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={cn("relative will-change-transform [transform-style:preserve-3d]", className)}
    >
      {children}
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={glareStyle}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
