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
import { isMeaninglessResponse } from "@/lib/chat-helpers"
import { getPostById, getPostsByWeek, type Post } from "@/lib/study-data"

const COOKIE = "mlt_student"

const POST_BOUND_INSTRUCTION = [
  "重要規則：你只能引導學生觀察『這張貼文或貼文圖片裡實際看得到的內容』，例如帳號名稱、貼文文字、圖片內容。絕對禁止要求學生去查看『過去貼文』『歷史留言』『其他評價』『網路搜尋』『正式新聞報導』『其他管道』等貼文或貼文圖片以外不存在的資訊，也不能要求學生「比較」這則貼文和任何圖片以外不存在的東西（例如『跟正式新聞報導比起來少了什麼』），因為學生只能看到這一張貼文的圖片，沒有其他資料來源。如果你想引導學生思考來源可信度，只能基於『這張圖和文案上寫了什麼、沒寫什麼』來提問。",
  '當你要引用或轉述貼文裡的文字時，必須精確依照貼文原文的用詞，不能改寫、簡化或自行組合成新的句子。如果不確定貼文裡是否真的有某個說法，請不要在問題中假設它存在，改用更概括的方式提問（例如直接問「貼文裡有沒有提到讓你覺得可信或不可信的說法」，而不是引用一句你不確定是否存在的原文）。',
  '每個問題只能圍繞一個明確的重點，不要把『如果...』的假設句和另一個不相關的追問綁在同一句話裡。問句要讓高中生一次讀完就能理解在問什麼，不要用抽象的形容詞（例如『太滿』『太快』）來描述問題，改用具體可觀察的描述（例如『用了很多驚嘆號』『把最嚴重的地方放在最前面』）。',
]
const FINAL_REPLY_INSTRUCTION = "你必須直接輸出給學生看的最終回覆，絕對不要輸出思考過程、自我對話、分析步驟或任何 <think> 標籤內容。"
const STAGE_INSTRUCTIONS = [
  '你現在協助學生進行「觀察」階段。請根據貼文內容和對話歷史，引導學生提出觀察性的問題，不要直接給答案。',
  '你現在協助學生進行「挑戰假設」階段。請引導學生思考貼文的假設與邏輯，依舊只用問句，不要給出結論。',
  '你現在協助學生進行「替代觀點」階段。請引導學生從不同角度審視貼文，仍然只用問句。',
  '你現在協助學生進行「判斷」階段。禁止提出任何新的觀察角度或前面階段未曾討論過的細節。請用整理型的問句，幫助學生回顧他在前面階段已經說過的重點，例如：「你剛剛提到的這幾點，你覺得哪一個最能支持你的判斷？」或「把你前面觀察到的這些線索放在一起看，你現在會怎麼判斷這則貼文？」絕對不要引導學生去注意任何前面階段沒有提過的新細節（例如認證標章、來源、其他頁面內容等）。',
]

type ChatMessage = { role: "ai" | "user"; text: string }

async function callOpenAI(
  systemInstruction: string,
  chatHistory: ChatMessage[],
  latestUserInput: string | undefined,
  config: {
    baseUrl: string
    apiKey: string
    model: string
  },
): Promise<string> {
  const messages = [
    { role: "system", content: systemInstruction },
    ...chatHistory.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
    ...(latestUserInput !== undefined ? [{ role: "user" as const, content: latestUserInput }] : []),
  ]

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_completion_tokens: 1024,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    console.error("API error:", response.status, await response.text())
    return "目前無法取得 AI 回覆，請稍後再試。"
  }

  const result = await response.json()
  const message = result?.choices?.[0]?.message
  const candidateText = message?.content || result?.choices?.[0]?.text || ""

  console.log("Full API response:", JSON.stringify(result, null, 2))

  return candidateText
}

