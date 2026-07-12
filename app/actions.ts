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

const POST_BOUND_INSTRUCTION = "你提出的問題必須引導學生從『這則貼文本身』尋找線索（例如用字、來源標示、數據呈現方式），不要問學生去外部查證研究或資料，只討論貼文內容本身。"
const FINAL_REPLY_INSTRUCTION = "你必須直接輸出給學生看的最終回覆，絕對不要輸出思考過程、自我對話、分析步驟或任何 <think> 標籤內容。"
const STAGE_INSTRUCTIONS = [
  '你現在協助學生進行「觀察」階段。請根據貼文內容和對話歷史，引導學生提出觀察性的問題，不要直接給答案。',
  '你現在協助學生進行「挑戰假設」階段。請引導學生思考貼文的假設與邏輯，依舊只用問句，不要給出結論。',
  '你現在協助學生進行「替代觀點」階段。請引導學生從不同角度審視貼文，仍然只用問句。',
  '你現在協助學生進行「判斷」階段。請幫助學生整理思路並確認他已經審慎思考過貼文，這一階段不再提出新的問題，而是引導學生整理已形成的觀察與判斷，準備做出最後判斷。',
]

type ChatMessage = { role: "ai" | "user"; text: string }

function isMeaninglessResponse(text: string): boolean {
  const meaninglessPatterns = [
    "不知道",
    "沒有",
    "不清楚",
    "沒差",
    "隨便",
    "不確定",
    "沒感覺",
    "沒想法",
    "還好",
  ]
  const trimmed = text.trim()
  if (trimmed.length <= 2) return true
  return meaninglessPatterns.some((pattern) => trimmed === pattern || trimmed.includes(pattern))
}

