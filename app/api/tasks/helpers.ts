import { q } from "@/lib/db";

export const TASK_STATUS = ["pendente", "em_andamento", "concluida"] as const;
export const TASK_PRIORITY = ["baixa", "media", "alta"] as const;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: Date | string | null;
  tags: string[];
  folder_id: string | null;
  contract_id: string | null;
  ecosystem_id: string;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  assignees?: any[];
};

export function mapTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    tags: row.tags || [],
    folderId: row.folder_id,
    contractId: row.contract_id,
    ecosystemId: row.ecosystem_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignees: row.assignees || [],
  };
}

export async function fetchTaskWithAssignees(taskId: string, ecosystemId: string) {
  const { rows } = await q(
    `SELECT t.*,
      COALESCE(
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', u.id, 'name', u.name, 'email', u.email))
        FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS assignees
     FROM tasks t
     LEFT JOIN task_assignees ta ON ta.task_id = t.id
     LEFT JOIN users u ON u.id = ta.user_id
     WHERE t.id = $1 AND t.ecosystem_id = $2
     GROUP BY t.id`,
    [taskId, ecosystemId],
  );

  const row = rows[0];
  return row ? mapTask(row as TaskRow) : null;
}

export async function syncAssignees(
  taskId: string,
  assignees: string[] | undefined,
  ecosystemId: string,
) {
  if (!Array.isArray(assignees)) return;

  await q("DELETE FROM task_assignees WHERE task_id = $1", [taskId]);
  if (!assignees.length) return;

  const { rows: validUsers } = await q(
    "SELECT id FROM users WHERE ecosystem_id = $1 AND id = ANY($2)",
    [ecosystemId, assignees],
  );
  if (!validUsers.length) return;

  const values: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const user of validUsers) {
    values.push(`($${idx}, $${idx + 1})`);
    params.push(taskId, user.id);
    idx += 2;
  }
  await q(
    `INSERT INTO task_assignees (task_id, user_id)
     VALUES ${values.join(", ")}
     ON CONFLICT DO NOTHING`,
    params,
  );
}

export async function validateLinks(
  folderId: string | null | undefined,
  contractId: string | null | undefined,
  ecosystemId: string,
) {
  if (folderId) {
    const { rowCount } = await q(
      "SELECT 1 FROM folders WHERE id = $1 AND ecosystem_id = $2",
      [folderId, ecosystemId],
    );
    if (!rowCount) {
      return "Pasta nao encontrada ou fora do ecossistema";
    }
  }

  if (contractId) {
    const { rowCount } = await q(
      "SELECT 1 FROM contracts WHERE id = $1 AND ecosystem_id = $2",
      [contractId, ecosystemId],
    );
    if (!rowCount) {
      return "Contrato nao encontrado ou fora do ecossistema";
    }
  }

  return null;
}
