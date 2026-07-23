import type { KanbanBoardData, KanbanColumn, KanbanPriority, KanbanTask } from '../types';
import { apiUrl } from './api';

type BackendTask = {
  id?: string;
  project_id?: string;
  column_id?: string;
  Sprint_id?: string | null;
  sprint_id?: string | null;
  Parent_id?: string | null;
  parent_id?: string | null;
  ticket_key?: string;
  Title?: string;
  title?: string;
  Description?: string | null;
  description?: string | null;
  Priority?: KanbanPriority;
  priority?: KanbanPriority;
  Assignee_id?: string | null;
  assignee_id?: string | null;
  Created_at?: string;
  created_at?: string;
};

type BackendColumn = {
  Id?: string;
  id?: string;
  Name?: string;
  name?: string;
  Position?: number;
  position?: number;
  Wip_limit?: number | null;
  wip_limit?: number | null;
  Tasks?: BackendTask[];
  tasks?: BackendTask[];
};

type BackendBoard = {
  Id?: string;
  id?: string;
  Project_id?: string;
  project_id?: string;
  Name?: string;
  name?: string;
  Columns?: BackendColumn[];
  columns?: BackendColumn[];
};

export interface CreateKanbanTaskPayload {
  project_id: string;
  title: string;
  description?: string | null;
  priority: KanbanPriority;
  Sprint_id?: string | null;
  Assignee_id?: string | null;
}

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = 'Request failed.';

    try {
      const payload = await response.json();
      if (Array.isArray(payload?.detail)) {
        message = payload.detail
          .map((item: { msg?: string; loc?: Array<string | number> }) => {
            const location = item.loc?.length ? `${item.loc.join('.')}: ` : '';
            return `${location}${item.msg ?? 'Invalid request.'}`;
          })
          .join(' ');
      } else {
        message = payload?.detail ?? payload?.message ?? message;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
};

const normalizeTask = (task: BackendTask): KanbanTask => ({
  id: task.id ?? '',
  projectId: task.project_id ?? '',
  columnId: task.column_id ?? '',
  sprintId: task.Sprint_id ?? task.sprint_id ?? null,
  parentId: task.Parent_id ?? task.parent_id ?? null,
  ticketKey: task.ticket_key ?? '',
  title: task.Title ?? task.title ?? '',
  description: task.Description ?? task.description ?? null,
  priority: task.Priority ?? task.priority ?? 'Medium',
  assigneeId: task.Assignee_id ?? task.assignee_id ?? null,
  createdAt: task.Created_at ?? task.created_at ?? '',
});

const normalizeColumn = (column: BackendColumn): KanbanColumn => {
  const id = column.Id ?? column.id ?? '';

  return {
    id,
    name: column.Name ?? column.name ?? '',
    position: column.Position ?? column.position ?? 0,
    wipLimit: column.Wip_limit ?? column.wip_limit ?? null,
    tasks: (column.Tasks ?? column.tasks ?? [])
      .map(normalizeTask)
      .filter((task) => task.id.length > 0)
      .map((task) => ({ ...task, columnId: task.columnId || id })),
  };
};

const normalizeBoard = (board: BackendBoard): KanbanBoardData => ({
  id: board.Id ?? board.id ?? '',
  projectId: board.Project_id ?? board.project_id ?? '',
  name: board.Name ?? board.name ?? '',
  columns: (board.Columns ?? board.columns ?? [])
    .map(normalizeColumn)
    .filter((column) => column.id.length > 0)
    .sort((first, second) => first.position - second.position),
});

export const fetchKanbanBoard = async (projectId: string, signal?: AbortSignal): Promise<KanbanBoardData> => {
  const response = await fetch(apiUrl(`/projects/${projectId}/board`), { signal });
  const board = await parseJson<BackendBoard>(response);
  return normalizeBoard(board);
};

export const createKanbanTask = async (
  payload: CreateKanbanTaskPayload,
  signal?: AbortSignal
): Promise<KanbanTask> => {
  const response = await fetch(apiUrl('/projects/tasks/create'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  return normalizeTask(await parseJson<BackendTask>(response));
};

export const moveKanbanTask = async (
  taskId: string,
  columnId: string,
  signal?: AbortSignal
): Promise<KanbanTask> => {
  const response = await fetch(apiUrl(`/projects/tasks/${taskId}/move-lane/${columnId}`), {
    method: 'PATCH',
    signal,
  });

  return normalizeTask(await parseJson<BackendTask>(response));
};
