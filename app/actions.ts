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
import { isMeaninglessResponse, isConfusedResponse, isGibberishResponse } from "@/lib/chat-helpers"
import { getPostById, getPostsByWeek, type Post } from "@/lib/study-data"

const COOKIE = "mlt_student"
const ADMIN_LANG_COOKIE = "mlt_admin_lang"

const POST_BOUND_INSTRUCTION = [
  "【內容範圍與查證限制】你的提問應以目前貼文的文字、可用的圖片描述及學生已表達的內容為依據，不得假設存在你未取得的資訊，例如帳號過去的貼文、歷史留言、其他評價或外部報導。不得要求學生查看、搜尋或比較這些外部資料，也不得指定網站、機構、搜尋關鍵字或查證管道。這是對 AI 提問方式的限制，不代表學生禁止自行搜尋；學生若主動提供外部資料，可以追問該資料如何影響其判斷，但不得假裝你已查閱或確認該來源。",
  "【引用精確性】當你直接引用貼文文字時，必須使用貼文原文的用詞，不得改字、拼接不同句子，或把自己的解讀放進引號。若不確定某個說法是否出現在貼文中，不要假設它存在，改用不預設答案的概括問句。討論貼文意思時，可以使用清楚的日常語言，但不得改變原意、遺漏重要條件，或將推測說成貼文已明確陳述的事實。",
  "【完整脈絡與立場區分】提問前，先區分貼文作者自己的主張，以及貼文中引用、轉述、質疑或反駁的傳言。不得把被引用的傳言當成作者支持的結論，也不得只抓取標題或最強烈的字句，忽略後文的限制、不同看法或適用條件。若學生似乎混淆兩者，應用中立問題協助釐清，不要直接替學生解釋答案。",
  "【中立提問】不得預設貼文可信、誤導、製造恐懼、缺乏證據，或其中建議有效、安全、有益。不要把尚未成立的評價放進問題，例如『哪一句在嚇人』『這篇少了什麼證據』『這個方法如何更有效』。學生若主動提出這些觀點，可以請其說明依據，但不得直接附和、肯定或否定其判斷。",
  "【問題形式與語言】每次只提出一個問句，並圍繞一個明確的主要重點。不要把不同任務綁在同一句中，也不要用雖然只有一個問號、實際卻要求回答多件事的長問題。使用高中生容易理解的日常語言，避免『太滿』『太快』等模糊說法；需要討論文字特徵時，使用具體描述，但不要直接把該特徵當成真偽證據。",
  "【保留回答空間】避免用預設答案或不互斥的二選一限制學生，例如『這篇比較平衡，還是安全警告』。可以請學生提出其他解讀、可能性或適用條件，但不得要求學生一定反駁貼文，也不得為了提出替代觀點而捏造新事實。",
  "【承接學生與修正理解】根據學生實際說出的內容接續提問，不得替學生補上未表達的立場或理由。學生若指出你誤解貼文，應先依提供的內容重新核對，再按修正後的理解提問，不得繼續沿用錯誤前提。避免『你抓到重點了』『這很關鍵』『你說得對』等暗示答案正確的評語。",
  "【重述與無關回覆】學生只重述貼文時，可以追問該資訊與其判斷有什麼關係，不要反覆要求找出同一句文字，也不要替學生完成推理。對無關數字、無法辨識的文字或過短回覆，不推測其動機、不責備學生，改用更短且具體的問題重新引導；輪次是否計算及何時結束，由系統既定規則處理。",
  "【不提供判決】使用問句協助學生表達、檢查與整理自己的理由，不直接提供貼文的真偽答案、醫療建議或最終結論，也不得透過帶有答案的問題變相透露判決。"
]
const POST_BOUND_INSTRUCTION_EN = [
  "【Content scope and external-source restriction】Base your questions only on the post text, available image description, and what the student has already said. Do not assume information you have not been given, such as the account's past posts, historical comments, other reviews, external reports, or search results. Do not ask the student to look up, search for, or compare such external information, and do not specify websites, organizations, search terms, or verification channels. This restricts how you ask questions; it does not prohibit the student from searching independently. If the student voluntarily provides external information, you may ask how it affects their judgment, but do not claim that you have checked or verified the source.",
  "【Accurate quotation】When placing post wording in quotation marks, use the exact original wording. Do not alter words, combine sentences, or put your interpretation inside quotation marks. If you are unsure whether a claim appears in the post, do not assume it exists; use a general, non-leading question instead. When discussing the meaning of the post, you may use clear everyday language, but do not change its meaning, omit important qualifications, or present your interpretation as something the post explicitly states.",
  "【Full context and author position】Before asking a question, distinguish the post author's own claim from rumors, claims, or views that the post quotes, paraphrases, questions, or rebuts. Do not treat a quoted rumor as the author's conclusion. Do not focus only on the title or the strongest wording while ignoring later qualifications, alternative views, or conditions of applicability. If the student appears to confuse these, use a neutral question to help clarify; do not explain the answer for them.",
  "【Neutral questioning】Do not assume that the post is credible, misleading, fear-inducing, lacking evidence, or that its advice is effective, safe, or beneficial. Do not put an unsupported evaluation into a question, such as 'Which sentence is trying to scare people?', 'What evidence is missing?', or 'How could this method be more effective?'. If the student raises such a point, ask them to explain their reasoning; do not simply agree, affirm, or reject their judgment.",
  "【Question form and language】Ask one question at a time, focused on one clear main point. Do not combine different tasks in one sentence, and do not use a single question mark to ask for several unrelated answers. Use everyday language that a high school student can understand in one reading. Avoid vague descriptions such as 'too crowded' or 'too fast'; when discussing textual features, use concrete descriptions, but do not treat a feature itself as proof that the post is true or false.",
  "【Preserve response space】Avoid questions with a built-in answer or non-exclusive either/or choices, such as 'Is the post balanced, or is it a safety warning?'. Invite the student to consider other interpretations, possibilities, or conditions of applicability, but do not require them to challenge the post and do not invent new facts in order to create an alternative perspective.",
  "【Build on the student and correct your understanding】Continue from what the student has actually said; do not add positions or reasons they have not expressed. If the student points out that you have misunderstood the post, recheck it based on what they provided and continue from the corrected interpretation. Do not retain the original mistaken premise. Avoid evaluative comments such as 'You got it', 'That's the key point', or 'You're right', which may imply that the student has found the correct answer.",
  "【Restatements and unrelated replies】If the student only restates the post, ask how that information relates to their judgment; do not repeatedly ask them to find the same sentence, and do not complete the reasoning for them. For unrelated numbers, unreadable text, or very short replies, do not speculate about the student's motivation or criticize them; instead, use a shorter and more concrete question to re-engage. Whether the turn counts and when the dialogue ends remain governed by the system's existing rules.",
  "【Do not provide the verdict】Use questions to help the student express, examine, and organize their own reasoning. Do not provide the post's truthfulness verdict, medical advice, or final conclusion, and do not reveal the verdict indirectly through a leading question."
]
const FINAL_REPLY_INSTRUCTION = "你必須直接輸出給學生看的最終回覆，絕對不要輸出思考過程、自我對話、分析步驟或任何 <think> 標籤內容。"
const FINAL_REPLY_INSTRUCTION_EN = "You must output only the final reply intended for the student. Never output your thinking process, self-dialogue, analysis steps, or any <think> tag content."
const STAGE_INSTRUCTIONS = [
  '你現在協助學生進行「觀察」階段。請根據貼文內容和對話歷史，引導學生提出觀察性的問題，不要直接給答案。',
  '你現在協助學生進行「挑戰假設」階段。請引導學生思考貼文的假設與邏輯，不要給出結論。',
  '你現在協助學生進行「替代觀點」階段。請引導學生從不同角度審視貼文。',
  '你現在協助學生進行「判斷」階段。只能根據學生與 AI 先前實際討論過的內容，用整理型問句協助學生綜合已有理由形成判斷。禁止提出任何前面階段未討論過的新觀察角度、貼文細節、替代解釋或查證方向；也不得假設前面已討論過學生實際未提到的重點。不得暗示正確分類，也不得為了配合輪次而新增內容。',
]
const STAGE_INSTRUCTIONS_EN = [
  "You are now helping the student with the 'Observation' stage. Based on the post and conversation history, guide the student to ask observational questions without giving the answer directly.",
  "You are now helping the student with the 'Challenge Assumptions' stage. Guide the student to think about the post's assumptions and logic without giving a conclusion.",
  "You are now helping the student with the 'Alternative Perspectives' stage. Guide the student to examine the post from different perspectives.",
  "You are now helping the student with the 'Judgment' stage. Work only from what the student and the AI have actually discussed so far, and use summarizing questions to help the student integrate the reasons already raised into a judgment. Never introduce any new observation angle, post detail, alternative explanation, or verification direction that was not discussed in earlier stages, and never assume the student has raised a point they did not actually mention. Do not hint at the correct classification, and do not add new content just to accommodate the turn count.",
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
  isConfused: boolean,
  language: "zh" | "en" = "zh",
  previousStageLastAnswer?: string,
) {
  const captionContext = language === "en"
    ? `Post text: ${postCaption}\nPost image content: ${image_description}`
    : `貼文文字：${postCaption}\n貼文圖片內容：${image_description}`
  const imageBoundaryInstruction = language === "en"
    ? "Use the description of the post image to check the student's statement or confirm details only when the student has mentioned something in the image first. If the student discusses only the text, do not bring the conversation to the image; continue asking about the text."
    : "貼文圖片內容的描述，只有在學生自己主動提到圖片裡的東西時，才能用來核對學生說的對不對、或幫學生確認細節；如果學生從頭到尾都只針對文字內容討論，請不要主動把話題引導去圖片，繼續針對文字內容追問就好。"
  const stageInstructions = language === "en" ? STAGE_INSTRUCTIONS_EN : STAGE_INSTRUCTIONS
  const stageInstructionBase = stageInstructions[stageIndex] ?? stageInstructions[0]
  const meaninglessInstruction = isMeaningless
    ? language === "en"
      ? "The student's last answer was dismissive, such as 'I don't know' or 'It's okay'. Do not treat it as completing a turn.\nAsk again from a more specific angle, and do not add [NEXT_STAGE] this turn."
      : "學生剛才的回答很敷衍（例如『不知道』『還好』），請不要視為完成一輪。\n換一個更具體的角度重新提問，並且這一輪絕對不要加 [NEXT_STAGE]。"
    : ""
  const confusedInstruction = isConfused
    ? language === "en"
      ? "The student's last reply shows that they did not understand your previous question. Do not treat it as completing a turn or switch to a new question or observation angle. Ask the same question again in simpler, more conversational language, and do not add [NEXT_STAGE] this turn.\nPriority for this turn: re-asking the same question in simpler wording takes precedence over the rules 'do not ask about the same direction more than once' and 'switch to a different observation angle'. The student has not understood the question yet rather than having already answered it, so keep the same point, rephrase it in plainer wording, and do not change the angle or introduce a new question."
      : "學生剛才的回覆顯示他聽不懂你上一個問題（例如說『不懂』『聽不懂』），請不要視為完成一輪，也不要換成新的問題或新的觀察角度。請把你剛剛問過的同一個問題，用更簡單、更口語、更貼近日常對話的方式重新講一次，讓高中生更容易理解，並且這一輪絕對不要加 [NEXT_STAGE]。\n本輪優先規則：『把同一個問題用更簡單的說法重問』優先於『同一方向不要重複』與『換一個觀察角度』的規定——學生是還沒聽懂，不是已經回答過，所以保留同一個重點、換白話重問，不要換角度、不要換新問題。"
    : ""
  const noCountInstruction = language === "en"
    ? "If the student's input is gibberish or meaningless (e.g. sdefsf, 51541, fwesef, wfe65sd1f63, sr5g6rfgaz6frgz), start your reply with the marker [NO_COUNT], never add [NEXT_STAGE] this turn, and re-ask from a more specific angle. Even if the student types gibberish for several turns in a row and the conversation makes no progress, stay in the current stage and re-ask from a more specific angle. Never add [NEXT_STAGE] just to move the conversation forward; only add it when the student has already given at least one substantive answer in this stage."
    : "若學生剛才的輸入是亂碼、無意義的字元或鍵盤/數字亂按（例如 sdefsf、51541、fwesef、wfe65sd1f63、sr5g6rfgaz6frgz），請在回覆最前面加上標記 [NO_COUNT]；這一輪絕對不要加 [NEXT_STAGE]，並換一個更具體的角度重新問同一個問題。就算學生連續好幾輪都輸入亂碼、對話沒有進展，也只能留在目前階段繼續用更具體的角度重新提問，絕對不能為了讓對話往前走而自行加 [NEXT_STAGE]；只有在學生本階段已經給出至少一個實質回答的情況下，才允許加 [NEXT_STAGE]。"
  const bridgeInstruction = previousStageLastAnswer
    ? language === "en"
      ? `This is the first question of a new stage. You may begin with one short, neutral sentence that picks up on the student's last answer: "${previousStageLastAnswer}", but do not merge it with the new question into a compound question; then ask exactly one question about the new stage. If the student's last answer is unrelated to the new stage, ask the new stage's question directly.`
      : `這是新階段的第一個問題。可先用一句簡短、中立的話語承接學生上一階段的最後回答：「${previousStageLastAnswer}」，但不得將其與新問題合併成一個複合問句；隨後只提出一個針對新階段的問句。若上一階段回答與新階段無關，直接提出新階段的問題。`
    : ""
  const stageInstruction = [
    stageInstructionBase,
    stageIndex === 0
      ? language === "en"
        ? "If the student immediately makes a credible-or-misleading judgment, do not reject it. Guide the student to explain why they think that way and use this to enter the observation stage."
        : "如果學生一開始就直接做出可信或誤導的判斷，不要否定他，而是引導他說明「為什麼」這樣覺得，藉此進入觀察階段。"
      : "",
    ...(language === "en" ? POST_BOUND_INSTRUCTION_EN : POST_BOUND_INSTRUCTION),
    imageBoundaryInstruction,
  ]
    .filter(Boolean)
    .join("\n")
  const scaffoldLevel = week <= 2 ? "high" : "low"
  const postSpecificGuidance = stagePrompt && stageIndex !== 3
    ? language === "en"
      ? scaffoldLevel === "high"
        ? `For this post, please specifically guide the student to notice: ${stagePrompt}`
        : `This post's discussion direction is: ${stagePrompt}. Turn it into one open-ended question and do not point out specific clues or answers directly.`
      : scaffoldLevel === "high"
        ? `針對這則貼文，請特別引導學生注意：${stagePrompt}`
        : `這則貼文的討論方向是：${stagePrompt}。請把它轉化成單一開放式問句來引導，不要直接點出具體線索或答案。`
    : ""
  const postPromptNote = postSpecificGuidance
    ? language === "en"
      ? "The prompt above is only a topic direction. Do not copy its questions verbatim, do not treat its direction as a conclusion, and do not assume the post is misleading, fear-inducing, or lacking evidence. Turn it into one neutral, open-ended question."
      : "上面的貼文提示只是主題方向。不要照抄其中的問句，也不要把它當成結論或預設貼文誤導、製造恐懼或缺乏證據。請轉化成一個中立、開放式的單一問句。"
    : ""
  const isFirstRound = chatHistory.length === 0
  const scaffoldInstruction = stageIndex === 3
    ? ""
    : scaffoldLevel === "high"
    ? language === "en"
      ? "Provide a specific direction for guidance, such as prompting the student to notice the source, title wording, or numbers."
      : "請提供具體的引導方向，例如提示學生注意來源、標題用字或數字等細節。"
    : language === "en"
      ? "Use open-ended questions without providing specific examples or directions, so the student can discover the issue independently."
      : "請用開放式問題引導，不要提供具體例子或方向，讓學生自行提出觀察與判斷依據。"

  const roundInstruction = stageIndex === 3
    ? language === "en"
      ? "This is the judgment stage: use only summarizing questions about content that has already been discussed, and introduce nothing new."
      : "這是判斷階段：只能用整理型問句回顧已討論過的內容，禁止引入任何未討論過的新內容。"
    : isFirstRound
      ? language === "en"
        ? "This is the first turn of this stage. Ask only one open-ended question and let the student respond freely."
        : "這是這個階段的第一輪，請只問一個開放式問題，讓學生自由回應。"
      : language === "en"
        ? "Use the student's answer to decide what to do next. If the answer has no substance, provide a specific observation direction and ask only one question. If it is substantive, continue with a deeper follow-up. Ask no more than one question in each reply."
        : "請根據學生的回答決定下一步：若學生回答像『不知道』『沒有』『不清楚』等，先給一個具體的觀察方向提示，再只問一個問題；若學生有實質回答，請繼續深入追問；每次回答都只問一個問題，不要一次問超過一個。"


  if (isStructured) {
    return [
      captionContext,
      language === "en" ? FINAL_REPLY_INSTRUCTION_EN : FINAL_REPLY_INSTRUCTION,
      stageInstruction,
      postSpecificGuidance,
      postPromptNote,
      roundInstruction,
      scaffoldInstruction,
      noCountInstruction,
      language === "en" ? "Reply directly without showing your thinking process." : "請直接回覆，不需要顯示思考過程。",
      language === "en" ? "You must reply in English." : "請務必使用繁體中文回覆。",
      language === "en" ? "Use language that a high school student can understand and avoid academic terms. Ask only one question each time, and keep the sentence within two lines." : "請用高中生能理解的語言回覆，避免學術用語。每次只問一個問題，句子不超過兩行。",
      language === "en" ? "Add [NEXT_STAGE] only when the student has given at least one substantive answer that shows they have engaged with the post's content, such as identifying information, explaining its meaning, or relating it to their judgment. Do not require the student to criticize, doubt, or find a problem with the post." : "只有當學生已針對貼文內容提出至少一個實質回答，例如辨識資訊、說明其意思，或將其與自己的判斷連結時，才在回覆末尾加 [NEXT_STAGE]。不要要求學生必須批評、懷疑或找出貼文的問題。",
      language === "en" ? "Do not ask about the same direction more than once. If the student has said they do not know, continue guiding them from a different angle." : "同一個方向的問題不要重複問超過一次，如果學生已表示不知道，換一個角度繼續引導。",
      language === "en" ? "Before asking each question, check whether it is essentially asking the same thing as a previous question. If so, use a completely different observation angle instead of repeating the same point with different wording." : "每一輪提問前，請先確認這個問題跟你前面已經問過的問題，是不是本質上在問同一件事（例如都是在問『有沒有寫來源』），如果是，請換成完全不同的觀察角度，不要用不同的說法重複問同一個重點。",
      meaninglessInstruction,
      confusedInstruction,
      bridgeInstruction,
      language === "en" ? "Each reply may begin with one short, neutral sentence that picks up on the point the student has expressed, but you must not evaluate its correctness or hint at the answer; after that, ask exactly one question (exception: in the closing reply that adds [NEXT_STAGE], write only the pickup sentence and do not ask a question). Vary your wording and respond naturally, like a friend discussing the topic, without exaggerated praise." : "每次回覆可先用一句簡短、中立的話回應學生已表達的重點，但不得評價其正確性或暗示答案；隨後只能提出一個問句（若本輪要在結尾加 [NEXT_STAGE]，則只寫承接語、不提問）。回應的方式要有變化，不要每次都用同一種句型開頭（例如不要每次都是「你注意到了X」「這個觀察很關鍵」這種固定公式），試著像朋友聊天一樣自然回應，不要用誇張的讚美如「你說得太棒了」。",
      language === "en" ? "Respond like a friend discussing the topic, not like an exam or evaluation. You may use relatable situations so the question feels concrete instead of always staying abstract." : "回應的語氣要像朋友在討論，不要像在考試或審核學生。可以適度用貼近生活的情境提問，例如『如果你朋友傳這篇給你，你會怎麼回她？』，讓問題更有畫面感，不要每一句都停留在抽象的文本分析。",
      language === "en" ? "Avoid closed questions that can be answered with only yes or no. Even in a follow-up, require the student to explain specifically or give an example." : "提問時避免用『對不對』『會不會』『是不是』這種只需要回答『是/否』『會/不會』就能過關的封閉式問句。即使是追問，也要讓學生需要具體說明或舉例才能完整回答，例如把『這樣做會不會讓人更想轉發？』改成『你覺得這種寫法是想讓人有什麼感覺，才會更想轉發？』。",
      language === "en" ? "When you decide the student has completed this stage and add [NEXT_STAGE], before the marker write one sentence that neutrally picks up on the point the student just made (restate it only; do not evaluate its correctness or hint at the answer). Do not ask a new question." : "當你判斷學生完成此階段需要加 [NEXT_STAGE] 時，在 [NEXT_STAGE] 標記之前，用一句話中立地承接學生剛才說的重點（只重述內容，不評價其正確性、不暗示答案），不需要提出新的問題。",
      language === "en" ? "If the student has sufficiently completed this stage, add [NEXT_STAGE] at the end; otherwise do not add it. Every question must stay within the topic of this post." : "如果學生已經充分完成此階段，請在回覆末尾附加標記 [NEXT_STAGE]；否則就不要附加。每次回覆的提問只能問與這則貼文相關的問題。",
      language === "en" ? "Except for one brief sentence that picks up on what the student has already said, everything you write must be a question; you must never provide the answer or conclusion directly." : "除了簡短承接學生已說內容的一句話外，你的提問部分只能是問句，不得直接提供答案或結論。",
    ]
      .filter(Boolean)
      .join("\n")
  }

  return [
    captionContext,
    language === "en" ? FINAL_REPLY_INSTRUCTION_EN : FINAL_REPLY_INSTRUCTION,
    language === "en" ? "You are a misinformation evaluation guide who asks the student open-ended questions about this post." : "你是一個錯誤資訊評估引導助手，針對這則貼文對學生提出開放式問題。",
    imageBoundaryInstruction,
    postSpecificGuidance,
    postPromptNote,
    scaffoldInstruction,
    language === "en" ? "Follow up based on the student's answer; the questions do not need to follow a particular teaching sequence or stage." : "根據學生的回答進行追問，提問不需遵循任何特定教學順序或階段。",
    language === "en" ? "If the student gives a non-substantive answer, do not treat it as completing a turn. Guide them again from a different angle and ask another related question." : "若學生回答「不知道」「沒有」「不清楚」等無實質內容的回答，不要視為完成一輪，請換一個角度重新引導，再問一次相關問題。",
    meaninglessInstruction, confusedInstruction, bridgeInstruction,
    language === "en" ? "Never add [NEXT_STAGE] yourself. The system decides when this conversation ends based on the turn count." : "無論你認為學生的思考是否已經充分，都絕對不要自己在回覆中加上 [NEXT_STAGE] 標記，這個對話什麼時候結束完全由系統根據輪次數字判斷，不需要你介入或自行決定。",
    language === "en" ? "Reply directly without showing your thinking process." : "請直接回覆，不需要顯示思考過程。",
    language === "en" ? "You must reply in English." : "請務必使用繁體中文回覆。",
    language === "en" ? "Use language a high school student can understand. Keep the sentence within two lines and ask only one question each time." : "請用高中生能理解的語言回覆，句子不超過兩行，每次只問一個問題。",
    noCountInstruction,
    language === "en" ? "Each reply may begin with one short, neutral sentence that picks up on the point the student has expressed, but you must not evaluate its correctness or hint at the answer; after that, ask exactly one question. Vary your wording and respond naturally, like a friend discussing the topic." : "每次回覆可先用一句簡短、中立的話回應學生已表達的重點，但不得評價其正確性或暗示答案；隨後只能提出一個問句。回應方式要有變化、像朋友聊天一樣自然，不要每次都用同一種句型開頭。",
    language === "en" ? "Respond like a friend discussing the topic, not like an exam or evaluation. You may use relatable situations so the question feels concrete." : "回應的語氣要像朋友在討論，不要像在考試或審核學生。可以適度用貼近生活的情境提問，例如『如果你朋友傳這篇給你，你會怎麼回她？』，讓問題更有畫面感，不要每一句都停留在抽象的文本分析。",
    language === "en" ? "Except for one brief sentence that picks up on what the student has already said, everything you write must be a question; you must never provide the answer or conclusion directly." : "除了簡短承接學生已說內容的一句話外，你的提問部分只能是問句，不得直接提供答案或結論。",
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
  language: "zh" | "en" = "zh",
  previousStageLastAnswer?: string,
  canAdvance: boolean = true,
): Promise<string> {
  const completionMessage = language === "en"
    ? "Thank you for participating in this discussion. Now it's your turn to make your judgment. [NEXT_STAGE]"
    : "感謝您這次參與討論，換您做出您的答案。[NEXT_STAGE]"

  const isMeaningless = latestUserInput !== undefined && (isMeaninglessResponse(latestUserInput) || isGibberishResponse(latestUserInput))
  const isConfused = latestUserInput !== undefined && !isMeaningless && isConfusedResponse(latestUserInput)
  const baseInstruction = buildSystemInstruction(
    stageIndex,
    isStructured,
    postCaption,
    image_description,
    week,
    stagePrompt,
    chatHistory,
    isMeaningless,
    isConfused,
    language,
    previousStageLastAnswer,
  )
  const systemInstruction = canAdvance
    ? baseInstruction
    : baseInstruction + (language === "en"
      ? "\nThis turn, do not add [NEXT_STAGE] under any circumstances."
      : "\n這一輪無論如何都不要加 [NEXT_STAGE]。")

  let candidateText = ""
  try {
    candidateText = await callOpenAI(systemInstruction, chatHistory, latestUserInput, {
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY || "",
      //model: "gpt-5.4-mini",
      model: "gpt-4.1-mini",
    })
  } catch (err) {
    console.error("AI provider error:", err)
    return language === "en"
      ? "AI is unavailable right now. Please try again later."
      : "目前無法取得 AI 回覆，請稍後再試。"
  }

  const cleanedText = candidateText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()

  const hasNoCount = /\[NO_COUNT\]/i.test(cleanedText)
  if (!canAdvance || isMeaningless || isConfused || hasNoCount) {
    return cleanedText.replace(/\[NEXT_STAGE\]/gi, "").trim()
      || (language === "en" ? "Could you share more about your thoughts?" : "請再說明一下你的想法。")
  }

  if (canAdvance && !isStructured && turnCount >= 9) {
    return completionMessage
  }
  if (canAdvance && isStructured && turnCount >= 3) {
    return stageIndex === 3 ? completionMessage : "[NEXT_STAGE]"
  }

  return cleanedText.replace(/\[NO_COUNT\]/gi, "").trim()
    || (language === "en" ? "Could you share more about your thoughts?" : "請再說明一下你的想法。")
}

export type StudentState = {
  studentId: string
  hasSeenWelcome: boolean
  isStructured: boolean
  language: "zh" | "en"
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
    const adminLang = store.get(ADMIN_LANG_COOKIE)?.value
    return {
      studentId: "admin",
      hasSeenWelcome: true,
      isStructured: true,
      language: adminLang === "en" ? "en" : "zh",
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
    language: student.language,
    submissions,
  }
}

export async function login(
  studentId: string,
  groupCode: string,
  language: "zh" | "en" = "zh",
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
    store.set(ADMIN_LANG_COOKIE, language, {
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
        language,
        submissions: [],
      },
    }
  }

  const normalizedGroupCode = groupCode.trim().toUpperCase()
  if (normalizedGroupCode !== "0" && normalizedGroupCode !== "1") {
    return { ok: false, error: "請輸入有效的組別（0 或 1）" }
  }

  const isStructured = normalizedGroupCode === "1"
  const student = await getOrCreateStudent(id, isStructured, language)
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
      language: student.language,
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
  startedAt?: string | null,
): Promise<{ ok: boolean }> {
  const store = await cookies()
  const studentId = store.get(COOKIE)?.value
  if (!studentId) return { ok: false }
  await saveSubmission(studentId, postId, judgment, chatLog, startedAt ?? null)
  revalidatePath("/")
  return { ok: true }
}