"use client"

import Image from "next/image"
import { Check, Lock, ChevronRight, LogOut, Trophy } from "lucide-react"
import {
  POSTS_PER_WEEK,
  TOTAL_WEEKS,
  getPostsByWeek,
  type Post,
} from "@/lib/study-data"
import { Button } from "@/components/ui/button"

type Props = {
  studentId: string
  currentWeek: number
  completedIds: Set<string>
  onOpenPost: (post: Post) => void
  onLogout: () => void
}

type TileState = "completed" | "current" | "locked"

export function ProgressScreen({
  studentId,
  currentWeek,
  completedIds,
  onOpenPost,
  onLogout,
}: Props) {
  const weekPosts = getPostsByWeek(currentWeek)
  const completedThisWeek = weekPosts.filter((p) => completedIds.has(p.id)).length

  // Determine the first incomplete post of the week (the "current" one).
  const currentPostId = weekPosts.find((p) => !completedIds.has(p.id))?.id ?? null

  function tileState(post: Post, index: number): TileState {
    if (completedIds.has(post.id)) return "completed"
    if (post.id === currentPostId) return "current"
    // A later post is locked until the earlier one in the week is done.
    const earlierDone = index === 0 || completedIds.has(weekPosts[index - 1].id)
    return earlierDone ? "current" : "locked"
  }

  const encouragement =
    completedThisWeek === 0
      ? "新的一週開始了，一起來分析第一則貼文吧！"
      : completedThisWeek < POSTS_PER_WEEK
        ? "做得很好，再完成一則就達成本週目標了！"
        : "太棒了！你已完成本週所有貼文，下週見！"

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">媒體素養訓練系統</p>
            <p className="text-sm font-bold text-card-foreground">學號：{studentId}</p>
          </div>
          <Button
            variant="ghost"
            onClick={onLogout}
            className="h-9 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            登出
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Week heading + progress */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-2xl font-extrabold text-card-foreground">第 {currentWeek} 週</h1>
            <p className="text-sm font-bold text-primary">
              本週進度：{completedThisWeek} / {POSTS_PER_WEEK} 則完成
            </p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all duration-500"
              style={{ width: `${(completedThisWeek / POSTS_PER_WEEK) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{encouragement}</p>
        </section>

        {/* Post tiles */}
        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {weekPosts.map((post, i) => (
            <PostTile
              key={post.id}
              post={post}
              state={tileState(post, i)}
              onOpen={() => onOpenPost(post)}
            />
          ))}
        </section>

        {/* Overall progress across weeks */}
        <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-card-foreground">
            <Trophy className="size-4 text-primary" aria-hidden="true" />
            總體進度
          </h2>
          <ol className="mt-4 flex items-center justify-between gap-2">
            {Array.from({ length: TOTAL_WEEKS }, (_, idx) => {
              const week = idx + 1
              const posts = getPostsByWeek(week)
              const allDone = posts.every((p) => completedIds.has(p.id))
              const isCurrent = week === currentWeek && !allDone
              const state: TileState = allDone ? "completed" : isCurrent ? "current" : "locked"
              return (
                <li key={week} className="flex flex-1 flex-col items-center gap-2">
                  <span
                    className={[
                      "flex size-10 items-center justify-center rounded-full text-sm font-bold",
                      state === "completed"
                        ? "bg-success text-success-foreground"
                        : state === "current"
                          ? "bg-primary text-primary-foreground ring-4 ring-secondary"
                          : "bg-muted text-locked",
                    ].join(" ")}
                  >
                    {state === "completed" ? (
                      <Check className="size-5" aria-hidden="true" />
                    ) : state === "locked" ? (
                      <Lock className="size-4" aria-hidden="true" />
                    ) : (
                      week
                    )}
                  </span>
                  <span
                    className={[
                      "text-xs font-medium",
                      state === "locked" ? "text-locked" : "text-card-foreground",
                    ].join(" ")}
                  >
                    第 {week} 週
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </main>
  )
}

function PostTile({
  post,
  state,
  onOpen,
}: {
  post: Post
  state: TileState
  onOpen: () => void
}) {
  const locked = state === "locked"

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={locked}
      aria-label={`第 ${post.week} 週 貼文：${post.username}`}
      className={[
        "group flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-all",
        locked
          ? "cursor-not-allowed border-border opacity-60"
          : "border-border hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
        state === "current" ? "border-primary ring-2 ring-primary/30" : "",
      ].join(" ")}
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
        <Image
          src={post.image || "/placeholder.svg"}
          alt=""
          fill
          sizes="64px"
          className={locked ? "object-cover grayscale" : "object-cover"}
        />
        {locked ? (
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/30">
            <Lock className="size-5 text-white" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-card-foreground">{post.username}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {post.caption}
        </p>
        <span
          className={[
            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
            state === "completed"
              ? "bg-success/15 text-success"
              : state === "current"
                ? "bg-primary/15 text-primary"
                : "bg-muted text-locked",
          ].join(" ")}
        >
          {state === "completed" ? (
            <>
              <Check className="size-3" aria-hidden="true" /> 已完成
            </>
          ) : state === "current" ? (
            <>
              開始分析 <ChevronRight className="size-3" aria-hidden="true" />
            </>
          ) : (
            <>
              <Lock className="size-3" aria-hidden="true" /> 未解鎖
            </>
          )}
        </span>
      </div>
    </button>
  )
}
