"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, ImageIcon, LoaderCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import {
  readExperimentSession,
  toTokyoIsoString,
  updateExperimentTaskOrder,
  writeExperimentSession,
} from "@/lib/experiment-session"
import {
  clearTaskMetrics,
  setCurrentTaskType,
} from "@/lib/task-metrics"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? ""

const getInsectImageUrl = (fileName: string) =>
  `${API_BASE_URL}/api/insects/${encodeURIComponent(fileName)}`

export default function UploadPage() {
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [insectImages, setInsectImages] = useState<string[]>([])
  const [isLoadingImages, setIsLoadingImages] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadInsectImages = async () => {
      setIsLoadingImages(true)
      setLoadError(null)

      try {
        const experimentSession = readExperimentSession()
        if (
          !experimentSession ||
          experimentSession.status === "starting"
        ) {
          router.replace("/")
          return
        }
        if (!experimentSession.tutorialCompleted) {
          router.replace("/tutorial")
          return
        }

        if (!API_BASE_URL) {
          throw new Error("API URL is not configured")
        }

        const response = await fetch(`${API_BASE_URL}/api/insects`, {
          cache: "no-store",
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error("Invalid response")

        const fileNames = data.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )

        if (cancelled) return
        setInsectImages(fileNames)
        const taskOrder = fileNames.map((fileName) =>
          fileName.replace(/\.[^.]+$/, ""),
        )
        updateExperimentTaskOrder(taskOrder)

        const savedIndex = Number.parseInt(
          sessionStorage.getItem("currentSampleIndex") || "0",
          10,
        )
        const safeIndex = Number.isFinite(savedIndex) && savedIndex >= 0 ? savedIndex : 0

        if (fileNames.length > 0 && safeIndex >= fileNames.length) {
          const latestSession = readExperimentSession()
          if (!latestSession) {
            router.replace("/")
            return
          }

          const completionEventId =
            latestSession.completionEventId ?? crypto.randomUUID()
          const completionEndedAt =
            latestSession.completionEndedAt ?? toTokyoIsoString()
          const completingSession = {
            ...latestSession,
            status: "completing" as const,
            taskOrder,
            completionEventId,
            completionEndedAt,
          }
          writeExperimentSession(completingSession)

          const completionResponse = await fetch(
            `${API_BASE_URL}/api/experiment/session/complete`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                participant_id: completingSession.participantId,
                session_id: completingSession.sessionId,
                event_id: completionEventId,
                started_at: completingSession.startedAt,
                ended_at: completionEndedAt,
                completed_task_count: fileNames.length,
                task_order: taskOrder,
                client: completingSession.client,
              }),
            },
          )
          const completionData = await completionResponse
            .json()
            .catch(() => ({}))

          if (!completionResponse.ok) {
            const detail =
              typeof completionData.detail === "string"
                ? completionData.detail
                : "Session completion failed"
            throw new Error(`SESSION_COMPLETE:${detail}`)
          }

          alert("すべての じっけんが おわりました！よくがんばったね！")
          sessionStorage.clear()
          router.replace("/")
          return
        }

        setCurrentIndex(safeIndex)
        sessionStorage.setItem("currentSampleIndex", safeIndex.toString())
      } catch (error) {
        console.error("Failed to load insect list:", error)
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : ""
          setLoadError(
            message.startsWith("SESSION_COMPLETE:")
              ? "実験記録を保存できませんでした。通信を確認して、もう一度よみこんでください。"
              : "こんちゅうの しゃしんを よみこめませんでした。",
          )
        }
      } finally {
        if (!cancelled) setIsLoadingImages(false)
      }
    }

    loadInsectImages()
    return () => {
      cancelled = true
    }
  }, [router])

  const handleSampleSelect = async (fileName: string, index: number) => {
    if (index !== currentIndex) return

    try {
      setLoadError(null)
      const response = await fetch(getInsectImageUrl(fileName), { cache: "no-store" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onload = (e) => {
        clearTaskMetrics()
        setCurrentTaskType("experiment")
        setSelectedImage(e.target?.result as string)
        setCurrentIndex(index)
        sessionStorage.setItem("currentSampleIndex", index.toString())
        sessionStorage.setItem("imageName", fileName)
      }
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error("Failed to load sample image:", error)
      setLoadError("えらんだ しゃしんを よみこめませんでした。")
    }
  }

  const handleProcess = async () => {
    if (selectedImage) {
      setIsProcessing(true)
      sessionStorage.setItem("insectImage", selectedImage)
      router.push("/processing")
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="bg-primary text-primary-foreground py-3 px-4 md:px-6 flex items-center gap-3 md:gap-4 flex-shrink-0">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg md:text-xl font-bold">
          しゃしんをえらぶ
          {insectImages.length > 0 && ` (${currentIndex + 1} / ${insectImages.length})`}
        </h1>
      </header>

      <main className="flex-1 min-h-0 p-3 md:p-4 flex flex-col items-center justify-center gap-3 md:gap-4 overflow-y-auto">

        {isLoadingImages && (
          <Card className="flex w-full max-w-xl flex-col items-center gap-3 p-8 text-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
            <p className="font-bold">こんちゅうの しゃしんを よみこみ中...</p>
          </Card>
        )}

        {!isLoadingImages && loadError && (
          <Card className="flex w-full max-w-xl flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="font-bold text-red-700">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              もういちど よみこむ
            </Button>
          </Card>
        )}

        {!isLoadingImages && !loadError && insectImages.length === 0 && (
          <Card className="w-full max-w-xl p-8 text-center">
            <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-bold">えらべる こんちゅうが まだありません。</p>
          </Card>
        )}

        {!isLoadingImages && !loadError && !selectedImage && insectImages.length > 0 && (
          <Card className="w-full max-w-5xl p-4 md:p-6 space-y-4">
            <div className="space-y-4 text-center">
              <p className="text-base md:text-lg font-bold text-gray-700">
                <ImageIcon className="w-5 h-5 inline-block mr-2 mb-1 text-primary" />
                しらべたい こんちゅうを えらぼう！
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {insectImages.map((fileName, index) => (
                  <button
                    key={fileName}
                    type="button"
                    onClick={() => handleSampleSelect(fileName, index)}
                    disabled={index !== currentIndex}
                    aria-label={
                      index === currentIndex
                        ? `こんちゅう ${index + 1} をえらぶ`
                        : `こんちゅう ${index + 1} はまだえらべません`
                    }
                    className={`group flex min-h-40 flex-col overflow-hidden rounded-xl border-4 bg-white shadow-sm transition focus:outline-none focus:ring-4 focus:ring-primary/40 ${
                      index === currentIndex
                        ? "border-primary hover:scale-[1.02] hover:shadow-md"
                        : "cursor-not-allowed border-gray-200 opacity-35 grayscale"
                    }`}
                  >
                    <span className="flex min-h-32 w-full flex-1 items-center justify-center bg-muted/30 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getInsectImageUrl(fileName)}
                        alt={`こんちゅう ${index + 1}`}
                        className="h-32 w-full object-contain"
                        loading="lazy"
                      />
                    </span>
                    <span className="w-full border-t bg-white px-2 py-2 text-center text-sm font-bold text-gray-700">
                      こんちゅう {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* 画像が選ばれた後の画面 */}
        {selectedImage && (
          <Card className="w-full max-w-4xl p-3 md:p-4 space-y-3 flex-shrink-0" style={{ maxHeight: "calc(100vh - 140px)" }}>
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <img src={selectedImage} alt="Selected insect" className="w-full h-full object-contain" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                variant="outline"
                className="h-12 md:h-14 text-sm md:text-base font-bold bg-transparent"
                onClick={() => setSelectedImage(null)}
                disabled={isProcessing}
              >
                もどる
              </Button>
              <Button
                size="lg"
                className="h-12 md:h-14 text-base md:text-lg font-bold bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg transform transition-all hover:scale-105"
                onClick={handleProcess}
                disabled={isProcessing}
              >
                {isProcessing ? "しょりちゅう..." : "つぎへ"}
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
