import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanTask } from '../types';

interface KanbanTaskCardProps {
  task: KanbanTask;
  columnId: string;
  onOpen: (task: KanbanTask) => void;
  isOverlay?: boolean;
}

const getPriorityClass = (priority: KanbanTask['priority']) => {
  if (priority === 'High' || priority === 'Urgent') {
    return 'bg-rose-500/10 text-rose-600';
  }

  if (priority === 'Medium') {
    return 'bg-blue-500/10 text-blue-600';
  }

  return 'bg-slate-100 text-slate-600';
};

const formatCreatedAt = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return parsed.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

function KanbanTaskCard({ task, columnId, onOpen, isOverlay = false }: KanbanTaskCardProps) {
  const sortable = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
      columnId,
    },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <button
      ref={sortable.setNodeRef}
      type="button"
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={() => onOpen(task)}
      className={`w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 ${
        sortable.isDragging ? 'opacity-40' : ''
      } ${isOverlay ? 'shadow-2xl' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="truncate font-mono text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
          {task.ticketKey}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${getPriorityClass(task.priority)}`}>
          {task.priority}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
        {task.title}
      </h3>

      <div className="mt-4 grid grid-cols-1 gap-1 text-xs text-slate-500">
        <p className="truncate">
          <span className="font-semibold text-slate-700">Assignee:</span>{' '}
          {task.assigneeId || 'Unassigned'}
        </p>
        <p className="truncate">
          <span className="font-semibold text-slate-700">Created:</span>{' '}
          {formatCreatedAt(task.createdAt)}
        </p>
      </div>
    </button>
  );
}

export default React.memo(KanbanTaskCard);
