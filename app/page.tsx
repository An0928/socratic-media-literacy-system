import { getStudentState } from "./actions"
import { StudyApp } from "@/components/study-app"

export default async function Page() {
  const initialState = await getStudentState()
  return <StudyApp initialState={initialState} />
}
