import { useState, useMemo } from 'react'
import { MessageSquare, ThumbsUp, ThumbsDown, Minus, User, Layers } from 'lucide-react'

const ASPECT_LABELS = {
  all:          'Semua',
  pigmentation: 'Pigmentasi',
  longevity:    'Ketahanan',
  texture:      'Tekstur',
  hydration:    'Hidrasi',
  price:        'Harga',
}

const SENTIMENT_CONFIG = {
  positive: {
    icon:      ThumbsUp,
    label:     'Positif',
    className: 'bg-positive/10 text-positive',
    badgeCls:  'bg-positive/10 text-positive border-positive/20',
  },
  negative: {
    icon:      ThumbsDown,
    label:     'Negatif',
    className: 'bg-negative/10 text-negative',
    badgeCls:  'bg-negative/10 text-negative border-negative/20',
  },
  neutral: {
    icon:      Minus,
    label:     'Netral',
    className: 'bg-border text-text-muted',
    badgeCls:  'bg-border/60 text-text-muted border-border',
  },
}

// ── Komponen kartu untuk tab Per Aspek ────────────────────────────────────────
function AspectReviewCard({ review }) {
  const sentConfig = SENTIMENT_CONFIG[review.sentiment] || SENTIMENT_CONFIG.neutral
  const SentIcon   = sentConfig.icon

  return (
    <div className="border border-border rounded-xl p-4 bg-background hover:bg-border/20 transition-colors">
      {/* Author row */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div>
            <span className="text-xs font-semibold text-text-main">{review.author}</span>
            <p className="text-[10px] text-text-muted">{review.date}</p>
          </div>
        </div>

        {/* Sentiment badge */}
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium shrink-0 ${sentConfig.className}`}>
          <SentIcon className="w-3 h-3" />
          {sentConfig.label}
        </span>
      </div>

      {/* Review text */}
      <p className="text-xs text-text-main leading-relaxed mb-2.5">{review.content}</p>

      {/* Aspect tag */}
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface border border-border text-[10px] text-text-muted">
        {ASPECT_LABELS[review.aspect] || review.aspect}
      </span>
    </div>
  )
}

// ── Komponen kartu untuk tab Per Ulasan (dipakai dalam carousel) ───────────────
function GroupedReviewCard({ review }) {
  const overallConfig = SENTIMENT_CONFIG[review.overall] || SENTIMENT_CONFIG.neutral
  const OverallIcon   = overallConfig.icon

  return (
    <div className="border border-border rounded-xl p-4 bg-background hover:bg-border/20 transition-colors">
      {/* Author row */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div>
            <span className="text-xs font-semibold text-text-main">{review.author}</span>
            <p className="text-[10px] text-text-muted">{review.date}</p>
          </div>
        </div>

        {/* Overall sentiment badge */}
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium shrink-0 ${overallConfig.className}`}>
          <OverallIcon className="w-3 h-3" />
          {overallConfig.label}
        </span>
      </div>

      {/* Review text */}
      <p className="text-xs text-text-main leading-relaxed mb-3">{review.content}</p>

      {/* Aspect + sentiment badges */}
      <div className="flex flex-wrap gap-1.5">
        {review.aspects.map((asp, i) => {
          const cfg  = SENTIMENT_CONFIG[asp.sentiment] || SENTIMENT_CONFIG.neutral
          const Icon = cfg.icon
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${cfg.badgeCls}`}
            >
              <Icon className="w-2.5 h-2.5" />
              {ASPECT_LABELS[asp.aspect] || asp.aspect}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReviewTabs({ reviews, reviewsGrouped }) {
  // Tab mode: 'aspect' = filter per aspek, 'grouped' = per ulasan unik
  const [mode,           setMode]           = useState('grouped')
  const [selectedAspects, setSelectedAspects] = useState(new Set())

  const aspectKeys = ['pigmentation', 'longevity', 'texture', 'hydration', 'price']

  const toggleAspect = (key) => {
    setSelectedAspects(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const uniqueReviews = useMemo(() => {
    const seen = new Set()
    return reviews.filter(r => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
  }, [reviews])

  const filteredAspect = useMemo(() => {
    if (selectedAspects.size === 0) return uniqueReviews
    return reviews.filter(r => selectedAspects.has(r.aspect))
  }, [reviews, uniqueReviews, selectedAspects])

  // reviews_grouped dari backend; fallback kalau API lama belum punya field ini
  const grouped = reviewsGrouped ?? []

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-text-main">Ulasan</h2>
          <p className="text-xs text-text-muted">
            {uniqueReviews.length} ulasan unik · {reviews.length} label aspek
          </p>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('grouped')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'grouped'
              ? 'bg-primary text-white'
              : 'bg-background text-text-muted hover:bg-border/40 hover:text-text-main'
          }`}
        >
          <User className="w-3 h-3" />
          Per Ulasan
        </button>
        <button
          onClick={() => setMode('aspect')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'aspect'
              ? 'bg-primary text-white'
              : 'bg-background text-text-muted hover:bg-border/40 hover:text-text-main'
          }`}
        >
          <Layers className="w-3 h-3" />
          Per Aspek
        </button>
      </div>

      {/* ── Mode: Per Ulasan ── */}
      {mode === 'grouped' && (
        <>
          <p className="text-[10px] text-text-muted mb-3">
            {grouped.length} ulasan · setiap kartu menampilkan semua aspek yang terdeteksi
          </p>
          <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1">
            {grouped.length === 0 ? (
              <p className="text-center text-sm text-text-muted py-10">Tidak ada data ulasan.</p>
            ) : (
              grouped.map((review, idx) => (
                <GroupedReviewCard key={review.id ?? idx} review={review} />
              ))
            )}
          </div>
        </>
      )}

      {/* ── Mode: Per Aspek ── */}
      {mode === 'aspect' && (
        <>
          {/* Aspect filter chips — multi-select */}
          <div className="flex flex-wrap gap-1.5 pb-4 mb-4 border-b border-border">
            <button
              onClick={() => setSelectedAspects(new Set())}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedAspects.size === 0
                  ? 'bg-primary text-white'
                  : 'bg-background text-text-muted hover:bg-border/40 hover:text-text-main'
              }`}
            >
              Semua
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                selectedAspects.size === 0 ? 'bg-white/20' : 'bg-border/60 text-text-muted'
              }`}>
                {uniqueReviews.length}
              </span>
            </button>

            {aspectKeys.map(key => {
              const count = reviews.filter(r => r.aspect === key).length
              if (count === 0) return null
              const isActive = selectedAspects.has(key)
              return (
                <button
                  key={key}
                  onClick={() => toggleAspect(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-background text-text-muted hover:bg-border/40 hover:text-text-main'
                  }`}
                >
                  {ASPECT_LABELS[key]}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    isActive ? 'bg-white/20' : 'bg-border/60 text-text-muted'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="text-[10px] text-text-muted mb-3">
            {selectedAspects.size === 0
              ? `${uniqueReviews.length} ulasan unik · ${reviews.length} total label aspek`
              : `${filteredAspect.length} label aspek · filter: ${[...selectedAspects].map(a => ASPECT_LABELS[a]).join(', ')}`
            }
          </p>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {filteredAspect.length === 0 ? (
              <p className="text-center text-sm text-text-muted py-10">
                Tidak ada ulasan untuk aspek ini.
              </p>
            ) : (
              filteredAspect.map((review, idx) => (
                <AspectReviewCard key={`${review.id}-${review.aspect}-${idx}`} review={review} />
              ))
            )}
          </div>
        </>
      )}
    </section>
  )
}