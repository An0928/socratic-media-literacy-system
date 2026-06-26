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

function buildSystemInstruction(
  stageIndex: number,
  isStructured: boolean,
  postCaption: string,
  week: number,
  stagePrompt: string,
  chatHistory: ChatMessage[],
) {
  const captionContext = `貼文內容：${postCaption}`
  const stageInstruction = STAGE_INSTRUCTIONS[stageIndex] ?? STAGE_INSTRUCTIONS[0]
  const postSpecificGuidance = stagePrompt
    ? `針對這則貼文，請特別引導學生注意：${stagePrompt}`
    : ""
  const isFirstRound = chatHistory.length === 0

  const roundInstruction = isFirstRound
    ? "這是這個階段的第一輪，請只問一個開放式問題，讓學生自由回應。"
    : "請根據學生的回答決定下一步：若學生回答像『不知道』『沒有』『不清楚』等，先給一個具體的觀察方向提示，再只問一個問題；若學生有實質回答，請繼續深入追問；每次回答都只問一個問題，不要一次問超過一個。"

  if (isStructured) {
    return [
      captionContext,
      stageInstruction,
      postSpecificGuidance,
      roundInstruction,
      "如果學生已經充分完成此階段，請在回覆末尾附加標記 [NEXT_STAGE]；否則就不要附加。每次回答請只用問句，並且只能問與這則貼文相關的問題。",
    ]
      .filter(Boolean)
      .join("\n")
  }

  const scaffoldLevel = week <= 2 ? "high" : "low"

  const scaffoldInstruction = scaffoldLevel === "high"
    ? "請提供具體的引導方向，例如提示學生注意來源、標題用字或數字等細節。"
    : "請用開放式問題引導，不要提供具體例子或方向，讓學生自己發現問題。"

  return [
    captionContext,
    stageInstruction,
    postSpecificGuidance,
    roundInstruction,
    scaffoldInstruction,
    "每次只問一個問題。如果學生已充分完成此階段，在回覆末尾加 [NEXT_STAGE]。",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function getAiReply(
  chatHistory: ChatMessage[],
  stageIndex: number,
  isStructured: boolean,
  postCaption: string,
  week: number,
  stagePrompt: string,
  latestUserInput?: string,
  turnCount: number = 0,
): Promise<string> {
  if (turnCount >= 3) {
    return "你已經在這個階段思考了一段時間，做得很好！讓我們繼續下一個問題。[NEXT_STAGE]"
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in server environment")
  }

  const systemInstruction = buildSystemInstruction(
    stageIndex,
    isStructured,
    postCaption,
    week,
    stagePrompt,
    chatHistory,
  )
  const messages = [
    { role: "system", content: systemInstruction },
    ...chatHistory.map((message) => ({
      role: message.role === "ai" ? "assistant" : "user",
      content: message.text,
    })),
    ...(latestUserInput !== undefined
      ? [{ role: "user" as const, content: latestUserInput }]
      : []),
  ]

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages,
      temperature: 0.7,
      max_tokens: 256,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("OpenRouter API error:", response.status, errorText)
    return "目前無法取得 AI 回覆，請稍後再試。"
  }

  const result = (await response.json()) as any
  const candidateText = result?.choices?.[0]?.message?.content ?? ""

  if (!candidateText) {
    console.error("OpenRouter response missing text", result)
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