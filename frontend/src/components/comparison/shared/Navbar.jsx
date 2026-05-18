import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Sparkles, Search, GitCompare } from 'lucide-react'

export default function Navbar() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const handleSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    // Kalau input URL femaledaily → navigate ke compare dengan query
    // Kalau nama produk → navigate ke compare dengan search query
    navigate(`/compare?q=${encodeURIComponent(query.trim())}`)
    setQuery('')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 bg-surface border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 shrink-0 group"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm group-hover:opacity-90 transition-opacity">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-semibold text-text-main hidden sm:block">
              Lip<span className="text-primary">Sense</span>
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:bg-background hover:text-text-main'
              }`}
            >
              Explore
            </Link>
            <Link
              to="/compare"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/compare')
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:bg-background hover:text-text-main'
              }`}
            >
              <GitCompare className="w-4 h-4" />
              Compare
            </Link>
          </div>

          {/* Search Bar */}
          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-md"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search product or paste URL..."
                className="w-full h-10 pl-10 pr-4 text-sm bg-background border border-border rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </form>

        </div>
      </div>
    </nav>
  )
}