function buildSystemInstruction(
  stageIndex: number,
  isStructured: boolean,
  postCaption: string,
  week: number,
  stagePrompt: string,
  chatHistory: ChatMessage[],
) {
  const captionContext = `貼文內容：${postCaption}`
  const stageInstructionBase =
    stageIndex === 3
      ? "你現在協助學生進行「判斷」階段。請幫助學生整理前面各階段的觀察與想法，確認他已經充分思考，這一階段不再提出新的問題，而是引導學生整理內容並準備做出判斷。"
      : STAGE_INSTRUCTIONS[stageIndex] ?? STAGE_INSTRUCTIONS[0]
  const stageInstruction = [
    stageInstructionBase,
    stageIndex === 0
      ? "如果學生一開始就直接做出真假判斷，不要否定他，而是引導他說明「為什麼」這樣覺得，藉此進入觀察階段。"
      : "",
    POST_BOUND_INSTRUCTION,
  ]
    .filter(Boolean)
    .join("\n")
  const postSpecificGuidance = stagePrompt
    ? `針對這則貼文，請特別引導學生注意：${stagePrompt}`
    : ""
  const isFirstRound = chatHistory.length === 0
  const scaffoldLevel = week <= 2 ? "high" : "low"
  const scaffoldInstruction = scaffoldLevel === "high"
    ? "請提供具體的引導方向，例如提示學生注意來源、標題用字或數字等細節。"
    : "請用開放式問題引導，不要提供具體例子或方向，讓學生自己發現問題。"

  const roundInstruction = stageIndex === 3
    ? "這是判斷階段，請不要再提出新的問題；請引導學生整理前面各階段的觀察、質疑與想法，準備做出最後判斷。"
    : isFirstRound
      ? "這是這個階段的第一輪，請只問一個開放式問題，讓學生自由回應。"
      : "請根據學生的回答決定下一步：若學生回答像『不知道』『沒有』『不清楚』等，先給一個具體的觀察方向提示，再只問一個問題；若學生有實質回答，請繼續深入追問；每次回答都只問一個問題，不要一次問超過一個。"

  if (isStructured) {
    return [
      captionContext,
      FINAL_REPLY_INSTRUCTION,
      stageInstruction,
      postSpecificGuidance,
      roundInstruction,
      scaffoldInstruction,
      "請直接回覆，不需要顯示思考過程。",
      "請務必使用繁體中文回覆。",
      "請用高中生能理解的語言回覆，避免學術用語。每次只問一個問題，句子不超過兩行。",
      "如果學生已經指出至少一個具體的質疑或問題，就可以在回覆末尾加 [NEXT_STAGE]。",
      "同一個方向的問題不要重複問超過一次，如果學生已表示不知道，換一個角度繼續引導。",
      "當學生給出有實質內容的回答時，用一句話簡短回應他說的重點（例如「你注意到了X」或「這個觀察很關鍵」），然後再提出下一個問題，讓對話有連貫感。不要用誇張的讚美如「你說得太棒了」。",
      "當你判斷學生完成此階段需要加 [NEXT_STAGE] 時，在 [NEXT_STAGE] 標記之前，用一句話肯定學生的思考，並同時帶出下一個階段的第一個引導問題。例如：「你已經注意到這個重點了！[NEXT_STAGE] 接下來我們想想，這個說法背後有什麼假設？」不要只輸出 [NEXT_STAGE] 而沒有後續問題。",
      "如果學生已經充分完成此階段，請在回覆末尾附加標記 [NEXT_STAGE]；否則就不要附加。每次回答請只用問句，並且只能問與這則貼文相關的問題。",
      "你只能用問句進行引導，絕對不要直接給出答案或結論。",
    ]
      .filter(Boolean)
      .join("\n")
  }

  return [
    captionContext,
    FINAL_REPLY_INSTRUCTION,
    "你是一個媒體素養引導助手，針對這則貼文對學生提出開放式問題。",
    stageInstruction,
    "根據學生的回答進行追問，提問不需遵循任何特定教學順序或階段。",
    "若學生回答「不知道」「沒有」「不清楚」等無實質內容的回答，不要視為完成一輪，請換一個角度重新引導，再問一次相關問題。",
    "當你判斷學生已經對這則貼文進行充分思考，在回覆末尾加上 [NEXT_STAGE]。",
    "請直接回覆，不需要顯示思考過程。",
    "請務必使用繁體中文回覆。",
    "請用高中生能理解的語言回覆，句子不超過兩行，每次只問一個問題。",
    "當學生給出有實質內容的回答時，先用一句話簡短肯定重點，再提出下一個問題。",
    "你只能用問句進行引導，絕對不要直接給出答案或結論。",
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
  if (!isStructured) {
    if (turnCount >= 8) {
      return "我們已經從很多角度討論了這則貼文，你準備好做出判斷了嗎？[NEXT_STAGE]"
    }
  } else if (turnCount >= 3) {
    if (stageIndex === 3) {
      return "你已經從多個角度思考過這則貼文，做得很好！現在請問：哪一個你最支持的判斷，最能被這則貼文中的證據支持？[NEXT_STAGE]"
    }
    return "你已經在這個階段思考了一段時間，做得很好！現在請問：這則貼文中哪一個細節最值得你下一步再追問？[NEXT_STAGE]"
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
      max_tokens: 1024,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("OpenRouter API error:", response.status, errorText)
    return "目前無法取得 AI 回覆，請稍後再試。"
  }

  const result = (await response.json()) as any
  const message = result?.choices?.[0]?.message
  const candidateText = message?.content || message?.reasoning_content || ""

  // 移除可能的思考標記
  const cleanedText = candidateText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^(嗯|讓我想想|我需要|根據指示)[，,][\s\S]*?(?=\n\n|$)/m, "")
    .trim()

  if (!cleanedText) {
    console.error("OpenRouter response missing text", result)
    return "請再說明一下你的想法。"
  }

  return cleanedText
}

export type StudentState = {
  studentId: string
  hasSeenWelcome: boolean
  isStructured: boolean
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
  if (studentId.toLowerCase() === "admin") {
    return {
      studentId: "admin",
      hasSeenWelcome: true,
      isStructured: true,
      submissions: [],
    }
  }
  const [student, submissions] = await Promise.all([
    getOrCreateStudent(studentId),
    getSubmissions(studentId),
  ])
  return {
    studentId,
    hasSeenWelcome: student.hasSeenWelcome,
    isStructured: student.isStructured,
    submissions,
  }
}

export async function login(
  studentId: string,
  groupCode: string,
): Promise<{ ok: boolean; error?: string; state?: StudentState }> {
  const id = studentId.trim()
  const normalizedId = id.toLowerCase()
  if (!id) return { ok: false, error: "請輸入學號" }
  if (id.length > 64) return { ok: false, error: "學號太長了" }

  if (normalizedId === "admin") {
    const store = await cookies()
    store.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
    revalidatePath("/")
    return {
      ok: true,
      state: {
        studentId: "admin",
        hasSeenWelcome: true,
        isStructured: true,
        submissions: [],
      },
    }
  }

  const normalizedGroupCode = groupCode.trim().toUpperCase()
  if (normalizedGroupCode !== "0" && normalizedGroupCode !== "1") {
    return { ok: false, error: "請輸入有效的組別（0 或 1）" }
  }

  const isStructured = normalizedGroupCode === "1"
  const student = await getOrCreateStudent(id, isStructured)
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
    state: {
      studentId: id,
      hasSeenWelcome: student.hasSeenWelcome,
      isStructured: student.isStructured,
      submissions,
    },
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