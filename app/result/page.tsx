"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles, Lightbulb, LoaderCircle } from "lucide-react"
import {
  markTutorialCompleted,
  readExperimentSession,
} from "@/lib/experiment-session"
import {
  beginResultMetrics,
  clearTaskMetrics,
  completeResultMetrics,
  getCurrentTaskType,
  incrementFriendMaskClick,
  incrementStructurePartClick,
  setCurrentTaskType,
  type BodyPartKey,
  type TaskType,
} from "@/lib/task-metrics"

type BodyPart = {
  name: string
  color: string
  description: string
  funFact: string
  targetRGB: [number, number, number]
}

const bodyParts: BodyPart[] = [
  {
    name: "あたま",
    color: "#3b82f6", // Blue
    description: "めやくち、しょっかくがあるよ",
    funFact: "こんちゅうのめは、たくさんのちいさなめがあつまってできているんだ！これを「ふくがん」っていうよ。",
    targetRGB: [31, 119, 180],
  },
  {
    name: "むね",
    color: "#22c55e", // Green
    description: "あしやはねがついているよ",
    funFact: "こんちゅうのあしは、ぜんぶで6ほん！ぜんぶむねからはえているんだよ。はねもむねについているよ。",
    targetRGB: [44, 160, 44],
  },
  {
    name: "はら",
    color: "#ef4444", // Red
    description: "しょくもつをしょうかするよ",
    funFact: "はらには、たべたものをしょうかするきかんや、たまごをつくるきかんがあるよ。",
    targetRGB: [214, 39, 40],
  },
  {
    name: "あし",
    color: "#a855f7", // Purple
    description: "むねからはえているよ",
    funFact: "こんちゅうのあしは、まえあし・なかあし・うしろあしの3つのペアにわかれているよ。",
    targetRGB: [148, 103, 189],
  },
]
const bodyPartKeys: BodyPartKey[] = [
  "head",
  "thorax",
  "abdomen",
  "legs",
]

const LEG_COLOR_RGB = [148, 103, 189]

type ResultMode = "comparison" | "structure"

type UserMask = {
  id: string
  label: string
  image_base64: string
}

type MajorityMaskResponse = {
  majority_mask_base64?: string
  collective_mask_base64?: string
  thorax_top?: number
  thorax_bottom?: number
  sample_count?: number
}

type UserMasksResponse = {
  insect_id: string
  user_masks: UserMask[]
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? ""
const toImageSource = (value: string) => value.startsWith("data:") ? value : `data:image/png;base64,${value}`

function TransparentMaskImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const transparentCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = transparentCanvasRef.current
    if (!canvas) return

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return

      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] <= 12 && pixels[index + 1] <= 12 && pixels[index + 2] <= 12) {
          pixels[index + 3] = 0
        }
      }
      ctx.putImageData(imageData, 0, 0)
    }
    image.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return <canvas ref={transparentCanvasRef} role="img" aria-label={alt} className={className} />
}

