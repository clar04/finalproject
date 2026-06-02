import { useState, useRef, useEffect } from 'react'
import { Search, Link, ChevronDown, X, Loader2, Sparkles } from 'lucide-react'
import { searchProducts, scrapeProduct } from '../../services/api'

export default function ProductSelector({ label, selectedProduct, onSelect, excludeId }) {
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState([])
  const [isOpen, setIsOpen]           = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isScraping, setIsScraping]   = useState(false)
  const [scrapeError, setScrapeError] = useState(null)
  const wrapperRef = useRef(null)

  // Kalkulasi sebelum efek agar bisa dipakai di dalam callback
  const isUrl = query.trim().startsWith('http')

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Search dengan debounce 400ms (hanya kalau bukan URL)
  useEffect(() => {
    if (!query.trim() || query.trim().startsWith('http')) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true)
        const data = await searchProducts(query)
        setResults(data.filter(p => p._id !== excludeId))
      } catch (err) {
        console.error(err)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query, excludeId])

  const handleSelect = (product) => {
    onSelect(product)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setScrapeError(null)
  }

  const handleClear = () => {
    onSelect(null)
    setQuery('')
    setResults([])
    setScrapeError(null)
  }

  // Scraping per-slot: dipanggil saat tombol "Scrape" diklik
  const handleScrape = async () => {
    if (!isUrl || isScraping) return
    try {
      setIsScraping(true)
      setScrapeError(null)
      const product = await scrapeProduct(query.trim())
      handleSelect(product)
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail

      if (status === 422) {
        setScrapeError(
          typeof detail === 'string'
            ? detail
            : 'URL tidak valid. Hanya link dari reviews.femaledaily.com.'
        )
      } else if (status === 409 && detail?.product_id) {
        // Produk sudah ada di DB — fetch dan langsung pilih
        try {
          const { getProductById } = await import('../../services/api')
          const existing = await getProductById(detail.product_id)
          handleSelect(existing)
        } catch {
          setScrapeError('Produk sudah dianalisis sebelumnya, tapi gagal memuat datanya.')
        }
      } else if (status === 409) {
        setScrapeError('Scraping sedang berjalan untuk URL ini. Harap tunggu.')
      } else {
        setScrapeError('Gagal scraping. Periksa URL dan coba lagi.')
      }
      console.error(err)
    } finally {
      setIsScraping(false)
    }
  }

  // ── Tampilan saat produk sudah terpilih ─────────────────────
  if (selectedProduct) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-text-main mb-2">{label}</label>
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/30 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden text-lg">
            {selectedProduct.product_image
              ? <img src={selectedProduct.product_image} alt="" className="w-full h-full object-cover" />
              : '💄'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary truncate">
              {selectedProduct.product_brand}
            </p>
            <p className="text-sm font-semibold text-text-main leading-snug line-clamp-1">
              {selectedProduct.product_name}
            </p>
            {selectedProduct.overall_nss !== undefined && (
              <p className={`text-xs font-medium mt-0.5 ${selectedProduct.overall_nss >= 0 ? 'text-positive' : 'text-negative'}`}>
                NSS {selectedProduct.overall_nss > 0 ? '+' : ''}{selectedProduct.overall_nss}
              </p>
            )}
          </div>
          <button
            onClick={handleClear}
            className="text-text-muted hover:text-negative transition-colors shrink-0"
            aria-label="Hapus produk"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // ── Tampilan input (belum ada produk terpilih) ───────────────
  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-sm font-medium text-text-main mb-2">{label}</label>

      <div className="space-y-2">
        {/* Input row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {isUrl
                ? <Link className="w-4 h-4 text-primary" />
                : <Search className="w-4 h-4 text-text-muted" />
              }
            </div>
            <input
              type="text"
              placeholder="Cari nama produk atau paste URL femaledaily..."
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setIsOpen(true)
                setScrapeError(null)
              }}
              onFocus={() => setIsOpen(true)}
              disabled={isScraping}
              className={`w-full pl-10 pr-8 py-3 text-sm border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text-muted disabled:opacity-60 ${
                isUrl
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'bg-surface border-border text-text-main'
              }`}
            />
            {query && !isScraping && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setScrapeError(null) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tombol Scrape — hanya muncul saat URL terdeteksi */}
          {isUrl && (
            <button
              onClick={handleScrape}
              disabled={isScraping}
              className="flex items-center gap-1.5 px-4 py-3 bg-primary text-white text-sm font-medium rounded-xl disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition-all shrink-0"
            >
              {isScraping
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />
              }
              {isScraping ? 'Scraping...' : 'Scrape'}
            </button>
          )}

          {/* Chevron — hanya muncul saat bukan URL */}
          {!isUrl && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ right: '0.75rem', top: '50%' }}>
              {!isUrl && query === '' && (
                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              )}
            </div>
          )}
        </div>

        {/* Info scraping berjalan */}
        {isScraping && (
          <p className="text-xs text-primary pl-1 animate-pulse">
            Menganalisis produk... Bisa memakan waktu 1–3 menit.
          </p>
        )}

        {/* Error scraping */}
        {scrapeError && (
          <p className="text-xs text-negative pl-1">{scrapeError}</p>
        )}

        {/* Dropdown hasil pencarian */}
        {isOpen && !isUrl && !isScraping && (query.trim() || results.length > 0) && (
          <div className="absolute z-50 w-full mt-1.5 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
            {isSearching && (
              <p className="px-4 py-3 text-xs text-text-muted">Mencari...</p>
            )}
            {!isSearching && results.length === 0 && query.trim() && (
              <p className="px-4 py-3 text-xs text-text-muted">
                Produk tidak ditemukan di database.
              </p>
            )}
            {results.map(product => (
              <button
                key={product._id}
                onClick={() => handleSelect(product)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors text-left border-t border-border first:border-t-0"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-base overflow-hidden">
                  {product.product_image
                    ? <img src={product.product_image} alt="" className="w-full h-full object-cover" />
                    : '💄'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-main truncate">{product.product_name}</p>
                  <p className="text-xs text-text-muted">{product.product_brand}</p>
                </div>
                {product.overall_nss !== undefined && (
                  <span className={`text-xs font-semibold ml-auto shrink-0 ${product.overall_nss >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {product.overall_nss > 0 ? '+' : ''}{product.overall_nss}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}