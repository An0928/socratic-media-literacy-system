// Static study content. Posts and conversation scripts live in code so the
// research content stays version-controlled; only student records and their
// submissions are persisted to the database.

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
export const STAGE_LABELS = ['觀察', '挑戰假設', '替代觀點', '判斷'] as const

// Helper to build the standard 4-stage script with post-specific flavour text.
function buildScript(opts: {
  observe: string
  challenge: string
  alternative: string
}): Stage[] {
  return [
    {
      key: 'observe',
      label: '觀察',
      prompt: opts.observe,
    },
    {
      key: 'challenge',
      label: '挑戰假設',
      prompt: opts.challenge,
    },
    {
      key: 'alternative',
      label: '替代觀點',
      prompt: opts.alternative,
    },
    {
      key: 'judgment',
      label: '判斷',
      prompt:
        '你已經從很多角度仔細思考過了，做得很好！現在請整理一下你的想法。準備好之後，就可以前往做出你的最終判斷。',
    },
  ]
}

export const POSTS: Post[] = [
  {
    id: 'w1p1',
    week: 1,
    slot: 1,
    username: '健康生活誌',
    handle: 'healthy_life_tw',
    avatarColor: '#22c55e',
    image: '/posts/fruit-cure.png',
    caption:
      '【震驚】每天吃這種神奇水果，竟然能完全治癒癌症！這是醫生們不想讓你知道的天然秘密。轉發出去，救救你身邊的人！🍇 #天然療法 #抗癌',
    likes: 18234,
    script: buildScript({
      observe:
        '嗨！我們一起來看看這則貼文。先別急著判斷，仔細觀察一下：你看到了哪些細節？例如標題的用字、發文的帳號、按讚數，還有它想傳達的訊息。',
      challenge:
        '觀察得很仔細！接下來想一想：這則貼文希望你相信什麼？它有提供任何科學證據、研究來源或醫生的名字嗎？有沒有哪些地方讓你覺得「怪怪的」？',
      alternative:
        '很好的思考！現在換個角度：為什麼有人要發這樣的貼文？「醫生不想讓你知道」這種說法，通常想達到什麼效果？如果這是真的，新聞和醫院會怎麼報導？',
    }),
  },
  {
    id: 'w1p2',
    week: 1,
    slot: 2,
    username: '真相觀察站',
    handle: 'truth_watch',
    avatarColor: '#3b82f6',
    image: '/posts/5g-tower.png',
    caption:
      '驚人真相！5G 基地台的電磁波正在害死成千上萬隻鳥，政府卻刻意隱瞞這個事實。大家一定要知道！📡🐦 #5G危機 #覺醒',
    likes: 9542,
    script: buildScript({
      observe:
        '我們來分析這則貼文。先觀察看看：貼文用了哪些情緒性的字眼？有沒有具體的數據、地點或時間？發文者是誰？',
      challenge:
        '不錯的觀察！想一想：「成千上萬隻鳥」這個數字從哪裡來？貼文有附上任何研究、官方資料或可查證的來源嗎？「政府隱瞞」要如何被證實？',
      alternative:
        '很棒！換個角度思考：鳥類死亡可能有哪些其他原因？如果 5G 真的這麼危險，科學家和環保團體會保持沉默嗎？這則貼文想引起你什麼樣的情緒？',
    }),
  },
  {
    id: 'w2p1',
    week: 2,
    slot: 1,
    username: '食安大小事',
    handle: 'food_safety_daily',
    avatarColor: '#f59e0b',
    image: '/posts/rice-ball.png',
    caption:
      '快分享！便利商店的飯糰其實加了大量會致癌的防腐劑，吃多了身體會出大問題，我朋友的醫生親口說的！⚠️🍙 #食安 #別再吃了',
    likes: 25103,
    script: buildScript({
      observe:
        '一起看看這則貼文吧。觀察一下：訊息的來源是誰？「我朋友的醫生親口說的」這種說法可信嗎？貼文有提到是哪些成分、哪間商店嗎？',
      challenge:
        '觀察得很好！想一想：這則貼文有提供任何檢驗報告或官方公告嗎？「致癌」是很嚴重的指控，需要什麼樣的證據才能成立？傳聞和事實有什麼差別？',
      alternative:
        '很好！換個角度：食品上市前需要經過哪些把關？如果飯糰真的有問題，食藥署或新聞會怎麼處理？為什麼這類「快分享」的訊息特別容易被轉傳？',
    }),
  },
  {
    id: 'w2p2',
    week: 2,
    slot: 2,
    username: '奇聞蒐集家',
    handle: 'weird_news_collector',
    avatarColor: '#8b5cf6',
    image: '/posts/talking-cat.png',
    caption:
      '太不可思議了！科學家發現一隻會說人話的貓，影片已經瘋傳全球。這證明動物其實比我們想的還聰明！🐱💬 #會說話的貓 #奇蹟',
    likes: 41200,
    script: buildScript({
      observe:
        '我們來看看這則貼文。觀察一下：貼文提到「科學家發現」，但有說是哪位科學家、哪個機構嗎？「影片瘋傳」但你實際看到可信的影片了嗎？',
      challenge:
        '觀察得不錯！想一想：這樣的發現如果是真的，會是多大的新聞？有沒有可能影片是經過剪輯、配音或 AI 製作的？貼文有提供任何可查證的連結嗎？',
      alternative:
        '很好的思考！換個角度：為什麼這種「不可思議」的內容容易被瘋傳？發文者可能想得到什麼（流量、關注）？我們要如何分辨真實影片和經過加工的內容？',
    }),
  },
  {
    id: 'w3p1',
    week: 3,
    slot: 1,
    username: '地球真相',
    handle: 'earth_truth_now',
    avatarColor: '#0ea5e9',
    image: '/posts/polar-bear.png',
    caption:
      '別再被騙了！北極熊的數量其實一直在增加，所謂的全球暖化根本是一場精心設計的騙局，目的是要收你的環保稅！🐻‍❄️ #暖化騙局 #清醒點',
    likes: 13876,
    script: buildScript({
      observe:
        '一起分析這則貼文。觀察看看：它用了哪些強烈的字眼（例如「騙局」「別再被騙」）？有沒有提供北極熊數量的具體數據或來源？',
      challenge:
        '觀察得很好！想一想：就算某地的北極熊數量增加，能直接證明「暖化是騙局」嗎？這之間的邏輯成立嗎？貼文有引用任何科學研究嗎？',
      alternative:
        '很棒！換個角度：絕大多數氣候科學家的共識是什麼？為什麼有人會想散播「暖化是騙局」的說法？這對誰有利？單一數據和整體趨勢有什麼不同？',
    }),
  },
  {
    id: 'w3p2',
    week: 3,
    slot: 2,
    username: '娛樂快訊',
    handle: 'ent_flash_news',
    avatarColor: '#ec4899',
    image: '/posts/celebrity-stage.png',
    caption:
      '【獨家】知名藝人深夜突然宣布退出演藝圈！完整聲明全文曝光，粉絲全哭了😭 點擊連結看更多 👉 (link) #震驚 #獨家',
    likes: 33489,
    script: buildScript({
      observe:
        '我們來看看這則貼文。觀察一下：它有說是哪位藝人嗎？「獨家」「完整全文」但內文其實有提供具體資訊嗎？還是要你「點擊連結」？',
      challenge:
        '觀察得不錯！想一想：為什麼貼文刻意不寫出藝人是誰？「點擊連結看更多」這種設計常見於什麼樣的內容？這個連結安全嗎？',
      alternative:
        '很好！換個角度：什麼是「標題殺人法」（clickbait）？發文者透過讓你點擊連結，可能想得到什麼？如果真有大藝人退出，可靠的新聞媒體會怎麼報導？',
    }),
  },
  {
    id: 'w4p1',
    week: 4,
    slot: 1,
    username: '財富自由教練',
    handle: 'rich_freedom_coach',
    avatarColor: '#eab308',
    image: '/posts/investment-app.png',
    caption:
      '跟著我用這個 App 操作，月入十萬不是夢！我的學員 0 基礎三個月就財富自由 💰 名額有限，私訊我加入！#投資 #被動收入 #財富自由',
    likes: 7621,
    script: buildScript({
      observe:
        '一起來看看這則貼文。觀察一下：它承諾了什麼？「月入十萬」「三個月財富自由」這些說法合理嗎？有提供任何真實、可查證的證據嗎？',
      challenge:
        '觀察得很好！想一想：如果真的這麼好賺，為什麼要公開招募學員、還說「名額有限」？「私訊我加入」這種催促的設計想達到什麼？投資真的零風險嗎？',
      alternative:
        '很棒的思考！換個角度：這類貼文常見的詐騙手法有哪些（製造急迫感、炫耀成果、要你私訊）？發文者真正的目的可能是什麼？面對「保證獲利」的說法，我們該怎麼做？',
    }),
  },
  {
    id: 'w4p2',
    week: 4,
    slot: 2,
    username: '生活情報通',
    handle: 'life_info_tw',
    avatarColor: '#14b8a6',
    image: '/posts/convenience-store.png',
    caption:
      '【最新政策】明天起，全國便利商店全面停止販售塑膠袋！這是真的，大家記得自備購物袋喔～轉發給家人朋友！🛍️ #環保 #新政策',
    likes: 15730,
    script: buildScript({
      observe:
        '我們來分析這則貼文。觀察看看：它說「明天起」「全國」實施，但有提到是哪個政府單位公告的嗎？有附上官方來源或新聞連結嗎？',
      challenge:
        '觀察得不錯！想一想：這麼大的政策通常會如何宣布？「明天起」就全面實施合理嗎？沒有官方來源的「最新政策」訊息，可信度如何？',
      alternative:
        '很好！換個角度：就算出發點是好的（環保），不準確的資訊轉傳出去會造成什麼問題？我們在分享「政策類」訊息前，應該先做什麼確認？',
    }),
  },
]

export const TOTAL_WEEKS = 4
export const POSTS_PER_WEEK = 2

export function getPostsByWeek(week: number): Post[] {
  return POSTS.filter((p) => p.week === week).sort((a, b) => a.slot - b.slot)
}

export function getPostById(id: string): Post | undefined {
  return POSTS.find((p) => p.id === id)
}
