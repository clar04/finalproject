import { BarChart3 } from 'lucide-react'
import { getNSSColor, getNSSLabel } from '../recommendation/ProductCard'

const ASPECT_LABELS = {
  pigmentation: 'Pigmentasi',
  longevity:    'Ketahanan',
  texture:      'Tekstur',
  hydration:    'Hidrasi',
  price:        'Harga',
}

export default function ABSABreakdown({ aspects }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-text-main">
            Aspect-Based Sentiment Analysis
          </h2>
          <p className="text-xs text-text-muted">
            Breakdown sentimen per atribut produk
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {aspects.map(({ aspect, positive, negative, neutral = 0, nss, is_low_count, low_count_warning }) => {
          const total      = positive + negative + neutral
          const posPercent = total > 0 ? (positive / total) * 100 : 0
          const negPercent = total > 0 ? (negative / total) * 100 : 0
          const neuPercent = total > 0 ? (neutral  / total) * 100 : 0

          const nssColor = nss == null ? 'text-text-muted' : getNSSColor(nss)
          const nssLabel = nss == null ? null : getNSSLabel(nss)

          return (
            <div key={aspect}>
              {/* Aspect name + mention count + NSS */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-main">
                    {ASPECT_LABELS[aspect] || aspect}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {total.toLocaleString('id-ID')} mention
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold tabular-nums ${nssColor}`}>
                    {nss == null ? 'NSS –' : `NSS ${nss}`}
                  </span>
                  {nssLabel && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                      nss >= 50 ? 'bg-positive/10 text-positive' :
                      nss >= 10 ? 'bg-amber-50 text-amber-700' :
                      nss > -10 ? 'bg-border text-text-muted' :
                      'bg-negative/10 text-negative'
                    }`}>
                      {nssLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Stacked bar */}
              <div className="flex h-7 rounded-lg overflow-hidden">
                {posPercent > 0 && (
                  <div
                    className="h-full bg-positive flex items-center justify-start transition-all duration-500"
                    style={{ width: `${posPercent}%` }}
                  >
                    {posPercent >= 12 && (
                      <span className="text-[11px] font-semibold text-white pl-2">
                        {posPercent.toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
                {neuPercent > 0 && (
                  <div
                    className="h-full flex items-center justify-center transition-all duration-500"
                    style={{ width: `${neuPercent}%`, backgroundColor: '#C9B8BD' }}
                  >
                    {neuPercent >= 12 && (
                      <span className="text-[11px] font-semibold text-white">
                        {neuPercent.toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
                {negPercent > 0 && (
                  <div
                    className="h-full bg-negative flex items-center justify-end transition-all duration-500"
                    style={{ width: `${negPercent}%` }}
                  >
                    {negPercent >= 12 && (
                      <span className="text-[11px] font-semibold text-white pr-2">
                        {negPercent.toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Legend counts */}
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-positive inline-block" />
                  Positif ({positive.toLocaleString('id-ID')})
                </div>
                {neutral > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#C9B8BD' }} />
                    Netral ({neutral.toLocaleString('id-ID')})
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  Negatif ({negative.toLocaleString('id-ID')})
                  <span className="w-2 h-2 rounded-full bg-negative inline-block" />
                </div>
              </div>

              {/* Low-count warning */}
              {is_low_count && low_count_warning && (
                <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 mt-2
                                bg-amber-50 border border-amber-200 text-amber-800">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span>
                  <span>{low_count_warning}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
