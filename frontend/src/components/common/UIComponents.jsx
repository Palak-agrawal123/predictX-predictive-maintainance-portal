import React from 'react';

export function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  let style = 'bg-[#F0F2ED] text-[#68736C] border-[#DFE4DD]';
  let dotColor = '#85918A';

  if (s === 'operational' || s === 'completed' || s === 'healthy') {
    style = 'bg-[#EBF5F0] text-[#368363] border-[#CCE6DA]';
    dotColor = '#368363';
  } else if (s === 'warning' || s === 'degraded' || s === 'in progress' || s === 'approved') {
    style = 'bg-[#FAF3E7] text-[#B98232] border-[#F3E0BD]';
    dotColor = '#B98232';
  } else if (s === 'critical' || s === 'urgent' || s === 'under maintenance' || s === 'offline') {
    style = 'bg-[#F8EBEB] text-[#B74747] border-[#EFCACA]';
    dotColor = '#B74747';
  } else if (s === 'draft') {
    style = 'bg-[#EBF3F6] text-[#2B6E8A] border-[#CFE2EA]';
    dotColor = '#2B6E8A';
  }

  // Capitalize nicely
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
      <span>{label}</span>
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const p = (priority || '').toLowerCase();
  let style = 'bg-[#F0F2ED] text-[#68736C] border-[#DFE4DD]';
  let dotColor = '#85918A';

  if (p === 'low') {
    style = 'bg-[#EBF5F0] text-[#368363] border-[#CCE6DA]';
    dotColor = '#368363';
  } else if (p === 'medium') {
    style = 'bg-[#EBF3F6] text-[#2B6E8A] border-[#CFE2EA]';
    dotColor = '#2B6E8A';
  } else if (p === 'high') {
    style = 'bg-[#FAF3E7] text-[#B98232] border-[#F3E0BD]';
    dotColor = '#B98232';
  } else if (p === 'urgent' || p === 'critical') {
    style = 'bg-[#F8EBEB] text-[#B74747] border-[#EFCACA] font-semibold';
    dotColor = '#B74747';
  }

  const label = priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
      <span>{label}</span>
    </span>
  );
}

export function StatCard({ title, value, subtitle, icon: Icon, badge }) {
  return (
    <div className="bg-white border border-[#DFE4DD] rounded-lg p-4 transition-all hover:border-[#C2CDC0]">
      <div className="flex items-center justify-between text-[#68736C] mb-2">
        <span className="text-xs font-medium tracking-tight text-[#68736C]">{title}</span>
        {Icon && (
          <div className="p-1 rounded text-[#68736C]">
            <Icon size={15} strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold font-mono tracking-tight text-[#202925]">{value}</span>
        {badge && <span className="text-[11px] text-[#68736C] font-mono">{badge}</span>}
      </div>
      {subtitle && <p className="text-[12px] text-[#68736C] mt-1 truncate">{subtitle}</p>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-[#DFE4DD] gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[#202925]">{title}</h2>
        {subtitle && <p className="text-xs text-[#68736C] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
