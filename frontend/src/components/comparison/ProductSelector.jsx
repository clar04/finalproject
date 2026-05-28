import { useState, useRef, useEffect } from 'react'
import { Search, Link, ChevronDown, X } from 'lucide-react'
import { searchProducts } from '../../services/api'

export default function ProductSelector({ label, selectedProduct, onSelect, excludeId }) {
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState([])
  const [isOpen, setIsOpen]           = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const wrapperRef = useRef(null)

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

  // Search dengan debounce 400ms
  useEffect(() => {
    if (!query.trim() || query.startsWith('http')) {
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
  }

  const handleClear = () => {
    onSelect(null)
    setQuery('')
    setResults([])
  }

  const isUrl = query.startsWith('http')

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-sm font-medium text-text-main mb-2">{label}</label>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isUrl
            ? <Link className="w-4 h-4 text-primary" />
            : <Search className="w-4 h-4 text-text-muted" />
          }
        </div>

        <input
          type="text"
          placeholder={selectedProduct
            ? selectedProduct.product_name
            : 'Cari nama produk atau paste URL femaledaily...'
          }
          value={selectedProduct ? '' : query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          className={`w-full pl-10 pr-10 py-3 text-sm border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
            selectedProduct
              ? 'bg-primary/5 border-primary/40 text-primary font-medium placeholder:text-primary'
              : 'bg-surface border-border text-text-main placeholder:text-text-muted'
          }`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {selectedProduct
            ? <button onClick={handleClear}><X className="w-4 h-4 text-text-muted hover:text-negative transition-colors" /></button>
            : <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          }
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !selectedProduct && (query.trim() || results.length > 0) && (
        <div className="absolute z-50 w-full mt-1.5 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
          {isSearching && (
            <p className="px-4 py-3 text-xs text-text-muted">Mencari...</p>
          )}
          {!isSearching && isUrl && (
            <button
              onClick={() => handleSelect({ _url: query, product_name: "Produk Baru (URL)", product_brand: "Klik Bandingkan untuk Scrape" })}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-base">🌐</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary truncate">Gunakan URL ini</p>
                <p className="text-xs text-text-muted truncate">{query}</p>
              </div>
            </button>
          )}
          {!isSearching && !isUrl && results.length === 0 && query.trim() && (
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
                {product.product_image ? <img src={product.product_image} alt="" className="w-full h-full object-cover" /> : "💄"}
              </div>
              <div className="min-w-0">
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
  )
}