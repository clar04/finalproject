import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip
} from 'recharts'

const ASPECT_LABELS = {
  pigmentation: 'Pigmentasi',
  longevity:    'Ketahanan',
  texture:      'Tekstur',
  hydration:    'Hidrasi',
  price:        'Harga',
}

const ASPECT_KEYS = ['pigmentation', 'longevity', 'texture', 'hydration', 'price']

const normalize = (nss) => Math.max(0, Math.min(100, ((nss + 100) / 200) * 100))

function getLowCountAspects(product) {
  if (!product.absa_aspects) return []
  return product.absa_aspects.filter(a => a.is_low_count && a.low_count_warning)
}

function LowCountBadge({ aspectLabel, warning }) {
  return (
    <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2
                    bg-amber-50 border border-amber-200 text-amber-800">
      <span className="mt-0.5 flex-shrink-0">⚠️</span>
      <span>
        <span className="font-medium">{aspectLabel}: </span>
        {warning}
      </span>
    </div>
  )
}

function ProductWarnings({ product, dotColor }) {
  const lowAspects = getLowCountAspects(product)
  if (lowAspects.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: dotColor }}
        />
        <span className="text-xs font-medium text-text-main truncate">
          {product.product_name}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 pl-4">
        {lowAspects.map(a => (
          <LowCountBadge
            key={a.aspect}
            aspectLabel={ASPECT_LABELS[a.aspect] ?? a.aspect}
            warning={a.low_count_warning}
          />
        ))}
      </div>
    </div>
  )
}

export default function NSSRadarChart({ product1, product2 }) {
  const data = ASPECT_KEYS.map(key => ({
    aspect: ASPECT_LABELS[key],
    [product1.product_name]: normalize(product1.nss_scores?.[key] ?? 0),
    [product2.product_name]: normalize(product2.nss_scores?.[key] ?? 0),
    [`${product1.product_name}_raw`]: product1.nss_scores?.[key] ?? 0,
    [`${product2.product_name}_raw`]: product2.nss_scores?.[key] ?? 0,
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface border border-border rounded-xl p-3 shadow-lg text-xs">
        <p className="font-semibold text-text-main mb-2">{label}</p>
        {payload.map((entry, idx) => {
          const rawVal = data.find(d => d.aspect === label)?.[`${entry.name}_raw`]
          return (
            <div key={idx} className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
              <span className="text-text-muted truncate max-w-[120px]">{entry.name}</span>
              <span className="font-semibold text-text-main ml-auto">
                {rawVal !== undefined ? `${rawVal > 0 ? '+' : ''}${rawVal}` : '-'}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const hasAnyWarning =
    getLowCountAspects(product1).length > 0 ||
    getLowCountAspects(product2).length > 0

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-main mb-1 text-center">
        Perbandingan Aspek
      </h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="#E8CECE" />
            <PolarAngleAxis
              dataKey="aspect"
              tick={{ fill: '#8C7177', fontSize: 12, fontFamily: 'Poppins' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#C9B8BD', fontSize: 10 }}
              tickCount={4}
            />
            <Radar
              name={product1.product_name}
              dataKey={product1.product_name}
              stroke="#D62828"
              fill="#D62828"
              fillOpacity={0.4}
              strokeWidth={3}
            />
            <Radar
              name={product2.product_name}
              dataKey={product2.product_name}
              stroke="#003049"
              fill="#003049"
              fillOpacity={0.4}
              strokeWidth={3}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 16, fontSize: 12, fontFamily: 'Poppins' }}
              formatter={(value) => (
                <span style={{ color: '#3D2C30' }} className="truncate max-w-[140px] inline-block">
                  {value}
                </span>
              )}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {hasAnyWarning && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            Catatan reliabilitas data
          </p>
          <ProductWarnings product={product1} dotColor="#D62828" />
          <ProductWarnings product={product2} dotColor="#003049" />
        </div>
      )}
    </section>
  )
}
