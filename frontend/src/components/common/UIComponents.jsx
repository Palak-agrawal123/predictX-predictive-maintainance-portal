import React from 'react';

export function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  let bg = 'bg-[#F0F4F1] text-[#68756F] border-[#E0E6E0]';

  if (s === 'operational' || s === 'completed' || s === 'healthy') {
    bg = 'bg-[#27845C]/10 text-[#27845C] border-[#27845C]/25';
  } else if (s === 'warning' || s === 'degraded' || s === 'in progress' || s === 'approved') {
    bg = 'bg-[#D99A24]/10 text-[#A66E0C] border-[#D99A24]/30';
  } else if (s === 'critical' || s === 'urgent' || s === 'under maintenance' || s === 'offline') {
    bg = 'bg-[#B94040]/10 text-[#B94040] border-[#B94040]/30';
  } else if (s === 'draft') {
    bg = 'bg-[#1E7598]/10 text-[#1E7598] border-[#1E7598]/25';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border font-medium ${bg}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80"></span>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const p = (priority || '').toLowerCase();
  let bg = 'bg-[#F0F4F1] text-[#68756F] border-[#E0E6E0]';

  if (p === 'low') {
    bg = 'bg-[#27845C]/10 text-[#27845C] border-[#27845C]/25';
  } else if (p === 'medium') {
    bg = 'bg-[#1E7598]/10 text-[#1E7598] border-[#1E7598]/25';
  } else if (p === 'high') {
    bg = 'bg-[#D99A24]/10 text-[#A66E0C] border-[#D99A24]/30';
  } else if (p === 'urgent' || p === 'critical') {
    bg = 'bg-[#B94040]/12 text-[#B94040] border-[#B94040]/35 font-semibold';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${bg}`}>
      {priority}
    </span>
  );
}

export function StatCard({ title, value, subtitle, icon: Icon, badge, color = 'accent' }) {
  const colorMap = {
    accent: 'text-[#176B52] border-[#176B52]/20 bg-[#176B52]/5',
    healthy: 'text-[#27845C] border-[#27845C]/20 bg-[#27845C]/5',
    warning: 'text-[#A66E0C] border-[#D99A24]/20 bg-[#D99A24]/5',
    critical: 'text-[#B94040] border-[#B94040]/20 bg-[#B94040]/5',
    blue: 'text-[#1E7598] border-[#1E7598]/20 bg-[#1E7598]/5',
  };

  return (
    <div className="bg-white border border-[#E0E6E0] rounded-lg p-4 transition-all hover:border-[#B5C4BA] shadow-sm">
      <div className="flex items-center justify-between text-[#68756F] mb-2">
        <span className="text-xs font-mono uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`p-1.5 rounded border ${colorMap[color] || colorMap.accent}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold font-mono tracking-tight text-[#202A27]">{value}</span>
        {badge && <span className="text-[11px] font-mono text-[#68756F]">{badge}</span>}
      </div>
      {subtitle && <p className="text-[12px] text-[#68756F] mt-1 truncate">{subtitle}</p>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-[#252B27] gap-3">
      <div>
        <h1 className="text-lg font-mono font-bold tracking-tight text-text-main flex items-center gap-2">
          <span className="text-accent">//</span> {title}
        </h1>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
