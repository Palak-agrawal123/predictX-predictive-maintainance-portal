import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';

/**
 * Custom light industrial tooltip
 */
const CustomTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#DFE4DD] px-3 py-2 rounded-md shadow-xs text-xs">
        <div className="text-[#68736C] text-[11px] font-medium mb-1 pb-1 border-b border-[#E7ECE5]">{label}</div>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[#202925] font-mono font-medium">
              {entry.name ? `${entry.name}: ` : ''}{entry.value}{unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Fleet Risk Distribution bar chart
 */
export function FleetRiskBarChart({ data, height = 180 }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE5" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#68736C"
            tick={{ fill: '#68736C', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            stroke="#68736C"
            tick={{ fill: '#68736C', fontSize: 11 }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip unit=" assets" />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={26}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || '#246B52'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Fleet-wide Workload & Work Order trend
 */
export function MaintenanceWorkloadTrendChart({ data, height = 180 }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="workloadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#246B52" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#246B52" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#368363" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#368363" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE5" vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#68736C"
            tick={{ fill: '#68736C', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            stroke="#68736C"
            tick={{ fill: '#68736C', fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip unit=" orders" />} />
          <Area
            type="monotone"
            dataKey="created"
            name="Created Tasks"
            stroke="#246B52"
            strokeWidth={1.75}
            fillOpacity={1}
            fill="url(#workloadGrad)"
          />
          <Area
            type="monotone"
            dataKey="resolved"
            name="Completed Tasks"
            stroke="#368363"
            strokeWidth={1.5}
            fillOpacity={1}
            fill="url(#resolvedGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Time-series sensor trend graph
 */
export function SensorTrendChart({ data, selectedSensor = 'temperature', sensorLabel = 'Sensor Reading', color = '#246B52', height = 240 }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center border border-[#DFE4DD] rounded bg-white text-xs text-[#68736C]">
        No telemetry stream available
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#E7ECE5" vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke="#68736C"
            tick={{ fill: '#68736C', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
          />
          <YAxis
            stroke="#68736C"
            tick={{ fill: '#68736C', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip unit="" />} />
          <Line
            type="monotone"
            dataKey={selectedSensor}
            name={sensorLabel}
            stroke={color}
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Multi-series sensor trend graph
 */
export function MultiSensorTrendChart({
  data,
  series = [],
  height = 200,
  yAxes = null
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center border border-[#DFE4DD] rounded bg-white text-xs text-[#68736C]" style={{ height }}>
        No telemetry stream available
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#E7ECE5" vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke="#68736C"
            tick={{ fill: '#68736C', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
          />
          {yAxes ? (
            yAxes.map((axis) => (
              <YAxis
                key={axis.id}
                yAxisId={axis.id}
                orientation={axis.orientation || 'left'}
                stroke="#68736C"
                tick={{ fill: '#68736C', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                domain={axis.domain || ['auto', 'auto']}
              />
            ))
          ) : (
            <YAxis
              stroke="#68736C"
              tick={{ fill: '#68736C', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              domain={['auto', 'auto']}
            />
          )}
          <Tooltip content={<CustomTooltip unit="" />} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={1.75}
              yAxisId={s.yAxisId}
              dot={false}
              activeDot={{ r: 4, fill: s.color, stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
