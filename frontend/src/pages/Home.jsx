import { useState, useMemo, useEffect } from 'react'
import { Search, PackageSearch } from 'lucide-react'
import Navbar from '../components/shared/Navbar'
import Sidebar from '../components/recommendation/Sidebar'
import ProductCard from '../components/recommendation/ProductCard'
import { getAllProducts } from '../services/api'

export default function Home() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedFilters, setSelectedFilters] = useState([])
  const [showTrending, setShowTrending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch semua produk dari MongoDB saat page load
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true)
        const data = await getAllProducts()
        setProducts(data)
      } catch (err) {
        setError('Gagal memuat produk. Pastikan backend berjalan.')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [])

  // Filter logic
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Filter search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchName = product.product_name?.toLowerCase().includes(q)
        const matchBrand = product.product_brand?.toLowerCase().includes(q)
        if (!matchName && !matchBrand) return false
      }

      // Filter trending
      if (showTrending && !product.isTrending) return false

      // Filter aspek — produk harus punya NSS > 0 di aspek yang dipilih
      if (selectedFilters.length > 0) {
        const hasMatch = selectedFilters.some(
          f => product.nss_scores?.[f] !== undefined && product.nss_scores[f] >= 0
        )
        if (!hasMatch) return false
      }

      return true
    })
  }, [products, searchQuery, showTrending, selectedFilters])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar
          selectedFilters={selectedFilters}
          onFilterChange={setSelectedFilters}
          showTrending={showTrending}
          onTrendingChange={setShowTrending}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 p-6">

          {/* Page header + search */}
          <div className="flex items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-xl font-semibold text-text-main">
                Rekomendasi Produk
              </h1>
              <p className="text-sm text-text-muted mt-0.5">
                {isLoading ? 'Memuat...' : (
                  <span>
                    <span className="font-semibold text-primary">{filteredProducts.length}</span>
                    {' '}produk dengan analisis sentimen AI
                  </span>
                )}
              </p>
            </div>

            {/* Search lokal */}
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari produk atau brand..."
                className="w-full h-10 pl-10 pr-4 text-sm bg-surface border border-border rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse">
                  <div className="h-4 bg-border rounded w-1/3 mb-3" />
                  <div className="h-5 bg-border rounded w-2/3 mb-6" />
                  <div className="space-y-3">
                    <div className="h-3 bg-border rounded" />
                    <div className="h-3 bg-border rounded w-4/5" />
                    <div className="h-3 bg-border rounded w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 rounded-2xl bg-negative/10 flex items-center justify-center mb-4">
                <PackageSearch className="w-7 h-7 text-negative" />
              </div>
              <p className="text-sm font-medium text-text-main">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <PackageSearch className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-text-main mb-1">
                Produk tidak ditemukan
              </h3>
              <p className="text-sm text-text-muted">
                Coba ubah filter atau kata kunci pencarian
              </p>
            </div>
          )}

          {/* Product grid */}
          {!isLoading && !error && filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product._id}
                  product={product}
                  selectedFilters={selectedFilters}
                />
              ))}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}