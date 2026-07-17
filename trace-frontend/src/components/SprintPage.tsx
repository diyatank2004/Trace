import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock3, Edit2, Eye, FolderKanban, Loader2, Play, Plus } from 'lucide-react';
import { type WorkspaceView } from '../lib/projectData';
import {
  createSprint,
  fetchProjectSprints,
  fetchProjectTasks,
  formatSprintStatusLabel,
  sprintDaysRemaining,
  sprintDisplayDate,
  sprintDisplayDateTime,
  sprintStatusToBackend,
  updateSprint,
  type SprintRecord,
} from '../lib/sprintApi';

type SprintStatus = 'Planned' | 'Active' | 'Completed';

type SprintDraft = {
  name: string;
  goal: string;
  description: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
};

type SprintItem = SprintRecord & {
  statusLabel: SprintStatus;
  taskCount: number;
};

interface SprintPageProps {
  projectId: string | null;
  projectName: string;
  projectKey: string;
  projectSlug: string;
  onNavigate: (view: WorkspaceView) => void;
}

const emptyDraft: SprintDraft = {
  name: '',
  goal: '',
  description: '',
  startDate: '',
  endDate: '',
  status: 'Planned',
};

const mapSprintItem = (sprint: SprintRecord, taskCount: number): SprintItem => ({
  ...sprint,
  statusLabel: formatSprintStatusLabel(sprint.status),
  taskCount,
});

const getBadgeClass = (status: SprintStatus) => {
  if (status === 'Active') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'Completed') {
    return 'bg-slate-200 text-slate-700';
  }

  return 'bg-amber-100 text-amber-700';
};

const getActionButtonClass = (tone: 'primary' | 'success' | 'danger' | 'ghost') => {
  if (tone === 'primary') {
    return 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20';
  }

  if (tone === 'success') {
    return 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20';
  }

  if (tone === 'danger') {
    return 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20';
  }

  return 'bg-slate-100 text-slate-700 hover:bg-slate-200';
};

