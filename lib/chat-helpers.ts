export function isMeaninglessResponse(text: string): boolean {
    const meaninglessPatterns = [
        "不知道", "沒有", "不清楚", "沒差", "隨便", "不確定", "沒感覺", "沒想法", "阿災", "還好",
    ]
    const trimmed = text.trim().replace(/[。！？，、\s]/g, "")
    if (trimmed.length <= 2) return true
    return meaninglessPatterns.some((pattern) => trimmed === pattern)
}

export function isConfusedResponse(text: string): boolean {
    const confusedPatterns = [
        "蛤", "蝦", "不懂", "聽不懂", "看不懂", "什麼意思", "你在說什麼", "你的問題是",
        "我不懂你的問題", "你在問什麼", "搞不懂", "什麼鬼", "我不知道你的意思",
    ]
    const trimmed = text.trim().replace(/[。！？，、\s]/g, "")
    return confusedPatterns.some((pattern) => trimmed.includes(pattern))
}
