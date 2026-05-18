import { BarChart3 } from 'lucide-react'

const ASPECT_LABELS = {
  pigmentation: 'Pigmentasi',
  longevity:    'Ketahanan',
  texture:      'Tekstur',
  hydration:    'Hidrasi',
  price:        'Harga',
}

export default function ABSABreakdown({ aspects }) {
  // aspects: [{ aspect: 'texture', positive: 1823, negative: 312, neutral: 145, nss: 76 }]

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
          <p className="text-xs text-text-muted">Breakdown sentimen per atribut produk</p>
        </div>
      </div>

      <div className="space-y-5">
        {aspects.map(({ aspect, positive, negative, neutral = 0, nss }) => {
          const total = positive + negative + neutral
          const posPercent = total > 0 ? (positive / total) * 100 : 0
          const negPercent = total > 0 ? (negative / total) * 100 : 0
          const neuPercent = total > 0 ? (neutral / total) * 100 : 0

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
                <span className={`text-xs font-semibold ${nss >= 0 ? 'text-positive' : 'text-negative'}`}>
                  NSS {nss > 0 ? '+' : ''}{nss}
                </span>
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
                    className="h-full bg-neutral-s flex items-center justify-center transition-all duration-500"
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
            </div>
          )
        })}
      </div>
    </section>
  )
}