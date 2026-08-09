import { ApplicationStatus, TimelineEvent } from '../services/stats.service';

export const STATUS_ORDER: ApplicationStatus[] = [
  'COMPILED',
  'SENT',
  'VIEWED',
  'RESPONDED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWING',
  'OFFER',
  'REJECTED',
  'GHOSTED',
  'WITHDRAWN',
];

export const FUNNEL_STATUSES: ApplicationStatus[] = [
  'SENT',
  'VIEWED',
  'RESPONDED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWING',
  'OFFER',
];

export const OUTCOME_STATUSES: ApplicationStatus[] = [
  'REJECTED',
  'GHOSTED',
  'WITHDRAWN',
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  COMPILED: 'Compiled',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  RESPONDED: 'Responded',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEWING: 'Interviewing',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  GHOSTED: 'Ghosted',
  WITHDRAWN: 'Withdrawn',
};

// One accent per status, reused everywhere a status appears — funnel bars, board
// card stripes, timeline dots, outcome markers — so the same color always means
// the same stage anywhere in the dashboard.
export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  COMPILED: 'bg-slate-400',
  SENT: 'bg-sky-500',
  VIEWED: 'bg-cyan-500',
  RESPONDED: 'bg-blue-600',
  INTERVIEW_SCHEDULED: 'bg-violet-500',
  INTERVIEWING: 'bg-violet-600',
  OFFER: 'bg-emerald-600',
  REJECTED: 'bg-rose-500',
  GHOSTED: 'bg-zinc-400',
  WITHDRAWN: 'bg-zinc-400',
};

export const MIN_SAMPLE_SIZE = 3;
export const KANBAN_COLUMN_CAP = 5;

export interface DisplayFunnelStage {
  status: ApplicationStatus;
  label: string;
  colorClass: string;
  count: number;
  percentageOfMax: number;
  dropOffPercent: number | null; // % drop vs previous stage, null for the first
}

export interface TimelineEventDisplay extends TimelineEvent {
  daysSincePrevious: number | null;
}
