"use client"

import { useState } from "react"
import { Check, X, HelpCircle, ArrowRight, PartyPopper } from "lucide-react"
import type { Judgment } from "@/lib/db"
import { Button } from "@/components/ui/button"

type Props = {
  onSelect: (judgment: Judgment) => void
  onContinue: () => void
  saving: boolean
}

const OPTIONS: {
  value: Judgment
  label: string
  icon: typeof Check
  classes: string
}[] = [
  {
    value: "real",
    label: "我認為這是真實的",
    icon: Check,
    classes: "border-success bg-success/10 text-success hover:bg-success/15",
  },
  {
    value: "fake",
    label: "我認為這是假的或誤導性的",
    icon: X,
    classes: "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/15",
  },
  {
    value: "unsure",
    label: "我無法判斷",
    icon: HelpCircle,
    classes: "border-border bg-muted text-muted-foreground hover:bg-muted/70",
  },
]

export function JudgmentScreen({ onSelect, onContinue, saving }: Props) {
  const [selected, setSelected] = useState<Judgment | null>(null)

  function choose(value: Judgment) {
    if (selected) return
    setSelected(value)
    onSelect(value)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg">
          {!selected ? (
            <>
              <h1 className="text-balance text-center text-2xl font-extrabold text-card-foreground">
                根據你的思考，你的判斷是？
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                選擇最符合你想法的選項，沒有標準答案。
              </p>
              <div className="mt-8 flex flex-col gap-3">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => choose(opt.value)}
                    className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left text-base font-bold transition-all hover:-translate-y-0.5 active:scale-[0.99] ${opt.classes}`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card">
                      <opt.icon className="size-5" aria-hidden="true" />
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center text-center">
              <span className="flex size-20 animate-in zoom-in-50 items-center justify-center rounded-full bg-success text-success-foreground shadow-md duration-500">
                <Check className="size-10" aria-hidden="true" strokeWidth={3} />
              </span>
              <h2 className="mt-6 flex items-center gap-2 text-2xl font-extrabold text-card-foreground">
                <PartyPopper className="size-6 text-primary" aria-hidden="true" />
                本則完成！
              </h2>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                謝謝你認真思考。每一次練習，都讓你更能看穿網路資訊的真假。
              </p>
              <Button
                onClick={onContinue}
                disabled={saving}
                className="mt-8 h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 active:scale-[0.98]"
              >
                {saving ? (
                  "儲存中…"
                ) : (
                  <span className="flex items-center gap-1.5">
                    繼續下一則 <ArrowRight className="size-5" aria-hidden="true" />
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
