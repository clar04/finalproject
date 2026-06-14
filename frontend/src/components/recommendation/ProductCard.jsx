import { useNavigate } from 'react-router-dom'
import { ArrowRight, Palette } from 'lucide-react'

// Helper: warna NSS score
function getNSSColor(score) {
  if (score >= 60) return 'text-positive'
  if (score >= 20) return 'text-primary'
  return 'text-negative'
}

function getNSSBg(score) {
  if (score >= 60) return 'bg-positive/10'
  if (score >= 20) return 'bg-primary/10'
  return 'bg-negative/10'
}

// Helper: label aspek Indonesia
const ASPECT_LABELS = {
  pigmentation: 'Pigmentasi',
  longevity:    'Ketahanan',
  texture:      'Tekstur',
  hydration:    'Hidrasi',
  price:        'Harga',
}

export default function ProductCard({ product }) {
  const navigate = useNavigate()

  const {
    _id,
    product_name,
    product_brand,
    product_shade,
    product_price,
    nss_scores = {},
    overall_nss = 0,
    total_reviews = 0,
    overall_is_low_confidence = false,
  } = product

  // Selalu tampilkan top 3 aspek berdasarkan nilai absolut NSS (paling signifikan)
  const aspectsToShow = Object.entries(nss_scores)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 3)

  return (
    <div
      onClick={() => navigate(`/product/${_id}`)}
      className="group bg-surface border border-border rounded-2xl p-3 sm:p-5 cursor-pointer hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all duration-200 flex flex-col"
    >
      {/* Header: nama + overall NSS */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          {product_brand && (
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-primary mb-0.5 truncate">
              {product_brand}
            </p>
          )}
          <h3 className="text-xs sm:text-sm font-semibold text-text-main leading-snug line-clamp-2">
            {product_name}
          </h3>
          {product_shade && (
            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-background border border-border text-[9px] sm:text-[10px] text-text-muted">
              <Palette className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
              <span className="truncate max-w-[80px] sm:max-w-[120px]">{product_shade}</span>
            </span>
          )}
          {product_price && (
            <p className="text-[10px] sm:text-xs text-text-muted mt-0.5">
              Rp {Number(product_price).toLocaleString('id-ID')}
            </p>
          )}
        </div>

        {/* NSS badge */}
        <div className={`flex flex-col items-center justify-center shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${getNSSBg(overall_nss)}`}>
          <span className={`text-xs sm:text-sm font-bold tabular-nums leading-none ${getNSSColor(overall_nss)}`}>
            {overall_nss}
          </span>
          <span className="text-[7px] sm:text-[8px] text-text-muted leading-none mt-0.5">NSS</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-3" />

      {/* Top 3 ABSA NSS bars */}
      <div className="space-y-2 sm:space-y-3 flex-1">
        <p className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          NSS per Aspek
        </p>
        {aspectsToShow.length > 0 ? (
          aspectsToShow.map(([key, score]) => {
            const barWidth = Math.max(0, Math.min(100, ((score + 100) / 200) * 100))
            const isPos = score >= 0
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <span className="text-[10px] sm:text-xs text-text-muted">
                    {ASPECT_LABELS[key] || key}
                  </span>
                  <span className={`text-[10px] sm:text-xs font-semibold tabular-nums ${isPos ? 'text-positive' : 'text-negative'}`}>
                    {score}
                  </span>
                </div>
                <div className="h-1 sm:h-1.5 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isPos ? 'bg-positive' : 'bg-negative'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-[10px] sm:text-xs text-text-muted italic">Tidak ada data aspek</p>
        )}
      </div>

      {/* Footer: total reviews + CTA */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <p className="text-[9px] sm:text-[10px] text-text-muted">
            {total_reviews.toLocaleString('id-ID')} ulasan
          </p>
          {overall_is_low_confidence && (
            <span
              title="Data ulasan terbatas, skor mungkin belum representatif"
              className="text-[9px] sm:text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 leading-none"
            >
              ⚠ Data terbatas
            </span>
          )}
        </div>
        <span className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Detail <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </span>
      </div>
    </div>
  )
}