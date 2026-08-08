export function isMeaninglessResponse(text: string): boolean {
    const meaninglessPatterns = [
        "不知道", "沒有", "不清楚", "沒差", "隨便", "不確定", "沒感覺", "沒想法", "還好",
    ]
    const trimmed = text.trim().replace(/[。！？，、\s]/g, "")
    if (trimmed.length <= 2) return true
    return meaninglessPatterns.some((pattern) => trimmed === pattern)
}
