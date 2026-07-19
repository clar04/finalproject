import { Filter, Flame, Palette, Clock, Layers, Droplets, DollarSign, Check, X } from 'lucide-react'

const ASPECTS = [
  { id: 'pigmentation', label: 'Pigmentasi', icon: Palette },
  { id: 'longevity',    label: 'Ketahanan',  icon: Clock },
  { id: 'texture',      label: 'Tekstur',    icon: Layers },
  { id: 'hydration',    label: 'Hidrasi',    icon: Droplets },
  { id: 'price',        label: 'Harga',      icon: DollarSign },
]

export default function Sidebar({
  selectedFilters,
  onFilterChange,
  // showTrending,
  // onTrendingChange,
}) {
  const toggleFilter = (id) => {
    if (selectedFilters.includes(id)) {
      onFilterChange(selectedFilters.filter(f => f !== id))
    } else {
      onFilterChange([...selectedFilters, id])
    }
  }

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-16 overflow-y-auto bg-surface border-r border-border">
      <div className="p-5 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Filter className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-main">Filters</p>
            <p className="text-xs text-text-muted">Refine results</p>
          </div>
        </div>

        {/* Aspect Filters */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-3">
            ABSA Aspects
          </p>
          <div className="space-y-1">
            {ASPECTS.map(({ id, label, icon: Icon }) => {
              const active = selectedFilters.includes(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleFilter(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-primary/10 text-text-main'
                      : 'text-text-muted hover:bg-background hover:text-text-main'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                    active
                      ? 'bg-primary border-primary'
                      : 'border-border bg-white'
                  }`}>
                    {active && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>

                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-text-muted'}`} />
                  <span className={`font-medium ${active ? 'text-text-main' : ''}`}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Trending Toggle */}
        <div className="border-t border-border pt-5">
          {/* <button
            onClick={() => onTrendingChange(!showTrending)}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
              showTrending ? 'bg-primary/10' : 'bg-background hover:bg-border/30'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                showTrending ? 'bg-primary/20' : 'bg-border/50'
              }`}>
                <Flame className={`w-4 h-4 ${showTrending ? 'text-primary' : 'text-text-muted'}`} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-main">Trending</p>
                <p className="text-[10px] text-text-muted">Rising NSS only</p>
              </div>
            </div>

            <div className={`w-9 h-5 rounded-full transition-colors relative ${
              showTrending ? 'bg-primary' : 'bg-border'
            }`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                showTrending ? 'left-4' : 'left-0.5'
              }`} />
            </div>
          </button> */}
        </div>

        {/* Active filter summary */}
        {selectedFilters.length > 0 && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-text-muted">Active filters</p>
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center">
                {selectedFilters.length}
              </span>
            </div>
            <button
              onClick={() => onFilterChange([])}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-text-muted border border-border rounded-lg hover:bg-background hover:text-text-main transition-colors"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          </div>
        )}

      </div>
    </aside>
  )
}