export default function SprintPage({ projectId, projectName, projectKey, projectSlug, onNavigate }: SprintPageProps) {
  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SprintDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? sprints[0] ?? null,
    [sprints, selectedSprintId]
  );

  const metrics = useMemo(
    () => ({
      total: sprints.length,
      planned: sprints.filter((sprint) => sprint.statusLabel === 'Planned').length,
      active: sprints.filter((sprint) => sprint.statusLabel === 'Active').length,
      completed: sprints.filter((sprint) => sprint.statusLabel === 'Completed').length,
    }),
    [sprints]
  );

  const loadProjectSprints = async (preferredSprintId?: string) => {
    if (!projectId) {
      setSprints([]);
      setSelectedSprintId(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [sprintRecords, taskRecords] = await Promise.all([
        fetchProjectSprints(projectId),
        fetchProjectTasks(projectId),
      ]);

      const taskCounts = taskRecords.reduce<Record<string, number>>((counts, task) => {
        const sprintId = task.Sprint_id ?? task.sprint_id;

        if (!sprintId) {
          return counts;
        }

        counts[sprintId] = (counts[sprintId] ?? 0) + 1;
        return counts;
      }, {});

      const nextSprints = sprintRecords.map((sprint) => mapSprintItem(sprint, taskCounts[sprint.id] ?? 0));
      setSprints(nextSprints);

      const nextSelectedSprintId =
        preferredSprintId && nextSprints.some((sprint) => sprint.id === preferredSprintId)
          ? preferredSprintId
          : nextSprints[0]?.id ?? null;

      setSelectedSprintId(nextSelectedSprintId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load sprint records.');
      setSprints([]);
      setSelectedSprintId(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProjectSprints();
  }, [projectId]);

  useEffect(() => {
    if (selectedSprintId || sprints.length === 0) {
      return;
    }

    setSelectedSprintId(sprints[0].id);
  }, [selectedSprintId, sprints]);

  const openCreateForm = () => {
    setEditorMode('create');
    setEditingSprintId(null);
    setDraft(emptyDraft);
    setFormError(null);
    setActionError(null);
    setStatusNote(null);
    setEditorOpen(true);
  };

  const openEditForm = (sprint: SprintItem) => {
    if (sprint.statusLabel === 'Completed') {
      return;
    }

    setEditorMode('edit');
    setEditingSprintId(sprint.id);
    setDraft({
      name: sprint.name,
      goal: sprint.goal,
      description: '',
      startDate: sprint.startDate ? sprint.startDate.slice(0, 10) : '',
      endDate: sprint.endDate ? sprint.endDate.slice(0, 10) : '',
      status: sprint.statusLabel,
    });
    setFormError(null);
    setActionError(null);
    setStatusNote(null);
    setEditorOpen(true);
  };

  const submitForm = async () => {
    if (!projectId) {
      setFormError('Select a project before creating or editing sprints.');
      return;
    }

    if (!draft.name.trim() || !draft.startDate || !draft.endDate) {
      setFormError('Sprint name, start date, and end date are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setActionError(null);
    setStatusNote(null);

    try {
      if (editorMode === 'create') {
        const createdSprint = await createSprint({
          Project_id: projectId,
          Name: draft.name.trim(),
          Goal: draft.goal.trim(),
          Start_date: new Date(`${draft.startDate}T00:00:00`).toISOString(),
          End_date: new Date(`${draft.endDate}T00:00:00`).toISOString(),
        });

        setStatusNote(`Created sprint ${createdSprint.name}.`);
        setEditorOpen(false);
        await loadProjectSprints(createdSprint.id);
        return;
      }

      if (!editingSprintId) {
        setFormError('Unable to identify the sprint record to update.');
        return;
      }

      const updatedSprint = await updateSprint(editingSprintId, {
        Name: draft.name.trim(),
        Goal: draft.goal.trim(),
        Start_date: new Date(`${draft.startDate}T00:00:00`).toISOString(),
        End_date: new Date(`${draft.endDate}T00:00:00`).toISOString(),
        Status: sprintStatusToBackend(draft.status),
      });

      setStatusNote(`Updated sprint ${updatedSprint.name}.`);
      setEditorOpen(false);
      await loadProjectSprints(updatedSprint.id);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save sprint changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSprintState = async (sprint: SprintItem, nextStatus: SprintStatus) => {
    setIsSubmitting(true);
    setFormError(null);
    setActionError(null);
    setStatusNote(null);

    try {
      await updateSprint(sprint.id, {
        Status: sprintStatusToBackend(nextStatus),
      });

      setStatusNote(
        nextStatus === 'Active'
          ? `Sprint ${sprint.name} is now active.`
          : `Sprint ${sprint.name} is now completed.`
      );

      await loadProjectSprints(sprint.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update sprint status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBreakdown = [
    { label: 'Planned', value: metrics.planned },
    { label: 'Active', value: metrics.active },
    { label: 'Completed', value: metrics.completed },
  ];

  const editorTitle = editorMode === 'create' ? 'Create Sprint' : 'Edit Sprint';
  const submitLabel = isSubmitting ? 'Saving...' : editorMode === 'create' ? 'Create Sprint' : 'Save Changes';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Sprint Management
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            {projectName}
            <span className="ml-3 text-sm font-medium text-slate-400">{projectKey}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage sprint records for this project, then jump to backlog or kanban when you need the adjacent workflow.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('backlog')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Clock3 className="h-4 w-4" />
            Open Backlog
          </button>
          <button
            type="button"
            onClick={() => onNavigate('kanban')}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <FolderKanban className="h-4 w-4" />
            Open Kanban Board
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Create Sprint
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Total Sprints</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.total}</p>
        </div>
        {statusBreakdown.map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">{item.value}</p>
          </div>
        ))}
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Sprint List</h2>
              <p className="text-sm text-slate-500">Real sprint records returned by the backend.</p>
            </div>
            <div className="text-xs font-medium text-slate-400">Project slug: /{projectSlug}</div>
          </div>

          <div className="mt-5 space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sprint records...
              </div>
            ) : sprints.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No sprint records were returned for this project. Create the first sprint to begin planning.
              </div>
            ) : (
              sprints.map((sprint) => {
                const daysRemaining = sprintDaysRemaining(sprint.endDate);
                const endDateLabel = sprintDisplayDate(sprint.endDate);
                const startDateLabel = sprintDisplayDate(sprint.startDate);
                const isSelected = selectedSprint?.id === sprint.id;
                const canStart = sprint.statusLabel === 'Planned';
                const canComplete = sprint.statusLabel === 'Active';
                const canEdit = sprint.statusLabel !== 'Completed';

                return (
                  <article
                    key={sprint.id}
                    className={`rounded-3xl border p-5 shadow-sm transition ${isSelected ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="truncate text-base font-semibold text-slate-950">{sprint.name}</h3>
                          {sprint.statusLabel === 'Active' ? (
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
                          ) : null}
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClass(sprint.statusLabel)}`}>
                            {sprint.statusLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {sprint.goal || 'No sprint goal returned by the backend.'}
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-500 sm:grid-cols-2">
                          <p><span className="font-semibold text-slate-700">Start:</span> {startDateLabel ?? 'Not available'}</p>
                          <p><span className="font-semibold text-slate-700">End:</span> {endDateLabel ?? 'Not available'}</p>
                          <p><span className="font-semibold text-slate-700">Task Count:</span> {sprint.taskCount}</p>
                          <p><span className="font-semibold text-slate-700">Days Remaining:</span> {daysRemaining === null ? 'Not available' : daysRemaining < 0 ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'}` : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`}</p>
                          <p><span className="font-semibold text-slate-700">Created At:</span> {sprintDisplayDateTime(sprint.createdAt) ?? 'Not available'}</p>
                          <p><span className="font-semibold text-slate-700">Updated At:</span> {sprintDisplayDateTime(sprint.updatedAt) ?? 'Not available'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSprintId(sprint.id)}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${getActionButtonClass('ghost')}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          title={canEdit ? 'Edit sprint' : 'Completed sprints cannot be edited.'}
                          onClick={() => openEditForm(sprint)}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${getActionButtonClass('primary')}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        {canStart ? (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void updateSprintState(sprint, 'Active')}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${getActionButtonClass('success')}`}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start Sprint
                          </button>
                        ) : null}
                        {canComplete ? (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void updateSprintState(sprint, 'Completed')}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${getActionButtonClass('success')}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Complete Sprint
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Sprint Details</h2>
                <p className="text-sm text-slate-500">Selected sprint metadata from the backend.</p>
              </div>
              <Calendar className="h-5 w-5 text-sky-500" />
            </div>

            {selectedSprint ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sprint Name</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">{selectedSprint.name}</h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailRow label="Goal" value={selectedSprint.goal || 'No goal returned by backend.'} />
                  <DetailRow label="Description" value="Not returned by the current sprint endpoints." />
                  <DetailRow label="Status" value={selectedSprint.statusLabel} />
                  <DetailRow label="Start Date" value={sprintDisplayDate(selectedSprint.startDate) ?? 'Not available'} />
                  <DetailRow label="End Date" value={sprintDisplayDate(selectedSprint.endDate) ?? 'Not available'} />
                  <DetailRow label="Task Count" value={String(selectedSprint.taskCount)} />
                  <DetailRow label="Created At" value={sprintDisplayDateTime(selectedSprint.createdAt) ?? 'Not available'} />
                  <DetailRow label="Updated At" value={sprintDisplayDateTime(selectedSprint.updatedAt) ?? 'Not available'} />
                </div>

                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Completed tasks and remaining tasks are not available from the current sprint API response. If the backend adds those fields later, this panel can surface them directly without changing the page layout.
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No sprint selected. Choose a sprint from the list to view its details.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Backend Limitations</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              The current backend sprint model does not expose description, created by, archive, or delete endpoints. The page therefore renders only the real fields returned by the existing API and omits unsupported actions instead of fabricating values.
            </p>
          </div>
        </section>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sprint Form</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">{editorTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {formError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formError}
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sprint Name</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Goal</span>
                <input
                  type="text"
                  value={draft.goal}
                  onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-28 w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
                  placeholder="The backend does not persist sprint descriptions yet."
                />
                <p className="text-xs text-slate-500">
                  This field is shown to match the requested layout, but the current sprint API does not store or return it.
                </p>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Start Date</span>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">End Date</span>
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              {editorMode === 'edit' ? (
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Status</span>
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as SprintStatus }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="Planned">Planned</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </select>
                </label>
              ) : (
                <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  The backend create endpoint defaults new sprints to Planned/Future status.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void submitForm()}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-900">{value}</p>
    </div>
  );
}
