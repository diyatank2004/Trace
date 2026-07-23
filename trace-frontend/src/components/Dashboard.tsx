import KanbanPage from './KanbanPage';
import BacklogPage from './BacklogPage';
import SprintPage from './SprintPage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Bell,
  Calendar,
  FolderKanban,
  FolderOpen,
  ChevronDown,
  CheckCircle2,
  LogOut,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Users,
  UserPlus,
  FolderPlus,
} from 'lucide-react';
import ProfilePage from './ProfilePage';
import { apiUrl } from '../lib/api';
import {
  buildWorkspacePath,
  getDefaultProjectSlug,
  NAV_ITEMS,
  parseWorkspacePath,
  type ProjectData,
  type WorkspaceView,
} from '../lib/projectData';


interface DashboardProps {
  workspace: {
    workspaceName: string;
    workspaceKey: string;
    employeeId: string;
  };
  token?: string;
  onLogout: () => void;
}

interface EmployeeProjectSummary {
  project_id: string;
  project_name: string;
  project_key: string;
  slug: string;
  user_role_in_project: string;
  user_designation: string;
}

interface DashboardTask {
  id: string;
  projectId: string;
  columnId: string;
  sprintId: string | null;
  ticketKey: string;
  title: string;
  description: string;
  priority: string;
  assigneeId: string | null;
  createdAt: string;
  columnName: string;
  columnPosition: number;
}

interface DashboardMember {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  role: string;
  designation: string;
}

interface DashboardSprint {
  id: string;
  name: string;
  goal: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string | null;
}

interface DashboardColumn {
  id: string;
  name: string;
  position: number;
  taskCount: number;
}

interface ProjectRealtimeSnapshot {
  projectId: string;
  tasks: DashboardTask[];
  members: DashboardMember[];
  sprints: DashboardSprint[];
  columns: DashboardColumn[];
  loadedAt: string;
  error?: string;
}

interface SearchResult {
  id: string;
  projectSlug: string;
  projectName: string;
  view: WorkspaceView;
  label: string;
  eyebrow: string;
  detail: string;
}

interface RealtimeNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  projectSlug: string;
  view: WorkspaceView;
  tone: 'info' | 'warning' | 'success';
}

const buildProjectSlug = (projectName: string) =>
  projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const getTaskField = (task: any, alias: string, plain: string, fallback = '') =>
  task?.[alias] ?? task?.[plain] ?? fallback;

const formatRelativeTime = (value: string | null | undefined) => {
  if (!value) return 'Just now';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently';

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return parsed.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'No date';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No date';

  return parsed.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const daysUntil = (value: string | null | undefined) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());

  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

const normalizeProjectSnapshot = (
  projectId: string,
  board: any,
  membersPayload: any,
  sprintsPayload: any
): ProjectRealtimeSnapshot => {
  const columnsPayload = board?.Columns ?? board?.columns ?? [];
  const columns: DashboardColumn[] = columnsPayload
    .map((column: any) => {
      const tasks = column?.Tasks ?? column?.tasks ?? [];
      return {
        id: column?.Id ?? column?.id ?? '',
        name: column?.Name ?? column?.name ?? 'Workflow Lane',
        position: column?.Position ?? column?.position ?? 0,
        taskCount: Array.isArray(tasks) ? tasks.length : 0,
      };
    })
    .filter((column: DashboardColumn) => column.id)
    .sort((first: DashboardColumn, second: DashboardColumn) => first.position - second.position);

  const tasks: DashboardTask[] = columnsPayload.flatMap((column: any) => {
    const columnId = column?.Id ?? column?.id ?? '';
    const columnName = column?.Name ?? column?.name ?? 'Workflow Lane';
    const columnPosition = column?.Position ?? column?.position ?? 0;
    const columnTasks = column?.Tasks ?? column?.tasks ?? [];

    if (!Array.isArray(columnTasks)) return [];

    return columnTasks
      .map((task: any) => ({
        id: task?.id ?? '',
        projectId: task?.project_id ?? projectId,
        columnId: task?.column_id ?? columnId,
        sprintId: task?.Sprint_id ?? task?.sprint_id ?? null,
        ticketKey: task?.ticket_key ?? '',
        title: getTaskField(task, 'Title', 'title'),
        description: getTaskField(task, 'Description', 'description'),
        priority: getTaskField(task, 'Priority', 'priority', 'Medium'),
        assigneeId: task?.Assignee_id ?? task?.assignee_id ?? null,
        createdAt: getTaskField(task, 'Created_at', 'created_at'),
        columnName,
        columnPosition,
      }))
      .filter((task: DashboardTask) => task.id);
  });

  const members: DashboardMember[] = Array.isArray(membersPayload)
    ? membersPayload.map((member: any) => ({
        id: member?.id ?? member?.employee_id ?? '',
        employeeId: member?.employee_id ?? '',
        fullName: member?.full_name ?? 'Unknown Employee',
        email: member?.email ?? 'N/A',
        role: member?.role ?? 'Member',
        designation: member?.designation ?? 'Not Assigned',
      }))
    : [];

  const sprints: DashboardSprint[] = Array.isArray(sprintsPayload)
    ? sprintsPayload.map((sprint: any) => ({
        id: sprint?.Id ?? sprint?.id ?? '',
        name: sprint?.Name ?? sprint?.name ?? 'Sprint',
        goal: sprint?.Goal ?? sprint?.goal ?? '',
        status: sprint?.Status ?? sprint?.status ?? 'Future',
        startDate: sprint?.Start_date ?? sprint?.start_date ?? null,
        endDate: sprint?.End_date ?? sprint?.end_date ?? null,
        updatedAt: sprint?.Updated_at ?? sprint?.updated_at ?? sprint?.Created_at ?? sprint?.created_at ?? null,
      }))
    : [];

  return {
    projectId,
    tasks: tasks.sort((first, second) => {
      const firstTime = new Date(first.createdAt).getTime() || 0;
      const secondTime = new Date(second.createdAt).getTime() || 0;
      return secondTime - firstTime;
    }),
    members,
    sprints,
    columns,
    loadedAt: new Date().toISOString(),
  };
};

