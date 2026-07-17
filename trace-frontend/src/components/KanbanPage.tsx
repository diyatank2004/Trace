import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { createKanbanTask, fetchKanbanBoard, moveKanbanTask } from '../lib/kanbanApi';
import { fetchProjectSprints } from '../lib/sprintApi';
import type { KanbanBoardData, KanbanColumn as KanbanColumnType, KanbanPriority, KanbanSprintOption, KanbanTask } from '../types';
import KanbanColumn from './KanbanColumn';
import KanbanTaskCard from './KanbanTaskCard';
import TaskDetailsDrawer from './TaskDetailsDrawer';

interface KanbanPageProps {
  projectId: string | null;
  projectName: string;
  projectKey: string;
  currentEmployeeId?: string;
}

type TaskDraft = {
  title: string;
  description: string;
  priority: KanbanPriority;
  assigneeId: string;
  sprintId: string;
};

const emptyDraft: TaskDraft = {
  title: '',
  description: '',
  priority: 'Medium',
  assigneeId: '',
  sprintId: '',
};

const BOARD_COLUMN_WIDTH = 320;
const BOARD_COLUMN_GAP = 16;

const getAllTasks = (columns: KanbanColumnType[]) => columns.flatMap((column) => column.tasks);

const getColumnIdForTask = (columns: KanbanColumnType[], taskId: string) =>
  columns.find((column) => column.tasks.some((task) => task.id === taskId))?.id ?? null;

const moveTaskInColumns = (
  columns: KanbanColumnType[],
  taskId: string,
  targetColumnId: string,
  overTaskId?: string
) => {
  const sourceColumn = columns.find((column) => column.tasks.some((task) => task.id === taskId));
  const targetColumn = columns.find((column) => column.id === targetColumnId);

  if (!sourceColumn || !targetColumn) {
    return columns;
  }

  const sourceTaskIndex = sourceColumn.tasks.findIndex((task) => task.id === taskId);
  const taskToMove = sourceColumn.tasks[sourceTaskIndex];

  if (!taskToMove) {
    return columns;
  }

  if (sourceColumn.id === targetColumn.id) {
    if (!overTaskId || overTaskId === taskId) {
      return columns;
    }

    const targetTaskIndex = sourceColumn.tasks.findIndex((task) => task.id === overTaskId);

    if (targetTaskIndex < 0) {
      return columns;
    }

    return columns.map((column) =>
      column.id === sourceColumn.id
        ? { ...column, tasks: arrayMove(column.tasks, sourceTaskIndex, targetTaskIndex) }
        : column
    );
  }

  return columns.map((column) => {
    if (column.id === sourceColumn.id) {
      return { ...column, tasks: column.tasks.filter((task) => task.id !== taskId) };
    }

    if (column.id === targetColumn.id) {
      const nextTasks = [...column.tasks];
      const targetTaskIndex = overTaskId ? nextTasks.findIndex((task) => task.id === overTaskId) : -1;
      const insertIndex = targetTaskIndex >= 0 ? targetTaskIndex : nextTasks.length;
      nextTasks.splice(insertIndex, 0, { ...taskToMove, columnId: targetColumn.id });
      return { ...column, tasks: nextTasks };
    }

    return column;
  });
};

const formatSprintStatus = (status: string) => (status === 'Future' ? 'Planned' : status);

