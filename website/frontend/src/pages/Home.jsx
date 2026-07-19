import { useState, useMemo, useEffect } from 'react'
import { Search, PackageSearch, ArrowUpDown, SlidersHorizontal, X, Tag, Sparkles, Settings2, HelpCircle } from 'lucide-react'
import Navbar from '../components/shared/Navbar'
import ProductCard from '../components/recommendation/ProductCard'
import { getAllProducts } from '../services/api'

const SORT_OPTIONS = [
  { value: 'nss_desc',  label: 'NSS Tertinggi' },
  { value: 'nss_asc',   label: 'NSS Terendah'  },
  { value: 'name_asc',  label: 'A → Z'          },
  { value: 'name_desc', label: 'Z → A'          },
  { value: 'date_desc', label: 'Terbaru'         },
  { value: 'date_asc',  label: 'Terlama'         },
]

const CATEGORY_LABELS = {
  lipcream:   'Lip Cream',
  lipstick:   'Lipstick',
  liptint:    'Lip Tint',
  lipgloss:   'Lip Gloss',
  lipbalm:    'Lip Balm',
  lipserum:   'Lip Serum',
  lipliner:   'Lip Liner',
  lipplumper: 'Lip Plumper',
  lipstain:   'Lip Stain',
}

const ASPECT_LABELS = {
  pigmentation: 'Pigmentasi',
  longevity:    'Ketahanan',
  texture:      'Tekstur',
  hydration:    'Hidrasi',
  price:        'Harga',
}

const ASPECTS = Object.entries(ASPECT_LABELS).map(([key, label]) => ({ key, label }))

// Normalisasi string kategori ke key CATEGORY_LABELS
function normalizeCategoryKey(str) {
  if (!str) return null
  const norm = str.toLowerCase().replace(/[\s-]/g, '')
  if (CATEGORY_LABELS[norm]) return norm
  for (const key of Object.keys(CATEGORY_LABELS)) {
    if (norm.includes(key)) return key   // cukup satu arah — hindari false positive
  }
  return null
}

/** Ekstrak kategori dari URL path Female Daily (fallback untuk produk lama). */
function extractCategory(url) {
  if (!url) return null
  const SKIP = new Set(['products', 'lips', 'eyes', 'face', 'skin', 'body', 'hair'])
  try {
    const segments = new URL(url).pathname.toLowerCase().split('/').filter(Boolean)
    for (const seg of segments) {
      if (SKIP.has(seg)) continue
      const key = normalizeCategoryKey(seg)
      if (key) return key
    }
  } catch {
    const path = url.toLowerCase()
    for (const key of Object.keys(CATEGORY_LABELS)) {
      if (path.includes(key)) return key
    }
  }
  return null
}

/** Ambil kategori produk: pakai field product_category jika ada, fallback ke URL. */
function getProductCategory(product) {
  if (product.product_category) {
    const norm = normalizeCategoryKey(product.product_category)
    if (norm) return norm
  }
  return extractCategory(product.product_url)
}


 // Hitung bobot per aspek per kategori dari frekuensi mention di data DB
 // Bobot = review_count[aspek] / total_mention_kategori
 
function computeCategoryWeights(products) {
  const mentionCounts = {}
  products.forEach(p => {
    const cat = getProductCategory(p)
    if (!cat || !Array.isArray(p.absa_aspects)) return
    if (!mentionCounts[cat]) mentionCounts[cat] = {}
    p.absa_aspects.forEach(({ aspect, review_count = 0 }) => {
      if (!aspect) return
      mentionCounts[cat][aspect] = (mentionCounts[cat][aspect] || 0) + review_count
    })
  })

  const weights = {}
  Object.entries(mentionCounts).forEach(([cat, counts]) => {
    const total = Object.values(counts).reduce((s, v) => s + v, 0)
    if (total === 0) return
    weights[cat] = {}
    Object.entries(counts).forEach(([aspect, count]) => {
      weights[cat][aspect] = count / total
    })
  })
  return weights
}

