import { useState, useEffect } from 'react'
import { GitCompare, Loader2, Clock, TrendingUp } from 'lucide-react'
import Navbar from '../components/shared/Navbar'
import ProductSelector from '../components/comparison/ProductSelector'
import LoadingOverlay from '../components/comparison/LoadingOverlay'
import NSSRadarChart from '../components/comparison/NSSRadarChart'
import { useCompare } from '../context/CompareContext'
import { compareProducts } from '../services/api'

// ── Konstanta aspek ───────────────────────────────────────────
const ASPECTS = [
  { key: 'pigmentation', label: 'Pigmentasi' },
  { key: 'longevity',    label: 'Ketahanan'  },
  { key: 'texture',      label: 'Tekstur'    },
  { key: 'hydration',    label: 'Hidrasi'    },
  { key: 'price',        label: 'Harga'      },
]

// ── NSS Badge (ringkasan skor keseluruhan) ────────────────────
function NSSBadge({ label, nss }) {
  const isPos = nss >= 0
  return (
    <div className="flex-1 bg-surface border border-border rounded-xl p-4 text-center">
      <p className="text-xs text-text-muted mb-1 truncate px-2">{label}</p>
      <p className={`text-2xl font-bold ${isPos ? 'text-positive' : 'text-negative'}`}>
        {nss > 0 ? '+' : ''}{nss}
      </p>
      <p className="text-[10px] text-text-muted mt-0.5">Net Sentiment Score</p>
    </div>
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
      <p className="text-xs text-text-muted mb-5">
        NSS = (positif − negatif) / total × 100. Ikon{' '}
        <TrendingUp className="w-3 h-3 inline text-positive" /> menandai produk yang unggul pada aspek tersebut.
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

              // Tentukan pemenang per aspek
              const winner = (has1 && has2)
                ? (nss1 > nss2 ? 1 : nss2 > nss1 ? 2 : 0)
                : 0

              return (
                <tr key={key}>
                  <td className="py-3 pr-6 text-xs font-medium text-text-main">{label}</td>

                  {/* Kolom produk 1 */}
                  <td className="py-3 px-4 text-center">
                    {has1 ? (
                      <span className={`inline-flex items-center justify-center gap-1 text-xs font-semibold ${
                        winner === 1 ? 'font-bold' : ''
                      } ${nss1 >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {winner === 1 && <TrendingUp className="w-3 h-3 shrink-0" />}
                        {nss1 > 0 ? '+' : ''}{nss1}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>

                  {/* Kolom produk 2 */}
                  <td className="py-3 pl-4 text-center">
                    {has2 ? (
                      <span className={`inline-flex items-center justify-center gap-1 text-xs font-semibold ${
                        winner === 2 ? 'font-bold' : ''
                      } ${nss2 >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {winner === 2 && <TrendingUp className="w-3 h-3 shrink-0" />}
                        {nss2 > 0 ? '+' : ''}{nss2}
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
    </section>
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
  // Produk dari URL yang belum di-scrape tidak akan punya _id
  const canCompare = !!(
    product1?._id && product2?._id && !isLoading
  )

  const handleCompare = async () => {
    if (!canCompare) return
    try {
      setShowResults(false)
      setError(null)
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
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <GitCompare className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-text-main">Komparasi Produk</h1>
          <p className="text-sm text-text-muted mt-2 max-w-lg mx-auto">
            Bandingkan dua produk bibir berdasarkan analisis sentimen ulasan Female Daily.
            Cari dari database atau paste URL untuk produk baru.
          </p>
        </div>

        {/* Product Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

        {/* Action buttons */}
        <div className="flex justify-center gap-3 mb-8">
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
          <div className="bg-negative/10 border border-negative/30 rounded-xl px-4 py-3 text-sm text-negative text-center mb-6">
            {error}
          </div>
        )}

        {/* Loading overlay */}
        <LoadingOverlay isLoading={isLoading} onComplete={handleLoadingComplete} />

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

            {/* Overall NSS */}
            <div className="flex gap-4">
              <NSSBadge label={result.product1.product_name} nss={result.product1.overall_nss} />
              <NSSBadge label={result.product2.product_name} nss={result.product2.overall_nss} />
            </div>

            {/* Radar chart */}
            <NSSRadarChart product1={result.product1} product2={result.product2} />

            {/* Tabel perbandingan per aspek */}
            <NSSComparisonTable product1={result.product1} product2={result.product2} />

          </div>
        )}

      </main>
    </div>
  )
}