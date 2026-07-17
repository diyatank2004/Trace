import { IssuePriority, IssueStatus, IssueType } from './types';

export const APP_NAME = 'Trace';

export const STATUS_COLORS: Record<IssueStatus, string> = {
  [IssueStatus.TODO]: 'bg-blue-50 text-blue-700 border-blue-200',
  [IssueStatus.IN_PROGRESS]: 'bg-amber-50 text-amber-700 border-amber-200',
  [IssueStatus.TESTING]: 'bg-purple-100 text-purple-700 border-purple-200',
  [IssueStatus.DEV_COMPLETED]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  [IssueStatus.PEER_REVIEW]: 'bg-purple-50 text-purple-700 border-purple-200',
  [IssueStatus.QA_MOVE]: 'bg-pink-50 text-pink-700 border-pink-200',
  [IssueStatus.UAT_MOVE]: 'bg-rose-50 text-rose-700 border-rose-200',
  [IssueStatus.PROD_DEPLOY]: 'bg-orange-50 text-orange-700 border-orange-200',
  [IssueStatus.DONE]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const PRIORITY_COLORS: Record<IssuePriority, { bg: string; text: string; border: string; full: string }> = {
  [IssuePriority.LOW]: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    full: 'bg-blue-50 text-blue-600 border-blue-100'
  },
  [IssuePriority.MEDIUM]: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    border: 'border-yellow-100',
    full: 'bg-yellow-50 text-yellow-600 border-yellow-100'
  },
  [IssuePriority.HIGH]: {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-100',
    full: 'bg-orange-50 text-orange-600 border-orange-100'
  },
  [IssuePriority.CRITICAL]: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-100',
    full: 'bg-red-50 text-red-600 border-red-100'
  },
};

export const TYPE_ICONS: Record<IssueType, string> = {
  [IssueType.STORY]: 'book-open',
  [IssueType.TASK]: 'check-square',
  [IssueType.BUG]: 'bug',
  [IssueType.EPIC]: 'shield',
};
