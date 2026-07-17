import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { KanbanColumn as KanbanColumnType, KanbanTask } from '../types';
import KanbanTaskCard from './KanbanTaskCard';

interface KanbanColumnProps {
  column: KanbanColumnType;
  tasks: KanbanTask[];
  onOpenTask: (task: KanbanTask) => void;
}

function KanbanColumn({ column, tasks, onOpenTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      columnId: column.id,
    },
  });

  return (
    <section
      ref={setNodeRef}
      className={`flex h-full w-80 shrink-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition ${
        isOver ? 'border-blue-200 bg-blue-50/60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950">
            {column.name} ({tasks.length})
          </h2>
          {column.wipLimit ? (
            <p className="mt-1 text-xs text-slate-500">WIP Limit: {column.wipLimit}</p>
          ) : null}
        </div>
      </div>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-4 min-h-32 flex-1 space-y-3">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <KanbanTaskCard key={task.id} task={task} columnId={column.id} onOpen={onOpenTask} />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No tasks
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export default React.memo(KanbanColumn);
