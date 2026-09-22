import "server-only"
import { getPool } from "@/lib/db"
import type { RowDataPacket } from "mysql2/promise"
import { STAGE_LABELS as SHARED_STAGE_LABELS, TOTAL_WEEKS, POSTS_PER_WEEK } from "@/lib/study-content"

export type Stage = {
  key: string
  label: string
  // Scripted AI prompt shown when the student reaches this stage.
  prompt: string
  promptEn?: string
}

export type Post = {
  id: string
  week: number
  slot: number // 1 or 2 within the week
  username: string
  handle: string
  avatarColor: string
  image: string
  imageEn?: string
  caption: string
  captionEn?: string
  usernameEn?: string
  image_description: string
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
  observeEn?: string
  challengeEn?: string
  alternativeEn?: string
}): Stage[] {
  return [
    {
      key: "observe",
      label: "觀察",
      prompt: opts.observe,
      promptEn: opts.observeEn,
    },
    {
      key: "challenge",
      label: "挑戰假設",
      prompt: opts.challenge,
      promptEn: opts.challengeEn,
    },
    {
      key: "alternative",
      label: "替代觀點",
      prompt: opts.alternative,
      promptEn: opts.alternativeEn,
    },
    {
      key: "judgment",
      label: "判斷",
      prompt:
        "你已經從很多角度仔細思考過了，做得很好！現在請整理一下你的想法。準備好之後，就可以前往做出你的最終判斷。",
      promptEn:
        "You've thought about this from many angles - well done! Now take a moment to organize your thoughts. When you're ready, you can move on to make your final judgment.",
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
    imageEn: (row.image_url_en as string) ?? undefined,
    caption: row.caption as string,
    captionEn: (row.caption_en as string) ?? undefined,
    usernameEn: (row.username_en as string) ?? undefined,
    image_description: (row.image_description as string) ?? "",
    likes: Number(row.likes),
    script: buildScript({
      observe: (row.observe_prompt as string) ?? "",
      challenge: (row.challenge_prompt as string) ?? "",
      alternative: (row.alternative_prompt as string) ?? "",
      observeEn: (row.observe_prompt_en as string) ?? undefined,
      challengeEn: (row.challenge_prompt_en as string) ?? undefined,
      alternativeEn: (row.alternative_prompt_en as string) ?? undefined,
    }),
  }
}

export async function getPostsByWeek(week: number): Promise<Post[]> {
  await ensurePostsSchema()
  const db = getPool()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, week, slot, username, username_en, handle, avatar_color, image_url, image_url_en, caption, caption_en, likes, image_description, observe_prompt, observe_prompt_en, challenge_prompt, challenge_prompt_en, alternative_prompt, alternative_prompt_en
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
    `SELECT id, week, slot, username, username_en, handle, avatar_color, image_url, image_url_en, caption, caption_en, likes, image_description, observe_prompt, observe_prompt_en, challenge_prompt, challenge_prompt_en, alternative_prompt, alternative_prompt_en
     FROM posts
     WHERE id = ?
     LIMIT 1`,
    [id],
  )
  return rows[0] ? mapRowToPost(rows[0]) : undefined
}
