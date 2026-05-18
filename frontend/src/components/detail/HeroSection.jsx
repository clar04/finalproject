import { Star, MessageSquare, TrendingUp, ShieldCheck, Timer, GitCompare } from 'lucide-react'
import { useCompare } from '../../context/CompareContext'
import { useNavigate } from 'react-router-dom'

export default function HeroSection({ product, analysisTime }) {
  const { addToCompare, isInCompare, compareList } = useCompare()
  const navigate = useNavigate()

  const {
    _id,
    product_name,
    product_brand,
    product_price,
    rating,
    total_reviews = 0,
    overall_nss = 0,
  } = product

  const alreadyInCompare = isInCompare(_id)

  const handleAddToCompare = () => {
    addToCompare(product)
    if (compareList.length >= 1) {
      // Sudah 2 produk → langsung ke halaman compare
      navigate('/compare')
    }
  }

  const stats = [
    {
      icon: Star,
      label: 'Average Rating',
      value: rating ? rating.toFixed(1) : 'N/A',
      color: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      icon: MessageSquare,
      label: 'Reviews Analyzed',
      value: total_reviews.toLocaleString('id-ID'),
      badge: analysisTime ? `${analysisTime}s` : null,
      color: 'bg-accent/10',
      iconColor: 'text-accent',
    },
    {
      icon: TrendingUp,
      label: 'Net Sentiment Score',
      value: `${overall_nss > 0 ? '+' : ''}${overall_nss}`,
      color: 'bg-positive/10',
      iconColor: 'text-positive',
    },
    {
      icon: ShieldCheck,
      label: 'Data Source',
      value: 'Female Daily',
      color: 'bg-primary/10',
      iconColor: 'text-primary',
    },
  ]

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

      {/* Product image placeholder */}
      <div className="aspect-square bg-surface rounded-2xl border border-border flex items-center justify-center shadow-sm overflow-hidden">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-4xl">💄</span>
          </div>
          <p className="text-sm font-medium text-primary">{product_brand}</p>
        </div>
      </div>

      {/* Product info */}
      <div className="flex flex-col justify-center gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
            {product_brand}
          </p>
          <h1 className="text-2xl lg:text-3xl font-semibold text-text-main leading-snug">
            {product_name}
          </h1>
          {product_price && (
            <p className="text-xl font-semibold text-text-main mt-2">
              Rp {Number(product_price).toLocaleString('id-ID')}
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map(({ icon: Icon, label, value, badge, color, iconColor }) => (
            <div
              key={label}
              className="bg-surface border border-border rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-text-muted truncate">{label}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-base font-semibold text-text-main">{value}</p>
                    {badge && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded-full">
                        <Timer className="w-2.5 h-2.5" />
                        {badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add to compare button */}
        <button
          onClick={handleAddToCompare}
          disabled={alreadyInCompare}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            alreadyInCompare
              ? 'bg-border text-text-muted cursor-not-allowed'
              : 'bg-primary text-white hover:opacity-90 shadow-sm shadow-primary/20'
          }`}
        >
          <GitCompare className="w-4 h-4" />
          {alreadyInCompare ? 'Sudah ditambahkan' : 'Tambah ke Compare'}
        </button>

        <p className="text-xs text-text-muted">
          Data dikumpulkan via scraping Female Daily · Analisis sentimen real-time
        </p>
      </div>
    </section>
  )
}