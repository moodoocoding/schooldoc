export type ActiveWorkToolId =
  | 'registry-sign'
  | 'student-lookup'
  | 'notice-collect'
  | 'data-collect'
  | 'special-room';

export interface ActiveWorkItem {
  id: string;
  toolId: ActiveWorkToolId;
  toolName: string;
  title: string;
  statusLabel: string;
  progressLabel: string;
  updatedAt: string;
  listPath: string;
  detailPath: string;
  overdue: boolean;
}

export interface ActiveWorkGroup {
  toolId: ActiveWorkToolId;
  toolName: string;
  listPath: string;
  items: ActiveWorkItem[];
}

export interface ActiveWorkLoadContext {
  userId: string;
  now: Date;
}

export interface ActiveWorkProvider {
  toolId: ActiveWorkToolId;
  toolName: string;
  listPath: string;
  load: (context: ActiveWorkLoadContext) => Promise<ActiveWorkItem[]>;
  subscribe?: (listener: () => void) => () => void;
}

export interface ActiveWorkFailure {
  toolId: ActiveWorkToolId;
  toolName: string;
  message: string;
}

export interface ActiveWorkSnapshot {
  groups: ActiveWorkGroup[];
  failures: ActiveWorkFailure[];
}
