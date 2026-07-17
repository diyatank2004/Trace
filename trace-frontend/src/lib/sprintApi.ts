const API_BASE = 'http://localhost:8000/projects';

export type BackendSprintStatus = 'Future' | 'Active' | 'Completed';

export interface BackendSprintRecord {
  Id?: string;
  id?: string;
  Project_id?: string;
  project_id?: string;
  Name?: string;
  name?: string;
  Goal?: string | null;
  goal?: string | null;
  Start_date?: string | null;
  start_date?: string | null;
  End_date?: string | null;
  end_date?: string | null;
  Status?: BackendSprintStatus;
  status?: BackendSprintStatus;
  Created_at?: string | null;
  created_at?: string | null;
  Updated_at?: string | null;
  updated_at?: string | null;
}

export interface BackendTaskRecord {
  Sprint_id?: string | null;
  sprint_id?: string | null;
}

export interface SprintRecord {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  startDate: string | null;
  endDate: string | null;
  status: BackendSprintStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SprintCreatePayload {
  Project_id: string;
  Name: string;
  Goal?: string;
  Start_date?: string | null;
  End_date?: string | null;
}

export interface SprintUpdatePayload {
  Name?: string;
  Goal?: string;
  Start_date?: string | null;
  End_date?: string | null;
  Status?: BackendSprintStatus;
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

const normalizeSprint = (sprint: BackendSprintRecord): SprintRecord => ({
  id: sprint.Id ?? sprint.id ?? '',
  projectId: sprint.Project_id ?? sprint.project_id ?? '',
  name: sprint.Name ?? sprint.name ?? '',
  goal: sprint.Goal ?? sprint.goal ?? '',
  startDate: sprint.Start_date ?? sprint.start_date ?? null,
  endDate: sprint.End_date ?? sprint.end_date ?? null,
  status: sprint.Status ?? sprint.status ?? 'Future',
  createdAt: sprint.Created_at ?? sprint.created_at ?? null,
  updatedAt: sprint.Updated_at ?? sprint.updated_at ?? null,
});

export const formatSprintStatusLabel = (status: BackendSprintStatus): 'Planned' | 'Active' | 'Completed' => {
  if (status === 'Future') {
    return 'Planned';
  }

  return status;
};

export const sprintStatusToBackend = (status: 'Planned' | 'Active' | 'Completed'): BackendSprintStatus => {
  if (status === 'Planned') {
    return 'Future';
  }

  return status;
};

export const sprintDisplayDate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

export const sprintDaysRemaining = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diff = targetDay.getTime() - startOfDay.getTime();

  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export const fetchProjectSprints = async (projectId: string, signal?: AbortSignal): Promise<SprintRecord[]> => {
  const response = await fetch(`${API_BASE}/${projectId}/sprints`, { signal });
  const payload = await parseJson<BackendSprintRecord[]>(response);
  return payload.map(normalizeSprint).filter((sprint) => sprint.id.length > 0);
};

export const fetchProjectTasks = async (projectId: string, signal?: AbortSignal): Promise<BackendTaskRecord[]> => {
  const response = await fetch(`${API_BASE}/${projectId}/tasks`, { signal });
  return parseJson<BackendTaskRecord[]>(response);
};

export const createSprint = async (
  payload: SprintCreatePayload,
  signal?: AbortSignal
): Promise<SprintRecord> => {
  const response = await fetch(`${API_BASE}/sprints/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  const sprint = await parseJson<BackendSprintRecord>(response);
  return normalizeSprint(sprint);
};

export const updateSprint = async (
  sprintId: string,
  payload: SprintUpdatePayload,
  signal?: AbortSignal
): Promise<SprintRecord> => {
  const response = await fetch(`${API_BASE}/sprints/${sprintId}/update`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  const sprint = await parseJson<BackendSprintRecord>(response);
  return normalizeSprint(sprint);
};

export const sprintDisplayDateTime = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
