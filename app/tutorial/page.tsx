"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  BoxSelect,
  Brush,
  LoaderCircle,
  MousePointer2,
  RefreshCw,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { readExperimentSession } from "@/lib/experiment-session"
import {
  clearTaskMetrics,
  setCurrentTaskType,
} from "@/lib/task-metrics"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? ""

const getTutorialImageUrl = (fileName: string) =>
  `${API_BASE_URL}/api/tutorial/insects/${encodeURIComponent(fileName)}`

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Invalid image data"))
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"))
    reader.readAsDataURL(blob)
  })

export default function TutorialPage() {
  const router = useRouter()
  const [tutorialImage, setTutorialImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    const loadTutorial = async () => {
      const session = readExperimentSession()
      if (!session || session.status !== "active") {
        router.replace("/")
        return
      }
      if (session.tutorialCompleted) {
        router.replace("/upload")
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        if (!API_BASE_URL) throw new Error("API URL is not configured")
        const response = await fetch(`${API_BASE_URL}/api/tutorial/insects`, {
          cache: "no-store",
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error("Invalid response")
        const fileName = data.find(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
        if (!fileName) throw new Error("No tutorial image")
        if (!cancelled) setTutorialImage(fileName)
      } catch (loadError) {
        console.error("Failed to load tutorial:", loadError)
        if (!cancelled) {
          setError("れんしゅうの しゃしんを よみこめませんでした。")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadTutorial()
    return () => {
      cancelled = true
    }
  }, [reloadKey, router])

  const handleStartTutorial = async () => {
    if (!tutorialImage || isStarting) return
    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch(getTutorialImageUrl(tutorialImage), {
        cache: "no-store",
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const imageData = await readBlobAsDataUrl(await response.blob())

      clearTaskMetrics()
      setCurrentTaskType("tutorial")
      sessionStorage.setItem("currentSampleIndex", "0")
      sessionStorage.setItem("imageName", tutorialImage)
      sessionStorage.setItem("insectImage", imageData)
      sessionStorage.removeItem("segmentedImage")
      sessionStorage.removeItem("editedMask")
      sessionStorage.removeItem("thoraxTop")
      sessionStorage.removeItem("thoraxBottom")
      router.push("/processing")
    } catch (startError) {
      console.error("Failed to start tutorial:", startError)
      setError("れんしゅうを はじめられませんでした。")
      setIsStarting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex-shrink-0 bg-primary px-4 py-3 text-primary-foreground md:px-6">
        <h1 className="text-center text-lg font-bold md:text-xl">
          まずは れんしゅうしよう！
        </h1>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-3 md:p-5">
        <Card className="grid w-full max-w-5xl gap-4 p-4 md:grid-cols-[minmax(240px,0.9fr)_minmax(360px,1.25fr)] md:p-6">
          <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-3">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 font-bold text-emerald-800">
                <LoaderCircle className="h-10 w-10 animate-spin" />
                よみこみ中...
              </div>
            ) : tutorialImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getTutorialImageUrl(tutorialImage)}
                alt="れんしゅうにつかうこんちゅう"
                className="max-h-[48vh] max-w-full object-contain"
              />
            ) : (
              <AlertCircle className="h-12 w-12 text-red-500" />
            )}
          </div>

          <div className="flex flex-col justify-center gap-3">
            <div>
              <h2 className="text-xl font-bold md:text-2xl">
                ぬりかたと、かいせつの見かたをためそう
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                れんしゅうの記録は、3つの本番のこんちゅうには入りません。
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-blue-50 p-3">
                <MousePointer2 className="mb-1 h-5 w-5 text-blue-600" />
                <p className="text-sm font-bold">タッチでおまかせ</p>
                <p className="text-xs text-gray-600">なおしたい場所をタッチ</p>
              </div>
              <div className="rounded-xl bg-violet-50 p-3">
                <BoxSelect className="mb-1 h-5 w-5 text-violet-600" />
                <p className="text-sm font-bold">かこんでおまかせ</p>
                <p className="text-xs text-gray-600">四角でかこんでなおす</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <Brush className="mb-1 h-5 w-5 text-amber-600" />
                <p className="text-sm font-bold">じぶんでなおす</p>
                <p className="text-xs text-gray-600">ペンとけしゴムでなおす</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <Users className="mb-1 h-5 w-5 text-emerald-600" />
                <p className="text-sm font-bold">いろとからだをかんさつ</p>
                <p className="text-xs text-gray-600">おともだちの色と解説を見る</p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"
              >
                <span>{error}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setReloadKey((value) => value + 1)}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  もういちど
                </Button>
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="h-14 bg-gradient-to-r from-green-500 to-blue-500 text-base font-bold text-white"
              disabled={!tutorialImage || isLoading || isStarting}
              onClick={() => void handleStartTutorial()}
            >
              {isStarting ? "じゅんび中..." : "れんしゅうを はじめる →"}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  )
}
