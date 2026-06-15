"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { ArrowLeft, Send, Check, Sparkles } from "lucide-react"
import { submitJudgment } from "@/app/actions"
import type { Submission, Judgment } from "@/lib/db"
import { STAGE_LABELS, type Post } from "@/lib/study-data"
import { InstagramPost } from "@/components/instagram-post"
import { JudgmentScreen } from "@/components/screens/judgment-screen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ChatMessage = { role: "ai" | "user"; text: string }

type Props = {
  post: Post
  existing?: Submission
  onComplete: () => void
  onExit: () => void
}

export function AnalysisScreen({ post, existing, onComplete, onExit }: Props) {
  // stageIndex points at the AI turn the student is currently responding to.
  const [stageIndex, setStageIndex] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: post.script[0].prompt },
  ])
  const [input, setInput] = useState("")
  const [chatDone, setChatDone] = useState(false)
  const [showJudgment, setShowJudgment] = useState(false)
  const [pending, startTransition] = useTransition()

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  // The active stage for the progress bar: number of completed stages.
  const activeStage = chatDone ? STAGE_LABELS.length : stageIndex

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    const userMsg: ChatMessage = { role: "user", text }
    const nextIndex = stageIndex + 1
    setInput("")

    if (nextIndex < post.script.length) {
      // Append user message, then the next scripted AI prompt.
      setMessages((prev) => [...prev, userMsg, { role: "ai", text: post.script[nextIndex].prompt }])
      setStageIndex(nextIndex)
      // The last scripted turn is the "judgment" cue -> chat is complete.
      if (nextIndex === post.script.length - 1) {
        setChatDone(true)
      }
    } else {
      setMessages((prev) => [...prev, userMsg])
      setChatDone(true)
    }
  }

  function buildChatLog(): string {
    return messages
      .map((m) => `${m.role === "ai" ? "AI" : "學生"}：${m.text}`)
      .join("\n")
  }

  function handleJudgment(judgment: Judgment) {
    startTransition(async () => {
      await submitJudgment(post.id, judgment, buildChatLog())
    })
  }

  if (showJudgment) {
    return (
      <JudgmentScreen
        onSelect={handleJudgment}
        onContinue={onComplete}
        saving={pending}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onExit}
            aria-label="返回"
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <div>
            <p className="text-xs font-medium text-muted-foreground">第 {post.week} 週 · 分析貼文</p>
            <p className="text-sm font-bold text-card-foreground">與 AI 一起思考</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5 lg:flex-row lg:items-start">
        {/* Left: Instagram post (fixed on desktop) */}
        <div className="lg:sticky lg:top-20 lg:w-2/5 lg:shrink-0">
          <InstagramPost post={post} />
        </div>

        {/* Right: chat */}
        <div className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:h-[calc(100vh-7rem)]">
          <StageProgress activeStage={activeStage} />

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} text={m.text} />
            ))}

            {chatDone ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-5 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-success text-success-foreground">
                  <Check className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-bold text-card-foreground">思考完成！</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  你已經從不同角度分析過這則貼文，現在換你做出判斷。
                </p>
                <Button
                  onClick={() => setShowJudgment(true)}
                  className="h-11 rounded-xl bg-primary px-6 font-bold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98]"
                >
                  做出我的判斷
                </Button>
              </div>
            ) : null}
          </div>

          {!chatDone ? (
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-border bg-card p-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="輸入你的想法…"
                className="h-12 rounded-xl text-base"
                aria-label="輸入你的想法"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                aria-label="送出"
                className="size-12 shrink-0 rounded-xl bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95 disabled:opacity-40"
              >
                <Send className="size-5" aria-hidden="true" />
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function StageProgress({ activeStage }: { activeStage: number }) {
  return (
    <div className="border-b border-border bg-card px-4 py-4">
      <ol className="flex items-center">
        {STAGE_LABELS.map((label, i) => {
          const done = i < activeStage
          const current = i === activeStage
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={[
                    "flex size-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    done
                      ? "bg-success text-success-foreground"
                      : current
                        ? "bg-primary text-primary-foreground ring-4 ring-secondary"
                        : "bg-muted text-locked",
                  ].join(" ")}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={[
                    "whitespace-nowrap text-xs font-semibold",
                    done || current ? "text-card-foreground" : "text-locked",
                  ].join(" ")}
                >
                  {label}
                </span>
              </div>
              {i < STAGE_LABELS.length - 1 ? (
                <span
                  className={[
                    "mx-1 h-0.5 flex-1 rounded-full transition-colors sm:mx-2",
                    done ? "bg-success" : "bg-muted",
                  ].join(" ")}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ChatBubble({ role, text }: { role: "ai" | "user"; text: string }) {
  if (role === "ai") {
    return (
      <div className="flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
          <p className="text-sm leading-relaxed text-card-foreground">{text}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5">
        <p className="text-sm leading-relaxed text-primary-foreground">{text}</p>
      </div>
    </div>
  )
}
