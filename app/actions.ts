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
import { getPostById, getPostsByWeek, type Post } from "@/lib/study-data"

const COOKIE = "mlt_student"

const STAGE_INSTRUCTIONS = [
  '你現在協助學生進行「觀察」階段。請根據貼文內容和對話歷史，引導學生提出觀察性的問題，不要直接給答案。',
  '你現在協助學生進行「挑戰假設」階段。請引導學生思考貼文的假設與邏輯，依舊只用問句，不要給出結論。',
  '你現在協助學生進行「替代觀點」階段。請引導學生從不同角度審視貼文，仍然只用問句。',
  '你現在協助學生進行「判斷」階段。請幫助學生整理思路並確認他已經審慎思考過貼文，回覆仍以問題為主。',
]

type ChatMessage = { role: "ai" | "user"; text: string }

function buildSystemInstruction(stageIndex: number, isStructured: boolean, postCaption: string, week: number) {
  const captionContext = `貼文內容：${postCaption}`
  if (isStructured) {
    const stageInstruction = STAGE_INSTRUCTIONS[stageIndex] ?? STAGE_INSTRUCTIONS[0]
    return `${captionContext}\n${stageInstruction}\n如果學生已經充分完成此階段，請在回覆末尾附加標記 [NEXT_STAGE]；否則就不要附加。每次回答請只用問句，並且只能問與這則貼文相關的問題。`
  }

  const scaffoldLevel = week <= 2 ? "high" : "low"

  const scaffoldInstruction = scaffoldLevel === "high"
    ? "請提供具體的引導方向，例如提示學生注意來源、標題用字或數字等細節。"
    : "請用開放式問題引導，不要提供具體例子或方向，讓學生自己發現問題。"

  if (isStructured) {
    const stageInstruction = STAGE_INSTRUCTIONS[stageIndex] ?? STAGE_INSTRUCTIONS[0]
    return `貼文內容：${postCaption}\n${stageInstruction}\n${scaffoldInstruction}\n每次只問一個問題。如果學生已充分完成此階段，在回覆末尾加 [NEXT_STAGE]。`
  }

  return `${captionContext}\n只能用問句，不能直接給答案，只能問跟這則貼文相關的問題。如果你判斷學生可以前往下一階段，請在回覆末尾附加標記 [NEXT_STAGE]；否則不要附加。`
}

export async function getAiReply(
  chatHistory: ChatMessage[],
  stageIndex: number,
  isStructured: boolean,
  postCaption: string,
  week: number
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in server environment")
  }

  const systemInstruction = buildSystemInstruction(stageIndex, isStructured, postCaption, week)
  const historyText = chatHistory
    .map((message) => `${message.role === "ai" ? "AI" : "學生"}：${message.text}`)
    .join("\n")
  const prompt = `${systemInstruction}\n\n目前對話紀錄：\n${historyText}\n\n請直接以 AI 身份回覆下一個問題。`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Gemini API error:", response.status, errorText)
    return "目前無法取得 AI 回覆，請稍後再試。"
  }

  const result = (await response.json()) as any
  const candidateText = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  if (!candidateText) {
    console.error("Gemini response missing text", result)
    return "目前無法解析 AI 回覆，請稍後再試。"
  }

  return candidateText
}

export type StudentState = {
  studentId: string
  hasSeenWelcome: boolean
  submissions: Submission[]
}

export async function getPostsByWeekAction(week: number): Promise<Post[]> {
  return getPostsByWeek(week)
}

export async function getPostByIdAction(id: string): Promise<Post | null> {
  const post = await getPostById(id)
  return post ?? null
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