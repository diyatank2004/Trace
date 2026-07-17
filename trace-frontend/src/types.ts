/**
 * core types for Trace
 */

export enum IssueStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  TESTING = 'Testing',
  DEV_COMPLETED = 'Development Completed',
  PEER_REVIEW = 'Peer Review',
  QA_MOVE = 'QA Move',
  UAT_MOVE = 'UAT Move',
  PROD_DEPLOY = 'Production Deploy',
  DONE = 'Done'
}

export enum IssuePriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum IssueType {
  STORY = 'Story',
  TASK = 'Task',
  BUG = 'Bug',
  EPIC = 'Epic'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'Admin' | 'Developer' | 'QA' | 'Viewer';
  profileKey: string;
  workspaceKey: string;
  notifications?: Notification[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'assigned' | 'status_change';
  title: string;
  message: string;
  issueId?: string;
  read: boolean;
  createdAt: string;
}

export interface IssueComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface IssueActivity {
  id: string;
  issueId: string;
  userId: string;
  type: 'status_change' | 'assignment' | 'comment' | 'created' | 'update';
  details?: {
    from?: string;
    to?: string;
    field?: string;
  };
  createdAt: string;
}

export interface Issue {
  id: string;
  key: string; // e.g., AF-123
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  assigneeId?: string;
  reporterId: string;
  storyPoints?: number;
  createdAt: string;
  updatedAt: string;
  sprintId?: string;
  activities?: IssueActivity[]; // Added activity log
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'planned';
  goal?: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  leadId: string;
}

export type KanbanPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface KanbanTask {
  id: string;
  projectId: string;
  columnId: string;
  sprintId: string | null;
  parentId: string | null;
  ticketKey: string;
  title: string;
  description: string | null;
  priority: KanbanPriority;
  assigneeId: string | null;
  createdAt: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  position: number;
  wipLimit: number | null;
  tasks: KanbanTask[];
}

export interface KanbanBoardData {
  id: string;
  projectId: string;
  name: string;
  columns: KanbanColumn[];
}

export interface KanbanSprintOption {
  id: string;
  name: string;
}
