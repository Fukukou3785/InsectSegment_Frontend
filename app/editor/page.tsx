"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Eraser, Paintbrush, RotateCcw, Scan, Sparkles, ZoomIn, ZoomOut, Wand2 } from "lucide-react"
import Link from "next/link"
import { readExperimentSession } from "@/lib/experiment-session"
import { prefetchResultReferenceData } from "@/lib/result-reference-data"
import {
  beginEditorMetrics,
  completeEditorMetrics,
  getCurrentTaskType,
  incrementCorrectionCount,
} from "@/lib/task-metrics"

type BodyPartType = "head" | "thorax" | "abdomen" | "legs"
type BrushSizeType = "small" | "medium" | "large"
type ToolType = "brush" | "eraser" | "zoom-in" | "zoom-out" | "sam" | "box"
type CorrectionMode = "touch" | "box" | "brush"
type BoxPoint = { x: number; y: number }
type BoxDraft = { start: BoxPoint; current: BoxPoint; pointerId: number }
type CanvasCoordinates = BoxPoint & { displayX: number; displayY: number }

const bodyPartColors = {
  head: "rgb(31, 119, 180)",
  thorax: "rgb(44, 160, 44)",
  abdomen: "rgb(214, 39, 40)",
  legs: "rgb(148, 103, 189)",
}

const bodyPartLabels = {
  head: "まえ",
  thorax: "まんなか",
  abdomen: "うしろ",
  legs: "あし",
}

const bodyPartEmojis = {
  head: "🦗",
  thorax: "🐛",
  abdomen: "🐜",
  legs: "🦵",
}

const brushSizes: Record<BrushSizeType, number> = {
  small: 6,
  medium: 12,
  large: 20,
}

