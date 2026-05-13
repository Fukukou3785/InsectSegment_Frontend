"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Eraser, Paintbrush, RotateCcw, Sparkles } from "lucide-react"
import Link from "next/link"

type BodyPartType = "head" | "thorax" | "abdomen" | "legs"
type BrushSizeType = "small" | "medium" | "large"

const bodyPartColors = {
  head: "rgba(59, 130, 246, 0.6)",
  thorax: "rgba(34, 197, 94, 0.6)",
  abdomen: "rgba(239, 68, 68, 0.6)",
  legs: "rgba(168, 85, 247, 0.6)",
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
  small: 12,
  medium: 24,
  large: 40,
}

const brushSizeLabels: Record<BrushSizeType, string> = {
  small: "ちいさい",
  medium: "ふつう",
  large: "おおきい",
}

export default function EditorPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState<BrushSizeType>("medium")
  const [tool, setTool] = useState<"brush" | "eraser">("brush")
  const [selectedPart, setSelectedPart] = useState<BodyPartType>("head")
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [history, setHistory] = useState<ImageData[]>([])
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handleResize = () => {
      if (originalImage) {
        redrawCanvas()
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [originalImage])

 // page.tsx の 82行目から
  useEffect(() => {
    // 1. 元画像と、AIが生成したマスク画像の両方をセッションストレージから取得
    const imageData = sessionStorage.getItem("insectImage") // 元画像
    const maskData = sessionStorage.getItem("segmentedImage") // AIが生成したマスク画像

    if (!imageData) {
      // 元画像がなければアップロードページに戻す
      router.push("/upload")
      return
    }

    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext("2d")
    const maskCtx = maskCanvas.getContext("2d")
    if (!ctx || !maskCtx) return

    // 2. 元画像(insectImage)をロード
    const img = new Image()
    img.onload = () => {
      // まず元画像をオリジナルとして保持
      setOriginalImage(img)
      canvas.width = img.width
      canvas.height = img.height
      maskCanvas.width = img.width
      maskCanvas.height = img.height

      // 3. AIが生成したマスク画像(segmentedImage)をロード
      if (maskData) {
        const maskImg = new Image()
        maskImg.onload = () => {
          // AIのマスクを、非表示の「マスク用Canvas」に描画
          maskCtx.drawImage(maskImg, 0, 0)
          
          // 4. 合成して表示
          // 元画像とマスクを合成してメインCanvasに表示
          redrawCanvas() 
          
          // 5. AIが描画した状態を「最初の履歴」として保存
          saveToHistory() 
        }
        maskImg.src = maskData
      } else {
        // AIのマスクがもし無かった場合（デバッグ用）
        // 元画像だけを表示
        ctx.drawImage(img, 0, 0)
        // 空白の状態を「最初の履歴」として保存
        saveToHistory()
      }
    }
    img.src = imageData
  }, [router])
// ここまでを置き換え

  const redrawCanvas = () => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas || !originalImage) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(originalImage, 0, 0)

    ctx.drawImage(maskCanvas, 0, 0)
  }

  const saveToHistory = () => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return
    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return

    const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
    setHistory((prev) => [...prev.slice(-9), imageData])
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const pos = getCanvasPosition(e)
    if (pos) {
      setLastPos(pos)
      drawAtPosition(pos.x, pos.y)
    }
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      setLastPos(null)
      saveToHistory()
    }
  }

  const getCanvasPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX: number, clientY: number

    if ("touches" in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY

    return { x, y }
  }

  const drawAtPosition = (x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return

    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return

    maskCtx.globalCompositeOperation = tool === "brush" ? "source-over" : "destination-out"
    maskCtx.fillStyle = tool === "brush" ? bodyPartColors[selectedPart] : "rgba(0, 0, 0, 1)"
    maskCtx.beginPath()
    maskCtx.arc(x, y, brushSizes[brushSize], 0, Math.PI * 2)
    maskCtx.fill()
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
    if (!isDrawing) return

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
      maskCtx.putImageData(previousState, 0, 0)
      setHistory(newHistory)
      redrawCanvas()
    }
  }

  const handleNext = () => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const maskData = maskCanvas.toDataURL("image/png")
    sessionStorage.setItem("editedMask", maskData)

    router.push("/result")
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-green-50 to-blue-50 overflow-hidden">
      <header className="bg-gradient-to-r from-green-500 to-blue-500 text-white py-4 px-4 flex items-center gap-3 shadow-lg flex-shrink-0">
        <Link href="/upload">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-12 w-12">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          <h1 className="text-xl md:text-2xl font-bold">こんちゅうをぬろう！</h1>
        </div>
      </header>

      {/* Left Sidebar - Always visible on all screen sizes */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-32 sm:w-48 md:w-56 lg:w-64 xl:w-72 flex-shrink-0 flex flex-col p-1.5 sm:p-2 md:p-3 bg-white border-r border-gray-200 overflow-hidden">
          <div className="flex flex-col h-full gap-1.5 sm:gap-2 md:gap-3 overflow-y-auto">
            {/* Body Parts Selection */}
            <Card className="p-1.5 sm:p-2 md:p-3 bg-gradient-to-br from-blue-50 to-green-50 shadow-md flex-shrink-0">
              <h2 className="text-[10px] sm:text-xs md:text-sm font-bold mb-1 sm:mb-2 text-center text-gray-800">
                どこをぬる？
              </h2>
              <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                {(Object.keys(bodyPartColors) as BodyPartType[]).map((part) => (
                  <button
                    key={part}
                    className={`p-1 sm:p-2 rounded-lg font-bold text-[9px] sm:text-xs transition-all transform hover:scale-105 ${
                      selectedPart === part ? "ring-2 ring-yellow-400 shadow-lg scale-105" : "hover:shadow-md"
                    }`}
                    style={{
                      backgroundColor: bodyPartColors[part].replace("0.6", selectedPart === part ? "0.9" : "0.5"),
                      color: "white",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
                    }}
                    onClick={() => setSelectedPart(part)}
                  >
                    <div className="text-base sm:text-xl mb-0.5">{bodyPartEmojis[part]}</div>
                    <div className="text-[8px] sm:text-[10px]">{bodyPartLabels[part]}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Tools */}
            <Card className="p-1.5 sm:p-2 md:p-3 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md flex-shrink-0">
              <h3 className="text-[10px] sm:text-xs md:text-sm font-bold mb-1 sm:mb-2 text-center text-gray-800">
                どうぐ
              </h3>
              <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                <Button
                  size="sm"
                  className={`h-10 sm:h-12 md:h-14 flex flex-col gap-0.5 text-[9px] sm:text-xs font-bold transition-all transform hover:scale-105 ${
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
                  className={`h-10 sm:h-12 md:h-14 flex flex-col gap-0.5 text-[9px] sm:text-xs font-bold transition-all transform hover:scale-105 ${
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
            </Card>

            {/* Brush Size */}
            <Card className="p-1.5 sm:p-2 md:p-3 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-md flex-shrink-0">
              <h3 className="text-[10px] sm:text-xs md:text-sm font-bold mb-1 sm:mb-2 text-center text-gray-800">
                おおきさ
              </h3>
              <div className="flex flex-col gap-1 sm:gap-1.5">
                {(Object.keys(brushSizes) as BrushSizeType[]).reverse().map((size) => (
                  <Button
                    key={size}
                    size="sm"
                    className={`h-8 sm:h-10 flex items-center justify-between px-1.5 sm:px-2 text-[9px] sm:text-xs font-bold transition-all transform hover:scale-105 ${
                      brushSize === size
                        ? "bg-purple-500 hover:bg-purple-600 text-white shadow-lg scale-105 ring-2 ring-yellow-400"
                        : "bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-300"
                    }`}
                    onClick={() => setBrushSize(size)}
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

            {/* Undo Button */}
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

            {/* Next Button */}
            <Button
              size="sm"
              className="h-10 sm:h-12 md:h-14 text-[9px] sm:text-xs md:text-sm font-bold bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 shadow-xl transform hover:scale-105 transition-all flex-shrink-0"
              onClick={handleNext}
            >
              できた！つぎへ →
            </Button>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 min-w-0 min-h-0 flex overflow-hidden">
          <div className="flex-1 p-2 sm:p-3 md:p-4 flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
            <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl p-2 sm:p-3 md:p-4 w-full h-full flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full w-auto h-auto object-contain touch-none cursor-crosshair rounded-lg"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <canvas ref={maskCanvasRef} className="hidden" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
