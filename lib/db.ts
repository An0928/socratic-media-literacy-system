import "server-only"
import mysql from "mysql2/promise"

/**
 * Storage layer for the media literacy study.
 *
 * In production (e.g. deployed on Railway) set the `DATABASE_URL` environment
 * variable to your MySQL connection string, e.g.
 *   mysql://user:password@host:port/railway
 * Railway also exposes `MYSQL_URL` for its MySQL plugin, which we fall back to.
 *
 * When no connection string is present (such as in the v0 preview), we fall
 * back to an in-memory store so the full flow can still be demonstrated.
 */

export type Judgment = "real" | "fake" | "unsure"

export type Submission = {
  postId: string
  judgment: Judgment
  chatLog: string
  completedAt: string
}

const CONNECTION_STRING = process.env.DATABASE_URL || process.env.MYSQL_URL || ""
const useMysql = CONNECTION_STRING.length > 0

// ---------------------------------------------------------------------------
// MySQL implementation
// ---------------------------------------------------------------------------

let pool: mysql.Pool | null = null
let schemaReady: Promise<void> | null = null

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      uri: CONNECTION_STRING,
      waitForConnections: true,
      connectionLimit: 5,
      // Railway public proxies require TLS; this is lenient enough for them.
      ssl: CONNECTION_STRING.includes("ssl") ? undefined : { rejectUnauthorized: false },
    })
  }
  return pool
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getPool()
      await db.query(`
        CREATE TABLE IF NOT EXISTS students (
          student_id VARCHAR(64) NOT NULL PRIMARY KEY,
          has_seen_welcome TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await db.query(`
        CREATE TABLE IF NOT EXISTS submissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id VARCHAR(64) NOT NULL,
          post_id VARCHAR(32) NOT NULL,
          judgment VARCHAR(16) NOT NULL,
          chat_log MEDIUMTEXT,
          completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_student_post (student_id, post_id)
        )
      `)
    })().catch((err) => {
      // Reset so a later request can retry the schema setup.
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

// ---------------------------------------------------------------------------
// In-memory fallback implementation (preview only)
// ---------------------------------------------------------------------------

type MemStudent = { hasSeenWelcome: boolean }
const memStudents = new Map<string, MemStudent>()
const memSubmissions = new Map<string, Map<string, Submission>>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getOrCreateStudent(studentId: string): Promise<{ hasSeenWelcome: boolean }> {
  if (useMysql) {
    await ensureSchema()
    const db = getPool()
    await db.query("INSERT IGNORE INTO students (student_id) VALUES (?)", [studentId])
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT has_seen_welcome FROM students WHERE student_id = ?",
      [studentId],
    )
    const row = rows[0]
    return { hasSeenWelcome: Boolean(row?.has_seen_welcome) }
  }

  if (!memStudents.has(studentId)) {
    memStudents.set(studentId, { hasSeenWelcome: false })
  }
  return { hasSeenWelcome: memStudents.get(studentId)!.hasSeenWelcome }
}

export async function markWelcomeSeen(studentId: string): Promise<void> {
  if (useMysql) {
    await ensureSchema()
    const db = getPool()
    await db.query("UPDATE students SET has_seen_welcome = 1 WHERE student_id = ?", [studentId])
    return
  }
  const s = memStudents.get(studentId)
  if (s) s.hasSeenWelcome = true
}

export async function getSubmissions(studentId: string): Promise<Submission[]> {
  if (useMysql) {
    await ensureSchema()
    const db = getPool()
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT post_id, judgment, chat_log, completed_at FROM submissions WHERE student_id = ? ORDER BY completed_at ASC",
      [studentId],
    )
    return rows.map((r) => ({
      postId: r.post_id as string,
      judgment: r.judgment as Judgment,
      chatLog: (r.chat_log as string) ?? "",
      completedAt: new Date(r.completed_at).toISOString(),
    }))
  }
  const map = memSubmissions.get(studentId)
  return map ? Array.from(map.values()) : []
}

export async function saveSubmission(
  studentId: string,
  postId: string,
  judgment: Judgment,
  chatLog: string,
): Promise<void> {
  if (useMysql) {
    await ensureSchema()
    const db = getPool()
    await db.query(
      `INSERT INTO submissions (student_id, post_id, judgment, chat_log)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE judgment = VALUES(judgment), chat_log = VALUES(chat_log), completed_at = CURRENT_TIMESTAMP`,
      [studentId, postId, judgment, chatLog],
    )
    return
  }
  if (!memSubmissions.has(studentId)) memSubmissions.set(studentId, new Map())
  memSubmissions.get(studentId)!.set(postId, {
    postId,
    judgment,
    chatLog,
    completedAt: new Date().toISOString(),
  })
}
