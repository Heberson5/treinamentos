import { useEffect, useRef } from "react"

interface AnimatedMeshBackgroundProps {
  className?: string
}

/**
 * Fundo com "orbs" de gradiente flutuantes e leve paralaxe pelo mouse.
 * CSS puro + um mousemove leve — sem libs externas.
 */
export function AnimatedMeshBackground({ className = "" }: AnimatedMeshBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let raf = 0
    const handlePointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${(x - 0.5) * 2}`)
        el.style.setProperty("--my", `${(y - 0.5) * 2}`)
      })
    }

    window.addEventListener("pointermove", handlePointerMove)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden [perspective:1200px] ${className}`}
      style={{ "--mx": 0, "--my": 0 } as React.CSSProperties}
      aria-hidden="true"
    >
      <div
        className="absolute -top-1/4 -left-1/4 h-[60%] w-[60%] rounded-full bg-white/25 blur-3xl animate-mesh-float-slow"
        style={{
          transform:
            "translate3d(calc(var(--mx) * 24px), calc(var(--my) * 24px), 0)",
        }}
      />
      <div
        className="absolute top-1/3 -right-1/4 h-[55%] w-[55%] rounded-full bg-white/15 blur-3xl animate-mesh-float"
        style={{
          transform:
            "translate3d(calc(var(--mx) * -32px), calc(var(--my) * -18px), 0)",
        }}
      />
      <div
        className="absolute -bottom-1/4 left-1/3 h-[50%] w-[50%] rounded-full bg-white/10 blur-3xl animate-mesh-float-slower"
        style={{
          transform:
            "translate3d(calc(var(--mx) * 18px), calc(var(--my) * -24px), 0)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay [background-image:linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] [background-size:48px_48px]" />
    </div>
  )
}
