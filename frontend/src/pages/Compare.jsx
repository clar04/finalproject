import { useState, useEffect } from 'react'
import { GitCompare, Loader2, Clock, CheckCircle2, AlertCircle, Info, Trophy, Minus } from 'lucide-react'
import Navbar from '../components/shared/Navbar'
import ProductSelector from '../components/comparison/ProductSelector'
import LoadingOverlay from '../components/comparison/LoadingOverlay'
import NSSRadarChart from '../components/comparison/NSSRadarChart'
import { useCompare } from '../context/CompareContext'
import { compareProducts } from '../services/api'
import { getNSSColor, getNSSBg, getNSSLabel } from '../components/recommendation/ProductCard'

// ── Konstanta aspek ───────────────────────────────────────────
const ASPECTS = [
  { key: 'pigmentation', label: 'Pigmentasi' },
  { key: 'longevity',    label: 'Ketahanan'  },
  { key: 'texture',      label: 'Tekstur'    },
  { key: 'hydration',    label: 'Hidrasi'    },
  { key: 'price',        label: 'Harga'      },
]

// ── NSS Scale Legend ─────────────────────────────────────────
function NSSScaleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-muted">
      <span className="font-medium text-text-main text-xs">Skala NSS:</span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-negative inline-block" />
        &lt; −10 · Perlu Perhatian
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-border inline-block" />
        −10 s/d 10 · Netral
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
        10 s/d 50 · Cukup Baik
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-positive inline-block" />
        ≥ 50 · Sangat Baik
      </span>
    </div>
  )
}

// ── NSS Badge (ringkasan skor keseluruhan) ────────────────────
function NSSBadge({ label, nss }) {
  const color = getNSSColor(nss)
  const bg    = getNSSBg(nss)
  const lbl   = getNSSLabel(nss)
  return (
    <div className="flex-1 bg-surface border border-border rounded-xl p-4 text-center">
      <p className="text-xs text-text-muted mb-1 truncate px-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {nss}
      </p>
      <p className="text-[10px] text-text-muted mt-0.5">Net Sentiment Score</p>
      <span className={`inline-block mt-1 text-[9px] font-medium px-2 py-0.5 rounded-full ${bg} ${color}`}>
        {lbl}
      </span>
    </div>
  )
}

// ── Info box NSS ─────────────────────────────────────────────
function NSSInfoBox() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/15 rounded-xl">
      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div className="text-xs text-text-muted leading-relaxed">
        <span className="font-semibold text-text-main">Apa itu NSS?</span>{' '}
        Net Sentiment Score mengukur sentimen ulasan pada skala{' '}
        <span className="font-medium text-negative">−100</span> (sangat negatif) hingga{' '}
        <span className="font-medium text-positive">+100</span> (sangat positif).{' '}
        Angka <span className="font-medium">0</span> berarti netral — jumlah ulasan positif dan negatif seimbang.
      </div>
    </div>
  )
}

