"use client"

import { useMemo, useState } from "react"
import type { StudentState } from "@/app/actions"
import { completeWelcome, getStudentState, logout } from "@/app/actions"
import { POSTS, TOTAL_WEEKS, getPostsByWeek, type Post } from "@/lib/study-data"
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

  const completedIds = useMemo(
    () => new Set(state?.submissions.map((s) => s.postId) ?? []),
    [state],
  )

  // The current week is the earliest week that still has an incomplete post.
  const currentWeek = useMemo(() => {
    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      const posts = getPostsByWeek(w)
      if (posts.some((p) => !completedIds.has(p.id))) return w
    }
    return TOTAL_WEEKS
  }, [completedIds])

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
    setActivePostId(post.id)
    setScreen("analysis")
  }

  async function handleAnalysisComplete() {
    await refresh()
    setActivePostId(null)
    setScreen("progress")
  }

  async function handleLogout() {
    await logout()
    setState(null)
    setScreen("progress")
    setActivePostId(null)
  }

  if (!state) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />
  }

  if (screen === "welcome") {
    return <WelcomeScreen onStart={handleWelcomeDone} />
  }

  if (screen === "analysis" && activePostId) {
    const post = POSTS.find((p) => p.id === activePostId)!
    return (
      <AnalysisScreen
        post={post}
        existing={state.submissions.find((s) => s.postId === activePostId)}
        onComplete={handleAnalysisComplete}
        onExit={() => {
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