function buildSystemInstruction(
  stageIndex: number,
  isStructured: boolean,
  postCaption: string,
  image_description: string,
  week: number,
  stagePrompt: string,
  chatHistory: ChatMessage[],
  isMeaningless: boolean,
  previousStageLastAnswer?: string,
) {
  const captionContext = `貼文文字：${postCaption}\n貼文圖片內容：${image_description}`
  const imageBoundaryInstruction = "貼文圖片內容的描述，只有在學生自己主動提到圖片裡的東西時，才能用來核對學生說的對不對、或幫學生確認細節；如果學生從頭到尾都只針對文字內容討論，請不要主動把話題引導去圖片，繼續針對文字內容追問就好。"
  const stageInstructionBase = STAGE_INSTRUCTIONS[stageIndex] ?? STAGE_INSTRUCTIONS[0]
  const meaninglessInstruction = isMeaningless
    ? "學生剛才的回答很敷衍（例如『不知道』『還好』），請不要視為完成一輪。\n換一個更具體的角度重新提問，並且這一輪絕對不要加 [NEXT_STAGE]。"
    : ""
  const bridgeInstruction = previousStageLastAnswer
    ? `這是新階段的第一個問題。學生在上一階段最後回答了：「${previousStageLastAnswer}」。如果適合，請把這句話自然地融入你的開場問題裡，用一句話簡短承接後直接接上新階段的提問，兩者合併成一個完整的問題，不要分成兩句話問兩件事；如果這句話跟新階段的主題關聯不大，就不用呼應，直接問新階段該問的問題就好。整段回覆只能有一個問句。`
    : ""
  const stageInstruction = [
    stageInstructionBase,
    stageIndex === 0
      ? "如果學生一開始就直接做出真假判斷，不要否定他，而是引導他說明「為什麼」這樣覺得，藉此進入觀察階段。"
      : "",
    POST_BOUND_INSTRUCTION,
    imageBoundaryInstruction,
  ]
    .filter(Boolean)
    .join("\n")
  const postSpecificGuidance = stagePrompt && stageIndex !== 3
    ? `針對這則貼文，請特別引導學生注意：${stagePrompt}`
    : ""
  const isFirstRound = chatHistory.length === 0
  const scaffoldLevel = week <= 2 ? "high" : "low"
  const scaffoldInstruction = scaffoldLevel === "high"
    ? "請提供具體的引導方向，例如提示學生注意來源、標題用字或數字等細節。"
    : "請用開放式問題引導，不要提供具體例子或方向，讓學生自己發現問題。"

  const roundInstruction = stageIndex === 3
    ? "這是判斷階段，只能用整理型問句回顧學生前面已經講過的內容，禁止提出任何前面階段沒討論過的新細節或新角度。"
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
      "每一輪提問前，請先確認這個問題跟你前面已經問過的問題，是不是本質上在問同一件事（例如都是在問『有沒有寫來源』），如果是，請換成完全不同的觀察角度，不要用不同的說法重複問同一個重點。",
      meaninglessInstruction,
      bridgeInstruction,
      "當學生給出有實質內容的回答時，用一句話簡短回應他說的重點，讓對話有連貫感，然後再提出下一個問題。回應的方式要有變化，不要每次都用同一種句型開頭（例如不要每次都是「你注意到了X」「這個觀察很關鍵」這種固定公式），試著像朋友聊天一樣自然回應，不要用誇張的讚美如「你說得太棒了」。",
      "回應的語氣要像朋友在討論，不要像在考試或審核學生。可以適度用貼近生活的情境提問，例如『如果你朋友傳這篇給你，你會怎麼回她？』，讓問題更有畫面感，不要每一句都停留在抽象的文本分析。",
      "提問時避免用『對不對』『會不會』『是不是』這種只需要回答『是/否』『會/不會』就能過關的封閉式問句。即使是追問，也要讓學生需要具體說明或舉例才能完整回答，例如把『這樣做會不會讓人更想轉發？』改成『你覺得這種寫法是想讓人有什麼感覺，才會更想轉發？』。",
      "當你判斷學生完成此階段需要加 [NEXT_STAGE] 時，在 [NEXT_STAGE] 標記之前，用一句話肯定學生的思考即可，不需要提出新的問題。",
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
    imageBoundaryInstruction,
    scaffoldInstruction,
    "根據學生的回答進行追問，提問不需遵循任何特定教學順序或階段。",
    "若學生回答「不知道」「沒有」「不清楚」等無實質內容的回答，不要視為完成一輪，請換一個角度重新引導，再問一次相關問題。",
    meaninglessInstruction,
    bridgeInstruction,
    "當你判斷學生已經對這則貼文進行充分思考，在回覆末尾加上 [NEXT_STAGE]。",
    "請直接回覆，不需要顯示思考過程。",
    "請務必使用繁體中文回覆。",
    "請用高中生能理解的語言回覆，句子不超過兩行，每次只問一個問題。",
    "當學生給出有實質內容的回答時，先用一句話簡短肯定重點，再提出下一個問題，回應方式要有變化、像朋友聊天一樣自然，不要每次都用同一種句型開頭。",
    "回應的語氣要像朋友在討論，不要像在考試或審核學生。可以適度用貼近生活的情境提問，例如『如果你朋友傳這篇給你，你會怎麼回她？』，讓問題更有畫面感，不要每一句都停留在抽象的文本分析。",
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
  image_description: string,
  week: number,
  stagePrompt: string,
  latestUserInput?: string,
  turnCount: number = 0,
  previousStageLastAnswer?: string,
): Promise<string> {
  if (!isStructured) {
    if (turnCount >= 9) {
      return "感謝您這次參與討論，換您做出您的答案。[NEXT_STAGE]"
    }
  } else if (turnCount >= 3) {
    if (stageIndex === 3) {
      return "感謝您這次參與討論，換您做出您的答案。[NEXT_STAGE]"
    }
    return "[NEXT_STAGE]"
  }

  const isMeaningless = latestUserInput !== undefined && isMeaninglessResponse(latestUserInput)
  const systemInstruction = buildSystemInstruction(
    stageIndex,
    isStructured,
    postCaption,
    image_description,
    week,
    stagePrompt,
    chatHistory,
    isMeaningless,
    previousStageLastAnswer,
  )

  let candidateText = ""
  try {
    candidateText = await callOpenAI(systemInstruction, chatHistory, latestUserInput, {
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-5.4-mini",
    })
  } catch (err) {
    console.error("AI provider error:", err)
    return "目前無法取得 AI 回覆，請稍後再試。"
  }

  const cleanedText = candidateText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()

  if (!cleanedText) {
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