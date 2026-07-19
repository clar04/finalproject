import { useNavigate } from 'react-router-dom'
import { ArrowRight, Palette, Tag } from 'lucide-react'

// ── NSS threshold warna (skala -100 s/d +100) ──────────────────
// ≥ 50  → Sangat Baik      (hijau)
// 0–49  → Cukup Baik       (kuning/amber)
// < 0   → Perlu Perhatian  (merah)
export function getNSSColor(score) {
  if (score >= 50) return 'text-positive'
  if (score >= 0)  return 'text-amber-600'
  return 'text-negative'
}

export function getNSSBg(score) {
  if (score >= 50) return 'bg-positive/10'
  if (score >= 0)  return 'bg-amber-50'
  return 'bg-negative/10'
}

export function getNSSLabel(score) {
  if (score >= 50) return 'Sangat Baik'
  if (score >= 0)  return 'Cukup Baik'
  return 'Perlu Perhatian'
}

// Helper: label aspek Indonesia
const ASPECT_LABELS = {
  pigmentation: 'Pigmentasi',
  longevity:    'Ketahanan',
  texture:      'Tekstur',
  hydration:    'Hidrasi',
  price:        'Harga',
}

export default function ProductCard({ product, weightedNSS }) {
  const navigate = useNavigate()

  const {
    _id,
    product_name,
    product_brand,
    product_shade,
    product_category,
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
          <h3 className="text-xs sm:text-sm font-semibold text-text-main leading-snug line-clamp-1">
            {product_name}
          </h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {product_category && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-[9px] sm:text-[10px] text-primary font-medium">
                <Tag className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                {product_category}
              </span>
            )}
            {product_shade && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background border border-border text-[9px] sm:text-[10px] text-text-muted">
                <Palette className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                <span className="truncate max-w-[60px] sm:max-w-[90px]">{product_shade}</span>
              </span>
            )}
          </div>
        </div>

        {/* NSS / Skor Rekomendasi badge */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <div className={`flex flex-col items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${getNSSBg(weightedNSS ?? overall_nss)}`}>
            <span className={`text-xs sm:text-sm font-bold tabular-nums leading-none ${getNSSColor(weightedNSS ?? overall_nss)}`}>
              {weightedNSS ?? overall_nss}
            </span>
            <span className="text-[7px] sm:text-[8px] text-text-muted leading-none mt-0.5">
              {weightedNSS != null ? 'Skor' : 'NSS'}
            </span>
          </div>
          {weightedNSS != null && (
            <span className="text-[8px] text-text-muted tabular-nums leading-none">
              NSS {overall_nss}
            </span>
          )}
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
            const barColor =
              score >= 50 ? 'bg-positive' :
              score >= 0  ? 'bg-amber-400' :
              'bg-negative'
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <span className="text-[10px] sm:text-xs text-text-muted">
                    {ASPECT_LABELS[key] || key}
                  </span>
                  <span className={`text-[10px] sm:text-xs font-semibold tabular-nums ${getNSSColor(score)}`}>
                    {score}
                  </span>
                </div>
                <div className="h-1 sm:h-1.5 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
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