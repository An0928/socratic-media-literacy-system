"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import {
  getOrCreateStudent,
  getSubmissions,
  markWelcomeSeen,
  saveSubmission,
  type Judgment,
  type Submission,
} from "@/lib/db"

const COOKIE = "mlt_student"

export type StudentState = {
  studentId: string
  hasSeenWelcome: boolean
  submissions: Submission[]
}

export async function getStudentState(): Promise<StudentState | null> {
  const store = await cookies()
  const studentId = store.get(COOKIE)?.value
  if (!studentId) return null
  const [student, submissions] = await Promise.all([
    getOrCreateStudent(studentId),
    getSubmissions(studentId),
  ])
  return { studentId, hasSeenWelcome: student.hasSeenWelcome, submissions }
}

export async function login(
  studentId: string,
): Promise<{ ok: boolean; error?: string; state?: StudentState }> {
  const id = studentId.trim()
  if (!id) return { ok: false, error: "請輸入學號" }
  if (id.length > 64) return { ok: false, error: "學號太長了" }

  const student = await getOrCreateStudent(id)
  const store = await cookies()
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  const submissions = await getSubmissions(id)
  revalidatePath("/")
  return {
    ok: true,
    state: { studentId: id, hasSeenWelcome: student.hasSeenWelcome, submissions },
  }
}

export async function logout(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
  revalidatePath("/")
}

export async function completeWelcome(): Promise<void> {
  const store = await cookies()
  const studentId = store.get(COOKIE)?.value
  if (!studentId) return
  await markWelcomeSeen(studentId)
  revalidatePath("/")
}

export async function submitJudgment(
  postId: string,
  judgment: Judgment,
  chatLog: string,
): Promise<{ ok: boolean }> {
  const store = await cookies()
  const studentId = store.get(COOKIE)?.value
  if (!studentId) return { ok: false }
  await saveSubmission(studentId, postId, judgment, chatLog)
  revalidatePath("/")
  return { ok: true }
}
