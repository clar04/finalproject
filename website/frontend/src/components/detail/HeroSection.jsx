import { MessageSquare, TrendingUp, ShieldCheck, Timer, GitCompare, Palette, HelpCircle, Tag } from 'lucide-react'
import { useCompare } from '../../context/CompareContext'
import { useNavigate } from 'react-router-dom'
import { getNSSColor, getNSSLabel } from '../recommendation/ProductCard'
import { useState } from 'react'

export default function HeroSection({ product, analysisTime }) {
  const { addToCompare, isInCompare, compareList } = useCompare()
  const navigate = useNavigate()
  const [showNSSGuide, setShowNSSGuide] = useState(false)

  const {
    _id,
    product_name,
    product_brand,
    product_shade,
    product_category,
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

  const nssColor = getNSSColor(overall_nss)
  const nssLabel = getNSSLabel(overall_nss)

  const stats = [
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
      value: String(overall_nss),
      color: 'bg-positive/10',
      iconColor: 'text-positive',
      isNSS: true,
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
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">

      {/* Product image — constrained height on mobile */}
      <div className="w-full max-h-64 sm:max-h-80 lg:max-h-none lg:aspect-square bg-surface rounded-2xl border border-border flex items-center justify-center shadow-sm overflow-hidden relative">
        {product.product_image ? (
          <img src={product.product_image} alt={product_name} className="w-full h-full object-contain p-4" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-text-muted">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-4xl">💄</span>
            </div>
            <p className="text-sm font-medium text-primary">{product_brand}</p>
          </div>
        )}
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
          <div className="flex flex-wrap gap-2 mt-2">
            {product_category && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-xs text-primary font-medium">
                <Tag className="w-3.5 h-3.5 shrink-0" />
                {product_category}
              </span>
            )}
            {product_shade && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text-muted">
                <Palette className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-medium">{product_shade}</span>
              </span>
            )}
          </div>
          {product_price && (
            <p className="text-xl font-semibold text-text-main mt-2">
              Rp {Number(product_price).toLocaleString('id-ID')}
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map(({ icon: Icon, label, value, badge, color, iconColor, isNSS }) => (
            <div
              key={label}
              className="bg-surface border border-border rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-text-muted truncate">{label}</p>
                    {isNSS && (
                      <button
                        onClick={() => setShowNSSGuide(v => !v)}
                        className="text-text-muted hover:text-primary transition-colors shrink-0"
                        title="Klik untuk lihat panduan NSS"
                      >
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-base font-semibold ${isNSS ? nssColor : 'text-text-main'}`}>
                      {value}
                    </p>
                    {isNSS && (
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        overall_nss >= 50 ? 'bg-positive/10 text-positive' :
                        overall_nss >= 0  ? 'bg-amber-50 text-amber-700' :
                        'bg-negative/10 text-negative'
                      }`}>
                        {nssLabel}
                      </span>
                    )}
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

        {/* NSS Guide panel — muncul saat tombol ? diklik */}
        {showNSSGuide && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs leading-relaxed">
            <p className="font-semibold text-text-main mb-2">📊 Panduan Membaca NSS</p>
            <p className="text-text-muted mb-2">
              Net Sentiment Score (NSS) mengukur sentimen ulasan pada skala <strong>−100</strong> hingga <strong>+100</strong>.
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-positive shrink-0" />
                <span className="text-positive font-medium">≥ 50 — Sangat Baik</span>
                <span className="text-text-muted">· produk sangat disukai pengguna</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-amber-600 font-medium">0 s/d 49 — Cukup Baik</span>
                <span className="text-text-muted">· ulasan mayoritas positif</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-negative shrink-0" />
                <span className="text-negative font-medium">&lt; 0 — Perlu Perhatian</span>
                <span className="text-text-muted">· ulasan negatif mendominasi</span>
              </div>
            </div>
          </div>
        )}

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