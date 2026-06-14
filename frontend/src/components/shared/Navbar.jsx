import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GitCompare, Sparkles, Link as LinkIcon, X, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { scrapeProduct, pollScrapeStatus, getProductById } from '../../services/api'

const NAV_LINKS = [
  { to: '/',        label: 'Rekomendasi' },
  { to: '/compare', label: 'Bandingkan', icon: GitCompare },
]

const SCRAPE_STEPS = [
  'Membuka halaman produk...',
  'Scraping ulasan Female Daily...',
  'Menjalankan analisis ABSA...',
  'Menghitung Net Sentiment Score...',
  'Menyimpan ke database...',
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  const [url, setUrl]               = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [stepIndex, setStepIndex]   = useState(0)
  const [error, setError]           = useState(null)
  const [menuOpen, setMenuOpen]     = useState(false)

  // State untuk polling mode
  const [isPolling, setIsPolling]       = useState(false)
  const [pollingElapsed, setPollingElapsed] = useState(0)
  const [pollingUrl, setPollingUrl]     = useState('')   // URL yang sedang di-poll

  const abortRef     = useRef(null)
  const elapsedTimer = useRef(null)
  const stepTimer    = useRef(null)

  // Tutup mobile menu saat navigasi
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      clearInterval(elapsedTimer.current)
      clearInterval(stepTimer.current)
    }
  }, [])

  const formatElapsed = (secs) => {
    if (secs < 60) return `${secs} detik`
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m} menit ${s} detik`
  }

  // Hitung indeks step berdasarkan elapsed time
  const getPollingStepIndex = (elapsed) => {
    if (elapsed < 15)  return 0
    if (elapsed < 60)  return 1
    if (elapsed < 180) return 2
    if (elapsed < 270) return 3
    return 4
  }

  const startPolling = useCallback(async (targetUrl) => {
    // Reset state scraping biasa, masuk mode polling
    setIsScraping(false)
    clearInterval(stepTimer.current)
    setIsPolling(true)
    setPollingUrl(targetUrl)
    setPollingElapsed(0)

    // Timer elapsed
    clearInterval(elapsedTimer.current)
    elapsedTimer.current = setInterval(() => {
      setPollingElapsed(prev => prev + 1)
    }, 1000)

    abortRef.current = new AbortController()

    try {
      const result = await pollScrapeStatus(
        targetUrl,
        () => {},  // elapsed dihandle oleh interval timer
        abortRef.current.signal,
        5000,
      )

      clearInterval(elapsedTimer.current)
      setIsPolling(false)
      setPollingUrl('')

      if (!result) {
        // Dibatalkan user
        return
      }

      // Selesai — navigasi ke halaman produk
      const product = await getProductById(result.product_id)
      setUrl('')
      navigate(`/product/${product._id}`)
    } catch (err) {
      clearInterval(elapsedTimer.current)
      setIsPolling(false)
      setPollingUrl('')
      if (err.name !== 'AbortError') {
        if (err.isScrapeError) {
          // Backend scraping/inference gagal
          setError('Scraping gagal di server. Coba lagi dengan URL yang sama.')
        } else {
          // Koneksi ke server terputus saat polling (setelah beberapa kali retry)
          setError('Koneksi ke server terputus. Paste URL yang sama untuk melanjutkan.')
        }
        console.error(err)
      }
    }
  }, [navigate])

  const handleCancelPolling = () => {
    abortRef.current?.abort()
    clearInterval(elapsedTimer.current)
    setIsPolling(false)
    setPollingUrl('')
    setError('Pemantauan dihentikan. Paste URL yang sama untuk melanjutkan.')
  }

  const handleScrape = async (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || !trimmed.startsWith('http')) return

    setMenuOpen(false)

    try {
      setIsScraping(true)
      setError(null)
      setStepIndex(0)

      // Animasi langkah-langkah (kosmetik — proses nyata berjalan paralel)
      stepTimer.current = setInterval(() => {
        setStepIndex(prev => (prev < SCRAPE_STEPS.length - 1 ? prev + 1 : prev))
      }, 1800)

      const product = await scrapeProduct(trimmed)
      clearInterval(stepTimer.current)

      setUrl('')
      setIsScraping(false)
      navigate(`/product/${product._id}`)
    } catch (err) {
      clearInterval(stepTimer.current)
      setIsScraping(false)

      const status = err?.response?.status
      const detail = err?.response?.data?.detail

      if (status === 422) {
        setError(
          typeof detail === 'string'
            ? detail
            : 'URL tidak valid. Hanya link lip product dari reviews.femaledaily.com.'
        )
      } else if (status === 409 && detail?.product_id) {
        // Produk sudah ada — redirect langsung
        setUrl('')
        navigate(`/product/${detail.product_id}`)
      } else if (status === 409) {
        // Scraping sedang berjalan → masuk mode polling dengan modal
        startPolling(trimmed)
      } else if (
        err?.code === 'ECONNABORTED' ||
        err?.message?.includes('timeout') ||
        !err?.response  // Network error: koneksi putus, server masih bisa berjalan
      ) {
        // Koneksi terputus sebelum scraping selesai → cek status via polling
        startPolling(trimmed)
      } else {
        setError('Terjadi kesalahan saat menganalisis. Coba lagi beberapa saat.')
      }

      console.error(err)
    }
  }

  const isValidUrl = url.trim().startsWith('http')

  // Step index untuk polling modal (berdasarkan elapsed)
  const pollingStep = getPollingStepIndex(pollingElapsed)

  // ── URL form — dipakai di desktop dan mobile panel ───────────
  const UrlForm = ({ compact = false }) => (
    <form onSubmit={handleScrape} className={compact ? 'w-full' : 'flex-1 max-w-md'}>
      <div className="space-y-1">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(null) }}
              placeholder="Paste URL lip product Female Daily..."
              disabled={isScraping || isPolling}
              className={`w-full h-9 pl-9 pr-8 text-xs border rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-60 ${
                error
                  ? 'border-negative/60 bg-negative/5'
                  : isValidUrl
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-background'
              }`}
            />
            {url && !isScraping && !isPolling && (
              <button
                type="button"
                onClick={() => { setUrl(''); setError(null) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!isValidUrl || isScraping || isPolling}
            className="flex items-center gap-1.5 px-3 h-9 bg-primary text-white text-xs font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all shrink-0"
          >
            {(isScraping || isPolling) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isScraping ? 'Menganalisis...' : isPolling ? 'Memantau...' : 'Analisis'}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 pl-9">
            <AlertCircle className="w-3 h-3 text-negative shrink-0" />
            <p className="text-[10px] text-negative leading-tight">{error}</p>
          </div>
        )}
      </div>
    </form>
  )

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur-md">

        {/* ── Desktop (sm+) ──────────────────────────────── */}
        <div className="hidden sm:flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 items-center gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-text-main tracking-tight">
              Lip<span className="text-primary">Sense</span>
            </span>
          </Link>

          <UrlForm />

          <nav className="flex items-center gap-1 ml-auto shrink-0">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'text-text-muted hover:text-text-main hover:bg-background'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* ── Mobile (< sm) ──────────────────────────────── */}
        <div className="flex sm:hidden items-center justify-between px-4 h-14">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-text-main tracking-tight">
              Lip<span className="text-primary">Sense</span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {/* Nav links (compact pill) */}
            {NAV_LINKS.map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'text-text-muted hover:text-text-main hover:bg-background'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  <span className="hidden xs:inline">{label}</span>
                </Link>
              )
            })}

            {/* Toggle URL input */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? 'Tutup input URL' : 'Buka input URL'}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                menuOpen
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-main hover:bg-background'
              }`}
            >
              {menuOpen ? <X className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ── Mobile collapsible URL panel ───────────────── */}
        {menuOpen && (
          <div className="sm:hidden border-t border-border bg-surface/95 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2">
              Analisis Produk Baru
            </p>
            <UrlForm compact />
          </div>
        )}
      </header>

      {/* ── Modal: scraping biasa ───────────────────────── */}
      {isScraping && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 w-full max-w-sm flex flex-col items-center gap-6 shadow-2xl">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-border" />
              <Loader2 className="absolute inset-0 w-14 h-14 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-text-main mb-1">Menganalisis Produk</p>
              <p className="text-xs text-text-muted">Proses ini dapat memakan waktu beberapa menit</p>
            </div>
            <div className="w-full space-y-2.5">
              {SCRAPE_STEPS.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    idx < stepIndex ? 'bg-positive text-white' : idx === stepIndex ? 'bg-primary text-white' : 'bg-border'
                  }`}>
                    {idx < stepIndex ? <Check className="w-3 h-3" /> : idx === stepIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  </div>
                  <span className={`text-xs transition-colors ${idx <= stepIndex ? 'text-text-main font-medium' : 'text-text-muted'}`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <div className="w-full px-3 py-2 bg-background rounded-lg border border-border">
              <p className="text-[10px] text-text-muted truncate">{url}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: polling mode ─────────────────────────── */}
      {isPolling && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-primary/20 rounded-2xl p-6 sm:p-8 w-full max-w-sm flex flex-col items-center gap-6 shadow-2xl">
            <div className="text-center">
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <RefreshCw className="absolute inset-0 w-14 h-14 text-primary animate-spin" style={{ animationDuration: '2s' }} />
              </div>
              <p className="text-sm font-semibold text-text-main mb-1">Scraping Masih Berjalan</p>
              <p className="text-xs text-text-muted">Proses di server masih aktif. Memantau hasil setiap 5 detik...</p>
            </div>
            <div className="w-full px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-center">
              <p className="text-[10px] text-text-muted mb-0.5">Berjalan selama</p>
              <p className="text-base font-semibold text-primary">{formatElapsed(pollingElapsed)}</p>
            </div>
            <div className="w-full">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(95, (pollingElapsed / 300) * 100)}%` }}
                />
              </div>
            </div>
            <div className="w-full space-y-2.5">
              {SCRAPE_STEPS.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    idx < pollingStep ? 'bg-positive text-white' : idx === pollingStep ? 'bg-primary text-white' : 'bg-border'
                  }`}>
                    {idx < pollingStep ? <Check className="w-3 h-3" /> : idx === pollingStep ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  </div>
                  <span className={`text-xs transition-colors ${idx <= pollingStep ? 'text-text-main font-medium' : 'text-text-muted'}`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <div className="w-full px-3 py-2 bg-background rounded-lg border border-border">
              <p className="text-[10px] text-text-muted truncate">{pollingUrl}</p>
            </div>
            <button
              onClick={handleCancelPolling}
              className="text-xs text-text-muted hover:text-negative transition-colors underline underline-offset-2"
            >
              Hentikan pemantauan
            </button>
          </div>
        </div>
      )}
    </>
  )
}
