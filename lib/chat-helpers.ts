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

export function isGibberishResponse(text: string): boolean {
    const trimmed = text.trim()
    if (trimmed.length === 0) return false

    const meaningfulCharPattern = /[\u4e00-\u9fa5a-zA-Z]/g
    const meaningfulChars = trimmed.match(meaningfulCharPattern) ?? []

    if (meaningfulChars.length === 0) return true

    const ratio = meaningfulChars.length / trimmed.length
    if (ratio < 0.3) return true

    return false
}
