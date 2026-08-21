"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  createExperimentSession,
  readExperimentSession,
  validateParticipantId,
  writeExperimentSession,
} from "@/lib/experiment-session"

export default function HomePage() {
  const router = useRouter()
  const [participantId, setParticipantId] = useState("")
  const [inputError, setInputError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    const existingSession = readExperimentSession()
    if (
      existingSession?.status === "active" ||
      existingSession?.status === "completing"
    ) {
      router.replace(
        existingSession.tutorialCompleted ? "/upload" : "/tutorial",
      )
    }
  }, [router])

  const handleExperimentStart = async () => {
    if (isStarting) return

    const validationError = validateParticipantId(participantId)
    if (validationError) {
      setInputError(validationError)
      return
    }

    setIsStarting(true)
    setInputError(null)

    try {
      const normalizedParticipantId = participantId.trim()
      const pendingSession = readExperimentSession()
      const session =
        pendingSession?.status === "starting" &&
        pendingSession.participantId === normalizedParticipantId
          ? pendingSession
          : createExperimentSession(normalizedParticipantId)

      if (session !== pendingSession) {
        sessionStorage.clear()
      }
      writeExperimentSession(session)

      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? ""
      if (!apiBaseUrl) {
        throw new Error("API URL is not configured")
      }

      const response = await fetch(
        `${apiBaseUrl}/api/experiment/session/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participant_id: session.participantId,
            session_id: session.sessionId,
            event_id: session.startEventId,
            started_at: session.startedAt,
            client: session.client,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "セッションを開始できませんでした。",
        )
      }

      writeExperimentSession({
        ...session,
        status: "active",
      })
      router.push("/tutorial")
    } catch (error) {
      console.error("Failed to start experiment session:", error)
      setInputError(
        "実験記録を開始できませんでした。通信を確認して、もう一度押してください。",
      )
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-3 px-4 md:px-6 flex-shrink-0">
        <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-center text-balance">
          こんちゅうのからだをしらべよう！
        </h1>
      </header>

      {/* Main Content - scrollable if needed on very small screens */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 md:p-6 gap-4 md:gap-6 overflow-y-auto">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl flex-shrink-0">
          <div className="w-24 h-24 md:w-32 md:h-32 mx-auto bg-secondary rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 md:w-16 md:h-16 text-secondary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-base md:text-lg lg:text-xl font-bold text-pretty px-2">
            こんちゅうのしゃしんをとって、からだのつくりをべんきょうしよう！
          </h2>
        </div>

        {/* Action Card */}
        <Card className="w-full max-w-md p-4 md:p-6 space-y-4 flex-shrink-0">
          <div className="space-y-2">
            <label
              htmlFor="participant-id"
              className="block text-sm font-bold text-foreground"
            >
              実験協力者ID
            </label>
            <input
              id="participant-id"
              type="text"
              value={participantId}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setParticipantId(event.target.value)
                if (inputError) setInputError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleExperimentStart()
                }
              }}
              aria-invalid={Boolean(inputError)}
              aria-describedby="participant-id-note participant-id-error"
              className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-base font-bold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              placeholder="例：P001"
              disabled={isStarting}
            />
            <p
              id="participant-id-note"
              className="text-xs leading-relaxed text-muted-foreground"
            >
              実験者から指定された匿名IDを入力してください。
              <br />
              氏名やメールアドレスは入力しないでください。
            </p>
            {inputError && (
              <p
                id="participant-id-error"
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
              >
                {inputError}
              </p>
            )}
          </div>

          <Button
            size="lg"
            className="w-full h-14 md:h-16 text-base md:text-lg font-bold"
            onClick={() => void handleExperimentStart()}
            disabled={isStarting}
          >
            {isStarting ? "きろくを じゅんび中..." : "実験を開始する"}
          </Button>

          {/* Info Cards */}
          <div className="grid gap-2 pt-3 border-t">
            <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm">
                1
              </div>
              <p className="text-xs md:text-sm leading-relaxed pt-1">こんちゅうのしゃしんをえらぶ</p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm">
                2
              </div>
              <p className="text-xs md:text-sm leading-relaxed pt-1">AIがこんちゅうのかたちをみつける</p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm">
                3
              </div>
              <p className="text-xs md:text-sm leading-relaxed pt-1">ブラシでかたちをなおす</p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm">
                4
              </div>
              <p className="text-xs md:text-sm leading-relaxed pt-1">あたま・むね・はらのばしょがわかる！</p>
            </div>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-2 px-4 text-center text-xs text-muted-foreground flex-shrink-0">
        こんちゅうがくしゅうアプリ
      </footer>
    </div>
  )
}