// Hitung NSS tertimbang satu produk dengan bobot yang diberikan //
function getWeightedNSS(product, weights) {
  if (!weights || !product.nss_scores) return null
  let score = 0
  Object.entries(weights).forEach(([aspect, w]) => {
    score += (product.nss_scores[aspect] ?? 0) * w
  })
  return Math.round(score * 10) / 10
}

export default function Home() {
  const [products, setProducts]           = useState([])
  const [isLoading, setIsLoading]         = useState(true)
  const [error, setError]                 = useState(null)
  const [searchQuery, setSearchQuery]     = useState('')
  const [sortBy, setSortBy]               = useState('nss_desc')
  const [showSortPanel, setShowSortPanel] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedAspects, setSelectedAspects] = useState([])
  const [customWeights, setCustomWeights]     = useState({})
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [modalAspects, setModalAspects]       = useState([])
  const [modalWeights, setModalWeights]       = useState({})
  const [showTutorial, setShowTutorial]       = useState(false)
  const [activeHelp, setActiveHelp]           = useState(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true)
        const data = await getAllProducts()
        setProducts(Array.isArray(data) ? data : [])
      } catch (err) {
        setError('Gagal memuat produk. Pastikan backend berjalan.')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const toggleAspect = (key) => {
    if (selectedAspects.includes(key)) {
      setSelectedAspects(prev => prev.filter(a => a !== key))
      setCustomWeights(prev => { const n = { ...prev }; delete n[key]; return n })
    } else {
      setSelectedAspects(prev => [...prev, key])
    }
  }

  // Bobot aspek per kategori — dihitung dari frekuensi mention di data
  const categoryWeights = useMemo(() => computeCategoryWeights(products), [products])

  /**
   * Bobot aktif dengan prioritas:
   *   1. Aspek yang dipilih user secara manual
   *      → pakai bobot custom jika diisi, fallback ke sama rata
   *   2. Bobot kategori dari data (jika kategori aktif)
   *   3. null → sort biasa tanpa pembobotan
   */
  const activeWeights = useMemo(() => {
    if (selectedAspects.length > 0) {
      const hasCustom = selectedAspects.some(a => Number(customWeights[a]) > 0)
      if (hasCustom) {
        const filledTotal = selectedAspects.reduce((s, a) => s + (Number(customWeights[a]) || 0), 0)
        const emptyAspects = selectedAspects.filter(a => !(Number(customWeights[a]) > 0))
        // Jika total isian >= 100 atau semua terisi: normalisasi proporsional
        if (filledTotal >= 100 || emptyAspects.length === 0) {
          return Object.fromEntries(
            selectedAspects.map(a => [a, (Number(customWeights[a]) || 0) / filledTotal])
          )
        }
        // Sisa persentase dibagi rata ke aspek yang tidak diisi
        const remainder = 100 - filledTotal
        const emptyShare = remainder / emptyAspects.length
        return Object.fromEntries(
          selectedAspects.map(a => {
            const v = Number(customWeights[a]) || 0
            return [a, v > 0 ? v / 100 : emptyShare / 100]
          })
        )
      }
      const w = 1 / selectedAspects.length
      return Object.fromEntries(selectedAspects.map(a => [a, w]))
    }
    if (activeCategory !== 'all' && activeCategory !== 'other') {
      return categoryWeights[activeCategory] || null
    }
    return null
  }, [selectedAspects, activeCategory, categoryWeights, customWeights])

  const openWeightModal = () => {
    setModalAspects([...selectedAspects])
    setModalWeights({ ...customWeights })
    setShowWeightModal(true)
  }

  const applyWeightModal = () => {
    setSelectedAspects(modalAspects)
    setCustomWeights(modalWeights)
    setShowWeightModal(false)
  }

  const toggleModalAspect = (key) => {
    if (modalAspects.includes(key)) {
      setModalAspects(prev => prev.filter(a => a !== key))
      setModalWeights(prev => { const n = { ...prev }; delete n[key]; return n })
    } else {
      setModalAspects(prev => [...prev, key])
    }
  }

  // Mode rekomendasi aktif saat ada bobot + sort berbasis NSS
  const isWeightedMode = activeWeights !== null && (sortBy === 'nss_desc' || sortBy === 'nss_asc')

  // Label sumber bobot untuk banner
  const weightSource = selectedAspects.length > 0 ? 'manual' : 'category'

  // Top 3 aspek dengan bobot terbesar (untuk banner kategori)
  const topWeightDisplay = useMemo(() => {
    if (!isWeightedMode || !activeWeights || weightSource !== 'category') return []
    return Object.entries(activeWeights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([asp, w]) => ({ label: ASPECT_LABELS[asp] || asp, pct: Math.round(w * 100) }))
  }, [isWeightedMode, activeWeights, weightSource])

  // Hitung kategori yang tersedia di data (pakai getProductCategory)
  const availableCategories = useMemo(() => {
    const counts = {}
    let otherCount = 0
    products.forEach(p => {
      const cat = getProductCategory(p)
      if (cat) counts[cat] = (counts[cat] || 0) + 1
      else otherCount++
    })
    const cats = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, count]) => ({ cat, count }))
    if (otherCount > 0) cats.push({ cat: 'other', count: otherCount })
    return cats
  }, [products])

  const filteredAndSorted = useMemo(() => {
    if (!Array.isArray(products)) return []

    let result = products.filter(product => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchText = (
          product.product_name?.toLowerCase().includes(q) ||
          product.product_brand?.toLowerCase().includes(q)
        )
        if (!matchText) return false
      }
      if (activeCategory !== 'all') {
        const cat = getProductCategory(product)
        if (activeCategory === 'other') {
          if (cat !== null) return false
        } else {
          if (cat !== activeCategory) return false
        }
      }
      return true
    })

    result = [...result].sort((a, b) => {
      if (isWeightedMode) {
        const wA = getWeightedNSS(a, activeWeights) ?? -999
        const wB = getWeightedNSS(b, activeWeights) ?? -999
        return sortBy === 'nss_asc' ? wA - wB : wB - wA
      }
      switch (sortBy) {
        case 'nss_desc':  return (b.overall_nss ?? -999) - (a.overall_nss ?? -999)
        case 'nss_asc':   return (a.overall_nss ?? 999)  - (b.overall_nss ?? 999)
        case 'name_asc':  return (a.product_name || '').localeCompare(b.product_name || '', 'id')
        case 'name_desc': return (b.product_name || '').localeCompare(a.product_name || '', 'id')
        case 'date_desc': return (b._id || '').localeCompare(a._id || '')
        case 'date_asc':  return (a._id || '').localeCompare(b._id || '')
        default: return 0
      }
    })

    return result
  }, [products, searchQuery, sortBy, activeCategory, activeWeights, isWeightedMode])

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Page header */}
        <div className="mb-5 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-text-main">Katalog Produk</h1>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
              {isLoading ? 'Memuat...' : (
                <span>
                  <span className="font-semibold text-primary">{filteredAndSorted.length}</span>
                  {' '}produk tersedia dengan analisis sentimen ABSA
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-muted border border-border hover:text-primary hover:border-primary/30 transition-all shrink-0 mt-0.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cara pakai</span>
          </button>
        </div>

        {/* ── Toolbar ─────────────────────────────────────── */}
        <div className="mb-5 space-y-2">

          {/* Row 1: Search + Sort toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari produk atau brand..."
                className="w-full h-10 pl-10 pr-9 text-sm bg-surface border border-border rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort toggle button — mobile only */}
            <button
              onClick={() => setShowSortPanel(o => !o)}
              className={`sm:hidden flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-medium transition-all shrink-0 ${
                showSortPanel || sortBy !== 'nss_desc'
                  ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                  : 'bg-surface border-border text-text-muted'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {sortBy !== 'nss_desc' ? activeSortLabel : 'Urutkan'}
            </button>

            {/* Sort pills — desktop only */}
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Urutkan:
              </div>
              <div className="flex gap-1.5">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      sortBy === opt.value
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-surface border border-border text-text-muted hover:text-text-main hover:border-primary/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Sort panel (mobile, collapsible) */}
          {showSortPanel && (
            <div className="sm:hidden flex flex-wrap gap-1.5 p-3 bg-surface border border-border rounded-xl">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setShowSortPanel(false) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === opt.value
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-background border border-border text-text-muted hover:text-text-main'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Row 3: Category filter chips */}
          {!isLoading && availableCategories.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                  <Tag className="w-3 h-3" />
                  <span className="hidden sm:inline">Jenis:</span>
                  <button
                    onClick={() => setActiveHelp(activeHelp === 'category' ? null : 'category')}
                    className={`transition-colors ${activeHelp === 'category' ? 'text-primary' : 'text-text-muted/50 hover:text-primary'}`}
                  >
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex gap-1.5 flex-nowrap">
                  <button
                    onClick={() => setActiveCategory('all')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                      activeCategory === 'all'
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-surface border border-border text-text-muted hover:text-text-main hover:border-primary/30'
                    }`}
                  >
                    Semua
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      activeCategory === 'all' ? 'bg-white/20' : 'bg-border/60 text-text-muted'
                    }`}>
                      {products.length}
                    </span>
                  </button>
                  {availableCategories.map(({ cat, count }) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                        activeCategory === cat
                          ? 'bg-primary text-white shadow-sm shadow-primary/20'
                          : 'bg-surface border border-border text-text-muted hover:text-text-main hover:border-primary/30'
                      }`}
                    >
                      {cat === 'other' ? 'Lainnya' : (CATEGORY_LABELS[cat] || cat)}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        activeCategory === cat ? 'bg-white/20' : 'bg-border/60 text-text-muted'
                      }`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {activeHelp === 'category' && (
                <div className="px-3 py-2.5 bg-primary/5 border border-primary/15 rounded-xl text-[11px] text-text-muted leading-relaxed">
                  <span className="font-medium text-text-main">Filter Jenis</span> — tampilkan hanya produk dari kategori tertentu (Lip Cream, Lip Tint, dll.).
                  Saat kategori aktif dan urutan NSS dipilih, produk otomatis diurutkan menggunakan bobot aspek dari frekuensi ulasan kategori tersebut.
                </div>
              )}
            </div>
          )}

          {/* Row 4: Aspect priority toggles */}
          {!isLoading && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                  <SlidersHorizontal className="w-3 h-3" />
                  <button
                    onClick={() => setActiveHelp(activeHelp === 'aspect' ? null : 'aspect')}
                    className={`transition-colors ${activeHelp === 'aspect' ? 'text-primary' : 'text-text-muted/50 hover:text-primary'}`}
                  >
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex gap-1.5 flex-nowrap items-center">
                  <button
                    onClick={openWeightModal}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-accent/40 text-accent hover:bg-accent/10 transition-all shrink-0"
                  >
                    <Settings2 className="w-3 h-3" />
                    Atur
                  </button>
                  {ASPECTS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleAspect(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                        selectedAspects.includes(key)
                          ? 'bg-accent text-white shadow-sm shadow-accent/20'
                          : 'bg-surface border border-border text-text-muted hover:text-text-main hover:border-accent/30'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {selectedAspects.length > 0 && (
                    <button
                      onClick={() => { setSelectedAspects([]); setCustomWeights({}) }}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-negative transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                      Reset
                    </button>
                  )}
                </div>
              </div>
              {activeHelp === 'aspect' && (
                <div className="px-3 py-2.5 bg-accent/5 border border-accent/15 rounded-xl text-[11px] text-text-muted leading-relaxed">
                  <span className="font-medium text-text-main">Prioritas Aspek</span> — pilih aspek yang paling penting bagimu.
                  Klik chip langsung untuk pilih cepat (bobot otomatis sama rata).
                  Klik <span className="font-medium text-accent">Atur</span> untuk memilih beberapa aspek sekaligus dan mengatur bobot masing-masing secara manual.
                </div>
              )}
            </div>
          )}

          {/* Banner rekomendasi */}
          {isWeightedMode && (
            <div className="flex items-start gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              {weightSource === 'manual' ? (
                <p className="text-xs text-text-muted">
                  <span className="font-medium text-primary">Diprioritaskan:</span>
                  {' '}
                  {(() => {
                    return selectedAspects.map((a, i) => {
                      const pct = (activeWeights?.[a] ?? 0) * 100
                      const isWhole = Number.isInteger(Math.round(pct * 10) / 10)
                      const display = isWhole
                        ? Math.round(pct) + '%'
                        : pct.toFixed(1).replace('.', ',') + '%'
                      return (
                        <span key={a}>
                          <span className="font-medium text-text-main">{ASPECT_LABELS[a]}</span>
                          {' '}
                          <span className="text-primary">({display})</span>
                          {i < selectedAspects.length - 1 ? ' + ' : ''}
                        </span>
                      )
                    })
                  })()}
                </p>
              ) : (
                <p className="text-xs text-text-muted">
                  <span className="font-medium text-primary">
                    Rekomendasi {CATEGORY_LABELS[activeCategory] || activeCategory}
                  </span>
                  {topWeightDisplay.length > 0 && (
                    <>
                      {' · '}bobot dari data ulasan:{' '}
                      {topWeightDisplay.map((item, i) => (
                        <span key={item.label}>
                          <span className="font-medium text-text-main">{item.label}</span>
                          {' '}
                          <span className="text-primary">({item.pct}%)</span>
                          {i < topWeightDisplay.length - 1 ? ' · ' : ''}
                        </span>
                      ))}
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
                <div className="h-3 bg-border rounded w-1/3 mb-2" />
                <div className="h-4 bg-border rounded w-2/3 mb-5" />
                <div className="space-y-2.5">
                  <div className="h-2.5 bg-border rounded" />
                  <div className="h-2.5 bg-border rounded w-4/5" />
                  <div className="h-2.5 bg-border rounded w-3/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-negative/10 flex items-center justify-center mb-4">
              <PackageSearch className="w-7 h-7 text-negative" />
            </div>
            <p className="text-sm font-medium text-text-main">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredAndSorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <PackageSearch className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-text-main mb-1">Produk tidak ditemukan</h3>
            <p className="text-sm text-text-muted">
              {activeCategory !== 'all'
                ? `Tidak ada produk kategori "${activeCategory === 'other' ? 'Lainnya' : (CATEGORY_LABELS[activeCategory] || activeCategory)}" yang cocok.`
                : 'Coba ubah kata kunci pencarian'
              }
            </p>
            {activeCategory !== 'all' && (
              <button
                onClick={() => setActiveCategory('all')}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Tampilkan semua kategori
              </button>
            )}
          </div>
        )}

        {/* Product grid */}
        {!isLoading && !error && filteredAndSorted.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {filteredAndSorted.map(product => (
              <ProductCard
                key={product._id}
                product={product}
                weightedNSS={isWeightedMode ? getWeightedNSS(product, activeWeights) : undefined}
              />
            ))}
          </div>
        )}

      </main>

      {/* Modal atur prioritas aspek */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowWeightModal(false)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-text-main mb-1">Atur Prioritas Aspek</h3>
            <p className="text-xs text-text-muted mb-5">
              Pilih aspek yang penting untukmu dan atur bobotnya. Kosongkan bobot untuk dibagi rata otomatis.
            </p>

            <div className="space-y-3 mb-2">
              {ASPECTS.map(({ key, label }) => {
                const isChecked = modalAspects.includes(key)
                return (
                  <div key={key} className="flex items-center gap-3">
                    <button
                      onClick={() => toggleModalAspect(key)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                        isChecked ? 'bg-accent border-accent' : 'border-border hover:border-accent/50'
                      }`}
                    >
                      {isChecked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                    </button>
                    <span className={`flex-1 text-sm transition-colors ${isChecked ? 'text-text-main font-medium' : 'text-text-muted'}`}>
                      {label}
                    </span>
                    {isChecked && (
                      <div className="relative flex items-center shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={modalWeights[key] ?? ''}
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '')
                            setModalWeights(prev => ({ ...prev, [key]: val }))
                          }}
                          placeholder="—"
                          className="w-16 h-8 shrink-0 text-sm text-center bg-background border border-border rounded-lg text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-accent tabular-nums pr-5"
                        />
                        <span className="absolute right-2 text-[10px] text-text-muted pointer-events-none">%</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Total indicator */}
            {modalAspects.length > 0 && (() => {
              const filled    = modalAspects.filter(a => Number(modalWeights[a]) > 0)
              const total     = filled.reduce((s, a) => s + Number(modalWeights[a]), 0)
              const allFilled = filled.length === modalAspects.length
              const hasAny    = filled.length > 0
              if (!hasAny)
                return <p className="text-[11px] text-text-muted mt-3 mb-4">Bobot sama rata — {Math.round(100 / modalAspects.length)}% per aspek</p>
              if (allFilled && total !== 100)
                return <p className="text-[11px] text-negative mt-3 mb-4 font-medium">Total: <span className="tabular-nums">{total}%</span> — harus tepat 100%</p>
              if (!allFilled && total >= 100)
                return <p className="text-[11px] text-negative mt-3 mb-4 font-medium">Total diisi: <span className="tabular-nums">{total}%</span> — sudah melebihi 100%, tidak ada sisa untuk aspek kosong</p>
              if (!allFilled)
                return <p className="text-[11px] text-text-muted mt-3 mb-4">Total diisi: <span className="tabular-nums font-medium">{total}%</span> · sisa <span className="tabular-nums font-medium">{100 - total}%</span> dibagi rata ke aspek kosong</p>
              return <p className="text-[11px] text-positive mt-3 mb-4 font-medium">Total: 100% ✓</p>
            })()}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowWeightModal(false)}
                className="flex-1 py-2 text-sm text-text-muted border border-border rounded-xl hover:bg-border/30 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={applyWeightModal}
                disabled={(() => {
                  if (modalAspects.length === 0) return true
                  const filled = modalAspects.filter(a => Number(modalWeights[a]) > 0)
                  const total  = filled.reduce((s, a) => s + Number(modalWeights[a]), 0)
                  if (filled.length === modalAspects.length) return total !== 100
                  return total >= 100
                })()}
                className="flex-1 py-2 text-sm bg-accent text-white rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tutorial cara pakai */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTutorial(false)} />
          <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-text-main">Cara Pakai</h3>
              <button onClick={() => setShowTutorial(false)} className="text-text-muted hover:text-text-main transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-text-muted">
              <div>
                <p className="font-semibold text-text-main mb-1">1. Cari Produk</p>
                <p>Ketik nama produk atau brand di kolom pencarian untuk menyaring daftar.</p>
              </div>
              <div>
                <p className="font-semibold text-text-main mb-1">2. Filter Jenis</p>
                <p>Klik chip jenis produk (Lip Cream, Lip Tint, dll.) untuk menampilkan kategori tertentu saja. Saat kategori aktif, urutan produk otomatis memakai bobot dari data ulasan kategori itu.</p>
              </div>
              <div>
                <p className="font-semibold text-text-main mb-1">3. Prioritaskan Aspek</p>
                <p>Klik chip aspek (Pigmentasi, Tekstur, dll.) untuk memilih aspek yang penting buatmu. Produk akan diurutkan berdasarkan skor aspek yang kamu pilih.</p>
                <p className="mt-1">Klik <span className="font-medium text-accent">Atur</span> untuk memilih beberapa aspek sekaligus dan mengatur bobot masing-masing (harus total 100%).</p>
              </div>
              <div>
                <p className="font-semibold text-text-main mb-1">4. Skor NSS</p>
                <p>Net Sentiment Score berkisar <span className="font-medium text-negative">−100</span> (sangat negatif) hingga <span className="font-medium text-positive">+100</span> (sangat positif). Skor sudah disesuaikan dengan jumlah ulasan — produk dengan sedikit ulasan skornya lebih konservatif.</p>
              </div>
              <div>
                <p className="font-semibold text-text-main mb-1">5. Urutkan</p>
                <p>Gunakan tombol urutkan untuk mengubah urutan tampilan. NSS Tertinggi/Terendah akan memakai skor tertimbang kalau ada aspek yang aktif.</p>
              </div>
            </div>

            <button
              onClick={() => setShowTutorial(false)}
              className="mt-5 w-full py-2 text-sm bg-primary text-white rounded-xl hover:opacity-90 transition-all font-medium"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}