// ── Kesimpulan otomatis ───────────────────────────────────────
function CompareConclusion({ product1, product2 }) {
  const name1 = product1.product_name
  const name2 = product2.product_name

  const wins1 = [], wins2 = [], draws = []

  ASPECTS.forEach(({ key, label }) => {
    const n1 = product1.nss_scores?.[key]
    const n2 = product2.nss_scores?.[key]
    if (n1 == null || n2 == null) return
    const diff = Math.abs(n1 - n2)
    if (diff < 5) {
      draws.push(label)
    } else if (n1 > n2) {
      wins1.push(label)
    } else {
      wins2.push(label)
    }
  })

  const overallWinner =
    product1.overall_nss > product2.overall_nss + 3 ? name1 :
    product2.overall_nss > product1.overall_nss + 3 ? name2 :
    null

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-text-main">Kesimpulan Perbandingan</h2>
          <p className="text-xs text-text-muted">Ringkasan otomatis berdasarkan skor NSS per aspek</p>
        </div>
      </div>

      <div className="space-y-3">
        {wins1.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-positive/5 border border-positive/20 rounded-xl">
            <span className="text-base shrink-0">🏆</span>
            <p className="text-sm text-text-main">
              <span className="font-semibold">{name1}</span> unggul pada aspek:{' '}
              <span className="text-positive font-medium">{wins1.join(', ')}</span>
            </p>
          </div>
        )}
        {wins2.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-base shrink-0">🏆</span>
            <p className="text-sm text-text-main">
              <span className="font-semibold">{name2}</span> unggul pada aspek:{' '}
              <span className="text-primary font-medium">{wins2.join(', ')}</span>
            </p>
          </div>
        )}
        {draws.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-border/30 border border-border rounded-xl">
            <Minus className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
            <p className="text-sm text-text-muted">
              Aspek <span className="font-medium text-text-main">{draws.join(', ')}</span> memiliki skor yang setara (selisih &lt; 5 poin).
            </p>
          </div>
        )}
        {overallWinner ? (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mt-2">
            <span className="text-base shrink-0">⭐</span>
            <p className="text-sm text-text-main">
              Secara keseluruhan, <span className="font-semibold text-amber-700">{overallWinner}</span> memiliki NSS overall yang lebih tinggi.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-4 py-3 bg-border/20 border border-border rounded-xl mt-2">
            <span className="text-base shrink-0">🤝</span>
            <p className="text-sm text-text-muted">
              Kedua produk memiliki NSS overall yang <span className="font-medium text-text-main">hampir setara</span>.
              Pilih berdasarkan aspek yang paling penting untukmu.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Tabel perbandingan NSS per aspek ─────────────────────────
function NSSComparisonTable({ product1, product2 }) {
  const name1 = product1.product_name
  const name2 = product2.product_name

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-main mb-1">
        Perbandingan NSS per Aspek
      </h2>
      <p className="text-xs text-text-muted mb-4">
        Skor NSS: −100 (sangat negatif) · 0 (netral) · +100 (sangat positif)
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-semibold text-text-muted pb-3 pr-6 w-1/3">
                Aspek
              </th>
              <th className="text-center text-xs font-semibold text-text-muted pb-3 px-4 w-1/3 max-w-0">
                <span className="block truncate">{name1}</span>
              </th>
              <th className="text-center text-xs font-semibold text-text-muted pb-3 pl-4 w-1/3 max-w-0">
                <span className="block truncate">{name2}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ASPECTS.map(({ key, label }) => {
              const nss1 = product1.nss_scores?.[key]
              const nss2 = product2.nss_scores?.[key]
              const has1 = nss1 !== undefined && nss1 !== null
              const has2 = nss2 !== undefined && nss2 !== null

              const winner = (has1 && has2)
                ? (nss1 > nss2 ? 1 : nss2 > nss1 ? 2 : 0)
                : 0

              return (
                <tr key={key}>
                  <td className="py-3 pr-6 text-xs font-medium text-text-main">{label}</td>

                  <td className="py-3 px-4 text-center">
                    {has1 ? (
                      <span className={`inline-flex items-center justify-center gap-1 text-xs font-semibold ${
                        winner === 1 ? 'font-bold underline underline-offset-2' : ''
                      } ${getNSSColor(nss1)}`}>
                        {nss1}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>

                  <td className="py-3 pl-4 text-center">
                    {has2 ? (
                      <span className={`inline-flex items-center justify-center gap-1 text-xs font-semibold ${
                        winner === 2 ? 'font-bold underline underline-offset-2' : ''
                      } ${getNSSColor(nss2)}`}>
                        {nss2}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <NSSScaleLegend />
      </div>
    </section>
  )
}

// ── Banner: status kesiapan produk ────────────────────────────
function ProductReadinessBanner({ product1, product2 }) {
  const p1Ready = !!product1?._id
  const p2Ready = !!product2?._id

  if ((!product1 && !product2) || (p1Ready && p2Ready)) return null
  if (product1 && product2 && !p1Ready && !p2Ready) return null

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl mb-4">
      <div className="flex flex-col gap-1.5 flex-1">
        {p1Ready && product1 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-positive shrink-0" />
            <span className="text-xs text-text-main">
              <span className="font-semibold">{product1.product_name}</span> sudah siap dianalisis
            </span>
          </div>
        )}
        {p2Ready && product2 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-positive shrink-0" />
            <span className="text-xs text-text-main">
              <span className="font-semibold">{product2.product_name}</span> sudah siap dianalisis
            </span>
          </div>
        )}
        {(product1 && !p1Ready) && (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 animate-pulse" />
            <span className="text-xs text-text-muted">
              Menunggu <span className="font-semibold">Produk Pertama</span> selesai diproses...
            </span>
          </div>
        )}
        {(product2 && !p2Ready) && (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 animate-pulse" />
            <span className="text-xs text-text-muted">
              Menunggu <span className="font-semibold">Produk Kedua</span> selesai diproses...
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Halaman Compare ───────────────────────────────────────────
export default function Compare() {
  const { compareList, clearCompare } = useCompare()

  const [product1, setProduct1] = useState(null)
  const [product2, setProduct2] = useState(null)
  const [isLoading, setIsLoading]     = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [result, setResult]           = useState(null)
  const [processingTime, setProcessingTime] = useState(null)
  const [error, setError]             = useState(null)

  // Sync dari CompareContext (kalau datang dari tombol "Tambah ke Compare" di halaman detail)
  useEffect(() => {
    if (compareList[0]) setProduct1(compareList[0])
    if (compareList[1]) setProduct2(compareList[1])
  }, [compareList])

  // Kedua produk harus sudah ada di DB (punya _id) sebelum bisa dibandingkan
  const canCompare = !!(
    product1?._id && product2?._id && !isLoading
  )

  const handleCompare = async () => {
    if (!canCompare) return
    try {
      setShowResults(false)
      setError(null)
      setResult(null)
      setIsLoading(true)
      const start = Date.now()
      const data = await compareProducts(product1._id, product2._id)
      setProcessingTime(((Date.now() - start) / 1000).toFixed(1))
      setResult(data)
    } catch (err) {
      setError('Gagal melakukan komparasi. Pastikan backend berjalan.')
      console.error(err)
      setIsLoading(false)
    }
  }

  const handleLoadingComplete = () => {
    setIsLoading(false)
    if (result) setShowResults(true)
  }

  const handleReset = () => {
    setProduct1(null)
    setProduct2(null)
    setShowResults(false)
    setResult(null)
    setProcessingTime(null)
    setError(null)
    clearCompare()
  }

  // Reset hasil saat produk diganti
  const handleSelectProduct1 = (p) => {
    setProduct1(p)
    setShowResults(false)
    setResult(null)
    setError(null)
  }
  const handleSelectProduct2 = (p) => {
    setProduct2(p)
    setShowResults(false)
    setResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">

        {/* Header */}
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <GitCompare className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-main">Komparasi Produk</h1>
          <p className="text-sm text-text-muted mt-2 max-w-lg mx-auto">
            Bandingkan dua produk bibir berdasarkan analisis sentimen ulasan Female Daily.
            Cari dari database atau paste URL untuk produk baru.
          </p>
        </div>

        {/* Product Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ProductSelector
            label="Produk Pertama"
            selectedProduct={product1}
            onSelect={handleSelectProduct1}
            excludeId={product2?._id}
          />
          <ProductSelector
            label="Produk Kedua"
            selectedProduct={product2}
            onSelect={handleSelectProduct2}
            excludeId={product1?._id}
          />
        </div>

        {/* Banner status kesiapan produk */}
        {!isLoading && !showResults && (product1 || product2) && (
          <ProductReadinessBanner product1={product1} product2={product2} />
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={handleCompare}
            disabled={!canCompare}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-white text-sm font-medium rounded-xl shadow-sm shadow-primary/20 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</>
              : <><GitCompare className="w-4 h-4" />Bandingkan Produk</>
            }
          </button>
          {(product1 || product2 || showResults) && !isLoading && (
            <button
              onClick={handleReset}
              className="px-4 py-3 text-sm text-text-muted border border-border rounded-xl hover:bg-surface transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Info: kenapa tombol bandingkan belum aktif */}
        {(product1 || product2) && !canCompare && !isLoading && (
          <p className="text-center text-xs text-text-muted mb-6">
            {(!product1 || !product2)
              ? 'Pilih dua produk untuk mulai membandingkan.'
              : 'Scrape kedua produk terlebih dahulu agar bisa dibandingkan.'
            }
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-negative/8 border border-negative/25 rounded-xl px-4 py-3 mb-6">
            <AlertCircle className="w-4 h-4 text-negative shrink-0 mt-0.5" />
            <p className="text-sm text-negative">{error}</p>
          </div>
        )}

        {/* Loading overlay — diberi hasResult agar tidak hilang sebelum data ada */}
        <LoadingOverlay
          isLoading={isLoading}
          hasResult={result !== null}
          onComplete={handleLoadingComplete}
        />

        {/* Results */}
        {showResults && result && (
          <div className="space-y-6">

            {/* Latency badge */}
            {processingTime && (
              <div className="flex justify-center">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-full text-xs text-text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  Diproses dalam {processingTime}s
                </div>
              </div>
            )}

            {/* NSS info box */}
            <NSSInfoBox />

            {/* Overall NSS */}
            <div className="flex flex-wrap gap-4">
              <NSSBadge label={result.product1.product_name} nss={result.product1.overall_nss} />
              <NSSBadge label={result.product2.product_name} nss={result.product2.overall_nss} />
            </div>

            {/* Radar chart */}
            <NSSRadarChart product1={result.product1} product2={result.product2} />

            {/* Tabel perbandingan per aspek */}
            <NSSComparisonTable product1={result.product1} product2={result.product2} />

            {/* Kesimpulan otomatis */}
            <CompareConclusion product1={result.product1} product2={result.product2} />

          </div>
        )}

      </main>
    </div>
  )
}