import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function PerformanceChart({
  data,
  dataKey,
  xAxisKey,
  gradientId,
  chartLabel,
  formatNumber,
  reversed = false,
  allowDecimals = false,
  labelFormatter,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 12, right: 12, left: -16, bottom: 5 }}
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#a3e635" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#a3e635" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          stroke="#24272d"
          strokeDasharray="4 4"
          vertical={false}
        />

        <XAxis
          dataKey={xAxisKey}
          tick={{ fill: '#858b97', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(value) =>
            String(value).length > 12
              ? `${String(value).slice(0, 10)}…`
              : value
          }
        />

        <YAxis
          allowDecimals={allowDecimals}
          reversed={reversed}
          tick={{ fill: '#858b97', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />

        <Tooltip
          contentStyle={{
            background: '#17191e',
            border: '1px solid #30343d',
            borderRadius: 10,
            color: '#f4f4f5',
          }}
          formatter={(value) => [
            formatNumber ? formatNumber(value) : value,
            chartLabel,
          ]}
          labelFormatter={labelFormatter}
        />

        <Area
          type="monotone"
          dataKey={dataKey}
          name={chartLabel}
          stroke="#a3e635"
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}