import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  Clock,
  Edit,
  ListChecks,
  Plus,
  Search,
  Trash2,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { tasksService } from "@/lib/services/tasks";
import { foldersService } from "@/lib/services/folders";
import { contractsService } from "@/lib/services/contracts";
import { usersService } from "@/lib/services/users";
import { Folder } from "@/types/folder";
import { Contract } from "@/types/contract";
import { User } from "@/types/auth";
import { Task, TaskPriority, TaskStatus } from "@/types/task";

type FormState = {
  id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  tags: string;
  folderId: string;
  contractId: string;
  assignees: string[];
};

const statusLabels: Record<TaskStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const priorityLabels: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const priorityColors: Record<TaskPriority, string> = {
  baixa: "bg-emerald-100 text-emerald-800",
  media: "bg-amber-100 text-amber-800",
  alta: "bg-rose-100 text-rose-800",
};

const defaultForm: FormState = {
  title: "",
  description: "",
  status: "pendente",
  priority: "media",
  dueDate: "",
  tags: "",
  folderId: "",
  contractId: "",
  assignees: [],
};

const MultiUserSelector = ({
  label,
  selectedIds,
  users,
  onChange,
}: {
  label: string;
  selectedIds: string[];
  users: User[];
  onChange: (ids: string[]) => void;
}) => {
  const toggle = (id: string) => {
    const set = new Set(selectedIds);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange(Array.from(set));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>
              {selectedIds.length ? `${selectedIds.length} selecionado(s)` : "Selecionar usuários"}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80">
          <Command>
            <CommandInput placeholder="Buscar usuário..." />
            <CommandList>
              <CommandEmpty>Nenhum usuário encontrado</CommandEmpty>
              <CommandGroup>
                {users.map((u) => (
                  <CommandItem
                    key={u.id}
                    onSelect={() => toggle(u.id)}
                    className="flex items-start gap-2"
                  >
                    <Checkbox
                      checked={selectedIds.includes(u.id)}
                      className="mt-0.5"
                      onCheckedChange={() => toggle(u.id)}
                    />
                    <div>
                      <div className="text-sm font-medium">{u.name || u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap gap-2">
        {selectedIds.map((id) => {
          const user = users.find((u) => u.id === id);
          return (
            <Badge key={id} variant="secondary">
              {user?.name || user?.email || id}
            </Badge>
          );
        })}
      </div>
    </div>
  );
};

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeStatus, setActiveStatus] = useState<TaskStatus | "todas">("todas");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [tasksRes, foldersRes, contractsRes, usersRes] = await Promise.all([
          tasksService.list(),
          foldersService.list(),
          contractsService.list(),
          usersService.list(),
        ]);
        setTasks(tasksRes || []);
        setFolders(foldersRes || []);
        setContracts(contractsRes || []);
        setUsers(usersRes || []);
      } catch (err: any) {
        toast({ variant: "destructive", title: err?.message || "Erro ao carregar dados" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = activeStatus === "todas" || task.status === activeStatus;
      const query = search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        task.title.toLowerCase().includes(query) ||
        (task.description || "").toLowerCase().includes(query) ||
        (task.assignees || []).some((a) =>
          `${a.name || ""} ${a.email || ""}`.toLowerCase().includes(query),
        );
      return matchesStatus && matchesQuery;
    });
  }, [tasks, activeStatus, search]);

  const startCreating = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setForm({
      id: task.id,
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      tags: (task.tags || []).join(", "),
      folderId: task.folderId || "",
      contractId: task.contractId || "",
      assignees: task.assignees?.map((a) => a.id) || [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast({ variant: "destructive", title: "Informe um título para a tarefa" });
      return;
    }

    const payload = {
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      folderId: form.folderId || null,
      contractId: form.contractId || null,
      assignees: form.assignees,
    };

    try {
      setSaving(true);
      if (editingId) {
        const updated = await tasksService.update(editingId, payload);
        setTasks((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
        toast({ title: "Tarefa atualizada" });
      } else {
        const created = await tasksService.create(payload);
        setTasks((prev) => [created, ...prev]);
        toast({ title: "Tarefa criada" });
      }
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    } catch (err: any) {
      toast({ variant: "destructive", title: err?.message || "Erro ao salvar tarefa" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksService.delete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "Tarefa removida" });
    } catch (err: any) {
      toast({ variant: "destructive", title: err?.message || "Erro ao excluir tarefa" });
    }
  };

  const handleStatusToggle = async (task: Task) => {
    const nextStatus = task.status === "concluida" ? "em_andamento" : "concluida";
    try {
      const updated = await tasksService.update(task.id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err: any) {
      toast({ variant: "destructive", title: err?.message || "Erro ao atualizar status" });
    }
  };

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Tarefas</h1>
            <p className="text-sm text-gray-500">Organize e acompanhe o andamento das tarefas.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9 w-64"
                placeholder="Pesquisar tarefas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={startCreating} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova tarefa
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <Tabs defaultValue="todas" value={activeStatus} onValueChange={(v) => setActiveStatus(v as any)}>
            <TabsList>
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="em_andamento">Em andamento</TabsTrigger>
              <TabsTrigger value="concluida">Concluídas</TabsTrigger>
            </TabsList>
            <TabsContent value={activeStatus}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((task) => (
                  <Card key={task.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          <CardDescription className="mt-1 text-sm text-gray-600">
                            {task.description || "Sem descrição"}
                          </CardDescription>
                        </div>
                        <Badge className={priorityColors[task.priority]}>{priorityLabels[task.priority]}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                          <Clock className="h-3 w-3" />
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-BR") : "Sem prazo"}
                        </span>
                        {task.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-4 w-4 text-gray-500" />
                          {statusLabels[task.status]}
                        </span>
                        {task.assignees?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {task.assignees.map((a) => (
                              <Badge key={a.id} variant="outline">
                                {a.name || a.email || a.id}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem responsáveis</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusToggle(task)}
                          className="gap-1"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {task.status === "concluida" ? "Reabrir" : "Concluir"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEditing(task)} className="gap-1">
                          <Edit className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(task.id)} className="gap-1">
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!filtered.length && (
                  <div className="col-span-full flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-gray-500">
                    Nenhuma tarefa encontrada.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
              <DialogDescription>
                Defina título, responsáveis, prioridade, prazo e vínculos com pasta ou contrato.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Revisar contrato"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prazo">Prazo</Label>
                <Input
                  id="prazo"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Detalhes adicionais"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder">Vincular a pasta (opcional)</Label>
                <Select
                  value={form.folderId || ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, folderId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma pasta</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract">Vincular a contrato (opcional)</Label>
                <Select
                  value={form.contractId || ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, contractId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum contrato</SelectItem>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tags">Tags (separe por vírgula)</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="prioridade, cliente, revisão"
                />
              </div>
              <div className="md:col-span-2">
                <MultiUserSelector
                  label="Responsáveis"
                  selectedIds={form.assignees}
                  users={users}
                  onChange={(ids) => setForm((f) => ({ ...f, assignees: ids }))}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Atualizar" : "Criar tarefa"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Tasks;
