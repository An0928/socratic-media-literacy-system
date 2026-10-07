export function isMeaninglessResponse(text: string): boolean {
    const meaninglessPatterns = [
        "不知道", "沒有", "不清楚", "沒差", "隨便", "不確定", "沒感覺", "沒想法", "阿災", "還好",
    ]
    const meaninglessPatternsEn = [
        "i don't know", "idk", "no", "not sure", "whatever",
        "i don't care", "no idea", "dunno", "meh",
    ]
    const trimmed = text.trim().replace(/[。！？，、\s]/g, "")
    const normalized = trimmed.toLowerCase()
    if (trimmed.length <= 2) return true
    return meaninglessPatterns.some((pattern) => trimmed === pattern)
        || meaninglessPatternsEn.some((pattern) => normalized === pattern)
}

export function isConfusedResponse(text: string): boolean {
    const confusedPatterns = [
        "蛤", "蝦", "不懂", "聽不懂", "看不懂", "什麼意思", "你在說什麼", "你的問題是",
        "我不懂你的問題", "你在問什麼", "搞不懂", "什麼鬼", "我不知道你的意思",
    ]
    const confusedPatternsEn = [
        "what", "i don't understand", "i dont understand",
        "what do you mean", "huh", "confused", "i don't get it",
        "what's your question", "what are you asking",
    ]
    const trimmed = text.trim().replace(/[。！？，、\s]/g, "")
    const normalized = trimmed.toLowerCase()
    return confusedPatterns.some((pattern) => trimmed.includes(pattern))
        || confusedPatternsEn.some((pattern) => normalized.includes(pattern))
}

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]

function hasAdjacentKeyboardRun(text: string): boolean {
    const lower = text.toLowerCase()
    let run = 1
    for (let i = 1; i < lower.length; i++) {
        const a = lower[i - 1]
        const b = lower[i]
        let adjacent = false
        for (const row of KEYBOARD_ROWS) {
            const ia = row.indexOf(a)
            const ib = row.indexOf(b)
            if (ia !== -1 && ib !== -1 && Math.abs(ia - ib) === 1) {
                adjacent = true
                break
            }
        }
        run = adjacent ? run + 1 : 1
        if (run >= 4) return true
    }
    return false
}

export function isGibberishResponse(text: string): boolean {
    const trimmed = text.trim()
    if (trimmed.length === 0) return false
    if (trimmed.includes("\uFFFD")) return true
    const body = trimmed.replace(/\s+/g, "")
    if (/^(.{1,2})\1{2,}$/.test(body)) return true
    const hasChinese = /[\u4e00-\u9fa5]/.test(trimmed)
    if (!hasChinese && hasAdjacentKeyboardRun(trimmed)) return true
    // 英數混雜、無空格、無中文（例如 wfe65sd1f63、5wde1fsz65h、sr5g6rfgaz6frgz）視為亂碼
    if (!hasChinese && /[0-9]/.test(trimmed) && !/\s/.test(trimmed)) return true

    const meaningfulCharPattern = /[\u4e00-\u9fa5a-zA-Z]/g
    const meaningfulChars = trimmed.match(meaningfulCharPattern) ?? []

    const core = trimmed.toLowerCase().replace(/[^a-z]/g, "")
    if (core.length >= 4 && !/[aeiou]/.test(core)) return true

    if (meaningfulChars.length === 0) return true

    const ratio = meaningfulChars.length / trimmed.length
    if (ratio < 0.3) return true

    return false
}
