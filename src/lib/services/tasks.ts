import { api } from "@/lib/api";
import { Task } from "@/types/task";

export const tasksService = {
  list: () => api.get<Task[]>("/api/tasks"),
  get: (id: string) => api.get<Task>(`/api/tasks/${id}`),
  create: (payload: Partial<Task>) => api.post<Task>("/api/tasks", payload),
  update: (id: string, payload: Partial<Task>) => api.patch<Task>(`/api/tasks/${id}`, payload),
  delete: (id: string) => api.delete<{ ok: boolean }>(`/api/tasks/${id}`),
};
