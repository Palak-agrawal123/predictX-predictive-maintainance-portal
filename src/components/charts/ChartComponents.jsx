import React, { useState } from 'react';
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
  CartesianGrid,
  PieChart,
  Pie
} from 'recharts';

/**
 * Custom light industrial tooltip
 */
const CustomTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#E0E6E0] px-3 py-2 rounded shadow-md text-xs font-mono">
        <div className="text-[#68756F] text-[10px] font-semibold mb-1 pb-1 border-b border-[#EAF0EC]">{label}</div>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[#202A27] font-semibold">
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
 * Fleet Risk Distribution bar chart - showing count of machines across 4 risk bands
 */
export function FleetRiskBarChart({ data, height = 180 }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE7" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#68756F"
            tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
          />
          <YAxis
            stroke="#68756F"
            tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip unit=" assets" />} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={28}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || '#176B52'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Fleet-wide Workload & Work Order trend over recent days/weeks
 */
export function MaintenanceWorkloadTrendChart({ data, height = 180 }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="workloadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#176B52" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#176B52" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#27845C" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#27845C" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE7" vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#68756F"
            tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
          />
          <YAxis
            stroke="#68756F"
            tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip unit=" orders" />} />
          <Area
            type="monotone"
            dataKey="created"
            name="Logged Tasks"
            stroke="#176B52"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#workloadGrad)"
          />
          <Area
            type="monotone"
            dataKey="resolved"
            name="Resolved Tasks"
            stroke="#27845C"
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
 * Time-series sensor trend graph with selectable telemetry metric
 */
export function SensorTrendChart({ data, selectedSensor = 'temperature', sensorLabel = 'LPC Temp (°C)', color = '#176B52', height = 240 }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center border border-[#E0E6E0] rounded bg-white text-xs font-mono text-[#68756F]">
        No telemetry stream available for selected machine
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#E7ECE7" vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke="#68756F"
            tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
          />
          <YAxis
            stroke="#68756F"
            tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip unit="" />} />
          <Line
            type="monotone"
            dataKey={selectedSensor}
            name={sensorLabel}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Reusable multi-series or single-series sensor trend graph with custom lines and Y axes
 */
export function MultiSensorTrendChart({
  data,
  series = [],
  height = 200,
  yAxes = null
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center border border-[#E0E6E0] rounded bg-white text-xs font-mono text-[#68756F]" style={{ height }}>
        No telemetry stream available for selected machine
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#E7ECE7" vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke="#68756F"
            tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
          />
          {yAxes ? (
            yAxes.map((axis) => (
              <YAxis
                key={axis.id}
                yAxisId={axis.id}
                orientation={axis.orientation || 'left'}
                stroke="#68756F"
                tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                domain={axis.domain || ['auto', 'auto']}
              />
            ))
          ) : (
            <YAxis
              stroke="#68756F"
              tick={{ fill: '#68756F', fontSize: 10, fontFamily: 'monospace' }}
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
              strokeWidth={2}
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
