import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Search, Link, ChevronDown, X, Loader2, Sparkles, Palette } from 'lucide-react'
import { getAllProducts, scrapeProduct, pollScrapeStatus, getProductById } from '../../services/api'
import ScrapePollingOverlay, { ErrorBanner } from './ScrapePollingOverlay'

/**
 * Bersihkan URL dari query string, fragment, trailing slash, dan whitespace.
 * Contoh:
 *   https://reviews.femaledaily.com/lip/brand/?page=2&utm=ig#top
 *   → https://reviews.femaledaily.com/lip/brand
 */
function cleanUrl(raw) {
  try {
    const parsed = new URL(raw.trim())
    // Buang query (?...) dan fragment (#...)
    parsed.search = ''
    parsed.hash = ''
    // Buang trailing slash
    const clean = parsed.toString().replace(/\/+$/, '')
    return clean
  } catch {
    return raw.trim()
  }
}

export default function ProductSelector({ label, selectedProduct, onSelect, excludeId }) {
  const [query, setQuery]       = useState('')
  const [isOpen, setIsOpen]     = useState(false)
  const [allProducts, setAllProducts] = useState([])

  // State scraping
  const [scrapePhase, setScrapePhase] = useState(null)
  // null = idle | 'requesting' = menunggu POST | 'polling' = menunggu status
  const [pollingElapsed, setPollingElapsed] = useState(0)
  const [scrapeError, setScrapeError] = useState(null)

  const wrapperRef   = useRef(null)
  const abortRef     = useRef(null)   // AbortController untuk polling
  const elapsedTimer = useRef(null)   // setInterval timer elapsed

  const isUrl      = query.trim().startsWith('http')
  const isScraping = scrapePhase !== null

  // Preload semua produk sekali (pakai cache yang sama dengan Home)
  useEffect(() => {
    getAllProducts()
      .then(data => setAllProducts(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [])

  // Filter client-side — instan, tanpa debounce dan tanpa API call
  const results = useMemo(() => {
    if (!query.trim() || isUrl) return []
    const q = query.trim().toLowerCase()
    return allProducts
      .filter(p =>
        p._id !== excludeId &&
        (p.product_name?.toLowerCase().includes(q) ||
         p.product_brand?.toLowerCase().includes(q))
      )
      .slice(0, 10)
  }, [query, allProducts, excludeId, isUrl])

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

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      clearInterval(elapsedTimer.current)
    }
  }, [])

  const startElapsedTimer = useCallback(() => {
    setPollingElapsed(0)
    clearInterval(elapsedTimer.current)
    elapsedTimer.current = setInterval(() => {
      setPollingElapsed(prev => prev + 1)
    }, 1000)
  }, [])

  const stopElapsedTimer = useCallback(() => {
    clearInterval(elapsedTimer.current)
  }, [])

  const handleSelect = (product) => {
    onSelect(product)
    setQuery('')
    setIsOpen(false)
    setScrapeError(null)
    setScrapePhase(null)
  }

  const handleClear = () => {
    onSelect(null)
    setQuery('')
    setScrapeError(null)
    setScrapePhase(null)
    abortRef.current?.abort()
    stopElapsedTimer()
  }

  // Mulai polling (dipanggil saat POST timeout atau dapat 409 "sedang berjalan")
  const startPolling = useCallback(async (url) => {
    setScrapePhase('polling')
    startElapsedTimer()

    abortRef.current = new AbortController()

    try {
      const result = await pollScrapeStatus(
        url,
        (_statusData) => {
          // elapsed dihandle oleh interval di startElapsedTimer
        },
        abortRef.current.signal,
        5000,
      )

      if (!result) {
        // Dibatalkan oleh user
        setScrapePhase(null)
        stopElapsedTimer()
        return
      }

      // Polling selesai — fetch produk
      const product = await getProductById(result.product_id)
      stopElapsedTimer()
      handleSelect(product)
    } catch (err) {
      stopElapsedTimer()
      setScrapePhase(null)
      setScrapeError(err.message || 'Terjadi kesalahan saat menunggu hasil scraping.')
      console.error(err)
    }
  }, [startElapsedTimer, stopElapsedTimer]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scraping per-slot: dipanggil saat tombol "Scrape" diklik
  const handleScrape = async () => {
    if (!isUrl || isScraping) return

    // Bersihkan URL dari query string, fragment, trailing slash
    const url = cleanUrl(query)

    // Update input agar menampilkan URL yang sudah dibersihkan
    if (url !== query.trim()) {
      setQuery(url)
    }

    try {
      setScrapePhase('requesting')
      setScrapeError(null)
      const product = await scrapeProduct(url)
      setScrapePhase(null)
      handleSelect(product)
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail

      // Produk sudah ada di DB
      if (status === 409 && detail?.product_id) {
        setScrapePhase(null)
        try {
          const existing = await getProductById(detail.product_id)
          handleSelect(existing)
        } catch {
          setScrapePhase(null)
          setScrapeError('Produk sudah dianalisis sebelumnya, tapi gagal memuat datanya.')
        }
        return
      }

      // Scraping sedang berjalan di server → switch ke polling
      if (status === 409) {
        setScrapeError(null)
        startPolling(url)
        return
      }

      // Timeout Axios → switch ke polling (server masih berjalan)
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        setScrapeError(null)
        startPolling(url)
        return
      }

      // Error lainnya (422, network error, dll)
      setScrapePhase(null)
      if (status === 422) {
        setScrapeError(
          typeof detail === 'string'
            ? detail
            : 'URL tidak valid. Hanya link lip product dari reviews.femaledaily.com.'
        )
      } else {
        setScrapeError('Gagal scraping. Periksa URL dan coba lagi.')
      }
      console.error(err)
    }
  }

  // Batalkan polling (scraping tetap jalan di server)
  const handleCancelPolling = () => {
    abortRef.current?.abort()
    stopElapsedTimer()
    setScrapePhase(null)
    setScrapeError('Polling dihentikan. Kamu bisa paste URL yang sama lagi nanti untuk melanjutkan.')
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
            {/* Shade badge */}
            {selectedProduct.product_shade && (
              <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md bg-surface border border-border text-[10px] text-text-muted">
                <Palette className="w-2.5 h-2.5" />
                {selectedProduct.product_shade}
              </span>
            )}
            {selectedProduct.overall_nss !== undefined && (
              <p className={`text-xs font-medium mt-0.5 tabular-nums ${selectedProduct.overall_nss >= 0 ? 'text-positive' : 'text-negative'}`}>
                NSS {selectedProduct.overall_nss}
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
              placeholder="Cari nama produk atau paste URL lip product femaledaily..."
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
                onClick={() => { setQuery(''); setScrapeError(null) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tombol Scrape — hanya muncul saat URL terdeteksi dan tidak sedang scraping */}
          {isUrl && !isScraping && (
            <button
              onClick={handleScrape}
              className="flex items-center gap-1.5 px-4 py-3 bg-primary text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              Scrape
            </button>
          )}

          {/* Spinner kecil saat 'requesting' */}
          {scrapePhase === 'requesting' && (
            <div className="flex items-center gap-1.5 px-4 py-3 bg-primary/10 text-primary text-sm font-medium rounded-xl shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memulai...
            </div>
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

        {/* Polling overlay */}
        {scrapePhase === 'polling' && (
          <ScrapePollingOverlay
            elapsed={pollingElapsed}
            onCancel={handleCancelPolling}
          />
        )}

        {/* Info saat requesting */}
        {scrapePhase === 'requesting' && (
          <p className="text-xs text-primary pl-1 animate-pulse">
            Menghubungi server... Ini mungkin memakan waktu beberapa menit untuk produk dengan banyak ulasan.
          </p>
        )}

        {/* Error banner */}
        {scrapeError && (
          <ErrorBanner
            message={scrapeError}
            type={scrapeError.includes('dihentikan') ? 'warning' : 'error'}
            onDismiss={() => setScrapeError(null)}
          />
        )}

        {/* Dropdown hasil pencarian */}
        {isOpen && !isUrl && !isScraping && query.trim() && (
          <div className="absolute z-50 w-full mt-1.5 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
            {results.length === 0 && (
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs text-text-muted">{product.product_brand}</p>
                    {product.product_shade && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
                        <Palette className="w-2.5 h-2.5" />
                        {product.product_shade}
                      </span>
                    )}
                  </div>
                </div>
                {product.overall_nss !== undefined && (
                  <span className={`text-xs font-semibold tabular-nums ml-auto shrink-0 ${product.overall_nss >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {product.overall_nss}
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