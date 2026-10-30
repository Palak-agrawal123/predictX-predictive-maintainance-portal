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

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeType = "neutral",
  valueColor,
  progressBar
}) {
  const badgeStyles = {
    success: "bg-[#E8F2EC] text-[#246B52] border-[#C7E3D3]",
    warning: "bg-[#FAF2E6] text-[#B98232] border-[#F2DEBA]",
    danger: "bg-[#FDF0F0] text-[#B74747] border-[#F5CACA]",
    neutral: "bg-[#F0F2ED] text-[#617068] border-[#DFE4DD]"
  };

  return (
    <div className="bg-white border border-[#DFE4DD] rounded-xl p-5 transition-all hover:border-[#C2CDC0] hover:shadow-xs min-h-[110px] flex flex-col justify-between box-border">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#55635C] tracking-tight">{title}</span>
        {badge && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${badgeStyles[badgeType] || badgeStyles.neutral}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              badgeType === 'success' ? 'bg-[#246B52]' :
              badgeType === 'warning' ? 'bg-[#B98232]' :
              badgeType === 'danger' ? 'bg-[#B74747]' : 'bg-[#617068]'
            }`} />
            {badge}
          </span>
        )}
        {Icon && !badge && (
          <div className="p-1 rounded text-[#617068]">
            <Icon size={15} strokeWidth={1.75} />
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="flex items-baseline justify-between">
          <span className={`text-3xl font-bold font-mono tracking-tight ${valueColor || 'text-[#1A2520]'}`}>
            {value}
          </span>
        </div>

        {progressBar !== undefined && progressBar !== null && (
          <div className="w-full bg-[#EBF0EB] h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressBar >= 70 ? 'bg-[#246B52]' : progressBar >= 50 ? 'bg-[#B98232]' : 'bg-[#B74747]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progressBar))}%` }}
            />
          </div>
        )}

        {subtitle && (
          <p className="text-xs font-normal text-[#6B7972] mt-1.5 leading-normal truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-4 border-b border-[#DFE4DD] gap-3">
      <div>
        <h2 className="text-base font-bold tracking-tight text-[#151D19]">{title}</h2>
        {subtitle && <p className="text-xs font-normal text-[#617068] mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