const Dashboard: React.FC<DashboardProps> = ({ workspace, token, onLogout }) => {
  const [route, setRoute] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        projectSlug: getDefaultProjectSlug(
          workspace.workspaceName,
          workspace.workspaceKey
        ),
        view: 'dashboard' as WorkspaceView,
      };
    }

    const parsed = parseWorkspacePath(window.location.pathname);
    const safeSlug =
      parsed.projectSlug ||
      getDefaultProjectSlug(workspace.workspaceName, workspace.workspaceKey);

    return { projectSlug: safeSlug, view: parsed.view };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [projectActionsOpen, setProjectActionsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [employeeProjects, setEmployeeProjects] = useState<EmployeeProjectSummary[]>([]);
  const [projectSnapshots, setProjectSnapshots] = useState<Record<string, ProjectRealtimeSnapshot>>({});
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotRefreshKey, setSnapshotRefreshKey] = useState(0);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberStatus, setMemberStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [memberForm, setMemberForm] = useState({
    employeeId: '',
    designation: 'Developer',
  });
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectStatus, setProjectStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [projectForm, setProjectForm] = useState({
    projectName: '',
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const workspaceProject = useMemo(
    () => employeeProjects.find((project) => project.project_id === workspace.workspaceKey) ?? null,
    [employeeProjects, workspace.workspaceKey]
  );

  const routeProject = useMemo(
    () => employeeProjects.find((project) => project.slug === route.projectSlug) ?? null,
    [employeeProjects, route.projectSlug]
  );

  const activeProject = routeProject ?? workspaceProject ?? employeeProjects[0] ?? null;
  const roleString = String(activeProject?.user_role_in_project ?? 'Member').toLowerCase();
  const canManageMembers = roleString.includes('team') && roleString.includes('leader');
  const activeSnapshot = activeProject?.project_id
    ? projectSnapshots[activeProject.project_id] ?? null
    : null;

  const currentProject = useMemo(() => {
    const currentProjectSlug = activeProject?.slug ?? route.projectSlug;
    const fallbackName = activeProject?.project_name ?? workspace.workspaceName;
    const fallbackKey = activeProject?.project_key ?? workspace.workspaceKey;
    const tasks = activeSnapshot?.tasks ?? [];
    const members = activeSnapshot?.members ?? [];
    const completedTasks = tasks.filter((task) => task.columnName.toLowerCase().includes('done')).length;
    const inProgressTasks = tasks.filter((task) => {
      const lane = task.columnName.toLowerCase();
      return lane.includes('progress') || lane.includes('review') || lane.includes('testing') || lane.includes('qa') || lane.includes('uat');
    }).length;
    const backlogTasks = tasks.filter((task) => {
      const lane = task.columnName.toLowerCase();
      return lane.includes('to do') || lane.includes('todo') || !task.sprintId;
    }).length;

    return {
      slug: currentProjectSlug as ProjectData['slug'],
      projectLabel: 'Current Project',
      name: fallbackName,
      key: fallbackKey,
      description: `${fallbackName} workspace live metrics, delivery flow, sprint health, and team activity.`,
      members: members.map((member) => member.fullName),
      stats: {
        totalTasks: tasks.length,
        completedTasks,
        inProgressTasks,
        backlogTasks,
      },
      recentActivity: tasks.slice(0, 5).map((task) => ({
        id: task.id,
        user: task.assigneeId || 'Unassigned',
        action: `${task.ticketKey} is in ${task.columnName}: ${task.title}`,
        timestamp: formatRelativeTime(task.createdAt),
      })),
      accentClass: 'from-blue-500 to-cyan-400',
    };
  }, [activeProject, activeSnapshot, route.projectSlug, workspace.workspaceKey, workspace.workspaceName]);

  const sidebarProjects = useMemo(() => {
    return employeeProjects;
  }, [employeeProjects]);

  const progress = Math.round(
    currentProject.stats.totalTasks > 0
      ? (currentProject.stats.completedTasks / currentProject.stats.totalTasks) *
        100
      : 0
  );

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const results: SearchResult[] = [];

    employeeProjects.forEach((project) => {
      const snapshot = projectSnapshots[project.project_id];
      const projectText = `${project.project_name} ${project.project_key} ${project.slug}`.toLowerCase();

      if (projectText.includes(query)) {
        results.push({
          id: `project-${project.project_id}`,
          projectSlug: project.slug,
          projectName: project.project_name,
          view: 'dashboard',
          label: project.project_name,
          eyebrow: `Project ${project.project_key}`,
          detail: `${project.user_role_in_project} - ${project.user_designation}`,
        });
      }

      snapshot?.tasks.forEach((task) => {
        const taskText = `${task.ticketKey} ${task.title} ${task.description} ${task.priority} ${task.columnName} ${task.assigneeId ?? ''}`.toLowerCase();
        if (!taskText.includes(query)) return;

        results.push({
          id: `task-${task.id}`,
          projectSlug: project.slug,
          projectName: project.project_name,
          view: 'kanban',
          label: `${task.ticketKey} ${task.title}`,
          eyebrow: `Task in ${task.columnName}`,
          detail: `${task.priority} priority${task.assigneeId ? ` - assigned to ${task.assigneeId}` : ''}`,
        });
      });

      snapshot?.members.forEach((member) => {
        const memberText = `${member.fullName} ${member.employeeId} ${member.email} ${member.role} ${member.designation}`.toLowerCase();
        if (!memberText.includes(query)) return;

        results.push({
          id: `member-${project.project_id}-${member.employeeId}`,
          projectSlug: project.slug,
          projectName: project.project_name,
          view: 'dashboard',
          label: member.fullName,
          eyebrow: `${member.role} - ${member.employeeId}`,
          detail: `${member.designation} on ${project.project_name}`,
        });
      });

      snapshot?.sprints.forEach((sprint) => {
        const sprintText = `${sprint.name} ${sprint.goal} ${sprint.status} ${formatDate(sprint.startDate)} ${formatDate(sprint.endDate)}`.toLowerCase();
        if (!sprintText.includes(query)) return;

        results.push({
          id: `sprint-${sprint.id}`,
          projectSlug: project.slug,
          projectName: project.project_name,
          view: 'sprint',
          label: sprint.name,
          eyebrow: `${sprint.status} sprint`,
          detail: sprint.goal || `${formatDate(sprint.startDate)} to ${formatDate(sprint.endDate)}`,
        });
      });

      snapshot?.columns.forEach((column) => {
        const columnText = `${column.name} lane column ${column.taskCount}`.toLowerCase();
        if (!columnText.includes(query)) return;

        results.push({
          id: `column-${column.id}`,
          projectSlug: project.slug,
          projectName: project.project_name,
          view: 'kanban',
          label: column.name,
          eyebrow: 'Kanban lane',
          detail: `${column.taskCount} task${column.taskCount === 1 ? '' : 's'} in ${project.project_name}`,
        });
      });
    });

    return results.slice(0, 12);
  }, [employeeProjects, projectSnapshots, searchQuery]);

  const notifications = useMemo<RealtimeNotification[]>(() => {
    const items: RealtimeNotification[] = [];

    employeeProjects.forEach((project) => {
      const snapshot = projectSnapshots[project.project_id];
      if (!snapshot) return;

      snapshot.tasks
        .filter((task) => task.assigneeId === workspace.employeeId)
        .slice(0, 3)
        .forEach((task) => {
          items.push({
            id: `assigned-${task.id}-${task.columnId}`,
            title: 'Task assigned to you',
            message: `${task.ticketKey} is currently in ${task.columnName}: ${task.title}`,
            time: formatRelativeTime(task.createdAt),
            projectSlug: project.slug,
            view: 'kanban',
            tone: task.priority === 'Urgent' ? 'warning' : 'info',
          });
        });

      snapshot.tasks
        .filter((task) => task.priority === 'Urgent')
        .slice(0, 2)
        .forEach((task) => {
          items.push({
            id: `urgent-${task.id}-${task.columnId}`,
            title: 'Urgent task in project',
            message: `${task.ticketKey} needs attention in ${project.project_name}.`,
            time: formatRelativeTime(task.createdAt),
            projectSlug: project.slug,
            view: 'kanban',
            tone: 'warning',
          });
        });

      snapshot.sprints
        .filter((sprint) => sprint.status === 'Active')
        .forEach((sprint) => {
          const remaining = daysUntil(sprint.endDate);
          items.push({
            id: `active-sprint-${sprint.id}-${sprint.updatedAt ?? ''}`,
            title: 'Active sprint running',
            message:
              remaining === null
                ? `${sprint.name} is active in ${project.project_name}.`
                : `${sprint.name} ends in ${remaining} day${remaining === 1 ? '' : 's'}.`,
            time: formatRelativeTime(sprint.updatedAt),
            projectSlug: project.slug,
            view: 'sprint',
            tone: remaining !== null && remaining <= 2 ? 'warning' : 'success',
          });
        });

      snapshot.tasks.slice(0, 2).forEach((task) => {
        items.push({
          id: `recent-task-${task.id}-${task.createdAt}`,
          title: 'Recent task update',
          message: `${task.ticketKey} was added to ${task.columnName}.`,
          time: formatRelativeTime(task.createdAt),
          projectSlug: project.slug,
          view: 'kanban',
          tone: 'info',
        });
      });

      snapshot.members.slice(0, 2).forEach((member) => {
        items.push({
          id: `member-${project.project_id}-${member.employeeId}`,
          title: 'Project member active',
          message: `${member.fullName} is assigned as ${member.designation}.`,
          time: formatRelativeTime(snapshot.loadedAt),
          projectSlug: project.slug,
          view: 'dashboard',
          tone: 'success',
        });
      });
    });

    return items.slice(0, 10);
  }, [employeeProjects, projectSnapshots, workspace.employeeId]);

  const unreadNotifications = notifications.filter((item) => !readNotificationIds.includes(item.id));

  const handleAddMemberSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!activeProject?.project_id) {
      setMemberStatus({ kind: 'error', text: 'Select a project before adding members.' });
      return;
    }

    setMemberStatus(null);
    setIsAddingMember(true);

    try {
      const res = await fetch(apiUrl('/projects/add-member'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          project_id: activeProject.project_id,
          employee_id: memberForm.employeeId.trim(),
          designation: memberForm.designation,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Unable to add member to project.');
      }

      setMemberStatus({ kind: 'success', text: data.message || 'Member added to the project.' });
      setMemberForm({ employeeId: '', designation: 'Developer' });
      setSnapshotRefreshKey((key) => key + 1);
    } catch (error: any) {
      setMemberStatus({ kind: 'error', text: error.message || 'Unable to add member to project.' });
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleCreateProjectSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!projectForm.projectName.trim()) {
      setProjectStatus({ kind: 'error', text: 'Enter a project name to continue.' });
      return;
    }

    setProjectStatus(null);
    setIsCreatingProject(true);

    try {
      const slug = buildProjectSlug(projectForm.projectName);
      const res = await fetch(apiUrl('/projects/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_name: projectForm.projectName.trim(),
          slug,
          employee_id: workspace.employeeId.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Unable to create project.');
      }

      const createdProject = {
        project_id: data.id || data.project_id || slug,
        project_name: data.name || projectForm.projectName.trim(),
        project_key: data.project_key || '',
        slug: data.slug || slug,
        user_role_in_project: 'Team Leader',
        user_designation: 'Product Manager',
      };

      setEmployeeProjects((currentProjects) => {
        const nextProjects = currentProjects.filter((project) => project.slug !== createdProject.slug);
        return [createdProject, ...nextProjects];
      });
      setProjectStatus({ kind: 'success', text: 'Project created successfully. Redirecting to the new workspace.' });
      setProjectForm({ projectName: '' });
      setSnapshotRefreshKey((key) => key + 1);
      navigateTo(createdProject.slug as ProjectData['slug'], 'dashboard', true);
    } catch (error: any) {
      setProjectStatus({ kind: 'error', text: error.message || 'Unable to create project.' });
    } finally {
      setIsCreatingProject(false);
    }
  };

  useEffect(() => {
    const loadEmployeeProjects = async () => {
      if (!workspace.employeeId) return;

      try {
        const res = await fetch(
          apiUrl(`/projects/dashboard/${encodeURIComponent(workspace.employeeId)}`),
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await res.json();
        if (res.ok && Array.isArray(data.active_projects)) {
          // Normalize different backend shapes so `project_id`, `slug`, and role are available
          const normalized = data.active_projects.map((p: any) => {
            const projectName = p.project_name ?? p.name ?? p.title ?? workspace.workspaceName;
            return {
              project_id: p.project_id ?? p.id ?? p.projectId ?? '',
              project_name: projectName,
              project_key: p.project_key ?? p.key ?? p.project_key ?? workspace.workspaceKey,
              slug: p.slug ?? buildProjectSlug(projectName),
              user_role_in_project: (p.user_role_in_project ?? p.user_role ?? p.role ?? 'Member'),
              user_designation: p.user_designation ?? p.user_designation ?? p.designation ?? 'Not Assigned',
            } as EmployeeProjectSummary;
          });

          setEmployeeProjects(normalized);
        } else {
          setEmployeeProjects([]);
        }
      } catch {
        setEmployeeProjects([]);
      }
    };

    loadEmployeeProjects();
  }, [workspace.employeeId]);

  useEffect(() => {
    if (!employeeProjects.length) {
      setProjectSnapshots({});
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadSnapshots = async () => {
      setSnapshotLoading(true);

      const entries: Array<[string, ProjectRealtimeSnapshot] | null> = await Promise.all(
        employeeProjects.map(async (project): Promise<[string, ProjectRealtimeSnapshot] | null> => {
          try {
            const [boardRes, membersRes, sprintsRes] = await Promise.all([
              fetch(apiUrl(`/projects/${project.project_id}/board`), { signal: controller.signal }),
              fetch(apiUrl(`/projects/${project.project_id}/members`), { signal: controller.signal }),
              fetch(apiUrl(`/projects/${project.project_id}/sprints`), { signal: controller.signal }),
            ]);

            if (!boardRes.ok || !membersRes.ok || !sprintsRes.ok) {
              throw new Error('Unable to load live project data.');
            }

            const [board, members, sprints] = await Promise.all([
              boardRes.json(),
              membersRes.json(),
              sprintsRes.json(),
            ]);

            return [project.project_id, normalizeProjectSnapshot(project.project_id, board, members, sprints)];
          } catch (error: any) {
            if (controller.signal.aborted) return null;

            return [
              project.project_id,
              {
                projectId: project.project_id,
                tasks: [],
                members: [],
                sprints: [],
                columns: [],
                loadedAt: new Date().toISOString(),
                error: error?.message || 'Unable to load live project data.',
              },
            ];
          }
        })
      );

      if (cancelled) return;

      setProjectSnapshots((current) => {
        const next = { ...current };
        entries.forEach((entry) => {
          if (!entry) return;
          next[entry[0]] = entry[1];
        });
        return next;
      });
      setSnapshotLoading(false);
    };

    loadSnapshots();
    const interval = window.setInterval(loadSnapshots, 30000);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [employeeProjects, snapshotRefreshKey]);

  useEffect(() => {
    if (!employeeProjects.length) return;

    const routeMatch = employeeProjects.find((project) => project.slug === route.projectSlug);
    if (routeMatch) return;

    const preferredProject = workspaceProject ?? employeeProjects[0];

    if (preferredProject?.slug && preferredProject.slug !== route.projectSlug) {
      const nextPath = buildWorkspacePath(preferredProject.slug as ProjectData['slug'], route.view);

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', nextPath);
      }

      setRoute({
        projectSlug: preferredProject.slug as ProjectData['slug'],
        view: route.view,
      });
    }
  }, [employeeProjects, route.projectSlug, route.view, workspaceProject]);

  const navigateTo = (
    projectSlug: ProjectData['slug'],
    view: WorkspaceView,
    replace = false
  ) => {
    const nextPath = buildWorkspacePath(projectSlug, view);

    if (typeof window !== 'undefined') {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath);
    }

    setRoute({ projectSlug, view });
    setProfileOpen(false);
    setProjectActionsOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
  };

  useEffect(() => {
    const onPopState = () => {
      if (typeof window === 'undefined') return;

      const parsed = parseWorkspacePath(window.location.pathname);
      const safeSlug =
        parsed.projectSlug ||
        getDefaultProjectSlug(workspace.workspaceName, workspace.workspaceKey);

      setRoute({ projectSlug: safeSlug, view: parsed.view });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === 'Escape') {
        setProfileOpen(false);
        setProjectActionsOpen(false);
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }

      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [workspace.workspaceKey, workspace.workspaceName]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.location.pathname === '/' || window.location.pathname === '') {
      navigateTo(
        getDefaultProjectSlug(workspace.workspaceName, workspace.workspaceKey),
        'dashboard',
        true
      );
    }
  }, [workspace.workspaceKey, workspace.workspaceName]);

  const renderContent = () => {
    switch (route.view) {
      case 'dashboard':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Overview
                </p>

                <h1 className="mt-2 text-3xl font-bold text-slate-950">
                  {currentProject.name} <span className="text-slate-400">-</span> {currentProject.key}
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  {currentProject.description}
                </p>
              </div>

              <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm">
                {snapshotLoading ? 'Syncing live data...' : `/${currentProject.slug}/dashboard`}
              </div>
            </div>

            {activeSnapshot?.error ? (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {activeSnapshot.error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total Tasks"
                value={currentProject.stats.totalTasks}
                icon={CheckCircle2}
                accent="text-blue-600"
              />
              <StatCard
                title="Completed"
                value={currentProject.stats.completedTasks}
                icon={TrendingUp}
                accent="text-emerald-600"
                progress={progress}
              />
              <StatCard
                title="In Progress"
                value={currentProject.stats.inProgressTasks}
                icon={AlertCircle}
                accent="text-amber-600"
              />
              <StatCard
                title="Team Members"
                value={activeSnapshot?.members.length ?? 0}
                icon={Users}
                accent="text-cyan-600"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Activity Feed
                    </h2>
                    <p className="text-sm text-slate-500">
                      Recent work in {currentProject.name}
                    </p>
                  </div>
                  <Calendar className="h-5 w-5 text-sky-500" />
                </div>

                <div className="mt-5 space-y-3">
                  {currentProject.recentActivity.length > 0 ? (
                    currentProject.recentActivity.map((activity) => (
                      <button
                        key={activity.id}
                        onClick={() => navigateTo(currentProject.slug, 'kanban')}
                        className="block w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left shadow-sm transition hover:border-sky-200 hover:bg-sky-50/70"
                      >
                        <p className="text-sm text-slate-800">
                          <span className="font-semibold text-slate-950">
                            {activity.user}
                          </span>{' '}
                          {activity.action}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activity.timestamp}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      {snapshotLoading ? 'Loading project activity...' : 'No tasks have been created in this project yet.'}
                    </div>
                  )}
                </div>
              </section>
              
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Team Snapshot
                    </h2>
                    <p className="text-sm text-slate-500">
                      People currently active on this project
                    </p>
                  </div>
                  <Users className="h-5 w-5 text-blue-500" />
                </div>

                <div className="mt-5 space-y-3">
                  {(activeSnapshot?.members ?? []).length > 0 ? (
                    (activeSnapshot?.members ?? []).map((member) => (
                      <div
                        key={member.employeeId}
                        className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br ${currentProject.accentClass} text-sm font-bold text-white`}
                        >
                          {member.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {member.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {member.role} - {member.designation}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      {snapshotLoading ? 'Loading project members...' : 'No project members returned by the backend.'}
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">
                    Sprint Health
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {(activeSnapshot?.sprints ?? []).filter((sprint) => sprint.status === 'Active').length} active sprint
                    {((activeSnapshot?.sprints ?? []).filter((sprint) => sprint.status === 'Active').length) === 1 ? '' : 's'} and {currentProject.stats.backlogTasks} backlog item
                    {currentProject.stats.backlogTasks === 1 ? '' : 's'} for {currentProject.name}.
                  </p>
                </div>
              </section>
            </div>
          </motion.div>
        );

      case 'kanban':
        return (
          <KanbanPage
            projectId={activeProject?.project_id ?? null}
            projectName={currentProject.name}
            projectKey={currentProject.key}
            currentEmployeeId={workspace.employeeId}
          />
        );

      case 'backlog':
        return (
          <BacklogPage
            projectId={activeProject?.project_id ?? null}
            projectName={activeProject?.project_name ?? currentProject.name}
            projectKey={activeProject?.project_key ?? currentProject.key}
          />
        );

      case 'sprint':
        return (
          <SprintPage
            projectId={activeProject?.project_id ?? null}
            projectName={activeProject?.project_name ?? currentProject.name}
            projectKey={activeProject?.project_key ?? currentProject.key}
            projectSlug={currentProject.slug}
            onNavigate={(view) => navigateTo(currentProject.slug, view)}
          />
        );

      case 'profile':
        return (
          <ProfilePage
            workspace={workspace}
            token={token}
            employeeProjects={employeeProjects}
          />
        );

      

      case 'create-project':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Create Project
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-950">
                  Start a new workspace
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Create a new project from this employee account. The creator will be assigned as the team leader automatically.
                </p>
              </div>

              <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm">
                /{currentProject.slug}/create-project
              </div>
            </div>

            <section className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <form className="space-y-4" onSubmit={handleCreateProjectSubmit}>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Project Name
                  </label>
                  <input
                    value={projectForm.projectName}
                    onChange={(event) => setProjectForm({ projectName: event.target.value })}
                    placeholder="e.g. Trace Mobile Revamp"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Project Slug Preview
                    </p>
                    <p className="mt-2 font-mono text-sm text-slate-700">
                      {projectForm.projectName ? buildProjectSlug(projectForm.projectName) : 'project-slug'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Creator Employee ID
                    </p>
                    <p className="mt-2 font-mono text-sm text-slate-700">
                      {workspace.employeeId || 'Not available'}
                    </p>
                  </div>
                </div>

                {projectStatus ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      projectStatus.kind === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {projectStatus.text}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isCreatingProject}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(37,99,235,0.96),rgba(14,165,233,0.96))] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FolderPlus className="h-4 w-4" />
                  {isCreatingProject ? 'Creating Project...' : 'Create Project'}
                </button>
              </form>
            </section>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_48%,#f8fafc_100%)] text-slate-950)]">
      <aside className={`flex shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white/85 backdrop-blur-xl transition-width duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72 lg:w-80'}`}>
        <header className="relative flex-none border-b border-slate-200 px-4 py-4">
          <div className="flex flex-col gap-1.5">

            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="truncate text-lg font-bold text-slate-950">
                {currentProject.name}
              </h2>
            </div>

            <p className="truncate text-xs text-slate-500">
              {activeProject?.project_key || currentProject.key} · {workspace.employeeId}
            </p>
          </div>

          <button
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setIsSidebarCollapsed((s) => !s)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-transform hover:scale-95"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isSidebarCollapsed ? 'rotate-90' : '-rotate-90'}`} />
          </button>
        </header>

        <nav className="sidebar-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-gutter:stable]">
          <section className="flex flex-col gap-3">
            <div className="flex items-center px-1">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Primary Navigation
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = route.view === item.id;

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => navigateTo(currentProject.slug, item.id)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex h-14 w-full items-center rounded-2xl border px-4 text-left transition-[background-color,color,box-shadow,transform] duration-200 ${
                      active
                        ? 'border-blue-200 bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                        : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex w-full items-center justify-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/70 text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors">
                        <Icon
                          className={`h-5 w-5 transition-colors ${
                            active ? 'text-blue-600' : 'text-slate-500'
                          }`}
                        />
                      </div>

                      {!isSidebarCollapsed && (
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-5">
                            {item.label}
                          </p>
                          <p className="truncate text-xs leading-4 text-slate-500">
                            {item.hint}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center px-1">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Secondary Navigation
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {sidebarProjects.map((project) => {
                const active = project.slug === currentProject.slug;

                return (
                  <motion.button
                    key={project.project_id}
                    onClick={() => {
                      navigateTo(project.slug as ProjectData['slug'], 'dashboard');
                    }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex h-14 w-full items-center rounded-2xl border px-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 ${
                      active
                        ? 'border-blue-200 bg-blue-50 shadow-sm shadow-blue-100'
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          active
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <FolderOpen className="h-5 w-5" />
                      </div>

                      {!isSidebarCollapsed && (
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            {project.project_key}
                          </p>
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {project.project_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {project.user_role_in_project} · {project.user_designation}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center px-1">
              <Sparkles className="h-4 w-4 shrink-0 text-slate-500" />
              <p className="ml-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                Utility Actions
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {canManageMembers ? (
                <button
                  onClick={() => {
                    setMemberStatus(null);
                    setMemberModalOpen(true);
                  }}
                  className="flex h-14 w-full items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left transition-all duration-200 hover:border-cyan-200 hover:bg-cyan-50/50"
                >
                  <div className="flex w-full items-center justify-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
                      <UserPlus className="h-4 w-4" />
                    </div>

                    {!isSidebarCollapsed && (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          Add Members
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          Invite team members to the current project.
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              ) : null}
              <button
                onClick={() => navigateTo(currentProject.slug, 'create-project')}
                className="flex h-14 w-full items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left transition-all duration-200 hover:border-sky-200 hover:bg-sky-50/50"
              >
                <div className="flex w-full items-center justify-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                    <FolderPlus className="h-4 w-4" />
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        Create Project
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        Start a new workspace from this account.
                      </p>
                    </div>
                  )}
                </div>
              </button>
            </div>
          </section>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-5 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <div ref={searchContainerRef} className="relative mx-auto max-w-2xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search projects, tasks, sprints, members"
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-11 pr-24 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Ctrl+K
              </span>

              <AnimatePresence>
                {searchOpen && searchQuery.trim() ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute left-0 right-0 top-14 z-50 max-h-112 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                  >
                    {searchResults.length > 0 ? (
                      <div className="space-y-1">
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => {
                              setSearchQuery('');
                              navigateTo(result.projectSlug as ProjectData['slug'], result.view);
                            }}
                            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                          >
                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                              <Search className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-950">
                                {result.label}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {result.eyebrow} - {result.projectName}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {result.detail}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        {snapshotLoading ? 'Searching live project data as it loads...' : 'No live project data matched that search.'}
                      </div>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white"
            >
              <Bell className="h-4 w-4 text-slate-700" />
              {unreadNotifications.length > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadNotifications.length}
                </span>
              ) : null}
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 top-14 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-950">
                      Notifications
                    </h3>
                    {unreadNotifications.length > 0 ? (
                      <button
                        onClick={() => setReadNotificationIds(notifications.map((item) => item.id))}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                    {notifications.length > 0 ? (
                      notifications.map((item) => {
                        const unread = !readNotificationIds.includes(item.id);

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setReadNotificationIds((ids) => Array.from(new Set([...ids, item.id])));
                              navigateTo(item.projectSlug as ProjectData['slug'], item.view);
                            }}
                            className={`block w-full rounded-xl border p-3 text-left transition hover:border-sky-200 hover:bg-sky-50/70 ${
                              unread ? 'border-sky-100 bg-sky-50/60' : 'border-slate-100 bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`mt-1 h-2 w-2 rounded-full ${
                                  item.tone === 'warning'
                                    ? 'bg-amber-500'
                                    : item.tone === 'success'
                                      ? 'bg-emerald-500'
                                      : 'bg-sky-500'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-950">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.message}
                                </p>
                                <p className="mt-2 text-[11px] text-slate-400">
                                  {item.time}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        {snapshotLoading ? 'Loading live notifications...' : 'No live notifications yet.'}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div ref={profileMenuRef} className="relative">
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-left transition hover:bg-slate-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                {(
                  workspace.employeeId
                    ? workspace.employeeId[0]
                    : workspace.workspaceName[0]
                ).toUpperCase()}
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute right-0 top-14 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl backdrop-blur-xl"
                >
                  <button
                    onClick={() => navigateTo(currentProject.slug, 'profile')}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    <User className="h-4 w-4 text-slate-500" />
                    Profile
                  </button>

                  <button
                    onClick={onLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-auto p-5 md:p-6">
        
          <AnimatePresence mode="wait">
            <motion.div
              key={`${route.projectSlug}-${route.view}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <AnimatePresence>
        {memberModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm"
            onClick={() => setMemberModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Team Leader Access
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-950">
                    Add member to project
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Project: {currentProject.name}
                  </p>
                </div>

                <button
                  onClick={() => setMemberModalOpen(false)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleAddMemberSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Employee ID
                    </label>
                    <input
                      value={memberForm.employeeId}
                      onChange={(event) => setMemberForm((current) => ({ ...current, employeeId: event.target.value }))}
                      placeholder="EMP-1024"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Designation
                    </label>
                    <select
                      value={memberForm.designation}
                      onChange={(event) => setMemberForm((current) => ({ ...current, designation: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                    >
                      <option value="Developer">Developer</option>
                      <option value="Tester">Tester</option>
                      <option value="DevOps Engineer">DevOps Engineer</option>
                      <option value="UI/UX Designer">UI/UX Designer</option>
                      <option value="Product Manager">Product Manager</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Project Name
                  </p>
                  <p className="mt-2 font-mono text-sm text-slate-700">
                    {activeProject?.project_name ?? activeProject?.slug ?? 'No active project selected'}
                  </p>
                </div>

                {memberStatus ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      memberStatus.kind === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {memberStatus.text}
                  </div>
                ) : null}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isAddingMember}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(37,99,235,0.96),rgba(14,165,233,0.96))] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <UserPlus className="h-4 w-4" />
                    {isAddingMember ? 'Adding Member...' : 'Add Member'}
                  </button>

                  <p className="text-xs text-slate-500">
                    Only Team Leaders can add members to the current project.
                  </p>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  progress?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  accent,
  progress,
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
      </div>
      <Icon className={`h-8 w-8 ${accent}`} />
    </div>

    {typeof progress === 'number' ? (
      <div className="mt-4 h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-[linear-gradient(135deg,rgba(37,99,235,0.95),rgba(14,165,233,0.95))]"
          style={{ width: `${progress}%` }}
        />
      </div>
    ) : null}
  </section>
);

interface PlaceholderViewProps {
  project: ProjectData;
  title: string;
  subtitle: string;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  project,
  title,
  subtitle,
}) => (
  <div className="space-y-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {project.projectLabel}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">
        {project.name} - {title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm text-slate-500">
        This contextual view is tied to{' '}
        <span className="font-semibold text-slate-950">
          /{project.slug}/{title.toLowerCase().replace(/\s+/g, '-')}
        </span>
        .
      </p>
    </div>
  </div>

);

export default Dashboard;
