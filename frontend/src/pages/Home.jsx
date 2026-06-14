import { useState, useMemo, useEffect } from 'react'
import { Search, PackageSearch, ArrowUpDown, SlidersHorizontal, X } from 'lucide-react'
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

export default function Home() {
  const [products, setProducts]       = useState([])
  const [isLoading, setIsLoading]     = useState(true)
  const [error, setError]             = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy]           = useState('nss_desc')
  const [showSortPanel, setShowSortPanel] = useState(false)

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

  const filteredAndSorted = useMemo(() => {
    if (!Array.isArray(products)) return []

    let result = products.filter(product => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        product.product_name?.toLowerCase().includes(q) ||
        product.product_brand?.toLowerCase().includes(q)
      )
    })

    result = [...result].sort((a, b) => {
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
  }, [products, searchQuery, sortBy])

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Page header */}
        <div className="mb-5">
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

        {/* ── Toolbar ─────────────────────────────────────── */}
        <div className="mb-5 space-y-2">

          {/* Row 1: Search + Sort toggle */}
          <div className="flex items-center gap-2">
            {/* Search — grows to fill available space */}
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

            {/* Sort toggle button — visible on mobile only */}
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

            {/* Sort pills — desktop only (hidden on mobile, replaced by panel below) */}
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
            <p className="text-sm text-text-muted">Coba ubah kata kunci pencarian</p>
          </div>
        )}

        {/* Product grid — 2 col on mobile, 2 col sm, 3 col lg */}
        {!isLoading && !error && filteredAndSorted.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {filteredAndSorted.map(product => (
              <ProductCard
                key={product._id}
                product={product}
              />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}