import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = {
  positive: '#81B29A',
  negative: '#E07A5F',
  neutral:  '#C9B8BD',
}

const LABELS = {
  positive: 'Positif',
  negative: 'Negatif',
  neutral:  'Netral',
}

// Custom label di dalam slice
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function SentimentDonut({ distribution }) {
  // distribution: { positive: 1823, negative: 312, neutral: 145 }
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)

  const data = ['positive', 'negative', 'neutral']
    .filter(key => distribution[key] > 0)
    .map(key => ({
      name: LABELS[key],
      value: distribution[key],
      color: COLORS[key],
      percent: total > 0 ? ((distribution[key] / total) * 100).toFixed(1) : 0,
    }))

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-text-main">Distribusi Sentimen</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Berdasarkan {total.toLocaleString('id-ID')} ulasan yang dianalisis
        </p>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${value.toLocaleString('id-ID')} ulasan`,
                name,
              ]}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E8CECE',
                borderRadius: '10px',
                fontSize: '12px',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ color: '#8C7177', fontSize: '12px' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap mt-2">
        {data.map(({ name, value, color, percent }) => (
          <div
            key={name}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-background border border-border"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-text-muted">{name}</span>
            <span className="font-semibold text-text-main">{percent}%</span>
          </div>
        ))}
      </div>
    </section>
  )
}