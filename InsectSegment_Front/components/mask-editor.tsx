"use client"

import type React from "react"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface MaskEditorProps {
  imageUrl: string
  onComplete: () => void
}

export function MaskEditor({ imageUrl, onComplete }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(20)
  const [mode, setMode] = useState<"draw" | "erase">("draw")
  const [history, setHistory] = useState<ImageData[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Initialize canvas with sample mask
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // Draw sample mask overlay
      ctx.fillStyle = "rgba(100, 200, 100, 0.5)"
      ctx.fillRect(img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6)

      // Save initial state
      saveHistory()
    }
    img.src = imageUrl || "/insect.jpg"
  }, [imageUrl])

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory((prev) => [...prev.slice(-9), imageData])
  }, [])

  const undo = useCallback(() => {
    if (history.length <= 1) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const newHistory = history.slice(0, -1)
    const previousState = newHistory[newHistory.length - 1]

    if (previousState) {
      ctx.putImageData(previousState, 0, 0)
      setHistory(newHistory)
    }
  }, [history])

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    const coords = getCoordinates(e)
    if (!coords) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return

    const coords = getCoordinates(e)
    if (!coords) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = brushSize

    if (mode === "draw") {
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = "rgba(100, 200, 100, 0.5)"
    } else {
      ctx.globalCompositeOperation = "destination-out"
    }

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      saveHistory()
    }
  }

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <Card className="overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-auto touch-none cursor-crosshair"
        />
      </Card>

      {/* Tools */}
      <Card className="p-4 space-y-4">
        {/* Mode Selection */}
        <div className="flex gap-2">
          <Button
            variant={mode === "draw" ? "default" : "outline"}
            size="lg"
            className="flex-1 h-14 text-base font-bold"
            onClick={() => setMode("draw")}
          >
            かく
          </Button>
          <Button
            variant={mode === "erase" ? "default" : "outline"}
            size="lg"
            className="flex-1 h-14 text-base font-bold"
            onClick={() => setMode("erase")}
          >
            けす
          </Button>
        </div>

        {/* Brush Size */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">ブラシのおおきさ</label>
            <span className="text-sm font-bold text-primary">{brushSize}px</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>ちいさい</span>
            <span>おおきい</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-12 text-base font-bold bg-transparent"
            onClick={undo}
            disabled={history.length <= 1}
          >
            もどす
          </Button>
          <Button size="lg" className="flex-1 h-12 text-base font-bold" onClick={onComplete}>
            かんせい！
          </Button>
        </div>
      </Card>
    </div>
  )
}
