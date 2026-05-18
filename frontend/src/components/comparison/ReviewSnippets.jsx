import { CheckCircle, AlertCircle } from 'lucide-react'

function SnippetList({ reviews, type }) {
  const isPos = type === 'positive'
  const Icon = isPos ? CheckCircle : AlertCircle
  const filtered = reviews
    .filter(r => r.sentiment === type)
    .slice(0, 3)

  if (filtered.length === 0) return (
    <p className="text-xs text-text-muted italic">Tidak ada ulasan {isPos ? 'positif' : 'negatif'}.</p>
  )

  return (
    <div className="space-y-2">
      {filtered.map((r, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-2.5 p-3 rounded-xl text-xs leading-relaxed ${
            isPos ? 'bg-positive/10' : 'bg-negative/10'
          }`}
        >
          <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isPos ? 'text-positive' : 'text-negative'}`} />
          <p className="text-text-main">{r.content}</p>
        </div>
      ))}
    </div>
  )
}

function ProductColumn({ product }) {
  if (!product) return null
  const { product_name, product_brand, reviews = [] } = product

  return (
    <div className="space-y-4">
      {/* Product label */}
      <div className="pb-3 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{product_brand}</p>
        <h3 className="text-sm font-semibold text-text-main leading-snug">{product_name}</h3>
      </div>

      {/* Positive */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle className="w-3.5 h-3.5 text-positive" />
          <p className="text-xs font-semibold text-positive">Yang disukai</p>
        </div>
        <SnippetList reviews={reviews} type="positive" />
      </div>

      {/* Negative */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <AlertCircle className="w-3.5 h-3.5 text-negative" />
          <p className="text-xs font-semibold text-negative">Perlu diperbaiki</p>
        </div>
        <SnippetList reviews={reviews} type="negative" />
      </div>
    </div>
  )
}

export default function ReviewSnippets({ product1, product2 }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-main mb-1">
        Analisis Sentimen Review
      </h2>
      <p className="text-xs text-text-muted mb-6">
        Ringkasan ulasan pengguna berdasarkan hasil klasifikasi model
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ProductColumn product={product1} />
        <ProductColumn product={product2} />
      </div>
    </section>
  )
}