const brushSizeLabels: Record<BrushSizeType, string> = {
  small: "ちいさい",
  medium: "ふつう",
  large: "おおきい",
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? ""

export default function EditorPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const guardCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const boxDraftRef = useRef<BoxDraft | null>(null)
  const drawingActiveRef = useRef(false)

  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState<BrushSizeType>("medium")
  const [tool, setTool] = useState<ToolType>("sam")
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("touch")
  const [selectedPart, setSelectedPart] = useState<BodyPartType>("head")
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [history, setHistory] = useState<ImageData[]>([])
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const [useGuard, setUseGuard] = useState(true)
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false)
  const [isCanvasInteracting, setIsCanvasInteracting] = useState(false)
  const [boxDraft, setBoxDraft] = useState<BoxDraft | null>(null)
  const [boxMessage, setBoxMessage] = useState<string | null>(null)
  
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [isSaving, setIsSaving] = useState(false) // ★追加: 保存中フラグ
  const [isTutorial, setIsTutorial] = useState(false)

  useEffect(() => {
    setIsTutorial(getCurrentTaskType() === "tutorial")
  }, [])

  useEffect(() => {
    const imageName = sessionStorage.getItem("imageName")
    if (!imageName || !API_BASE_URL) return

    void prefetchResultReferenceData({
      apiBaseUrl: API_BASE_URL,
      taskType: getCurrentTaskType(),
      imageName,
    })
  }, [])

  const restartAfterSessionLoss = () => {
    alert("AIとのつながりが切れました。いまの画像をもう一度よみこみます。")
    sessionStorage.removeItem("segmentedImage")
    sessionStorage.removeItem("editedMask")
    sessionStorage.removeItem("thoraxTop")
    sessionStorage.removeItem("thoraxBottom")

    const experimentSession = readExperimentSession()
    if (
      experimentSession?.status === "active" &&
      sessionStorage.getItem("insectImage")
    ) {
      router.replace("/processing")
    } else {
      router.replace("/")
    }
  }

  const requireSessionId = () => {
    const experimentSession = readExperimentSession()
    if (!experimentSession || experimentSession.status !== "active") {
      router.replace("/")
      return null
    }
    return experimentSession.sessionId
  }

  useEffect(() => {
    const handleResize = () => {
      if (originalImage) redrawCanvas()
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [originalImage])

  const updateGuardCanvas = () => {
    const maskCanvas = maskCanvasRef.current
    const guardCanvas = guardCanvasRef.current
    if (!maskCanvas || !guardCanvas) return
    const guardCtx = guardCanvas.getContext("2d")
    if (!guardCtx) return

    guardCtx.clearRect(0, 0, guardCanvas.width, guardCanvas.height)
    guardCtx.drawImage(maskCanvas, 0, 0)
  }

  useEffect(() => {
    if (!cursorRef.current) return
    const diameter = brushSizes[brushSize] * 2 * zoom
    cursorRef.current.style.width = `${diameter}px`
    cursorRef.current.style.height = `${diameter}px`

    if (tool === 'eraser') {
        cursorRef.current.style.borderColor = '#ffffff'
        cursorRef.current.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
        cursorRef.current.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)'
        cursorRef.current.style.borderRadius = '50%'
    } else if (tool === 'sam') {
        cursorRef.current.style.width = '20px'
        cursorRef.current.style.height = '20px'
        cursorRef.current.style.borderColor = 'white'
        cursorRef.current.style.backgroundColor = bodyPartColors[selectedPart]
        cursorRef.current.style.boxShadow = '0 0 4px rgba(0,0,0,0.8)'
        cursorRef.current.style.borderRadius = '50%'
        cursorRef.current.style.borderWidth = '3px'
    } else {
        cursorRef.current.style.borderColor = 'white'
        cursorRef.current.style.backgroundColor = bodyPartColors[selectedPart].replace('rgb', 'rgba').replace(')', ', 0.2)')
        cursorRef.current.style.boxShadow = `0 0 0 2px ${bodyPartColors[selectedPart]}, 0 0 4px rgba(0,0,0,0.5)`
        cursorRef.current.style.borderRadius = '50%'
    }
  }, [brushSize, zoom, tool, selectedPart])

  useEffect(() => {
    const imageData = sessionStorage.getItem("insectImage")
    const maskData = sessionStorage.getItem("segmentedImage")

    if (!imageData) {
      router.push(
        getCurrentTaskType() === "tutorial" ? "/tutorial" : "/upload",
      )
      return
    }

    beginEditorMetrics()

    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    const guardCanvas = guardCanvasRef.current
    const container = containerRef.current
    if (!canvas || !maskCanvas || !guardCanvas || !container) return

    const ctx = canvas.getContext("2d")
    const maskCtx = maskCanvas.getContext("2d")
    const guardCtx = guardCanvas.getContext("2d")
    if (!ctx || !maskCtx || !guardCtx) return

    const img = new Image()
    img.onload = () => {
      const MAX_SIZE = 800
      let width = img.width
      let height = img.height
      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round(height * (MAX_SIZE / width))
          width = MAX_SIZE
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round(width * (MAX_SIZE / height))
          height = MAX_SIZE
        }
      }

      canvas.width = width
      canvas.height = height
      maskCanvas.width = width
      maskCanvas.height = height
      guardCanvas.width = width
      guardCanvas.height = height

      const availableW = container.clientWidth - 32
      const availableH = container.clientHeight - 32
      const scaleW = availableW / width
      const scaleH = availableH / height
      const fitScale = Math.min(scaleW, scaleH, 1.0)
      setZoom(fitScale)
      setOriginalImage(img)

      if (maskData) {
        const maskImg = new Image()
        maskImg.onload = () => {
          maskCtx.drawImage(maskImg, 0, 0, width, height)
          guardCtx.clearRect(0, 0, width, height)
          guardCtx.drawImage(maskImg, 0, 0, width, height)
          redrawCanvas(img) 
          saveToHistory() 
        }
        maskImg.src = maskData
      } else {
        redrawCanvas(img)
        saveToHistory()
      }
    }
    img.src = imageData
  }, [router])

  const recalcLinesFromMask = async () => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return

    try {
      const currentMaskBase64 = maskCanvas.toDataURL("image/png")
      const sessionId = requireSessionId()
      if (!sessionId) return

      const formData = new FormData()
      formData.append("current_mask", currentMaskBase64)
      formData.append("session_id", sessionId)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recalc_lines`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        if (response.status === 400 || response.status === 404) {
          restartAfterSessionLoss()
          return
        }
        throw new Error("Recalc Failed")
      }

      const data = await response.json()

      if (data.thorax_top !== undefined) {
        sessionStorage.setItem("thoraxTop", data.thorax_top.toString())
        sessionStorage.setItem("thoraxBottom", data.thorax_bottom.toString())
        console.log("Lines updated based on brush strokes")
      }
    } catch (e) {
      console.error("Failed to recalculate lines:", e)
    }
  }

  const downloadDemoImage = () => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    try {
      const storedTop = sessionStorage.getItem("thoraxTop")
      const storedBottom = sessionStorage.getItem("thoraxBottom")
      const ratioTop = storedTop ? parseFloat(storedTop) : 0.33
      const ratioBottom = storedBottom ? parseFloat(storedBottom) : 0.66

      const tempCanvas = document.createElement("canvas")
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const ctx = tempCanvas.getContext("2d")
      if (!ctx) return

      ctx.drawImage(canvas, 0, 0)

      const maskCtx = maskCanvas.getContext("2d")
      if (!maskCtx) return
      
      const width = canvas.width
      const height = canvas.height
      
      const maskImageData = maskCtx.getImageData(0, 0, width, height)
      const data = maskImageData.data

      const COLOR_HEAD = [31, 119, 180]
      const COLOR_THORAX = [44, 160, 44]
      const COLOR_ABDOMEN = [214, 39, 40]
      const COLOR_LEG = [148, 103, 189]

      const yHeadEnd = ratioTop * height
      const yThoraxEnd = ratioBottom * height

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]

        if (a === 0) continue

        const distLeg = Math.abs(r - COLOR_LEG[0]) + Math.abs(g - COLOR_LEG[1]) + Math.abs(b - COLOR_LEG[2])
        const isLeg = distLeg < 80

        const pixelIndex = i / 4
        const y = Math.floor(pixelIndex / width)

        if (isLeg) {
             data[i] = COLOR_LEG[0]; data[i+1] = COLOR_LEG[1]; data[i+2] = COLOR_LEG[2]
        } else {
             if (y < yHeadEnd) {
                 data[i] = COLOR_HEAD[0]; data[i+1] = COLOR_HEAD[1]; data[i+2] = COLOR_HEAD[2]
             } else if (y < yThoraxEnd) {
                 data[i] = COLOR_THORAX[0]; data[i+1] = COLOR_THORAX[1]; data[i+2] = COLOR_THORAX[2]
             } else {
                 data[i] = COLOR_ABDOMEN[0]; data[i+1] = COLOR_ABDOMEN[1]; data[i+2] = COLOR_ABDOMEN[2]
             }
        }
        data[i + 3] = 180 
      }

      const coloredMaskCanvas = document.createElement("canvas")
      coloredMaskCanvas.width = width
      coloredMaskCanvas.height = height
      const coloredCtx = coloredMaskCanvas.getContext("2d")
      
      if (coloredCtx) {
          coloredCtx.putImageData(maskImageData, 0, 0)
          ctx.drawImage(coloredMaskCanvas, 0, 0)
      }
    } catch (e) {
      console.error("Demo download failed:", e)
    }
  }

  const redrawCanvas = (img: HTMLImageElement | null = null) => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    const targetImage = img || originalImage 
    if (!canvas || !maskCanvas || !targetImage) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(targetImage, 0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.globalAlpha = 0.6
    ctx.drawImage(maskCanvas, 0, 0)
    ctx.restore()
  }
  
  const saveToHistory = () => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return
    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return
    const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
    setHistory((prev) => [...prev.slice(-9), imageData])
  }

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(prev + delta, 0.5), 3.0))
  }

  const updateCursorPosition = (
    e: React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
      | React.PointerEvent<HTMLCanvasElement>,
  ) => {
    if (!cursorRef.current) return
    let clientX: number, clientY: number
    if ("touches" in e) {
      if (e.touches.length === 0) return
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const point = getCanvasCoordinatesFromClient(clientX, clientY)
    if (!point) return

    cursorRef.current.style.transform =
      `translate(${point.displayX}px, ${point.displayY}px) translate(-50%, -50%)`
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (correctionMode !== "brush" || (tool !== "brush" && tool !== "eraser")) return
    if (drawingActiveRef.current) return

    drawingActiveRef.current = true
    setIsDrawing(true)
    updateCursorPosition(e)
    const pos = getCanvasPosition(e)
    if (pos) {
      setLastPos(pos)
      drawAtPosition(pos.x, pos.y)
    }
  }

  const stopDrawing = () => {
    if (drawingActiveRef.current) {
      drawingActiveRef.current = false
      setIsDrawing(false)
      setLastPos(null)
      saveToHistory()
      incrementCorrectionCount(selectedPart, "manual")
      
      if (tool === "brush" || tool === "eraser") {
          recalcLinesFromMask() 
      }
    }
  }

  const handleSamPointerDown = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (correctionMode !== "touch" || tool !== "sam" || isProcessingAI) return
    if (e.pointerType === "mouse" && e.button !== 0) return

    e.preventDefault()
    setIsCanvasInteracting(true)
    setIsHoveringCanvas(true)
    updateCursorPosition(e)

    const shouldHideMarker = e.pointerType === "touch"

    const finishProcessing = () => {
      setIsProcessingAI(false)
      setIsCanvasInteracting(false)
      if (shouldHideMarker) setIsHoveringCanvas(false)
    }

    const pos = getCanvasPosition(e)
    if (!pos) {
      finishProcessing()
      return
    }

    try {
        setIsProcessingAI(true)
        
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas) {
          finishProcessing()
          return
        }
        
        const currentMaskBase64 = maskCanvas.toDataURL("image/png")
        const sessionId = requireSessionId()
        if (!sessionId) {
          finishProcessing()
          return
        }

        const formData = new FormData()
        formData.append('x', Math.round(pos.x).toString())
        formData.append('y', Math.round(pos.y).toString())
        formData.append('label_part', selectedPart)
        formData.append('current_mask', currentMaskBase64) 
        formData.append('session_id', sessionId)

       const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/refine`, {
            method: 'POST',
            body: formData,
        })
        
        if (!response.ok) {
          if (response.status === 400 || response.status === 404) {
            finishProcessing()
            restartAfterSessionLoss()
            return
          }
          throw new Error("API Error")
        }

        const data = await response.json()
        const newMaskBase64 = data.segmented_image_base64
        
        if (data.thorax_top !== undefined) {
             sessionStorage.setItem("thoraxTop", data.thorax_top.toString())
             sessionStorage.setItem("thoraxBottom", data.thorax_bottom.toString())
        }
        
        const maskCtx = maskCanvas?.getContext("2d")
        if (maskCanvas && maskCtx && newMaskBase64) {
             const img = new Image()
             img.onload = () => {
                 maskCtx.clearRect(0,0, maskCanvas.width, maskCanvas.height)
                 maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height)
                 
                 updateGuardCanvas()
                 
                 redrawCanvas()
                 saveToHistory()
                 incrementCorrectionCount(selectedPart, "touch")
                 finishProcessing()
             }
             img.onerror = finishProcessing
             img.src = newMaskBase64
        } else {
             finishProcessing()
        }
    } catch (error) {
        console.error("SAM Error", error)
        finishProcessing()
        alert("AI修正に失敗しました")
    }
  }

  const getCanvasCoordinatesFromClient = (
    clientX: number,
    clientY: number,
  ): CanvasCoordinates | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    const displayX = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    const displayY = Math.min(Math.max(clientY - rect.top, 0), rect.height)

    return {
      x: displayX * (canvas.width / rect.width),
      y: displayY * (canvas.height / rect.height),
      displayX,
      displayY,
    }
  }

  const getPointerCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoordinatesFromClient(e.clientX, e.clientY)
    return point ? { x: point.displayX, y: point.displayY } : null
  }

  const applyRefinedMask = async (data: {
    segmented_image_base64?: string
    thorax_top?: number
    thorax_bottom?: number
    sam_debug?: unknown
  }) => {
    const maskCanvas = maskCanvasRef.current
    const maskCtx = maskCanvas?.getContext("2d")
    if (!maskCanvas || !maskCtx || !data.segmented_image_base64) {
      throw new Error("Refined mask is missing")
    }

    if (data.thorax_top !== undefined && data.thorax_bottom !== undefined) {
      sessionStorage.setItem("thoraxTop", data.thorax_top.toString())
      sessionStorage.setItem("thoraxBottom", data.thorax_bottom.toString())
    }

    await new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
        maskCtx.drawImage(image, 0, 0, maskCanvas.width, maskCanvas.height)
        updateGuardCanvas()
        redrawCanvas()
        saveToHistory()
        resolve()
      }
      image.onerror = () => reject(new Error("Failed to load refined mask"))
      image.src = data.segmented_image_base64 as string
    })

    if (data.sam_debug) console.debug("SAM box debug:", data.sam_debug)
  }

  const submitBoxRefinement = async (start: BoxPoint, end: BoxPoint) => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas || isProcessingAI) return

    const rect = canvas.getBoundingClientRect()
    const left = Math.min(start.x, end.x)
    const top = Math.min(start.y, end.y)
    const right = Math.max(start.x, end.x)
    const bottom = Math.max(start.y, end.y)
    const renderedWidth = right - left
    const renderedHeight = bottom - top

    if (renderedWidth < 20 || renderedHeight < 20) {
      setBoxMessage("もういちど、ぬりたいところを四角でかこんでね")
      setBoxDraft(null)
      return
    }

    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x1 = Math.max(0, Math.min(canvas.width - 1, Math.round(left * scaleX)))
    const y1 = Math.max(0, Math.min(canvas.height - 1, Math.round(top * scaleY)))
    const x2 = Math.max(x1 + 1, Math.min(canvas.width, Math.round(right * scaleX)))
    const y2 = Math.max(y1 + 1, Math.min(canvas.height, Math.round(bottom * scaleY)))

    try {
      setIsProcessingAI(true)
      setBoxMessage(null)

      const sessionId = requireSessionId()
      if (!sessionId) return

      const formData = new FormData()
      formData.append("x1", x1.toString())
      formData.append("y1", y1.toString())
      formData.append("x2", x2.toString())
      formData.append("y2", y2.toString())
      formData.append("label_part", selectedPart)
      formData.append("current_mask", maskCanvas.toDataURL("image/png"))
      formData.append("session_id", sessionId)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/refine_box`, {
        method: "POST",
        body: formData,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const detail = typeof data.detail === "string" ? data.detail : "Box refinement failed"
        const normalizedDetail = detail.toLowerCase()
        if (
          normalizedDetail.includes("image not loaded") ||
          normalizedDetail.includes("no image loaded") ||
          normalizedDetail.includes("embedding")
        ) {
          restartAfterSessionLoss()
          return
        }
        throw new Error(detail)
      }

      await applyRefinedMask(data)
      incrementCorrectionCount(selectedPart, "box")
    } catch (error) {
      console.error("SAM Box Error", error)
      setBoxMessage("もういちど、ぬりたいところを四角でかこんでね")
    } finally {
      setIsProcessingAI(false)
      setBoxDraft(null)
      boxDraftRef.current = null
    }
  }

  const handleBoxPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (correctionMode !== "box" || isProcessingAI) return
    if (e.pointerType === "mouse" && e.button !== 0) return

    const point = getPointerCanvasPoint(e)
    if (!point) return

    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const draft = { start: point, current: point, pointerId: e.pointerId }
    boxDraftRef.current = draft
    setBoxDraft(draft)
    setBoxMessage(null)
    setIsCanvasInteracting(true)
  }

  const handleBoxPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const draft = boxDraftRef.current
    if (correctionMode !== "box" || !draft || draft.pointerId !== e.pointerId) return

    const point = getPointerCanvasPoint(e)
    if (!point) return

    e.preventDefault()
    const nextDraft = { ...draft, current: point }
    boxDraftRef.current = nextDraft
    setBoxDraft(nextDraft)
  }

  const handleBoxPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const draft = boxDraftRef.current
    if (correctionMode !== "box" || !draft || draft.pointerId !== e.pointerId) {
      setIsCanvasInteracting(false)
      return
    }

    e.preventDefault()
    const end = getPointerCanvasPoint(e) ?? draft.current
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    boxDraftRef.current = null
    setIsCanvasInteracting(false)
    void submitBoxRefinement(draft.start, end)
  }

  const handleBoxPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (boxDraftRef.current?.pointerId !== e.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    boxDraftRef.current = null
    setBoxDraft(null)
    setIsCanvasInteracting(false)
  }

  const getCanvasPosition = (
    e: React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
      | React.PointerEvent<HTMLCanvasElement>,
  ) => {
    let clientX: number, clientY: number
    if ("touches" in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const point = getCanvasCoordinatesFromClient(clientX, clientY)
    return point ? { x: point.x, y: point.y } : null
  }

  const drawAtPosition = (x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current
    const guardCanvas = guardCanvasRef.current
    if (!maskCanvas || !guardCanvas) return
    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return

    maskCtx.globalCompositeOperation = tool === "brush" ? "source-over" : "destination-out"
    maskCtx.fillStyle = tool === "brush" ? bodyPartColors[selectedPart] : "rgba(0, 0, 0, 1)"
    maskCtx.beginPath()
    maskCtx.arc(x, y, brushSizes[brushSize], 0, Math.PI * 2)
    maskCtx.fill()

    if (useGuard) {
        maskCtx.globalCompositeOperation = "destination-in"
        maskCtx.drawImage(guardCanvas, 0, 0, maskCanvas.width, maskCanvas.height)
    }
    maskCtx.globalCompositeOperation = "source-over"
  }

  const interpolatePoints = (x1: number, y1: number, x2: number, y2: number) => {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    const steps = Math.max(Math.floor(distance / 2), 1)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x1 + (x2 - x1) * t
      const y = y1 + (y2 - y1) * t
      drawAtPosition(x, y)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    updateCursorPosition(e)
    if (correctionMode !== "brush" || !isDrawing) return
    const pos = getCanvasPosition(e)
    if (!pos) return
    if (lastPos) {
      interpolatePoints(lastPos.x, lastPos.y, pos.x, pos.y)
    } else {
      drawAtPosition(pos.x, pos.y)
    }
    setLastPos(pos)
    redrawCanvas()
  }

  const handleUndo = () => {
    if (history.length <= 1) return
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return
    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return
    const newHistory = history.slice(0, -1)
    const previousState = newHistory[newHistory.length - 1]
    if (previousState) {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
      maskCtx.putImageData(previousState, 0, 0)
      setHistory(newHistory)
      redrawCanvas()
    }
  }

  const handleNext = async () => {
    if (isSaving) return // ★追加: 連打防止
    setIsSaving(true)    // ★追加: 保存中フラグをON

    const sessionId = requireSessionId()
    if (!sessionId) {
      setIsSaving(false)
      return
    }

    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) {
      setIsSaving(false)
      return
    }
    const userMaskData = maskCanvas.toDataURL("image/png")
    sessionStorage.setItem("editedMask", userMaskData)

    downloadDemoImage()

    const taskMetrics = completeEditorMetrics()

    if (getCurrentTaskType() !== "tutorial") {
      const experimentSession = readExperimentSession()
      const originalData = sessionStorage.getItem("insectImage")
      const aiMaskData = sessionStorage.getItem("segmentedImage")
      const tTop = sessionStorage.getItem("thoraxTop")
      const tBottom = sessionStorage.getItem("thoraxBottom")

      if (!experimentSession || !originalData || !aiMaskData) {
        alert("実験記録の情報が足りません。もう一度やりなおしてください。")
        setIsSaving(false)
        return
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/experiment/task/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participant_id: experimentSession.participantId,
            session_id: sessionId,
            session_started_at: experimentSession.startedAt,
            task_id: taskMetrics.taskId,
            task_index: taskMetrics.taskIndex,
            image_name: taskMetrics.imageName,
            editor_started_at: taskMetrics.editorStartedAt,
            editor_completed_at: taskMetrics.editorCompletedAt,
            editor_duration_ms: taskMetrics.editorDurationMs,
            correction_counts: taskMetrics.correctionCounts,
            original_base64: originalData,
            ai_mask_base64: aiMaskData,
            user_mask_base64: userMaskData,
            thorax_top: Number(tTop) || 0,
            thorax_bottom: Number(tBottom) || 0,
          }),
        })
        const responseData = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(
            typeof responseData.detail === "string"
              ? responseData.detail
              : "Save failed",
          )
        }
      } catch (e) {
        console.error("Failed to save experiment task:", e)
        alert("実験記録を保存できませんでした。通信を確認して、もう一度押してください。")
        setIsSaving(false)
        return
      }
    }

    setIsSaving(false) // ★追加: 保存完了後にフラグをOFF
    router.push("/result")
  }

  const getCursorStyle = () => {
    if (correctionMode === "box") return isProcessingAI ? "wait" : "crosshair"
    if (tool === "zoom-in") return "zoom-in"
    if (tool === "zoom-out") return "zoom-out"
    if (tool === "sam" && isProcessingAI) return "wait"
    if (tool === "sam") return "pointer"
    return "none"
  }

  const selectCorrectionMode = (mode: CorrectionMode) => {
    setCorrectionMode(mode)
    setTool(mode === "touch" ? "sam" : mode === "box" ? "box" : "brush")
    drawingActiveRef.current = false
    setIsDrawing(false)
    setLastPos(null)
    setBoxDraft(null)
    boxDraftRef.current = null
    setBoxMessage(null)
  }

  const boxOverlayStyle = boxDraft
    ? {
        left: Math.min(boxDraft.start.x, boxDraft.current.x),
        top: Math.min(boxDraft.start.y, boxDraft.current.y),
        width: Math.abs(boxDraft.current.x - boxDraft.start.x),
        height: Math.abs(boxDraft.current.y - boxDraft.start.y),
        borderColor: bodyPartColors[selectedPart],
        backgroundColor: bodyPartColors[selectedPart].replace("rgb(", "rgba(").replace(")", ", 0.18)"),
      }
    : null

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-green-50 to-blue-50 overflow-hidden">
      
      <header className="bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 px-4 flex items-center gap-3 shadow-lg flex-shrink-0">
        <Link href={isTutorial ? "/tutorial" : "/upload"}>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-12 w-12">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          <h1 className="text-xl md:text-2xl font-bold">
            {isTutorial ? "れんしゅう：こんちゅうをぬろう！" : "こんちゅうをぬろう！"}
          </h1>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-[300px] md:w-[320px] lg:w-[340px] xl:w-[360px] flex-shrink-0 flex flex-col p-2 md:p-3 bg-white border-r border-gray-200 overflow-hidden">
          
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            <Card className="p-2 bg-gradient-to-br from-blue-50 to-green-50 shadow-sm flex-shrink-0">
              <h2 className="text-sm font-bold mb-1.5 text-center text-gray-800">
                どこをぬる？
              </h2>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(bodyPartColors) as BodyPartType[]).map((part) => (
                  <button
                    key={part}
                    className={`min-w-0 px-1 py-1.5 rounded-lg font-bold text-xs transition-all transform hover:scale-[1.02] ${
                      selectedPart === part ? "ring-2 ring-yellow-400 shadow-lg scale-105" : "hover:shadow-md"
                    }`}
                    style={{
                      backgroundColor: bodyPartColors[part].replace("0.6", selectedPart === part ? "0.9" : "0.5"),
                      color: "white",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
                    }}
                    onClick={() => {
                      setSelectedPart(part)
                    }}
                  >
                    <div className="text-lg leading-none mb-1">{bodyPartEmojis[part]}</div>
                    <div className="text-xs whitespace-nowrap">{bodyPartLabels[part]}</div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-2 shadow-sm flex-shrink-0">
              <h2 className="text-sm font-bold mb-1.5 text-center text-gray-800">
                なおしかたを えらぼう
              </h2>
              <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="なおしかた">
                <Button
                  size="sm"
                  role="tab"
                  aria-selected={correctionMode === "touch"}
                  className={correctionMode === "touch" ? "h-12 min-w-0 px-1 text-[10px] whitespace-normal leading-tight bg-purple-600 text-white" : "h-12 min-w-0 px-1 text-[10px] whitespace-normal leading-tight bg-gray-100 text-gray-700"}
                  onClick={() => selectCorrectionMode("touch")}
                >
                  <Wand2 className="w-3.5 h-3.5 mr-0.5 flex-shrink-0" />
                  <span>タッチで<br />おまかせ</span>
                </Button>
                <Button
                  size="sm"
                  role="tab"
                  aria-selected={correctionMode === "box"}
                  className={correctionMode === "box" ? "h-12 min-w-0 px-1 text-[10px] whitespace-normal leading-tight bg-teal-600 text-white" : "h-12 min-w-0 px-1 text-[10px] whitespace-normal leading-tight bg-gray-100 text-gray-700"}
                  onClick={() => selectCorrectionMode("box")}
                >
                  <Scan className="w-3.5 h-3.5 mr-0.5 flex-shrink-0" />
                  <span>かこんで<br />おまかせ</span>
                </Button>
                <Button
                  size="sm"
                  role="tab"
                  aria-selected={correctionMode === "brush"}
                  className={correctionMode === "brush" ? "h-12 min-w-0 px-1 text-[10px] whitespace-normal leading-tight bg-blue-600 text-white" : "h-12 min-w-0 px-1 text-[10px] whitespace-normal leading-tight bg-gray-100 text-gray-700"}
                  onClick={() => selectCorrectionMode("brush")}
                >
                  <Paintbrush className="w-3.5 h-3.5 mr-0.5 flex-shrink-0" />
                  <span>じぶんで<br />なおす</span>
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-center leading-snug text-gray-600">
                {correctionMode === "touch"
                  ? "なおしたいところを、ポンとタッチしてね"
                  : correctionMode === "box"
                    ? "ぬりたいところを、四角でかこんでね"
                    : "ペンやけしゴムで、すこしずつなおせるよ"}
              </p>
              {boxMessage && correctionMode === "box" && (
                <p className="mt-1.5 rounded-lg bg-amber-100 px-2 py-1.5 text-center text-xs font-bold text-amber-800">
                  {boxMessage}
                </p>
              )}
            </Card>

            <Card className="p-2 bg-gradient-to-br from-purple-50 to-pink-50 shadow-sm flex-shrink-0">
              <h3 className="text-sm font-bold mb-1.5 text-center text-gray-800">
                {correctionMode === "touch" ? "タッチのしかた" : correctionMode === "box" ? "かこみかた" : "どうぐ"}
              </h3>
              {correctionMode === "touch" && (
                <div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-purple-100 px-3 py-2 text-center text-xs font-bold text-purple-800">
                  <Wand2 className="h-4 w-4 flex-shrink-0" />
                  色をえらんで、なおしたいところを1回タッチ
                </div>
              )}
              {correctionMode === "box" && (
                <div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-teal-100 px-3 py-2 text-center text-xs font-bold text-teal-800">
                  <Scan className="h-4 w-4 flex-shrink-0" />
                  ぬりたいところを、指やマウスで四角にかこむ
                </div>
              )}
              {correctionMode === "brush" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    className={`h-10 flex-col gap-0.5 text-xs font-bold transition-all hover:scale-[1.02] ${
                      tool === "brush"
                        ? "bg-blue-500 hover:bg-blue-600 shadow-lg scale-105 ring-2 ring-yellow-400"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                    onClick={() => setTool("brush")}
                  >
                    <Paintbrush className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-[8px] sm:text-[10px]">ブラシ</span>
                  </Button>
                  <Button
                    size="sm"
                    className={`h-10 flex-col gap-0.5 text-xs font-bold transition-all hover:scale-[1.02] ${
                      tool === "eraser"
                        ? "bg-orange-500 hover:bg-orange-600 shadow-lg scale-105 ring-2 ring-yellow-400"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                    onClick={() => setTool("eraser")}
                  >
                    <Eraser className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-[8px] sm:text-[10px]">けしゴム</span>
                  </Button>
                </div>
              )}
            </Card>

            <Card className={`${correctionMode !== "brush" ? "hidden" : ""} p-2 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-sm flex-shrink-0`}>
              <h3 className="text-sm font-bold mb-1.5 text-center text-gray-800">
                おおきさ
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(brushSizes) as BrushSizeType[]).reverse().map((size) => (
                  <Button
                    key={size}
                    size="sm"
                    className={`h-9 flex items-center justify-center gap-1 px-1 text-xs font-bold transition-all hover:scale-[1.02] ${
                      brushSize === size
                        ? "bg-purple-500 hover:bg-purple-600 text-white shadow-lg scale-105 ring-2 ring-yellow-400"
                        : "bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-300"
                    }`}
                    onClick={() => setBrushSize(size)}
                    disabled={correctionMode !== "brush"}
                  >
                    <span className="text-[8px] sm:text-[10px]">{brushSizeLabels[size]}</span>
                    <div
                      className="rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: brushSize === size ? "white" : "#6b7280",
                        width: size === "small" ? "8px" : size === "medium" ? "14px" : "24px",
                        height: size === "small" ? "8px" : size === "medium" ? "14px" : "24px",
                      }}
                    />
                  </Button>
                ))}
              </div>
            </Card>

            <div className="flex-1 min-h-1" />

            <Button
              size="sm"
              variant="outline"
              className="h-8 sm:h-10 md:h-12 flex items-center justify-center gap-1 font-bold text-[9px] sm:text-xs bg-white hover:bg-gray-50 border-2 border-gray-300 flex-shrink-0"
              onClick={handleUndo}
              disabled={history.length <= 1}
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-[8px] sm:text-[10px]">もどす</span>
            </Button>

            <Button
              size="sm"
              disabled={isSaving}
              className={`h-10 sm:h-12 md:h-14 text-[9px] sm:text-xs md:text-sm font-bold shadow-xl transform transition-all flex-shrink-0 ${
                isSaving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 hover:scale-105"
              }`}
              onClick={handleNext}
            >
              {isSaving ? "ほぞんちゅう..." : "できた！つぎへ →"}
            </Button>
          </div>
        </aside>

        <main className="relative flex-1 min-w-0 min-h-0 flex overflow-hidden bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
          <div ref={containerRef} className="flex-1 w-full h-full overflow-auto flex p-4">
            
            <div 
              className="relative shadow-2xl bg-white transition-all duration-200 ease-out m-auto"
              style={{
                width: canvasRef.current ? canvasRef.current.width * zoom : "auto",
                height: canvasRef.current ? canvasRef.current.height * zoom : "auto",
              }}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full touch-none rounded-lg"
                style={{ cursor: getCursorStyle() }}
                onPointerEnter={() => setIsHoveringCanvas(true)}
                onPointerLeave={() => {
                  setIsHoveringCanvas(false)
                  if (correctionMode !== "box") {
                    setIsCanvasInteracting(false)
                    stopDrawing()
                  }
                }}

                onPointerDown={(e) => {
                  if (correctionMode === "box") handleBoxPointerDown(e)
                  else if (correctionMode === "touch") void handleSamPointerDown(e)
                  else setIsCanvasInteracting(true)
                }}
                onPointerMove={(e) => {
                  if (correctionMode === "box") handleBoxPointerMove(e)
                  else updateCursorPosition(e)
                }}
                onPointerUp={(e) => {
                  if (correctionMode === "box") handleBoxPointerUp(e)
                  else setIsCanvasInteracting(false)
                }}
                onPointerCancel={(e) => {
                  if (correctionMode === "box") handleBoxPointerCancel(e)
                  else setIsCanvasInteracting(false)
                }}
                
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}

              />
              <div
                ref={cursorRef}
                className="pointer-events-none absolute left-0 top-0 z-40 transition-opacity duration-75"
                style={{
                  width: 0,
                  height: 0,
                  opacity:
                    isHoveringCanvas
                    && (tool === "brush" || tool === "eraser" || tool === "sam")
                      ? 1
                      : 0,
                  willChange: "transform",
                }}
                aria-hidden="true"
              />
              {correctionMode === "box" && boxOverlayStyle && (
                <div
                  className="pointer-events-none absolute z-20 border-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
                  style={boxOverlayStyle}
                  aria-hidden="true"
                />
              )}
              {correctionMode === "box" && isProcessingAI && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-white/25">
                  <div className="rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-teal-800 shadow-lg">
                    AIがかくにん中...
                  </div>
                </div>
              )}
              <canvas ref={maskCanvasRef} className="hidden" />
              <canvas ref={guardCanvasRef} className="hidden" />
            </div>
          </div>

          <div
            className={`absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/70 bg-white/85 p-2 shadow-lg backdrop-blur-sm transition-opacity duration-200 ${
              isCanvasInteracting ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
            aria-hidden={isCanvasInteracting}
          >
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-12 w-12 rounded-full bg-white text-teal-700 shadow-sm hover:bg-teal-50"
              onClick={() => handleZoom(0.5)}
              aria-label="画像を拡大する"
              title="かくだい"
            >
              <ZoomIn className="h-6 w-6" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-12 w-12 rounded-full bg-white text-teal-700 shadow-sm hover:bg-teal-50"
              onClick={() => handleZoom(-0.5)}
              aria-label="画像を縮小する"
              title="しゅくしょう"
            >
              <ZoomOut className="h-6 w-6" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  )
}
