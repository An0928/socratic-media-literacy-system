"use client"

import { useState, useTransition } from "react"
import { ShieldCheck, Search } from "lucide-react"
import { login, type StudentState } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (state: StudentState) => void }) {
  const [studentId, setStudentId] = useState("")
  const [groupCode, setGroupCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const normalizedGroupCode = groupCode.trim().toUpperCase()
    if (normalizedGroupCode !== "A" && normalizedGroupCode !== "B") {
      setError("請輸入有效的組別（A 或 B）")
      return
    }

    startTransition(async () => {
      const res = await login(studentId, normalizedGroupCode)
      if (!res.ok || !res.state) {
        setError(res.error ?? "登入失敗，請再試一次")
        return
      }
      onLoggedIn(res.state)
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-5 flex size-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-md">
              <ShieldCheck className="size-10" aria-hidden="true" />
              <span className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full bg-success text-success-foreground ring-4 ring-card">
                <Search className="size-4" aria-hidden="true" />
              </span>
            </div>
            <h1 className="text-pretty text-2xl font-extrabold text-card-foreground">
              媒體素養訓練系統
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">請輸入你的學號以開始</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="studentId" className="text-sm font-semibold text-card-foreground">
                學號
              </label>
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="例如：S1130123"
                autoComplete="off"
                inputMode="text"
                className="h-12 rounded-xl text-base"
                aria-invalid={Boolean(error)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="groupCode" className="text-sm font-semibold text-card-foreground">
                組別
              </label>
              <Input
                id="groupCode"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                placeholder="A 或 B"
                autoComplete="off"
                inputMode="text"
                className="h-12 rounded-xl text-base"
                aria-invalid={Boolean(error)}
              />
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <Button
              type="submit"
              disabled={pending || !studentId.trim() || !groupCode.trim()}
              className="h-12 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 active:scale-[0.98]"
            >
              {pending ? "登入中…" : "開始"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          本系統為媒體素養研究之用，不需要密碼。
          <br />
          你的學號僅用於記錄學習進度。
        </p>
      </div>
    </main>
  )
}
