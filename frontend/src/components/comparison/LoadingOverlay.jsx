import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

const STEPS = [
  { id: 'scraping',  label: 'Scraping ulasan Female Daily...' },
  { id: 'indobert',  label: 'Menjalankan analisis...' },
  { id: 'nss',       label: 'Menghitung Net Sentiment Score...' },
  { id: 'chart',     label: 'Menyiapkan visualisasi...' },
]

export default function LoadingOverlay({ isLoading, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0)
      return
    }

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= STEPS.length - 1) {
          clearInterval(interval)
          setTimeout(() => onComplete?.(), 600)
          return prev
        }
        return prev + 1
      })
    }, 1100)

    return () => clearInterval(interval)
  }, [isLoading, onComplete])

  if (!isLoading) return null

  return (
    <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-center gap-6 mb-8">
      {/* Spinner */}
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-border" />
        <Loader2 className="absolute inset-0 w-14 h-14 text-primary animate-spin" />
      </div>

      {/* Current step label */}
      <p className="text-sm font-medium text-text-main">
        {STEPS[currentStep]?.label}
      </p>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => (
          <div
            key={step.id}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx <= currentStep ? 'bg-primary' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Step checklist */}
      <div className="w-full max-w-xs space-y-2.5">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
              idx < currentStep
                ? 'bg-positive text-white'
                : idx === currentStep
                  ? 'bg-primary text-white'
                  : 'bg-border'
            }`}>
              {idx < currentStep
                ? <Check className="w-3 h-3" />
                : idx === currentStep
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : null
              }
            </div>
            <span className={`text-xs transition-colors ${
              idx <= currentStep ? 'text-text-main font-medium' : 'text-text-muted'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}