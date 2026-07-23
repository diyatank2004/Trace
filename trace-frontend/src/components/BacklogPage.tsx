import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { apiUrl } from '../lib/api';

type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

type SprintSummary = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: 'Planned' | 'Active' | 'Completed';
  taskCount: number;
};

type BacklogTask = {
  id: string;
  ticketKey: string;
  title: string;
  description: string | null;
  priority: Priority;
  assigneeId: string | null;
  sprintId: string | null;
  createdAt: string;
  projectId: string;
};

type ProjectMember = {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  role: string;
  designation: string;
};

type EmployeeOption = {
  id: string;
  employeeId: string;
  label: string;
  email: string;
};

interface BacklogPageProps {
  projectId: string | null;
  projectName: string;
  projectKey: string;
}

const priorityOptions: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];

const defaultTaskForm = {
  title: '',
  priority: 'Medium' as Priority,
  assigneeId: '',
  sprintId: '',
};

const parseTaskError = async (response: Response) => {
  try {
    const payload = await response.json();
    return typeof payload?.detail === 'string' ? payload.detail : payload?.message || 'Request failed.';
  } catch {
    return response.statusText || 'Request failed.';
  }
};

const formatDateRange = (startDate: string | null, endDate: string | null) => {
  const startLabel = startDate ? new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No start';
  const endLabel = endDate ? new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No end';
  return `${startLabel} - ${endLabel}`;
};

const formatSprintWindow = (startDate: string | null, endDate: string | null) => {
  const start = startDate ? new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No start';
  const end = endDate ? new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No end';
  return `${start} - ${end}`;
};

