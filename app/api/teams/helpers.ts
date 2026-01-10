import { q } from "@/lib/db";

export type TeamRow = {
  id: string;
  name: string;
  ecosystem_id: string;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  members?: any[];
};

export function mapTeam(row: TeamRow) {
  return {
    id: row.id,
    name: row.name,
    ecosystemId: row.ecosystem_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members: row.members || [],
  };
}

export async function fetchTeamWithMembers(teamId: string, ecosystemId: string) {
  const { rows } = await q(
    `SELECT t.*,
      COALESCE(
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', u.id, 'name', u.name, 'email', u.email))
        FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS members
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id
     LEFT JOIN users u ON u.id = tm.user_id
     WHERE t.id = $1 AND t.ecosystem_id = $2
     GROUP BY t.id`,
    [teamId, ecosystemId],
  );

  const row = rows[0];
  return row ? mapTeam(row as TeamRow) : null;
}

export async function syncMembers(teamId: string, members: string[] | undefined, ecosystemId: string) {
  if (!Array.isArray(members)) return;
  await q("DELETE FROM team_members WHERE team_id = $1", [teamId]);
  if (!members.length) return;

  const { rows: valid } = await q(
    "SELECT id FROM users WHERE ecosystem_id = $1 AND id = ANY($2)",
    [ecosystemId, members],
  );
  if (!valid.length) return;

  const values: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const u of valid) {
    values.push(`($${idx}, $${idx + 1})`);
    params.push(teamId, u.id);
    idx += 2;
  }
  await q(
    `INSERT INTO team_members (team_id, user_id)
     VALUES ${values.join(", ")}
     ON CONFLICT DO NOTHING`,
    params,
  );
}
