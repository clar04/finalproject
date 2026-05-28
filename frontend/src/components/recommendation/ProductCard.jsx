import { useNavigate } from 'react-router-dom'
import { TrendingUp, Flame, ArrowRight } from 'lucide-react'

// Helper: warna NSS score
function getNSSColor(score) {
  if (score >= 60) return 'text-positive'
  if (score >= 20) return 'text-primary'
  return 'text-negative'
}

// Helper: label aspek Indonesia
const ASPECT_LABELS = {
  pigmentation: 'Pigmentasi',
  longevity:    'Ketahanan',
  texture:      'Tekstur',
  hydration:    'Hidrasi',
  price:        'Harga',
}

export default function ProductCard({ product, selectedFilters }) {
  const navigate = useNavigate()

  const {
    _id,
    product_name,
    product_brand,
    product_price,
    isTrending = false,
    nss_scores = {},       // { pigmentation: 82, longevity: -10, ... }
    overall_nss = 0,
    total_reviews = 0,
  } = product

  // Aspek yang ditampilkan: kalau ada filter aktif, tampilkan yang difilter
  // Kalau tidak ada filter, tampilkan 3 aspek pertama
  const aspectsToShow = selectedFilters.length > 0
    ? Object.entries(nss_scores).filter(([key]) => selectedFilters.includes(key))
    : Object.entries(nss_scores).slice(0, 3)

  return (
    <div
      onClick={() => navigate(`/product/${_id}`)}
      className="group bg-surface border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all duration-200"
    >
      {/* Header: nama + badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          {product_brand && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-0.5 truncate">
              {product_brand}
            </p>
          )}
          <h3 className="text-sm font-semibold text-text-main leading-snug line-clamp-2">
            {product_name}
          </h3>
          {product_price && (
            <p className="text-xs text-text-muted mt-1">Rp {Number(product_price).toLocaleString('id-ID')}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Trending badge di-hide sementara */}
          <span className={`flex items-center gap-1 text-sm font-bold ${getNSSColor(overall_nss)}`}>
            <TrendingUp className="w-3.5 h-3.5" />
            {overall_nss > 0 ? '+' : ''}{overall_nss}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-4" />

      {/* ABSA NSS bars per aspek */}
      <div className="space-y-3 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          NSS per Aspek
        </p>
        {aspectsToShow.length > 0 ? (
          aspectsToShow.map(([key, score]) => {
            // NSS range -100 to +100, normalize ke bar 0-100%
            const barWidth = Math.max(0, Math.min(100, ((score + 100) / 200) * 100))
            const isPos = score >= 0
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-muted">
                    {ASPECT_LABELS[key] || key}
                  </span>
                  <span className={`text-xs font-semibold ${isPos ? 'text-positive' : 'text-negative'}`}>
                    {score > 0 ? '+' : ''}{score}
                  </span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isPos ? 'bg-positive' : 'bg-negative'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-xs text-text-muted italic">Tidak ada data aspek</p>
        )}
      </div>

      {/* Footer: total reviews + CTA */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-text-muted">
          {total_reviews.toLocaleString('id-ID')} ulasan
        </p>
        <span className="flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Lihat detail <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  )
}