export default function KanbanPage({ projectId, projectName, projectKey, currentEmployeeId }: KanbanPageProps) {
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const [board, setBoard] = useState<KanbanBoardData | null>(null);
  const [columns, setColumns] = useState<KanbanColumnType[]>([]);
  const [sprints, setSprints] = useState<KanbanSprintOption[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState('all');
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [boardViewport, setBoardViewport] = useState({
    scrollLeft: 0,
    clientWidth: 0,
    scrollWidth: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const loadBoard = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!projectId) {
        setBoard(null);
        setColumns([]);
        setSprints([]);
        setSelectedSprintId('all');
        setLoadError(null);
        setIsLoading(false);
        return;
      }

      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setLoadError(null);

      try {
        const [boardRecord, sprintRecords] = await Promise.all([
          fetchKanbanBoard(projectId),
          fetchProjectSprints(projectId),
        ]);

        setBoard(boardRecord);
        setColumns(boardRecord.columns);
        setSprints(
          sprintRecords.map((sprint) => ({
            id: sprint.id,
            name: `${sprint.name} (${formatSprintStatus(sprint.status)})`,
          }))
        );
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load kanban board.');
        setBoard(null);
        setColumns([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const allTasks = useMemo(() => getAllTasks(columns), [columns]);

  const filteredColumns = useMemo(() => {
    if (selectedSprintId === 'all') {
      return columns;
    }

    return columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => task.sprintId === selectedSprintId),
    }));
  }, [columns, selectedSprintId]);

  const metrics = useMemo(() => {
    const doneColumn = columns.find((column) => column.name.trim().toLowerCase() === 'done');

    return {
      total: allTasks.length,
      highPriority: allTasks.filter((task) => task.priority === 'High').length,
      assignedToMe: currentEmployeeId
        ? allTasks.filter((task) => task.assigneeId?.trim().toLowerCase() === currentEmployeeId.trim().toLowerCase()).length
        : 0,
      completed: doneColumn?.tasks.length ?? 0,
    };
  }, [allTasks, columns, currentEmployeeId]);

  const updateBoardViewport = useCallback(() => {
    const boardElement = boardScrollRef.current;

    if (!boardElement) {
      return;
    }

    setBoardViewport({
      scrollLeft: boardElement.scrollLeft,
      clientWidth: boardElement.clientWidth,
      scrollWidth: boardElement.scrollWidth,
    });
  }, []);

  useEffect(() => {
    updateBoardViewport();
  }, [filteredColumns, isLoading, updateBoardViewport]);

  useEffect(() => {
    window.addEventListener('resize', updateBoardViewport);

    return () => window.removeEventListener('resize', updateBoardViewport);
  }, [updateBoardViewport]);

  const visibleColumnIds = useMemo(() => {
    const visibleStart = boardViewport.scrollLeft;
    const visibleEnd = boardViewport.scrollLeft + boardViewport.clientWidth;

    return new Set(
      filteredColumns
        .filter((column, index) => {
          const columnStart = index * (BOARD_COLUMN_WIDTH + BOARD_COLUMN_GAP);
          const columnEnd = columnStart + BOARD_COLUMN_WIDTH;
          return columnEnd > visibleStart && columnStart < visibleEnd;
        })
        .map((column) => column.id)
    );
  }, [boardViewport.clientWidth, boardViewport.scrollLeft, filteredColumns]);

  const showBoardMiniMap = filteredColumns.length > 1 && boardViewport.scrollWidth > boardViewport.clientWidth;

  const scrollToColumn = useCallback((columnIndex: number) => {
    boardScrollRef.current?.scrollTo({
      left: columnIndex * (BOARD_COLUMN_WIDTH + BOARD_COLUMN_GAP),
      behavior: 'smooth',
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as KanbanTask | undefined;
    setActiveTask(task ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const task = event.active.data.current?.task as KanbanTask | undefined;
      const overData = event.over?.data.current as { type?: string; columnId?: string; task?: KanbanTask } | undefined;

      setActiveTask(null);

      if (!task || !event.over) {
        return;
      }

      const sourceColumnId = getColumnIdForTask(columns, task.id);
      const targetColumnId = overData?.columnId ?? String(event.over.id);
      const overTaskId = overData?.type === 'task' ? String(event.over.id) : undefined;

      if (!sourceColumnId || !targetColumnId || (sourceColumnId === targetColumnId && (!overTaskId || overTaskId === task.id))) {
        return;
      }

      const previousColumns = columns;
      const nextColumns = moveTaskInColumns(columns, task.id, targetColumnId, overTaskId);

      setColumns(nextColumns);
      setSelectedTask((current) => (current?.id === task.id ? { ...current, columnId: targetColumnId } : current));
      setActionError(null);
      setStatusNote(null);

      try {
        await moveKanbanTask(task.id, targetColumnId);
        setStatusNote(`${task.ticketKey} moved successfully.`);
      } catch (error) {
        setColumns(previousColumns);
        setSelectedTask((current) => (current?.id === task.id ? task : current));
        setActionError(error instanceof Error ? error.message : 'Unable to move task. Board changes were rolled back.');
      }
    },
    [columns]
  );

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
  }, []);

  const openCreateForm = useCallback(() => {
    setDraft(emptyDraft);
    setActionError(null);
    setStatusNote(null);
    setIsCreateOpen(true);
  }, []);

  const submitCreateTask = useCallback(async () => {
    if (!projectId) {
      setActionError('Select a project before creating a task.');
      return;
    }

    if (draft.title.trim().length < 2) {
      setActionError('Task title must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setStatusNote(null);

    try {
      const createdTask = await createKanbanTask({
        project_id: projectId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        priority: draft.priority,
        Sprint_id: draft.sprintId || null,
        Assignee_id: draft.assigneeId.trim() || null,
      });

      setStatusNote(`Created task ${createdTask.ticketKey}.`);
      setIsCreateOpen(false);
      setDraft(emptyDraft);
      await loadBoard({ silent: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to create task.');
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, loadBoard, projectId]);

  const loadingColumns = Array.from({ length: 4 }, (_, index) => index);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Kanban Board
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            {projectName}
            <span className="ml-3 text-sm font-medium text-slate-400">{projectKey}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Move work through the project workflow using the live board returned by the backend.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void loadBoard({ silent: true })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Board
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Tasks" value={metrics.total} />
        <StatCard label="High Priority Tasks" value={metrics.highPriority} />
        <StatCard label="Assigned To Me" value={metrics.assignedToMe} />
        <StatCard label="Completed Tasks" value={metrics.completed} />
      </div>

      {statusNote ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusNote}
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      <section className="relative rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{board?.name ?? 'Workflow Board'}</h2>
            <p className="text-sm text-slate-500">Columns and tasks are rendered from the backend board response.</p>
          </div>
          <label className="min-w-56 space-y-2">
            <span className="sr-only">Sprint Filter</span>
            <select
              value={selectedSprintId}
              onChange={(event) => setSelectedSprintId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="all">All Tasks</option>
              {sprints.map((sprint, index) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name || `Sprint ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div ref={boardScrollRef} onScroll={updateBoardViewport} className="mt-5 overflow-x-auto scroll-smooth pb-3">
          {isLoading ? (
            <div className="flex min-h-[28rem] gap-4">
              {loadingColumns.map((item) => (
                <div key={item} className="w-80 shrink-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
                  <div className="mt-5 space-y-3">
                    <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredColumns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No board columns were returned for this project.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={(event) => void handleDragEnd(event)}
              onDragCancel={handleDragCancel}
            >
              <div className="flex min-h-[28rem] gap-4">
                {filteredColumns.map((column) => (
                  <KanbanColumn key={column.id} column={column} tasks={column.tasks} onOpenTask={setSelectedTask} />
                ))}
              </div>

              <DragOverlay>
                {activeTask ? (
                  <KanbanTaskCard task={activeTask} columnId={activeTask.columnId} onOpen={() => undefined} isOverlay />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {showBoardMiniMap ? (
          <BoardMiniMap
            columns={filteredColumns}
            visibleColumnIds={visibleColumnIds}
            viewport={boardViewport}
            onSelectColumn={scrollToColumn}
          />
        ) : null}
      </section>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Task Form</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Create Task</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Title</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Priority</span>
                <select
                  value={draft.priority}
                  onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as KanbanPriority }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Assignee ID</span>
                <input
                  type="text"
                  value={draft.assigneeId}
                  onChange={(event) => setDraft((current) => ({ ...current, assigneeId: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sprint</span>
                <select
                  value={draft.sprintId}
                  onChange={(event) => setDraft((current) => ({ ...current, sprintId: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="">No sprint</option>
                  {sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                The backend creates new tasks in the first workflow lane for the project board.
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void submitCreateTask()}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTask ? <div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm" onClick={() => setSelectedTask(null)} /> : null}
      <TaskDetailsDrawer task={selectedTask} sprints={sprints} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

interface BoardMiniMapProps {
  columns: KanbanColumnType[];
  visibleColumnIds: Set<string>;
  viewport: {
    scrollLeft: number;
    clientWidth: number;
    scrollWidth: number;
  };
  onSelectColumn: (columnIndex: number) => void;
}

function BoardMiniMap({ columns, visibleColumnIds, viewport, onSelectColumn }: BoardMiniMapProps) {
  const viewportLeft = viewport.scrollWidth > 0 ? (viewport.scrollLeft / viewport.scrollWidth) * 100 : 0;
  const viewportWidth = viewport.scrollWidth > 0 ? (viewport.clientWidth / viewport.scrollWidth) * 100 : 100;

  return (
    <div className="pointer-events-auto absolute bottom-6 right-6 z-20 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
      <div className="relative grid h-14 w-56 gap-1 overflow-hidden rounded-xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        <div
          className="pointer-events-none absolute inset-y-1 rounded-lg border-2 border-blue-500 transition-all"
          style={{
            left: `calc(${viewportLeft}% + 4px)`,
            width: `max(1.75rem, calc(${viewportWidth}% - 8px))`,
          }}
        />
        {columns.map((column, index) => {
          const isVisible = visibleColumnIds.has(column.id);

          return (
            <button
              key={column.id}
              type="button"
              title={column.name}
              onClick={() => onSelectColumn(index)}
              className={`h-full min-w-0 rounded-md border transition ${
                isVisible
                  ? 'border-blue-300 bg-blue-100'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="sr-only">{column.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