export default function BacklogPage({ projectId, projectName, projectKey }: BacklogPageProps) {
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [sprints, setSprints] = useState<SprintSummary[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedSprints, setExpandedSprints] = useState<Record<string, boolean>>({});
  const [taskForm, setTaskForm] = useState(defaultTaskForm);

  const token = typeof window !== 'undefined' ? localStorage.getItem('trace_session_token') : null;

  // ============ LOAD PROJECT MEMBERS ============
  const loadProjectMembers = async (signal?: AbortSignal) => {
    if (!projectId) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }

    setMembersLoading(true);
    try {
      const response = await fetch(apiUrl(`/projects/${projectId}/members`), {
        signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(await parseTaskError(response));
      }

      const payload = await response.json();
      const normalizedMembers = Array.isArray(payload)
        ? payload.map((member: any) => ({
            id: String(member.id ?? ''),
            employee_id: String(member.employee_id ?? ''),
            full_name: String(member.full_name ?? 'Unknown'),
            email: String(member.email ?? ''),
            role: String(member.role ?? ''),
            designation: String(member.designation ?? ''),
          }))
        : [];

      setMembers(normalizedMembers);
    } catch (error) {
      console.error('Failed to load project members:', error);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  // ============ LOAD BACKLOG DATA ============
  const loadBacklogData = async (signal?: AbortSignal) => {
    if (!projectId) {
      setTasks([]);
      setSprints([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const [tasksResponse, sprintsResponse] = await Promise.all([
        fetch(apiUrl(`/projects/${projectId}/tasks`), {
          signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
        fetch(apiUrl(`/projects/${projectId}/sprints`), {
          signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
      ]);

      const [taskPayload, sprintPayload] = await Promise.all([
        tasksResponse.json().catch(() => null),
        sprintsResponse.json().catch(() => null),
      ]);

      if (!tasksResponse.ok) {
        throw new Error(await parseTaskError(tasksResponse));
      }

      if (!sprintsResponse.ok) {
        throw new Error(typeof sprintPayload?.detail === 'string' ? sprintPayload.detail : 'Unable to load sprint data.');
      }

      // Normalize tasks
      const normalizedTasks = Array.isArray(taskPayload)
        ? taskPayload.map((task: any) => ({
            id: String(task.id ?? ''),
            ticketKey: String(task.ticket_key ?? task.ticketKey ?? ''),
            title: String(task.Title ?? task.title ?? ''),
            description: task.Description ?? task.description ?? null,
            priority: (task.Priority ?? task.priority ?? 'Medium') as Priority,
            assigneeId: task.Assignee_id ?? task.assignee_id ?? null,
            sprintId: task.Sprint_id ?? task.sprint_id ?? null,
            createdAt: String(task.Created_at ?? task.created_at ?? ''),
            projectId: String(task.project_id ?? task.Project_id ?? projectId),
          }))
        : [];

      // Normalize sprints
      const sprintSource = Array.isArray(sprintPayload)
        ? sprintPayload
        : Array.isArray(sprintPayload?.sprints)
          ? sprintPayload.sprints
          : [];

      const normalizedSprints = sprintSource.map((sprint: any) => {
        // Count tasks for this sprint
        const sprintTaskCount = normalizedTasks.filter(
          (t) => t.sprintId === (sprint.id ?? sprint.Id)
        ).length;

        return {
          id: String(sprint.id ?? sprint.Id ?? ''),
          name: String(sprint.name ?? sprint.Name ?? ''),
          startDate: sprint.start_date ?? sprint.Start_date ?? null,
          endDate: sprint.end_date ?? sprint.End_date ?? null,
          status: (sprint.status ?? sprint.Status ?? 'Planned') as SprintSummary['status'],
          taskCount: sprintTaskCount,
        };
      });

      setTasks(normalizedTasks);
      setSprints(normalizedSprints);
      setExpandedSprints((current) => {
        const nextState: Record<string, boolean> = { ...current };
        normalizedSprints.forEach((sprint: SprintSummary) => {
          if (nextState[sprint.id] === undefined) {
            nextState[sprint.id] = sprint.status !== 'Completed';
          }
        });
        return nextState;
      });
    } catch (error) {
      setTasks([]);
      setSprints([]);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load backlog data.');
    } finally {
      setLoading(false);
    }
  };

  // ============ LOAD DATA ON MOUNT AND WHEN PROJECT CHANGES ============
  useEffect(() => {
    const controller = new AbortController();
    void loadBacklogData(controller.signal);
    void loadProjectMembers(controller.signal);

    return () => controller.abort();
  }, [projectId]);

  const sprintOptions = useMemo(
    () => sprints.map((sprint) => ({ id: sprint.id, label: `${sprint.name} · ${formatDateRange(sprint.startDate, sprint.endDate)}` })),
    [sprints]
  );

  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    return members.map((member) => ({
      id: member.id,
      employeeId: member.employee_id,
      label: `${member.full_name} (${member.employee_id})`,
      email: member.email,
    }));
  }, [members]);

  const backlogTasks = useMemo(
    () => tasks.filter((task) => task.sprintId === null),
    [tasks]
  );

  const groupedSprintTasks = useMemo(() => {
    const map = new Map<string, BacklogTask[]>();
    tasks.forEach((task) => {
      if (!task.sprintId) return;
      const bucket = map.get(task.sprintId) ?? [];
      bucket.push(task);
      map.set(task.sprintId, bucket);
    });
    return map;
  }, [tasks]);

  const getMemberName = (employeeId: string | null): string => {
    if (!employeeId) return 'Unassigned';
    const member = members.find((m) => m.employee_id === employeeId);
    return member ? `${member.full_name} (${member.employee_id})` : `ID: ${employeeId}`;
  };

  const handleAddTask = async () => {
    if (!projectId) {
      setErrorMessage('Select a project before adding tasks.');
      return;
    }

    if (!taskForm.title.trim()) {
      setErrorMessage('Enter a task title first.');
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(apiUrl('/projects/tasks/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          project_id: projectId,
          title: taskForm.title.trim(),
          priority: taskForm.priority,
          assignee_id: taskForm.assigneeId.trim() || null,
          sprint_id: taskForm.sprintId.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Unable to add task to backlog.');
      }

      const createdTask: BacklogTask = {
        id: String(payload.id ?? payload.Id ?? crypto.randomUUID()),
        ticketKey: String(payload.ticket_key ?? payload.ticketKey ?? 'NEW'),
        title: String(payload.Title ?? payload.title ?? taskForm.title.trim()),
        description: payload.Description ?? payload.description ?? null,
        priority: (payload.Priority ?? payload.priority ?? taskForm.priority) as Priority,
        assigneeId: (payload.Assignee_id ?? payload.assignee_id ?? taskForm.assigneeId.trim()) || null,
        sprintId: (payload.Sprint_id ?? payload.sprint_id ?? taskForm.sprintId.trim()) || null,
        createdAt: String(payload.Created_at ?? payload.created_at ?? new Date().toISOString()),
        projectId: String(payload.project_id ?? projectId),
      };

      setTasks((current) => [createdTask, ...current]);
      setTaskForm(defaultTaskForm);
      setStatusMessage(`Task "${payload.ticket_key}" created and synced to backlog.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add task to backlog.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string, taskKey: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(apiUrl(`/projects/tasks/${taskId}`), {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(await parseTaskError(response));
      }

      setTasks((current) => current.filter((task) => task.id !== taskId));
      setStatusMessage(`Task "${taskKey}" has been removed from backlog.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete task.');
    }
  };

  const handleMoveTask = (taskId: string, sprintId: string) => {
    const normalizedSprintId = sprintId.trim() || null;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, sprintId: normalizedSprintId } : task)));
    
    const sprintName = normalizedSprintId 
      ? sprints.find((s) => s.id === normalizedSprintId)?.name || 'sprint'
      : 'general backlog';
    setStatusMessage(`Task moved to ${sprintName}.`);
  };

  const getPriorityClass = (value: Priority) => {
    if (value === 'Urgent') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (value === 'High') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (value === 'Medium') return 'border-sky-200 bg-sky-50 text-sky-700';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  };

  const selectedSprintCount = (sprintId: string) => groupedSprintTasks.get(sprintId)?.length ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Header Zone</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Project Backlog Cockpit</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Track live backlog items, split sprint containers from the general queue, and keep the project feed in sync with the backend in real-time.
        </p>
      </section>

      <section className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="grid flex-1 gap-3 md:grid-cols-[1.6fr_0.8fr_0.9fr_1.1fr_auto]">
            <input
              value={taskForm.title}
              onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Task Title"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
            />

            <select
              value={taskForm.priority}
              onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value as Priority }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
            >
              {priorityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              value={taskForm.assigneeId}
              onChange={(event) => setTaskForm((current) => ({ ...current, assigneeId: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
              disabled={membersLoading}
            >
              <option value="">
                {membersLoading ? 'Loading members...' : 'Assign to team member'}
              </option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.employeeId}>
                  {emp.label}
                </option>
              ))}
            </select>

            <select
              value={taskForm.sprintId}
              onChange={(event) => setTaskForm((current) => ({ ...current, sprintId: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
            >
              <option value="">No sprint target</option>
              {sprintOptions.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleAddTask()}
              disabled={submitting || membersLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,0.96),rgba(59,130,246,0.96))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add to Backlog
            </button>
          </div>
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Zone 1</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Sprints Stack</h2>
            <p className="mt-1 text-sm text-slate-500">Collapsible sprint cards. Completed sprint blocks are visually demarcated.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            {projectName} · {projectKey}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tasks and sprint summary...
            </div>
          ) : sprints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No sprint summary data returned for this project.
            </div>
          ) : (
            sprints.map((sprint) => {
              const taskCount = selectedSprintCount(sprint.id);
              const isOpen = expandedSprints[sprint.id] ?? sprint.status !== 'Completed';
              const tasksForSprint = groupedSprintTasks.get(sprint.id) ?? [];

              return (
                <article key={sprint.id} className={`overflow-hidden rounded-3xl border ${sprint.status === 'Completed' ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedSprints((current) => ({ ...current, [sprint.id]: !isOpen }))}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-semibold text-slate-950">{sprint.name}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sprint.status === 'Completed' ? 'bg-slate-200 text-slate-700' : sprint.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {sprint.status}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                          {taskCount} tasks
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{formatSprintWindow(sprint.startDate, sprint.endDate)}</p>
                    </div>

                    <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen ? (
                    <div className="border-t border-slate-200 px-5 py-4">
                      {tasksForSprint.length === 0 ? (
                        <p className="text-sm text-slate-500">No tasks are assigned to this sprint yet.</p>
                      ) : (
                        <div className="grid gap-3 lg:grid-cols-2">
                          {tasksForSprint.map((task) => (
                            <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{task.ticketKey}</p>
                                  <h4 className="mt-1 text-sm font-semibold text-slate-950">{task.title}</h4>
                                  <p className="mt-2 text-sm text-slate-500">{task.description || 'No description provided.'}</p>
                                  <p className="mt-2 text-xs text-slate-600">
                                    <span className="font-semibold">Assigned to:</span> {getMemberName(task.assigneeId)}
                                  </p>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityClass(task.priority)}`}>
                                  {task.priority}
                                </span>
                              </div>
                              <div className="mt-4 flex items-center justify-between gap-3">
                                <select
                                  value={task.sprintId ?? ''}
                                  onChange={(event) => handleMoveTask(task.id, event.target.value)}
                                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-400"
                                >
                                  <option value="">General backlog</option>
                                  {sprintOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => void handleDeleteTask(task.id, task.ticketKey)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Zone 2</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">General Backlog Pool</h2>
            <p className="mt-1 text-sm text-slate-500">All tasks without a sprint assignment.</p>
          </div>
          <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            {backlogTasks.length} items
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {backlogTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No tasks are currently sitting in the general backlog pool.
            </div>
          ) : (
            backlogTasks.map((task) => (
              <article key={task.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{task.ticketKey}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{task.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{task.description || 'No description provided.'}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold">Assigned to:</span> {getMemberName(task.assigneeId)}
                    </p>
                  </div>

                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityClass(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <select
                    value=""
                    onChange={(event) => handleMoveTask(task.id, event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-400"
                  >
                    <option value="">Move to sprint...</option>
                    {sprintOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => void handleDeleteTask(task.id, task.ticketKey)}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}