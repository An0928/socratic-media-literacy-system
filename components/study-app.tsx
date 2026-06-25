"use client"

import { useEffect, useMemo, useState } from "react"
import type { StudentState } from "@/app/actions"
import {
  completeWelcome,
  getPostByIdAction,
  getPostsByWeekAction,
  getStudentState,
  logout,
} from "@/app/actions"
import { TOTAL_WEEKS } from "@/lib/study-content"
import type { Post } from "@/lib/study-data"
import { LoginScreen } from "@/components/screens/login-screen"
import { WelcomeScreen } from "@/components/screens/welcome-screen"
import { ProgressScreen } from "@/components/screens/progress-screen"
import { AnalysisScreen } from "@/components/screens/analysis-screen"

type Screen = "welcome" | "progress" | "analysis"

export function StudyApp({ initialState }: { initialState: StudentState | null }) {
  const [state, setState] = useState<StudentState | null>(initialState)
  const [screen, setScreen] = useState<Screen>(
    initialState && !initialState.hasSeenWelcome ? "welcome" : "progress",
  )
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [activePost, setActivePost] = useState<Post | null>(null)
  const [postsByWeek, setPostsByWeek] = useState<Record<number, Post[]>>({})

  const completedIds = useMemo(
    () => new Set(state?.submissions.map((s) => s.postId) ?? []),
    [state],
  )

  useEffect(() => {
    let ignore = false

    async function loadPosts() {
      const loaded = await Promise.all(
        Array.from({ length: TOTAL_WEEKS }, (_, index) => getPostsByWeekAction(index + 1)),
      )

      if (ignore) return

      const nextMap = Object.fromEntries(
        loaded.map((posts, index) => [index + 1, posts]),
      ) as Record<number, Post[]>
      setPostsByWeek(nextMap)
    }

    loadPosts()
    return () => {
      ignore = true
    }
  }, [completedIds])

  const currentWeek = useMemo(() => {
    for (let week = 1; week <= TOTAL_WEEKS; week++) {
      const posts = postsByWeek[week] ?? []
      if (posts.some((post) => !completedIds.has(post.id))) return week
    }
    return TOTAL_WEEKS
  }, [completedIds, postsByWeek])

  useEffect(() => {
    if (screen !== "analysis" || !activePostId) {
      setActivePost(null)
      return
    }

    let ignore = false

    async function loadActivePost() {
      const post = await getPostByIdAction(activePostId)
      if (!ignore) setActivePost(post)
    }

    loadActivePost()
    return () => {
      ignore = true
    }
  }, [activePostId, screen])

  async function refresh() {
    const next = await getStudentState()
    setState(next)
  }

  function handleLoggedIn(next: StudentState) {
    setState(next)
    setScreen(next.hasSeenWelcome ? "progress" : "welcome")
  }

  async function handleWelcomeDone() {
    await completeWelcome()
    setState((prev) => (prev ? { ...prev, hasSeenWelcome: true } : prev))
    setScreen("progress")
  }

  function openPost(post: Post) {
    setActivePost(post)
    setActivePostId(post.id)
    setScreen("analysis")
  }

  async function handleAnalysisComplete() {
    await refresh()
    setActivePost(null)
    setActivePostId(null)
    setScreen("progress")
  }

  async function handleLogout() {
    await logout()
    setState(null)
    setScreen("progress")
    setActivePost(null)
    setActivePostId(null)
  }

  if (!state) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />
  }

  if (screen === "welcome") {
    return <WelcomeScreen onStart={handleWelcomeDone} />
  }

  if (screen === "analysis" && activePostId) {
    if (!activePost) {
      return <div className="flex min-h-screen items-center justify-center">載入中…</div>
    }

    return (
      <AnalysisScreen
        post={activePost}
        existing={state.submissions.find((submission) => submission.postId === activePostId)}
        onComplete={handleAnalysisComplete}
        onExit={() => {
          setActivePost(null)
          setActivePostId(null)
          setScreen("progress")
        }}
      />
    )
  }

  return (
    <ProgressScreen
      studentId={state.studentId}
      currentWeek={currentWeek}
      completedIds={completedIds}
      onOpenPost={openPost}
      onLogout={handleLogout}
    />
  )
}
