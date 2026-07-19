import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import Navbar from '../components/shared/Navbar'
import HeroSection from '../components/detail/HeroSection'
import SentimentDonut from '../components/detail/SentimentDonut'
import ABSABreakdown from '../components/detail/ABSABreakdown'
import ReviewTabs from '../components/detail/ReviewTabs'
import { getProductById } from '../services/api'

// Skeleton loader untuk saat loading
function SkeletonBlock({ className }) {
  return <div className={`animate-pulse bg-border rounded-xl ${className}`} />
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [analysisTime, setAnalysisTime] = useState(null)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const start = Date.now()
        const data = await getProductById(id)
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)
        setAnalysisTime(elapsed)
        setProduct(data)
      } catch (err) {
        setError('Produk tidak ditemukan atau gagal memuat data.')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) fetchProduct()
  }, [id])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-main transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>

        {/* Page eyebrow */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
            Product Analysis Dashboard
          </p>
          <h1 className="text-xl font-semibold text-text-main">
            Sentiment Intelligence Report
          </h1>
        </div>

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-negative/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-7 h-7 text-negative" />
            </div>
            <p className="text-sm font-medium text-text-main mb-1">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Kembali ke halaman utama
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SkeletonBlock className="aspect-square" />
              <div className="space-y-4">
                <SkeletonBlock className="h-4 w-1/4" />
                <SkeletonBlock className="h-8 w-3/4" />
                <SkeletonBlock className="h-6 w-1/4" />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <SkeletonBlock className="h-16" />
                  <SkeletonBlock className="h-16" />
                  <SkeletonBlock className="h-16" />
                  <SkeletonBlock className="h-16" />
                </div>
              </div>
            </div>
            <SkeletonBlock className="h-64" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SkeletonBlock className="h-72" />
              <SkeletonBlock className="h-72" />
            </div>
          </div>
        )}

        {/* Content */}
        {product && !isLoading && (
          <div className="space-y-8">

            {/* Hero */}
            <HeroSection product={product} analysisTime={analysisTime} />

            {/* Sentiment donut — full width */}
            <SentimentDonut distribution={product.sentiment_distribution} />

            {/* ABSA + Reviews — 2 col */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ABSABreakdown aspects={product.absa_aspects} />
              <ReviewTabs reviews={product.reviews} reviewsGrouped={product.reviews_grouped} />
            </div>

            {/* Footer */}
            <footer className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
              <p>Data dikumpulkan via scraping Female Daily Network</p>
              <p>
                Dianalisis dalam{' '}
                <span className="font-medium text-primary">{analysisTime}s</span>
              </p>
            </footer>

          </div>
        )}

      </main>
    </div>
  )
}