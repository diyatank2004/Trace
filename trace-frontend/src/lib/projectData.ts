import { Calendar, CheckCircle2, Clock3, FolderKanban, Sparkles, Users } from 'lucide-react';

export type WorkspaceView =
  | 'dashboard'
  | 'kanban'
  | 'backlog'
  | 'sprint'
  | 'profile'
  | 'create-project';

export type ProjectSlug = string;

export interface ProjectActivity {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}

export interface ProjectData {
  slug: ProjectSlug;
  projectLabel: string;
  name: string;
  key: string;
  description: string;
  members: string[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    backlogTasks: number;
  };
  recentActivity: ProjectActivity[];
  accentClass: string;
}

export interface NavItem {
  id: WorkspaceView;
  label: string;
  icon: typeof FolderKanban;
  hint: string;
}

export const PROJECTS: ProjectData[] = [
  {
    slug: 'tej',
    projectLabel: 'Project 1',
    name: 'Team Tej',
    key: 'TEJ',
    description: 'Mobile app development, release planning, and platform improvements.',
    members: ['Tej', 'Priya', 'Vikram', 'Asha', 'Nikhil'],
    stats: {
      totalTasks: 48,
      completedTasks: 32,
      inProgressTasks: 12,
      backlogTasks: 4,
    },
    recentActivity: [
      { id: 'tej-1', user: 'Tej', action: 'closed AF-123 after QA signoff', timestamp: '2 hours ago' },
      { id: 'tej-2', user: 'Priya', action: 'moved AF-456 into review', timestamp: '4 hours ago' },
      { id: 'tej-3', user: 'Asha', action: 'updated sprint scope', timestamp: '6 hours ago' },
    ],
    accentClass: 'from-blue-500 to-cyan-400',
  },
  {
    slug: 'digitalization',
    projectLabel: 'Project 2',
    name: 'Team Digitalization',
    key: 'DIG',
    description: 'Workflow automation, cloud migration, and enterprise digitization.',
    members: ['Sarah', 'Mike', 'Emma', 'John', 'Rohan', 'Nina', 'Kabir'],
    stats: {
      totalTasks: 62,
      completedTasks: 45,
      inProgressTasks: 14,
      backlogTasks: 3,
    },
    recentActivity: [
      { id: 'dig-1', user: 'Sarah', action: 'deployed AF-001 to staging', timestamp: '1 hour ago' },
      { id: 'dig-2', user: 'Mike', action: 'approved migration task AF-234', timestamp: '3 hours ago' },
      { id: 'dig-3', user: 'Emma', action: 'updated rollout notes for AF-567', timestamp: '5 hours ago' },
    ],
    accentClass: 'from-sky-500 to-cyan-300',
  },
];

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: CheckCircle2, hint: 'Project overview' },
  { id: 'kanban', label: 'Kanban Board', icon: FolderKanban, hint: 'Track flow' },
  { id: 'backlog', label: 'Backlog', icon: Clock3, hint: 'Plan future work' },
  
  {
  id: 'sprint',
  label: 'Sprints',
  hint: 'Plan sprint work',
  icon: Calendar,
},




];

export const getProjectBySlug = (slug: string | undefined) => PROJECTS.find((project) => project.slug === slug);

export const getDefaultProjectSlug = (workspaceName?: string, workspaceKey?: string): ProjectSlug => {
  const source = `${workspaceName ?? ''} ${workspaceKey ?? ''}`.toLowerCase();
  if (source.includes('digital')) return 'digitalization';
  return 'tej';
};

export const parseWorkspacePath = (pathname: string): { projectSlug: ProjectSlug; view: WorkspaceView } => {
  const segments = pathname.split('/').filter(Boolean);
  const projectSlug = (segments[0] || 'tej') as ProjectSlug;

const validViews = ['dashboard', 'kanban', 'backlog', 'sprint', 'profile', 'create-project'];

const view = validViews.includes(segments[1])
  ? (segments[1] as WorkspaceView)
  : 'dashboard';  
  return { projectSlug, view };
};

export const buildWorkspacePath = (projectSlug: ProjectSlug, view: WorkspaceView) => `/${projectSlug}/${view}`;
