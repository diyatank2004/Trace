import React from 'react';
import { X } from 'lucide-react';
import type { KanbanSprintOption, KanbanTask } from '../types';

interface TaskDetailsDrawerProps {
  task: KanbanTask | null;
  sprints: KanbanSprintOption[];
  onClose: () => void;
}

const formatDateTime = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function TaskDetailsDrawer({ task, sprints, onClose }: TaskDetailsDrawerProps) {
  const sprintName = task?.sprintId
    ? sprints.find((sprint) => sprint.id === task.sprintId)?.name ?? 'Sprint not found'
    : 'No sprint';

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-300 ${
        task ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {task ? (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                {task.ticketKey}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-8 text-slate-950">{task.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex-1 space-y-4 overflow-y-auto">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Description
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {task.description || 'No description returned by the backend.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailRow label="Priority" value={task.priority} />
              <DetailRow label="Assignee" value={task.assigneeId || 'Unassigned'} />
              <DetailRow label="Sprint" value={sprintName} />
              <DetailRow label="Created At" value={formatDateTime(task.createdAt)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default React.memo(TaskDetailsDrawer);
