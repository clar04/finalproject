import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GitCompare, Sparkles, Link as LinkIcon, X, Loader2, Check } from 'lucide-react'
import { useState } from 'react'
import { scrapeProduct } from '../../services/api'

const NAV_LINKS = [
  { to: '/',        label: 'Rekomendasi' },
  { to: '/compare', label: 'Bandingkan', icon: GitCompare },
]

const SCRAPE_STEPS = [
  'Mengambil data produk...',
  'Scraping ulasan Female Daily...',
  'Menjalankan analisis ABSA...',
  'Menghitung Net Sentiment Score...',
  'Menyimpan ke database...',
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [url, setUrl]             = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError]         = useState(null)

  const handleScrape = async (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || !trimmed.startsWith('http')) return

    try {
      setIsScraping(true)
      setError(null)
      setStepIndex(0)

      // Animasi langkah-langkah (kosmetik saja — proses nyata berjalan paralel)
      const stepTimer = setInterval(() => {
        setStepIndex(prev => (prev < SCRAPE_STEPS.length - 1 ? prev + 1 : prev))
      }, 1800)

      const product = await scrapeProduct(trimmed)
      clearInterval(stepTimer)

      setUrl('')
      setIsScraping(false)
      navigate(`/product/${product._id}`)
    } catch (err) {
      setIsScraping(false)

      const status = err?.response?.status
      const detail = err?.response?.data?.detail

      if (status === 422) {
        // URL bukan dari Female Daily
        setError(
          typeof detail === 'string'
            ? detail
            : 'URL tidak valid. Hanya link dari reviews.femaledaily.com yang bisa dianalisis.'
        )
      } else if (status === 409 && detail?.product_id) {
        // Produk sudah ada — redirect ke halaman produk yang sudah tersimpan
        setUrl('')
        navigate(`/product/${detail.product_id}`)
      } else if (status === 409) {
        setError('Scraping sedang berjalan untuk URL ini. Harap tunggu.')
      } else {
        setError('Gagal menganalisis URL. Pastikan URL berasal dari Female Daily.')
      }

      console.error(err)
    }
  }

  const isValidUrl = url.trim().startsWith('http')

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">

          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-text-main tracking-tight">
              Lip<span className="text-primary">Sense</span>
            </span>
          </Link>

          {/* URL Scrape form */}
          <form onSubmit={handleScrape} className="flex-1 max-w-md">
            <div className="space-y-0.5">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setError(null) }}
                    placeholder="Paste URL produk Female Daily untuk analisis..."
                    disabled={isScraping}
                    className={`w-full h-9 pl-9 pr-8 text-xs border rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-60 ${
                      error
                        ? 'border-negative/60 bg-negative/5'
                        : isValidUrl
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border bg-background'
                    }`}
                  />
                  {url && !isScraping && (
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
                  disabled={!isValidUrl || isScraping}
                  className="flex items-center gap-1.5 px-3 h-9 bg-primary text-white text-xs font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all shrink-0"
                >
                  {isScraping
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : null
                  }
                  {isScraping ? 'Menganalisis...' : 'Analisis'}
                </button>
              </div>
              {error && (
                <p className="text-[10px] text-negative pl-9 leading-tight">{error}</p>
              )}
            </div>
          </form>

          {/* Navigation */}
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
      </header>

      {/* Fullscreen loading modal saat scraping */}
      {isScraping && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-6 shadow-2xl">

            {/* Spinner */}
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-border" />
              <Loader2 className="absolute inset-0 w-14 h-14 text-primary animate-spin" />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-text-main mb-1">Menganalisis Produk</p>
              <p className="text-xs text-text-muted">
                Proses ini dapat memakan waktu 1–3 menit
              </p>
            </div>

            {/* Step list */}
            <div className="w-full space-y-2.5">
              {SCRAPE_STEPS.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    idx < stepIndex
                      ? 'bg-positive text-white'
                      : idx === stepIndex
                        ? 'bg-primary text-white'
                        : 'bg-border'
                  }`}>
                    {idx < stepIndex
                      ? <Check className="w-3 h-3" />
                      : idx === stepIndex
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : null
                    }
                  </div>
                  <span className={`text-xs transition-colors ${
                    idx <= stepIndex ? 'text-text-main font-medium' : 'text-text-muted'
                  }`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>

            {/* URL yang sedang diproses */}
            <div className="w-full px-3 py-2 bg-background rounded-lg border border-border">
              <p className="text-[10px] text-text-muted truncate">{url}</p>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
