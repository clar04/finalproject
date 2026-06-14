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

// NSS range -100 s/d +100, normalize ke 0-100 untuk radar
const normalize = (nss) => Math.max(0, Math.min(100, ((nss + 100) / 200) * 100))

export default function NSSRadarChart({ product1, product2 }) {
  const aspects = ['pigmentation', 'longevity', 'texture', 'hydration', 'price']

  const data = aspects.map(key => ({
    aspect: ASPECT_LABELS[key],
    [product1.product_name]: normalize(product1.nss_scores?.[key] ?? 0),
    [product2.product_name]: normalize(product2.nss_scores?.[key] ?? 0),
    // Raw NSS untuk tooltip
    [`${product1.product_name}_raw`]: product1.nss_scores?.[key] ?? 0,
    [`${product2.product_name}_raw`]: product2.nss_scores?.[key] ?? 0,
  }))

  // Custom tooltip yang tampilkan NSS asli (-100 to +100)
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface border border-border rounded-xl p-3 shadow-lg text-xs">
        <p className="font-semibold text-text-main mb-2">{label}</p>
        {payload.map((entry, idx) => {
          const rawKey = `${entry.name}_raw`
          const rawVal = data.find(d => d.aspect === label)?.[rawKey]
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
                <span style={{ color: '#3D2C30' }} className="truncate max-w-[140px] inline-block">{value}</span>
              )}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}