import { useEffect, useState, useRef } from 'react'
import { Check, Loader2 } from 'lucide-react'

const STEPS = [
  { id: 'scraping',  label: 'Scraping ulasan Female Daily...',   durationMs: 1500 },
  { id: 'indobert',  label: 'Menjalankan analisis ABSA...',       durationMs: 1500 },
  { id: 'nss',       label: 'Menghitung Net Sentiment Score...',  durationMs: 1000 },
  { id: 'chart',     label: 'Menyiapkan visualisasi...',          durationMs: 800  },
]

/**
 * Overlay loading untuk proses komparasi.
 *
 * Props:
 *   isLoading  {boolean} - Apakah sedang loading
 *   hasResult  {boolean} - Apakah result sudah tersedia dari API
 *   onComplete {func}    - Dipanggil setelah animasi selesai DAN hasResult = true
 */
export default function LoadingOverlay({ isLoading, hasResult = false, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  // Apakah animasi step sudah sampai ke akhir (step terakhir)
  const [animDone, setAnimDone] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!isLoading) {
      // Reset semua state saat tidak loading
      setCurrentStep(0)
      setAnimDone(false)
      clearTimeout(timerRef.current)
      return
    }

    // Advance step satu per satu berdasarkan durationMs masing-masing step
    let stepIdx = 0
    setCurrentStep(0)
    setAnimDone(false)

    const advanceStep = () => {
      if (stepIdx >= STEPS.length - 1) {
        // Sudah di step terakhir — tandai anim selesai
        setAnimDone(true)
        return
      }
      stepIdx += 1
      setCurrentStep(stepIdx)
      timerRef.current = setTimeout(advanceStep, STEPS[stepIdx].durationMs)
    }

    timerRef.current = setTimeout(advanceStep, STEPS[0].durationMs)

    return () => clearTimeout(timerRef.current)
  }, [isLoading])

  // Panggil onComplete hanya saat KEDUANYA terpenuhi: animasi selesai + result sudah ada
  useEffect(() => {
    if (animDone && hasResult && isLoading) {
      // Sedikit delay agar step terakhir sempat terlihat sebagai "done"
      const t = setTimeout(() => onComplete?.(), 600)
      return () => clearTimeout(t)
    }
  }, [animDone, hasResult, isLoading, onComplete])

  if (!isLoading) return null

  // Apakah step terakhir ditampilkan — kalau animDone tapi belum hasResult, tahan di sini
  const displayStep = animDone && !hasResult ? STEPS.length - 1 : currentStep

  return (
    <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-center gap-6 mb-8">
      {/* Spinner */}
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-border" />
        <Loader2 className="absolute inset-0 w-14 h-14 text-primary animate-spin" />
      </div>

      {/* Current step label */}
      <div className="text-center">
        <p className="text-sm font-medium text-text-main">
          {STEPS[displayStep]?.label}
        </p>
        {/* Pesan tambahan saat animasi selesai tapi result belum tersedia */}
        {animDone && !hasResult && (
          <p className="text-xs text-text-muted mt-1 animate-pulse">
            Memproses banyak ulasan, harap bersabar...
          </p>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => (
          <div
            key={step.id}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx <= displayStep ? 'bg-primary' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Step checklist */}
      <div className="w-full max-w-xs space-y-2.5">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
              idx < displayStep
                ? 'bg-positive text-white'
                : idx === displayStep
                  ? 'bg-primary text-white'
                  : 'bg-border'
            }`}>
              {idx < displayStep
                ? <Check className="w-3 h-3" />
                : idx === displayStep
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : null
              }
            </div>
            <span className={`text-xs transition-colors ${
              idx <= displayStep ? 'text-text-main font-medium' : 'text-text-muted'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}