export default function ResultPage() {
  const router = useRouter()
  const selfCanvasRef = useRef<HTMLCanvasElement>(null)
  const majorityCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = majorityCanvasRef
  const renderVersionRef = useRef(0)
  const structurePartMapRef = useRef<Uint8Array | null>(null)
  const structurePartMapSizeRef = useRef({ width: 0, height: 0 })

  const [resultMode, setResultMode] = useState<ResultMode>("comparison")
  const [selectedPart, setSelectedPart] = useState<number | null>(null)
  const [quizMode, setQuizMode] = useState(false)
  const [drawnLines, setDrawnLines] = useState<number[]>([])
  const [quizResult, setQuizResult] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

  const [thoraxTop, setThoraxTop] = useState<number | null>(null)
  const [thoraxBottom, setThoraxBottom] = useState<number | null>(null)
  const [majorityMask, setMajorityMask] = useState<string | null>(null)
  const [majorityThoraxTop, setMajorityThoraxTop] = useState<number | null>(null)
  const [majorityThoraxBottom, setMajorityThoraxBottom] = useState<number | null>(null)
  const [majoritySampleCount, setMajoritySampleCount] = useState(0)
  const [isMajorityLoading, setIsMajorityLoading] = useState(true)
  const [majorityError, setMajorityError] = useState<string | null>(null)
  const [userMasks, setUserMasks] = useState<UserMask[]>([])
  const [selectedUserIndex, setSelectedUserIndex] = useState(0)
  const [isUserMasksLoading, setIsUserMasksLoading] = useState(true)
  const [userMasksError, setUserMasksError] = useState<string | null>(null)
  const [userMasksReloadKey, setUserMasksReloadKey] = useState(0)
  const [taskType, setTaskType] = useState<TaskType | null>(null)
  const [isSavingResult, setIsSavingResult] = useState(false)

  useEffect(() => {
    const currentTaskType = getCurrentTaskType()
    setTaskType(currentTaskType)
    beginResultMetrics()
  }, [])

  const handleNextInsect = async () => {
    if (isSavingResult) return
    setIsSavingResult(true)

    if (getCurrentTaskType() === "tutorial") {
      markTutorialCompleted()
      clearTaskMetrics()
      setCurrentTaskType("experiment")
      sessionStorage.removeItem("insectImage")
      sessionStorage.removeItem("imageName")
      sessionStorage.removeItem("segmentedImage")
      sessionStorage.removeItem("editedMask")
      sessionStorage.removeItem("thoraxTop")
      sessionStorage.removeItem("thoraxBottom")
      sessionStorage.setItem("currentSampleIndex", "0")
      router.replace("/upload")
      return
    }

    const experimentSession = readExperimentSession()
    const taskMetrics = completeResultMetrics()
    if (!experimentSession || !taskMetrics) {
      alert("実験記録の情報が足りません。画面をもう一度よみこんでください。")
      setIsSavingResult(false)
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/experiment/task/result`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participant_id: experimentSession.participantId,
            session_id: experimentSession.sessionId,
            session_started_at: experimentSession.startedAt,
            task_id: taskMetrics.taskId,
            task_index: taskMetrics.taskIndex,
            result_started_at: taskMetrics.resultStartedAt,
            result_completed_at: taskMetrics.resultCompletedAt,
            result_view_duration_ms: taskMetrics.resultViewDurationMs,
            friend_mask_click_counts:
              taskMetrics.friendMaskClickCounts,
            structure_part_click_counts:
              taskMetrics.structurePartClickCounts,
          }),
        },
      )
      const responseData = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          typeof responseData.detail === "string"
            ? responseData.detail
            : "Result save failed",
        )
      }
    } catch (error) {
      console.error("Failed to save result metrics:", error)
      alert("結果画面の記録を保存できませんでした。通信を確認して、もう一度押してください。")
      setIsSavingResult(false)
      return
    }

    const currentIndex = Number.parseInt(
      sessionStorage.getItem("currentSampleIndex") || "0",
      10,
    )
    sessionStorage.setItem(
      "currentSampleIndex",
      (currentIndex + 1).toString(),
    )
    clearTaskMetrics()
    router.push("/upload")
  }

  useEffect(() => {
    if (!taskType) return
    const imageName = sessionStorage.getItem("imageName")
    if (!imageName || !API_BASE_URL) {
      setMajorityError("みんなのデータを よみこめませんでした。")
      setIsMajorityLoading(false)
      return
    }

    const insectId = imageName.replace(/\.[^.]+$/, "")
    const controller = new AbortController()

    const loadMajorityMask = async () => {
      try {
        setIsMajorityLoading(true)
        setMajorityError(null)
        const apiPrefix =
          taskType === "tutorial" ? "/api/tutorial" : "/api"
        const response = await fetch(
          `${API_BASE_URL}${apiPrefix}/majority_mask?insect_id=${encodeURIComponent(insectId)}`,
          { cache: "no-store", signal: controller.signal },
        )

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as MajorityMaskResponse
        const collectiveMask = data.collective_mask_base64 ?? data.majority_mask_base64
        if (!collectiveMask) throw new Error("Mask is missing")

        setMajorityMask(toImageSource(collectiveMask))
        setMajorityThoraxTop(data.thorax_top ?? null)
        setMajorityThoraxBottom(data.thorax_bottom ?? null)
        setMajoritySampleCount(data.sample_count ?? 0)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("Failed to load majority mask:", error)
        setMajorityError("みんなのデータは まだありません。")
      } finally {
        if (!controller.signal.aborted) setIsMajorityLoading(false)
      }
    }

    loadMajorityMask()
    return () => controller.abort()
  }, [taskType])

  useEffect(() => {
    if (!taskType) return
    const imageName = sessionStorage.getItem("imageName")
    if (!imageName || !API_BASE_URL) {
      setUserMasksError("おともだちのいろを よみこめませんでした。")
      setIsUserMasksLoading(false)
      return
    }

    const insectId = imageName.replace(/\.[^.]+$/, "")
    const controller = new AbortController()

    const loadUserMasks = async () => {
      try {
        setIsUserMasksLoading(true)
        setUserMasksError(null)
        const apiPrefix =
          taskType === "tutorial" ? "/api/tutorial" : "/api"
        const response = await fetch(
          `${API_BASE_URL}${apiPrefix}/user_masks?insect_id=${encodeURIComponent(insectId)}`,
          { cache: "no-store", signal: controller.signal },
        )

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as UserMasksResponse
        const receivedMasks = Array.isArray(data.user_masks)
          ? data.user_masks
              .filter((mask) => mask && typeof mask.image_base64 === "string" && mask.image_base64.length > 0)
              .map((mask, index) => ({
                ...mask,
                id: mask.id || `user-${index + 1}`,
                label: mask.label || `おともだち ${index + 1}`,
                image_base64: toImageSource(mask.image_base64),
              }))
          : []

        setUserMasks(receivedMasks)
        setSelectedUserIndex(0)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("Failed to load user masks:", error)
        setUserMasks([])
        setUserMasksError("おともだちのいろを よみこめませんでした。")
      } finally {
        if (!controller.signal.aborted) setIsUserMasksLoading(false)
      }
    }

    loadUserMasks()
    return () => controller.abort()
  }, [taskType, userMasksReloadKey])

  useEffect(() => {
    const renderVersion = ++renderVersionRef.current
    const imageData = sessionStorage.getItem("insectImage")
    const selfMaskData = sessionStorage.getItem("editedMask")
    const storedTop = sessionStorage.getItem("thoraxTop")
    const storedBottom = sessionStorage.getItem("thoraxBottom")

    if (storedTop) setThoraxTop(Number(storedTop))
    if (storedBottom) setThoraxBottom(Number(storedBottom))

    if (!imageData) {
      router.push(
        getCurrentTaskType() === "tutorial" ? "/tutorial" : "/upload",
      )
      return
    }

    type CanvasVariant = "self" | "majority" | "quiz"

    const renderCanvas = (
      canvas: HTMLCanvasElement | null,
      maskData: string | null,
      variant: CanvasVariant,
    ) => {
      if (variant === "majority") {
        structurePartMapRef.current = null
        structurePartMapSizeRef.current = { width: 0, height: 0 }
      }
      if (!canvas) return
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return

      const img = new Image()
      img.onload = () => {
        if (renderVersion !== renderVersionRef.current) return
        canvas.width = img.width
        canvas.height = img.height
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)

        const useMajorityBoundaries = variant === "majority"
        const ratioTop = useMajorityBoundaries && majorityThoraxTop !== null
          ? majorityThoraxTop
          : storedTop ? Number(storedTop) : 0.35
        const ratioBottom = useMajorityBoundaries && majorityThoraxBottom !== null
          ? majorityThoraxBottom
          : storedBottom ? Number(storedBottom) : 0.65
        const currentThoraxTop = ratioTop * canvas.height
        const currentThoraxBottom = ratioBottom * canvas.height

        const drawFinishingElements = () => {
          if (variant === "majority" && resultMode === "structure") {
            if (selectedPart === null) {
              drawDividingLines(
                ctx,
                canvas.width,
                currentThoraxTop,
                currentThoraxBottom,
              )
            }
          } else if (variant === "quiz") {
            drawQuizLines(ctx, canvas.width)
          }
        }

        if (!maskData) {
          drawFinishingElements()
          return
        }

        const maskImg = new Image()
        maskImg.onload = () => {
          if (renderVersion !== renderVersionRef.current) return

          if (variant !== "quiz" || showHint) {
            const tempCanvas = document.createElement("canvas")
            tempCanvas.width = canvas.width
            tempCanvas.height = canvas.height
            const tempCtx = tempCanvas.getContext("2d")

            if (tempCtx) {
              tempCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height)
              const imgData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
              const data = imgData.data
              const COLOR_HEAD = [31, 119, 180]
              const COLOR_THORAX = [44, 160, 44]
              const COLOR_ABDOMEN = [214, 39, 40]
              const COLOR_LEG = [148, 103, 189]
              const PART_COLORS = [
                COLOR_HEAD,
                COLOR_THORAX,
                COLOR_ABDOMEN,
                COLOR_LEG,
              ]
              const showStructure = variant === "majority" && resultMode === "structure"
              const structurePartMap = showStructure
                ? new Uint8Array(canvas.width * canvas.height)
                : null

              for (let i = 0; i < data.length; i += 4) {
                const r = data[i]
                const g = data[i + 1]
                const b = data[i + 2]
                if (data[i + 3] === 0) continue

                const colorDistances = PART_COLORS.map(
                  ([targetR, targetG, targetB]) =>
                    Math.abs(r - targetR)
                    + Math.abs(g - targetG)
                    + Math.abs(b - targetB),
                )
                let partIndex = 0
                for (let index = 1; index < colorDistances.length; index += 1) {
                  if (colorDistances[index] < colorDistances[partIndex]) {
                    partIndex = index
                  }
                }
                const isLeg = partIndex === 3

                if (showStructure) {
                  if (structurePartMap) {
                    structurePartMap[i / 4] = partIndex + 1
                  }

                  let alpha = isLeg ? 200 : 180
                  if (selectedPart !== null) {
                    const isTarget = selectedPart === partIndex
                    alpha = isTarget ? 220 : 40
                  }
                  data[i + 3] = alpha
                } else {
                  data[i + 3] = variant === "quiz" && showHint ? 80 : 150
                }
              }

              if (showStructure && structurePartMap) {
                structurePartMapRef.current = structurePartMap
                structurePartMapSizeRef.current = {
                  width: canvas.width,
                  height: canvas.height,
                }
              }

              tempCtx.putImageData(imgData, 0, 0)
              ctx.drawImage(tempCanvas, 0, 0)
            }
          }

          drawFinishingElements()
        }
        maskImg.src = maskData
      }
      img.src = imageData
    }

    if (quizMode) {
      renderCanvas(majorityCanvasRef.current, selfMaskData, "quiz")
    } else {
      renderCanvas(selfCanvasRef.current, selfMaskData, "self")
      renderCanvas(majorityCanvasRef.current, majorityMask, "majority")
    }

    return () => {
      renderVersionRef.current += 1
    }
  }, [
    majorityMask,
    majorityThoraxBottom,
    majorityThoraxTop,
    router,
    quizMode,
    drawnLines,
    selectedPart,
    showHint,
    resultMode,
  ])

  const drawQuizLines = (ctx: CanvasRenderingContext2D, width: number) => {
    drawnLines.forEach((y) => {
      ctx.strokeStyle = "#f59e0b"
      ctx.lineWidth = 6
      ctx.setLineDash([15, 15])
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(20, y)
      ctx.lineTo(width - 20, y)
      ctx.stroke()
      ctx.setLineDash([])
    })
  }

  const drawDividingLines = (
    ctx: CanvasRenderingContext2D,
    width: number,
    tTop: number,
    tBottom: number,
  ) => {
    const headEnd = tTop
    const thoraxEnd = tBottom
    const lineStart = 15
    const lineEnd = width - 15

    const lineColor = "#fbbf24"
    const lineShadow = "rgba(0,0,0,0.2)"

    ctx.save()
    ctx.shadowColor = lineShadow
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 2

    ctx.strokeStyle = lineColor
    ctx.lineWidth = 5
    ctx.setLineDash([12, 10])
    ctx.lineCap = "round"

    ctx.beginPath()
    ctx.moveTo(lineStart, headEnd)
    ctx.lineTo(lineEnd, headEnd)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(lineStart, thoraxEnd)
    ctx.lineTo(lineEnd, thoraxEnd)
    ctx.stroke()

    ctx.setLineDash([])
    ctx.fillStyle = lineColor
    const dotSize = 6
      ;[headEnd, thoraxEnd].forEach(y => {
        ctx.beginPath(); ctx.arc(lineStart, y, dotSize, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(lineEnd, y, dotSize, 0, Math.PI * 2); ctx.fill()
      })
    ctx.restore()

    drawPartTextLabel(ctx, "あたま", bodyParts[0].color, headEnd / 2, width)
    drawPartTextLabel(ctx, "むね", bodyParts[1].color, (headEnd + thoraxEnd) / 2, width)
    drawPartTextLabel(ctx, "おなか", bodyParts[2].color, (thoraxEnd + ctx.canvas.height) / 2, width)
  }

  const drawPartTextLabel = (
    ctx: CanvasRenderingContext2D,
    text: string,
    color: string,
    centerY: number,
    width: number,
  ) => {
    ctx.save()
    ctx.font = "bold 20px 'M PLUS Rounded 1c', sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    const paddingX = 14
    const labelHeight = 36
    const labelWidth = ctx.measureText(text).width + paddingX * 2
    const labelX = width - labelWidth - 24
    const labelY = Math.max(
      4,
      Math.min(
        ctx.canvas.height - labelHeight - 4,
        centerY - labelHeight / 2,
      ),
    )

    ctx.shadowColor = "rgba(0,0,0,0.18)"
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 2
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(
      labelX,
      labelY,
      labelWidth,
      labelHeight,
      labelHeight / 2,
    )
    ctx.fill()
    ctx.stroke()

    ctx.shadowColor = "transparent"
    ctx.fillStyle = color
    ctx.fillText(
      text,
      labelX + labelWidth / 2,
      labelY + labelHeight / 2 + 1,
    )
    ctx.restore()
  }

  const selectStructurePart = (
    index: number,
    toggleWhenSelected = false,
  ) => {
    const bodyPartKey = bodyPartKeys[index]
    if (!bodyPartKey) return
    incrementStructurePartClick(bodyPartKey)
    setSelectedPart((current) =>
      toggleWhenSelected && current === index ? null : index,
    )
  }

  const handleUserMaskSelect = (index: number) => {
    const userMask = userMasks[index]
    if (!userMask) return
    setSelectedUserIndex(index)
    incrementFriendMaskClick(userMask.id)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleY = canvas.height / rect.height
    const scaleX = canvas.width / rect.width

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    if (quizMode) {
      if (drawnLines.length >= 2) return
      setDrawnLines([...drawnLines, y])
      return
    }

    if (resultMode === "structure") {
      const partMap = structurePartMapRef.current
      const mapSize = structurePartMapSizeRef.current
      const pixelX = Math.floor(x)
      const pixelY = Math.floor(y)

      if (
        !partMap
        || mapSize.width !== canvas.width
        || mapSize.height !== canvas.height
        || pixelX < 0
        || pixelY < 0
        || pixelX >= mapSize.width
        || pixelY >= mapSize.height
      ) {
        setSelectedPart(null)
        return
      }

      const partCode = partMap[pixelY * mapSize.width + pixelX]
      if (partCode >= 1 && partCode <= bodyParts.length) {
        selectStructurePart(partCode - 1)
      } else {
        setSelectedPart(null)
      }
    }
  }

  const checkQuizAnswer = () => {
    if (drawnLines.length < 2) {
      setQuizResult("せんを2ほんひいてね！")
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const sortedLines = [...drawnLines].sort((a, b) => a - b)
    const userLine1 = sortedLines[0]
    const userLine2 = sortedLines[1]

    const correctTop = thoraxTop ?? canvas.height * 0.35
    const correctBottom = thoraxBottom ?? canvas.height * 0.65

    const tolerance = canvas.height * 0.05

    const line1Correct = Math.abs(userLine1 - correctTop) < tolerance
    const line2Correct = Math.abs(userLine2 - correctBottom) < tolerance

    if (line1Correct && line2Correct) {
      setQuizResult("せいかい！とてもじょうずだね！")
    } else if (line1Correct || line2Correct) {
      setQuizResult("おしい！もういちどためしてみよう！")
    } else {
      setQuizResult("ざんねん...もういちどためしてみよう！")
    }
  }

  const startQuiz = () => {
    setResultMode("comparison")
    setQuizMode(true)
    setDrawnLines([])
    setQuizResult(null)
    setShowHint(false)
  }

  const endQuiz = () => {
    setQuizMode(false)
    setDrawnLines([])
    setQuizResult(null)
    setShowHint(false)
  }

  const resetQuiz = () => {
    setDrawnLines([])
    setQuizResult(null)
    setShowHint(false)
  }

  const handleRestart = () => {
    sessionStorage.clear()
    router.push("/")
  }

  const selectedUserMask = userMasks[selectedUserIndex] ?? null

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-green-50 to-blue-50 overflow-hidden">
      <header className="bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 px-4 flex items-center gap-3 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <h1 className="text-base md:text-lg font-bold">
            {taskType === "tutorial" ? "れんしゅう：" : ""}
            {quizMode ? "クイズにちょうせん！" : resultMode === "structure" ? "からだのつくり" : "いろをくらべよう"}
          </h1>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-2 md:p-3 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col md:flex-row gap-2 md:gap-3">
          <Card className="p-2 md:p-3 bg-white shadow-lg flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden relative">

            {!quizMode && (
              <div className="w-full flex justify-center mb-2 z-10">
                <div
                  className="bg-white/95 backdrop-blur-sm p-1 rounded-2xl shadow-md border border-gray-200 flex gap-1 pointer-events-auto"
                  role="tablist"
                  aria-label="けっかの見かた"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={resultMode === "comparison"}
                    onClick={() => { setResultMode("comparison"); setSelectedPart(null) }}
                    className={`px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${resultMode === "comparison"
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-orange-50"
                      }`}
                  >
                    <span aria-hidden="true">🎨</span>
                    いろをくらべよう
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={resultMode === "structure"}
                    onClick={() => { setResultMode("structure"); setSelectedPart(null) }}
                    disabled={isMajorityLoading || !majorityMask}
                    title={majorityError ?? undefined}
                    className={`px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50 ${resultMode === "structure"
                        ? "bg-green-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-green-50"
                      }`}
                  >
                    <span aria-hidden="true">📏</span>
                    からだのつくり
                  </button>
                </div>
              </div>
            )}

            {quizMode ? (
              <div className="relative w-full flex-1 flex items-center justify-center min-h-0">
                <canvas
                  ref={majorityCanvasRef}
                  className="max-w-full max-h-full object-contain cursor-crosshair"
                  onClick={handleCanvasClick}
                />
              </div>
            ) : (
              <div className="grid w-full flex-1 min-h-0 grid-cols-2 gap-2 md:gap-3">
                <section className="min-w-0 min-h-0 rounded-2xl border-2 border-orange-200 bg-orange-50/40 p-1.5 md:p-2 flex flex-col overflow-hidden">
                  <div className="mb-1.5 flex min-h-8 items-center justify-center rounded-xl bg-orange-100 px-2 py-1 text-center text-[11px] font-bold text-orange-900 md:text-sm">
                    <span aria-hidden="true" className="mr-1">👤</span>
                    じぶんのぬったいろ
                  </div>
                  <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                    <canvas ref={selfCanvasRef} className="max-h-full max-w-full object-contain" />
                  </div>
                </section>

                <section className="min-w-0 min-h-0 rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-1.5 md:p-2 flex flex-col overflow-hidden">
                  <div className="mb-1.5 flex min-h-8 items-center justify-center rounded-xl bg-violet-100 px-2 py-1 text-center text-[11px] font-bold text-violet-900 md:text-sm">
                    <span aria-hidden="true" className="mr-1">👥</span>
                    みんなのぬったいろ
                    {majoritySampleCount > 0 && <span className="ml-1">({majoritySampleCount}人)</span>}
                  </div>
                  <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                    <canvas
                      ref={majorityCanvasRef}
                      className={`max-h-full max-w-full object-contain ${resultMode === "structure" ? "cursor-pointer" : ""}`}
                      onClick={handleCanvasClick}
                    />
                    {isMajorityLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/75">
                        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-violet-700 shadow">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          よみこみ中...
                        </div>
                      </div>
                    )}
                    {!isMajorityLoading && majorityError && (
                      <div className="absolute inset-x-3 bottom-3 rounded-xl border border-amber-300 bg-amber-50/95 p-2 text-center text-xs font-bold text-amber-800 shadow-sm">
                        {majorityError}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {quizMode && drawnLines.length < 2 && (
              <div className="mt-2 p-2 bg-blue-100 rounded-lg text-center flex-shrink-0">
                <p className="text-xs md:text-sm font-bold text-blue-800">
                  あと {2 - drawnLines.length} ほんひけるよ！
                </p>
              </div>
            )}
          </Card>

          <div className="w-full md:w-72 lg:w-80 xl:w-96 flex flex-col gap-2 md:gap-3 min-h-0 overflow-hidden">
            {quizMode ? (
              <>
                <Card className="p-2 md:p-3 bg-blue-50 border-2 border-blue-300 flex-shrink-0">
                  <h2 className="text-base md:text-lg font-bold text-center mb-1">クイズ</h2>
                  <p className="text-xs md:text-sm text-center mb-1 leading-snug">
                    こんちゅうのからだを、あたま・むね・はらにわけるせんを2ほんひいてね！
                  </p>
                  <p className="text-xs text-center text-gray-600">がめんをタップして、せんをひこう</p>
                </Card>

                {quizResult && (
                  <Card
                    className={`p-2 md:p-3 flex-shrink-0 ${quizResult.includes("せいかい")
                        ? "bg-green-100 border-2 border-green-500"
                        : quizResult.includes("おしい")
                          ? "bg-yellow-100 border-2 border-yellow-500"
                          : "bg-red-100 border-2 border-red-500"
                      }`}
                  >
                    <p className="text-sm md:text-base font-bold text-center mb-2">{quizResult}</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-10 text-xs md:text-sm font-bold" onClick={resetQuiz}>
                          もういちど
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-10 text-xs md:text-sm font-bold bg-white"
                          onClick={endQuiz}
                        >
                          おわる
                        </Button>
                      </div>
                      {!quizResult.includes("せいかい") && (
                        <Button
                          size="sm"
                          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold"
                          onClick={() => setShowHint(true)}
                          disabled={showHint}
                        >
                          <Lightbulb className="w-4 h-4 mr-2" />
                          ヒントをみる
                        </Button>
                      )}
                    </div>
                  </Card>
                )}

                {!quizResult && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="flex-1 h-10 md:h-12 text-xs md:text-sm font-bold bg-gradient-to-r from-green-500 to-blue-500"
                      onClick={checkQuizAnswer}
                      disabled={drawnLines.length < 2}
                    >
                      こたえあわせ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 px-3 text-xs md:text-sm font-bold bg-white"
                      onClick={resetQuiz}
                    >
                      やりなおす
                    </Button>
                  </div>
                )}

                <div className="flex-1 min-h-0" />
              </>
            ) : (
              <>
                {resultMode === "structure" ? (
                  <>
                    <Card className="p-3 md:p-4 bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-300 flex-shrink-0 shadow-sm mb-2 md:mb-3">
                      <strong className="text-base md:text-lg text-gray-900 block mb-2">💡 こんちゅうのからだ：</strong>
                      <div className="text-sm md:text-base leading-relaxed text-gray-800 space-y-2 md:space-y-3">
                        <p>
                          こんちゅうのからだは、
                          <span
                            className="inline-block font-bold text-blue-600 cursor-pointer hover:underline hover:bg-blue-100 px-1 rounded transition-colors"
                            onClick={() => selectStructurePart(0)}
                          >あたま</span>・
                          <span
                            className="inline-block font-bold text-green-600 cursor-pointer hover:underline hover:bg-green-100 px-1 rounded transition-colors"
                            onClick={() => selectStructurePart(1)}
                          >むね</span>・
                          <span
                            className="inline-block font-bold text-red-600 cursor-pointer hover:underline hover:bg-red-100 px-1 rounded transition-colors"
                            onClick={() => selectStructurePart(2)}
                          >おなか</span>（はら）
                          の3つのぶぶんにわかれています。
                        </p>
                        <p>
                          <span
                            className="inline-block font-bold text-purple-600 cursor-pointer hover:underline hover:bg-purple-100 px-1 rounded transition-colors"
                            onClick={() => selectStructurePart(3)}
                          >あし</span>
                          は6ほんあって、すべて
                          <span
                            className="inline-block font-bold text-green-600 cursor-pointer hover:underline hover:bg-green-100 px-1 rounded transition-colors"
                            onClick={() => selectStructurePart(1)}
                          >むね</span>
                          からはえています。
                        </p>
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs md:text-sm">
                          黄色の点線は、上が
                          <strong className="text-amber-700">あたまの下はし</strong>
                          、下が
                          <strong className="text-amber-700">むねと、はらの境目</strong>
                          のめやすだよ。色のついた形もよく見てみよう。
                        </p>
                      </div>
                    </Card>

                    <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pb-1">
                      {bodyParts.map((part, index) => (
                        <Card
                          key={index}
                          className={`p-2 cursor-pointer transition-all flex-shrink-0 ${selectedPart === index ? "ring-2 ring-yellow-400 shadow-lg" : "hover:shadow-md"
                            }`}
                          onClick={() => selectStructurePart(index, true)}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className="w-6 h-6 md:w-7 md:h-7 rounded-full flex-shrink-0 shadow-md"
                              style={{ backgroundColor: part.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-sm md:text-base mb-0.5">{part.name}</h3>
                              <p className="text-xs text-gray-700 mb-1">{part.description}</p>
                              {selectedPart === index && (
                                <div className="mt-1 p-2 bg-yellow-50 rounded-lg border border-yellow-300">
                                  <p className="text-xs font-bold text-yellow-800 mb-0.5">💡 まめちしき</p>
                                  <p className="text-xs text-gray-700 leading-snug">{part.funFact}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <Card className="p-3 md:p-4 bg-gradient-to-br from-amber-50 via-white to-violet-50 border-2 border-amber-300 flex-1 min-h-0 overflow-y-auto shadow-sm">
                    <h2 className="text-base font-bold text-gray-900 md:text-lg">みんながぬったいろをかんさつ</h2>

                    {isUserMasksLoading ? (
                      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-5 text-xs font-bold text-blue-800">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        おともだちのいろを よみこみ中...
                      </div>
                    ) : selectedUserMask ? (
                      <div className="mt-3 rounded-2xl border-2 border-blue-200 bg-blue-50/70 p-2.5">
                        <p className="mb-2 text-center text-xs font-bold text-blue-900 md:text-sm">
                          <span aria-hidden="true">👤</span> {selectedUserMask.label} のいろ
                        </p>
                        <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl bg-white md:h-44">
                          <TransparentMaskImage
                            src={selectedUserMask.image_base64}
                            alt={`${selectedUserMask.label}のぬったいろ`}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white/70 p-4 text-center text-xs font-bold text-gray-500">
                        <p>{userMasksError ?? "おともだちのいろは まだありません。"}</p>
                        {userMasksError && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-3 bg-white font-bold"
                            onClick={() => setUserMasksReloadKey((key) => key + 1)}
                          >
                            もういちど
                          </Button>
                        )}
                      </div>
                    )}

                    {userMasks.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-bold text-gray-700">ほかのおともだちのいろ</p>
                        <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto rounded-xl bg-white/70 p-2 pr-1">
                          {userMasks.map((userMask, index) => {
                            const isSelected = index === selectedUserIndex
                            return (
                              <button
                                type="button"
                                key={userMask.id}
                                onClick={() => handleUserMaskSelect(index)}
                                aria-pressed={isSelected}
                                title={`${userMask.label}のいろを見る`}
                                className={`min-w-0 rounded-xl border bg-white p-1 transition-all hover:border-blue-400 hover:shadow ${isSelected
                                    ? "border-blue-500 ring-2 ring-blue-500 ring-offset-1"
                                    : "border-gray-200"
                                  }`}
                              >
                                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                                  <TransparentMaskImage
                                    src={userMask.image_base64}
                                    alt={`${userMask.label}のサムネイル`}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                                <span className="mt-1 block truncate text-[10px] font-bold text-gray-700">{userMask.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                {/* ★修正: 新しい「つぎへすすむ」ボタン */}
                <div className="flex justify-end mt-3 flex-shrink-0">
                  <Button
                    size="lg"
                    onClick={() => void handleNextInsect()}
                    disabled={isSavingResult}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold h-12 md:h-14 px-8 shadow-lg transform transition-all hover:scale-105"
                  >
                    {isSavingResult
                      ? "きろくを ほぞん中..."
                      : taskType === "tutorial"
                        ? "れんしゅうを おわる →"
                        : "つぎへすすむ →"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
