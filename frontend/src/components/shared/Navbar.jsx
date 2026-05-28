import { Link, useLocation } from 'react-router-dom'
import { GitCompare, Sparkles } from 'lucide-react'

const NAV_LINKS = [
  { to: '/',        label: 'Rekomendasi' },
  { to: '/compare', label: 'Bandingkan', icon: GitCompare },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">

        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold text-text-main tracking-tight">
            Lip<span className="text-primary">Sense</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
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
  )
}
