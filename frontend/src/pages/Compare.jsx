import { useState, useEffect } from 'react'
import { GitCompare, Loader2, Clock, X } from 'lucide-react'
import Navbar from '../components/shared/Navbar'
import ProductSelector from '../components/comparison/ProductSelector'
import LoadingOverlay from '../components/comparison/LoadingOverlay'
import NSSRadarChart from '../components/comparison/NSSRadarChart'
import ReviewSnippets from '../components/comparison/ReviewSnippets'
import { useCompare } from '../context/CompareContext'
import { compareProducts, scrapeProduct } from '../services/api'

function ProductMiniCard({ product, onRemove }) {
  if (!product) {
    return (
      <div className="flex-1 border border-dashed border-border rounded-2xl p-5 flex items-center justify-center min-h-[96px]">
        <p className="text-sm text-text-muted">Pilih produk untuk dibandingkan</p>
      </div>
    )
  }
  return (
    <div className="flex-1 bg-primary/5 border border-primary/30 rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
        {product.product_image ? <img src={product.product_image} alt="" className="w-full h-full object-cover" /> : "💄"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary truncate">{product.product_brand}</p>
        <p className="text-sm font-semibold text-text-main leading-snug line-clamp-2">{product.product_name}</p>
        {product.overall_nss !== undefined && (
          <p className={`text-xs font-medium mt-0.5 ${product.overall_nss >= 0 ? 'text-positive' : 'text-negative'}`}>
            NSS {product.overall_nss > 0 ? '+' : ''}{product.overall_nss}
          </p>
        )}
      </div>
      <button onClick={onRemove} className="text-text-muted hover:text-negative transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

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

export default function Compare() {
  const { compareList, clearCompare } = useCompare()

  const [product1, setProduct1] = useState(null)
  const [product2, setProduct2] = useState(null)
  const [isLoading, setIsLoading]     = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [result, setResult]           = useState(null)
  const [processingTime, setProcessingTime] = useState(null)
  const [error, setError] = useState(null)

  // Sync dari CompareContext (kalau datang dari Page 3)
  useEffect(() => {
    if (compareList[0]) setProduct1(compareList[0])
    if (compareList[1]) setProduct2(compareList[1])
  }, [compareList])

  const canCompare = product1 && product2 && !isLoading

  const handleCompare = async () => {
    if (!canCompare) return
    try {
      setShowResults(false)
      setError(null)
      setIsLoading(true)
      const start = Date.now()

      let p1_id = product1._id
      let p2_id = product2._id

      if (product1._url) {
        const scraped1 = await scrapeProduct(product1._url)
        p1_id = scraped1._id
        setProduct1(scraped1)
      }
      if (product2._url) {
        const scraped2 = await scrapeProduct(product2._url)
        p2_id = scraped2._id
        setProduct2(scraped2)
      }

      const data = await compareProducts(p1_id, p2_id)
      setProcessingTime(((Date.now() - start) / 1000).toFixed(1))
      setResult(data)
    } catch (err) {
      setError('Gagal melakukan komparasi. Pastikan backend berjalan atau URL valid.')
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
            Bandingkan dua produk bibir berdasarkan analisis sentimen ulasan Female Daily secara real-time
          </p>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ProductSelector label="Produk Pertama" selectedProduct={product1} onSelect={setProduct1} excludeId={product2?._id} />
          <ProductSelector label="Produk Kedua"   selectedProduct={product2} onSelect={setProduct2} excludeId={product1?._id} />
        </div>

        {/* Mini cards */}
        <div className="flex gap-4 mb-6">
          <ProductMiniCard product={product1} onRemove={() => setProduct1(null)} />
          <ProductMiniCard product={product2} onRemove={() => setProduct2(null)} />
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

        {/* Error */}
        {error && (
          <div className="bg-negative/10 border border-negative/30 rounded-xl px-4 py-3 text-sm text-negative text-center mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
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

            {/* NSS summary */}
            <div className="flex gap-4">
              <NSSBadge label={result.product1.product_name} nss={result.product1.overall_nss} />
              <NSSBadge label={result.product2.product_name} nss={result.product2.overall_nss} />
            </div>

            {/* Radar */}
            <NSSRadarChart product1={result.product1} product2={result.product2} />

            {/* Review snippets */}
            <ReviewSnippets product1={result.product1} product2={result.product2} />

          </div>
        )}

      </main>
    </div>
  )
}