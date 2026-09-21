"use client"

import { useTransition } from "react"
import { ImageIcon, MessagesSquare, Gavel, Sparkles, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"

function getSteps(language: "zh" | "en") {
  if (language === "en") {
    return [
      {
        icon: ImageIcon,
        title: "Read the Instagram Post",
        desc: "Carefully look at the post's content and image.",
        color: "#ec4899",
      },
      {
        icon: MessagesSquare,
        title: "Discuss with AI to think about the post",
        desc: "The AI will guide you step by step with questions.",
        color: "#3b82f6",
      },
      {
        icon: Gavel,
        title: "Make Your Final Judgment",
        desc: "Based on your thinking, decide if this post is credible.",
        color: "#22c55e",
      },
    ]
  }

  return [
    {
      icon: ImageIcon,
      title: "閱讀 Instagram 貼文",
      desc: "仔細看看貼文的內容與圖片。",
      color: "#ec4899",
    },
    {
      icon: MessagesSquare,
      title: "與 AI 對話，思考貼文內容",
      desc: "AI 會引導你一步步分析、提出問題。",
      color: "#3b82f6",
    },
    {
      icon: Gavel,
      title: "做出你的最終判斷",
      desc: "根據你的思考，判斷這則貼文是否可信。",
      color: "#22c55e",
    },
  ]
}

export function WelcomeScreen({ onStart, language = "zh" }: { onStart: () => void; language?: "zh" | "en" }) {
  const [pending, startTransition] = useTransition()
  const steps = getSteps(language)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Sparkles className="size-8" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-pretty text-2xl font-extrabold text-card-foreground">
              {language === "en" ? "Welcome to This Study!" : "歡迎參加本研究！"}
            </h1>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              {language === "en"
                ? "You'll see some social media posts. Don't worry, this isn't a test - just think through the steps."
                : "接下來你會看到一些社群貼文。別擔心，這不是考試， 只要跟著步驟一起思考就可以了。"}
            </p>
          </div>

          <ol className="mt-8 flex flex-col gap-4">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="flex items-start gap-4 rounded-2xl border border-border bg-background p-4"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: step.color }}
                >
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-card-foreground">
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground">
            <CalendarDays className="size-5 shrink-0" aria-hidden="true" />
            <span>{language === "en" ? "New posts will be ready for you to analyze each week" : "每週會有新的貼文等你分析"}</span>
          </div>

          <Button
            onClick={() => startTransition(onStart)}
            disabled={pending}
            className="mt-6 h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 active:scale-[0.98]"
          >
            {pending
              ? language === "en"
                ? "Preparing…"
                : "準備中…"
              : language === "en"
                ? "I'm Ready!"
                : "我準備好了！"}
          </Button>
        </div>
      </div>
    </main>
  )
}
