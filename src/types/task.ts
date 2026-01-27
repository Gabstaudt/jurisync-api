export type TaskStatus = "pendente" | "em_andamento" | "concluida";
export type TaskPriority = "baixa" | "media" | "alta";

export interface TaskAssignee {
  id: string;
  name?: string;
  email?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  tags: string[];
  folderId?: string | null;
  contractId?: string | null;
  ecosystemId?: string;
  createdBy?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  assignees?: TaskAssignee[];
}
