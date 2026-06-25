import "server-only"
import { getPool } from "@/lib/db"
import type { RowDataPacket } from "mysql2/promise"
import { STAGE_LABELS as SHARED_STAGE_LABELS, TOTAL_WEEKS, POSTS_PER_WEEK } from "@/lib/study-content"

export type Stage = {
  key: string
  label: string
  // Scripted AI prompt shown when the student reaches this stage.
  prompt: string
}

export type Post = {
  id: string
  week: number
  slot: number // 1 or 2 within the week
  username: string
  handle: string
  avatarColor: string
  image: string
  caption: string
  likes: number
  // Per-post scripted conversation. Each entry is one AI turn.
  script: Stage[]
}

// The four reasoning stages, in order. These labels drive the progress bar.
export const STAGE_LABELS = SHARED_STAGE_LABELS

// Helper to build the standard 4-stage script with post-specific flavour text.
function buildScript(opts: {
  observe: string
  challenge: string
  alternative: string
}): Stage[] {
  return [
    {
      key: "observe",
      label: "觀察",
      prompt: opts.observe,
    },
    {
      key: "challenge",
      label: "挑戰假設",
      prompt: opts.challenge,
    },
    {
      key: "alternative",
      label: "替代觀點",
      prompt: opts.alternative,
    },
    {
      key: "judgment",
      label: "判斷",
      prompt:
        "你已經從很多角度仔細思考過了，做得很好！現在請整理一下你的想法。準備好之後，就可以前往做出你的最終判斷。",
    },
  ]
}

export { TOTAL_WEEKS, POSTS_PER_WEEK }

async function ensurePostsSchema(): Promise<void> {
  const db = getPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      week INT NOT NULL,
      slot INT NOT NULL,
      username VARCHAR(255) NOT NULL,
      handle VARCHAR(255) NOT NULL,
      avatar_color VARCHAR(32) NOT NULL,
      image_url VARCHAR(512) NOT NULL,
      caption TEXT NOT NULL,
      likes INT NOT NULL DEFAULT 0,
      is_true TINYINT(1) NOT NULL DEFAULT 0,
      source VARCHAR(255) DEFAULT NULL,
      source_url VARCHAR(512) DEFAULT NULL,
      observe_prompt TEXT NOT NULL,
      challenge_prompt TEXT NOT NULL,
      alternative_prompt TEXT NOT NULL
    )
  `)
}

function mapRowToPost(row: RowDataPacket): Post {
  return {
    id: row.id as string,
    week: Number(row.week),
    slot: Number(row.slot),
    username: row.username as string,
    handle: row.handle as string,
    avatarColor: row.avatar_color as string,
    image: row.image_url as string,
    caption: row.caption as string,
    likes: Number(row.likes),
    script: buildScript({
      observe: (row.observe_prompt as string) ?? "",
      challenge: (row.challenge_prompt as string) ?? "",
      alternative: (row.alternative_prompt as string) ?? "",
    }),
  }
}

export async function getPostsByWeek(week: number): Promise<Post[]> {
  await ensurePostsSchema()
  const db = getPool()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, week, slot, username, handle, avatar_color, image_url, caption, likes, observe_prompt, challenge_prompt, alternative_prompt
     FROM posts
     WHERE week = ?
     ORDER BY slot ASC`,
    [week],
  )
  return rows.map(mapRowToPost)
}

export async function getPostById(id: string): Promise<Post | undefined> {
  await ensurePostsSchema()
  const db = getPool()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, week, slot, username, handle, avatar_color, image_url, caption, likes, observe_prompt, challenge_prompt, alternative_prompt
     FROM posts
     WHERE id = ?
     LIMIT 1`,
    [id],
  )
  return rows[0] ? mapRowToPost(rows[0]) : undefined
}
