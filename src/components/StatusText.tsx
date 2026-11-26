import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { DEMO_MODE } from '../config';
import { TicketPriority, TicketStatus } from '../types/serpo';
import { buildCsvContent, formatPercent } from '../utils/serpoLogic';

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = buildCsvContent(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Baru',
  ASSIGNED: 'Ditugaskan',
  IN_PROGRESS: 'Dikerjakan',
  RESOLVED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICAL: 'Kritis',
  HIGH: 'Tinggi',
  MEDIUM: 'Sedang',
  LOW: 'Rendah',
};

export function getTicketStatusLabel(status: TicketStatus): string {
  return TICKET_STATUS_LABELS[status];
}

export function getTicketPriorityLabel(priority: TicketPriority): string {
  return TICKET_PRIORITY_LABELS[priority];
}

interface StatusBadgeProps {
  tone: 'green' | 'amber' | 'red' | 'blue' | 'gray';
  label: string;
  icon?: 'check' | 'warn' | 'error' | 'clock' | 'shield' | 'bolt' | 'up' | 'down' | 'minus';
}

const TONE_CLASSES: Record<StatusBadgeProps['tone'], string> = {
  green: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  amber: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  red: 'bg-[#FEF2F2] text-[#E61E25] border-[#FECACA]',
  blue: 'bg-[#EFF6FF] text-[#0A4B8F] border-[#BFDBFE]',
  gray: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
};

export const StatusLabel: React.FC<StatusBadgeProps> = ({ tone, label, icon }) => {
  const renderIcon = () => {
    const cls = 'w-3.5 h-3.5 shrink-0';
    switch (icon) {
      case 'check':
        return <CheckCircle2 className={cls} aria-hidden="true" />;
      case 'warn':
        return <AlertTriangle className={cls} aria-hidden="true" />;
      case 'error':
        return <XCircle className={cls} aria-hidden="true" />;
      case 'clock':
        return <Clock className={cls} aria-hidden="true" />;
      case 'shield':
        return <ShieldAlert className={cls} aria-hidden="true" />;
      case 'bolt':
        return <Zap className={cls} aria-hidden="true" />;
      case 'up':
        return <ArrowUp className={cls} aria-hidden="true" />;
      case 'down':
        return <ArrowDown className={cls} aria-hidden="true" />;
      case 'minus':
        return <Minus className={cls} aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold tracking-tight whitespace-nowrap shrink-0 ${TONE_CLASSES[tone]}`}
    >
      {renderIcon()}
      <span>{label}</span>
    </span>
  );
};

export const TicketStatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
  const label = getTicketStatusLabel(status);
  if (status === 'RESOLVED') return <StatusLabel tone="green" icon="check" label={label} />;
  if (status === 'IN_PROGRESS') return <StatusLabel tone="amber" icon="clock" label={label} />;
  if (status === 'ASSIGNED') return <StatusLabel tone="blue" label={label} />;
  if (status === 'CANCELLED') return <StatusLabel tone="red" icon="error" label={label} />;
  return <StatusLabel tone="gray" label={label} />;
};

export const TicketPriorityBadge: React.FC<{
  priority: TicketPriority;
  slaBreached?: boolean;
}> = ({ priority, slaBreached = false }) => {
  const label = getTicketPriorityLabel(priority);
  if (priority === 'CRITICAL' || slaBreached) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E61E25] text-white text-[11px] font-bold tracking-tight whitespace-nowrap shrink-0">
        {priority === 'CRITICAL' && <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />}
        <span>{label}</span>
        {slaBreached && <span>· Lewat SLA</span>}
      </span>
    );
  }
  if (priority === 'HIGH') return <StatusLabel tone="amber" icon="up" label={label} />;
  if (priority === 'MEDIUM') return <StatusLabel tone="amber" icon="minus" label={label} />;
  return <StatusLabel tone="gray" icon="down" label={label} />;
};

interface BudgetMeterProps {
  pct: number;
  warningThresholdPct: number;
  status: 'Aman' | 'Waspada' | 'Melebihi budget';
}

export const BudgetMeter: React.FC<BudgetMeterProps> = ({
  pct,
  warningThresholdPct,
  status,
}) => {
  const clampedWidth = Math.min(100, Math.max(0, pct));
  const fillClass =
    status === 'Melebihi budget'
      ? 'bg-[#E61E25]'
      : status === 'Waspada'
      ? 'bg-[#F59E0B]'
      : 'bg-[#0A4B8F]';

  const trackClass =
    status === 'Melebihi budget'
      ? 'bg-[#FEE2E2]'
      : status === 'Waspada'
      ? 'bg-[#FEF3C7]'
      : 'bg-[#E2E8F0]';

  return (
    <div className="flex items-center gap-2.5 min-w-[130px]">
      <div className={`relative h-2 flex-1 rounded-full overflow-hidden ${trackClass}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillClass}`}
          style={{ width: `${clampedWidth}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/95 z-10"
          style={{ left: `${Math.min(98, Math.max(5, warningThresholdPct))}%` }}
          title={`Ambang peringatan ${formatPercent(warningThresholdPct, 0)}`}
        />
      </div>
      <span className="text-xs font-semibold text-[#0F172A] tabular-nums w-12 text-right">
        {formatPercent(pct)}
      </span>
    </div>
  );
};

interface PageHeaderProps {
  title: string;
  subtitle: string;
  timestampLabel?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  timestampLabel = 'Data per 8 Nov 2026, 09.41 WITA',
  action,
}) => {
  const displayTimestamp = DEMO_MODE
    ? `Data demo · ${timestampLabel}`
    : timestampLabel;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">{title}</h1>
        <p className="text-sm text-[#475569] mt-0.5">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
        <span className="text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
          {displayTimestamp}
        </span>
        {action}
      </div>
    </div>
  );
};
