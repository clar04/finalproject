import { useEffect, useState } from 'react'
import { Loader2, Wifi, Brain, Database, CheckCircle2, XCircle, X } from 'lucide-react'

// Tahap-tahap animasi scraping yang ditampilkan ke user
const PHASES = [
  { icon: Wifi,       label: 'Membuka halaman produk...',       minElapsed: 0   },
  { icon: Wifi,       label: 'Mengumpulkan ulasan...',          minElapsed: 15  },
  { icon: Brain,      label: 'Menganalisis sentimen (ABSA)...', minElapsed: 60  },
  { icon: Database,   label: 'Menyimpan hasil analisis...',     minElapsed: 180 },
]

/**
 * Overlay UI untuk polling status scraping.
 *
 * Props:
 *   elapsed   {number}  - Waktu (detik) sejak scraping dimulai
 *   onCancel  {func}    - Callback saat user klik "Batalkan polling"
 */
export default function ScrapePollingOverlay({ elapsed = 0, onCancel }) {
  const [dotCount, setDotCount] = useState(1)

  // Animasi titik-titik (...)
  useEffect(() => {
    const t = setInterval(() => setDotCount(d => (d % 3) + 1), 500)
    return () => clearInterval(t)
  }, [])

  // Tentukan fase saat ini berdasarkan elapsed time
  const currentPhaseIdx = PHASES.reduce((acc, phase, idx) => {
    return elapsed >= phase.minElapsed ? idx : acc
  }, 0)

  const currentPhase = PHASES[currentPhaseIdx]
  const PhaseIcon    = currentPhase.icon

  // Format elapsed time
  const formatElapsed = (secs) => {
    if (secs < 60) return `${secs}d`
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}m ${s}d`
  }

  // Progress bar width (estimasi proses ~5 menit = 300 detik)
  const progressPct = Math.min(95, (elapsed / 300) * 100)

  return (
    <div className="bg-surface border border-primary/20 rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-main">Scraping berjalan di server</p>
            <p className="text-[10px] text-text-muted">
              Berjalan selama {formatElapsed(elapsed)} · polling setiap 5 detik
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            title="Hentikan polling (scraping tetap berjalan di server)"
            className="text-text-muted hover:text-negative transition-colors shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary rounded-full transition-all duration-1000"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Fase-fase */}
      <div className="space-y-2">
        {PHASES.map((phase, idx) => {
          const PIcon    = phase.icon
          const isDone   = idx < currentPhaseIdx
          const isCurrent = idx === currentPhaseIdx
          const isPending = idx > currentPhaseIdx

          return (
            <div key={idx} className={`flex items-center gap-2.5 transition-opacity ${isPending ? 'opacity-40' : ''}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                isDone    ? 'bg-positive text-white' :
                isCurrent ? 'bg-primary text-white'  :
                            'bg-border'
              }`}>
                {isDone
                  ? <CheckCircle2 className="w-3 h-3" />
                  : isCurrent
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <PIcon className="w-3 h-3 text-text-muted" />
                }
              </div>
              <span className={`text-xs ${isCurrent ? 'text-text-main font-medium' : 'text-text-muted'}`}>
                {phase.label}{isCurrent ? '.'.repeat(dotCount) : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Catatan */}
      <p className="text-[10px] text-text-muted mt-4 pl-0.5 leading-relaxed">
        Menutup halaman ini tidak menghentikan proses di server.
        Kamu bisa paste URL yang sama lagi nanti untuk mengambil hasilnya.
      </p>
    </div>
  )
}

/**
 * Banner error scraping yang informatif dan elegan.
 *
 * Props:
 *   message   {string}  - Pesan error
 *   type      {'error'|'warning'|'info'} - Tipe banner
 *   onDismiss {func}    - Callback saat user dismiss
 */
export function ErrorBanner({ message, type = 'error', onDismiss }) {
  if (!message) return null

  const config = {
    error: {
      container: 'bg-negative/8 border-negative/25',
      icon:      XCircle,
      iconColor: 'text-negative',
      textColor: 'text-negative',
    },
    warning: {
      container: 'bg-yellow-500/8 border-yellow-500/25',
      icon:      XCircle,
      iconColor: 'text-yellow-600',
      textColor: 'text-yellow-700',
    },
    info: {
      container: 'bg-primary/8 border-primary/25',
      icon:      Loader2,
      iconColor: 'text-primary',
      textColor: 'text-primary',
    },
  }

  const { container, icon: Icon, iconColor, textColor } = config[type] || config.error

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${container}`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
      <p className={`text-xs leading-relaxed flex-1 ${textColor}`}>{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className={`${iconColor} opacity-60 hover:opacity-100 shrink-0`}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
