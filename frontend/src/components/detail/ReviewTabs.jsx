import { useState } from 'react'
import { MessageSquare, ThumbsUp, ThumbsDown, Minus, User, BadgeCheck } from 'lucide-react'

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
    icon: ThumbsUp,
    label: 'Positif',
    className: 'bg-positive/10 text-positive',
  },
  negative: {
    icon: ThumbsDown,
    label: 'Negatif',
    className: 'bg-negative/10 text-negative',
  },
  neutral: {
    icon: Minus,
    label: 'Netral',
    className: 'bg-border text-text-muted',
  },
}

export default function ReviewTabs({ reviews }) {
  const [activeTab, setActiveTab] = useState('all')

  const tabs = ['all', 'pigmentation', 'longevity', 'texture', 'hydration', 'price']

  const filtered = activeTab === 'all'
    ? reviews
    : reviews.filter(r => r.aspect === activeTab)

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-text-main">Review per Aspek</h2>
          <p className="text-xs text-text-muted">Filter ulasan berdasarkan atribut produk</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 pb-4 mb-4 border-b border-border">
        {tabs.map(tab => {
          const count = tab === 'all'
            ? reviews.length
            : reviews.filter(r => r.aspect === tab).length
          if (tab !== 'all' && count === 0) return null

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-background text-text-muted hover:bg-border/40 hover:text-text-main'
              }`}
            >
              {ASPECT_LABELS[tab]}
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                activeTab === tab ? 'bg-white/20' : 'bg-border/60 text-text-muted'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Review list */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-text-muted py-10">
            Tidak ada ulasan untuk aspek ini.
          </p>
        ) : (
          filtered.map(review => {
            const sentConfig = SENTIMENT_CONFIG[review.sentiment] || SENTIMENT_CONFIG.neutral
            const SentIcon = sentConfig.icon

            return (
              <div
                key={review.id}
                className="border border-border rounded-xl p-4 bg-background hover:bg-border/20 transition-colors"
              >
                {/* Author row */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-text-main">
                          {review.author}
                        </span>
                        {review.isVerified && (
                          <span className="flex items-center gap-0.5 text-[10px] text-primary">
                            <BadgeCheck className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </div>
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
                <p className="text-xs text-text-main leading-relaxed mb-2.5">
                  {review.content}
                </p>

                {/* Aspect tag */}
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface border border-border text-[10px] text-text-muted">
                  {ASPECT_LABELS[review.aspect] || review.aspect}
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}