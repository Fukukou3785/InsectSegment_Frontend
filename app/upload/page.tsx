"use client"

import type React from "react"
import { useEffect } from "react"
import type { ReactElement } from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Upload, Crop, ImageIcon } from "lucide-react"
import Link from "next/link"

type CropHandle = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r" | null

// ★ サンプル画像のURLリスト
// public/samples フォルダに画像を置くのが一番早くて確実です。
// Hugging Faceの生画像URL(https://...)に変更することも可能です。
const SAMPLE_IMAGES = [
  "/samples/sample1.jpg",
  "/samples/sample2.jpg",
  "/samples/sample3.jpg",
]

export default function UploadPage(): ReactElement {
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isCropMode, setIsCropMode] = useState(false)
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [activeCropHandle, setActiveCropHandle] = useState<CropHandle>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0 })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // ★ 追加：サンプル画像を選択したときの処理
  const handleSampleSelect = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
      }
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error("Failed to load sample image:", error)
      alert("サンプル画像の読み込みに失敗しました。")
    }
  }

  const startCrop = () => {
    setIsCropMode(true)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // 画像の80%のサイズを計算
      const initialWidth = img.width * 0.8
      const initialHeight = img.height * 0.8
      // 中央に配置するためのX, Y座標を計算
      const x = (img.width - initialWidth) / 2
      const y = (img.height - initialHeight) / 2
      
      setCropArea({ x: x, y: y, width: initialWidth, height: initialHeight })
    }
    img.src = selectedImage!
  }

  const getMousePosOnCanvas = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = cropCanvasRef.current!
    const rect = canvas.getBoundingClientRect()

    const displayWidth = rect.width
    const displayHeight = rect.height
    const displayAspect = displayWidth / displayHeight

    const imageWidth = canvas.width
    const imageHeight = canvas.height
    const imageAspect = imageWidth / imageHeight

    let scale: number
    let offsetX = 0
    let offsetY = 0

    if (imageAspect > displayAspect) {
      scale = displayWidth / imageWidth
      offsetY = (displayHeight - imageHeight * scale) / 2
    } else {
      scale = displayHeight / imageHeight
      offsetX = (displayWidth - imageWidth * scale) / 2
    }

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const x = (mouseX - offsetX) / scale
    const y = (mouseY - offsetY) / scale

    return { x, y }
  }

  const getCropHandleAtPosition = (x: number, y: number): CropHandle => {
    const canvas = cropCanvasRef.current!

    const rect = canvas.getBoundingClientRect()
    const displayWidth = rect.width
    const displayHeight = rect.height
    const displayAspect = displayWidth / displayHeight
    const imageAspect = canvas.width / canvas.height
    
    let scale: number
    if (imageAspect > displayAspect) {
      scale = displayWidth / canvas.width
    } else {
      scale = displayHeight / canvas.height
    }

    const DETECT_CORNER_RADIUS = 25
    const DETECT_EDGE_RADIUS = 20

    const cornerHandleSize = DETECT_CORNER_RADIUS / scale
    const edgeThreshold = DETECT_EDGE_RADIUS / scale

    if (Math.abs(x - cropArea.x) < cornerHandleSize && Math.abs(y - cropArea.y) < cornerHandleSize) return "tl"
    if (Math.abs(x - (cropArea.x + cropArea.width)) < cornerHandleSize && Math.abs(y - cropArea.y) < cornerHandleSize) return "tr"
    if (Math.abs(x - cropArea.x) < cornerHandleSize && Math.abs(y - (cropArea.y + cropArea.height)) < cornerHandleSize) return "bl"
    if (Math.abs(x - (cropArea.x + cropArea.width)) < cornerHandleSize && Math.abs(y - (cropArea.y + cropArea.height)) < cornerHandleSize) return "br"

    if (Math.abs(x - cropArea.x) < edgeThreshold && y > cropArea.y + cornerHandleSize && y < cropArea.y + cropArea.height - cornerHandleSize) return "l"
    if (Math.abs(x - (cropArea.x + cropArea.width)) < edgeThreshold && y > cropArea.y + cornerHandleSize && y < cropArea.y + cropArea.height - cornerHandleSize) return "r"
    if (Math.abs(y - cropArea.y) < edgeThreshold && x > cropArea.x + cornerHandleSize && x < cropArea.x + cropArea.width - cornerHandleSize) return "t"
    if (Math.abs(y - (cropArea.y + cropArea.height)) < edgeThreshold && x > cropArea.x + cornerHandleSize && x < cropArea.x + cropArea.width - cornerHandleSize) return "b"

    return null
  }

  const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cropCanvasRef.current
    if (!canvas) return

    const { x, y } = getMousePosOnCanvas(e)
    const handle = getCropHandleAtPosition(x, y)
    setActiveCropHandle(handle)
    setDragStart({ x, y, cropX: cropArea.x, cropY: cropArea.y, cropWidth: cropArea.width, cropHeight: cropArea.height })
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cropCanvasRef.current
    if (!canvas) return

    const { x, y } = getMousePosOnCanvas(e)

    if (!activeCropHandle) {
      const handle = getCropHandleAtPosition(x, y)
      if (handle) {
        const cursors: Record<CropHandle, string> = {
          tl: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", br: "nwse-resize",
          t: "ns-resize", b: "ns-resize", l: "ew-resize", r: "ew-resize",
        }
        canvas.style.cursor = cursors[handle] || "default"
      } else {
        canvas.style.cursor = "default"
      }
      return
    }

    const dx = x - dragStart.x
    const dy = y - dragStart.y

    let newX = dragStart.cropX
    let newY = dragStart.cropY
    let newWidth = dragStart.cropWidth
    let newHeight = dragStart.cropHeight

    switch (activeCropHandle) {
      case "tl": newX = dragStart.cropX + dx; newY = dragStart.cropY + dy; newWidth = dragStart.cropWidth - dx; newHeight = dragStart.cropHeight - dy; break
      case "tr": newY = dragStart.cropY + dy; newWidth = dragStart.cropWidth + dx; newHeight = dragStart.cropHeight - dy; break
      case "bl": newX = dragStart.cropX + dx; newWidth = dragStart.cropWidth - dx; newHeight = dragStart.cropHeight + dy; break
      case "br": newWidth = dragStart.cropWidth + dx; newHeight = dragStart.cropHeight + dy; break
      case "t": newY = dragStart.cropY + dy; newHeight = dragStart.cropHeight - dy; break
      case "b": newHeight = dragStart.cropHeight + dy; break
      case "l": newX = dragStart.cropX + dx; newWidth = dragStart.cropWidth - dx; break
      case "r": newWidth = dragStart.cropWidth + dx; break
    }

    const minSize = 50
    if (canvas) {
      if (newWidth < minSize) {
        if (activeCropHandle === "l" || activeCropHandle === "tl" || activeCropHandle === "bl") {
          newX = dragStart.cropX + dragStart.cropWidth - minSize
          newWidth = minSize
        } else {
          newWidth = minSize
        }
      }
      if (newHeight < minSize) {
        if (activeCropHandle === "t" || activeCropHandle === "tl" || activeCropHandle === "tr") {
          newY = dragStart.cropY + dragStart.cropHeight - minSize
          newHeight = minSize
        } else {
          newHeight = minSize
        }
      }

      if (newX < 0) { newWidth = newWidth + newX; newX = 0 }
      if (newY < 0) { newHeight = newHeight + newY; newY = 0 }
      if (newX + newWidth > canvas.width) newWidth = canvas.width - newX
      if (newY + newHeight > canvas.height) newHeight = canvas.height - newY

      newWidth = Math.max(minSize, newWidth)
      newHeight = Math.max(minSize, newHeight)
    }

    setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight })
  }

  const handleCropMouseUp = () => setActiveCropHandle(null)

  const applyCrop = () => {
    const canvas = cropCanvasRef.current
    if (!canvas || !selectedImage) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const cropCanvas = document.createElement("canvas")
      cropCanvas.width = cropArea.width
      cropCanvas.height = cropArea.height
      const ctx = cropCanvas.getContext("2d")
      if (!ctx) return

      ctx.drawImage(img, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cropArea.width, cropArea.height)

      const croppedImage = cropCanvas.toDataURL("image/jpeg")
      setSelectedImage(croppedImage)
      setIsCropMode(false)
    }
    img.src = selectedImage
  }

  const cancelCrop = () => {
    setIsCropMode(false)
    setCropArea({ x: 0, y: 0, width: 0, height: 0 })
  }

  const drawCropCanvas = () => {
    const canvas = cropCanvasRef.current
    if (!canvas || !selectedImage) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height

      const rect = canvas.getBoundingClientRect()
      const displayWidth = rect.width
      const displayHeight = rect.height
      const displayAspect = displayWidth / displayHeight
      const imageAspect = canvas.width / canvas.height
      
      let scale: number
      if (imageAspect > displayAspect) {
        scale = displayWidth / canvas.width
      } else {
        scale = displayHeight / canvas.height
      }

      ctx.drawImage(img, 0, 0)
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)
      ctx.drawImage(img, cropArea.x, cropArea.y, cropArea.width, cropArea.height, cropArea.x, cropArea.y, cropArea.width, cropArea.height)

      ctx.strokeStyle = "#2563eb"
      ctx.lineWidth = 4
      ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

      const VISUAL_CORNER_SIZE = 24
      const VISUAL_EDGE_WIDTH = 40
      const VISUAL_EDGE_HEIGHT = 16

      const handleSize = VISUAL_CORNER_SIZE / scale
      const edgeHandleWidth = VISUAL_EDGE_WIDTH / scale
      const edgeHandleHeight = VISUAL_EDGE_HEIGHT / scale

      ctx.fillStyle = "#2563eb"

      ctx.fillRect(cropArea.x - handleSize / 2, cropArea.y - handleSize / 2, handleSize, handleSize)
      ctx.fillRect(cropArea.x + cropArea.width - handleSize / 2, cropArea.y - handleSize / 2, handleSize, handleSize)
      ctx.fillRect(cropArea.x - handleSize / 2, cropArea.y + cropArea.height - handleSize / 2, handleSize, handleSize)
      ctx.fillRect(cropArea.x + cropArea.width - handleSize / 2, cropArea.y + cropArea.height - handleSize / 2, handleSize, handleSize)

      ctx.fillRect(cropArea.x + cropArea.width / 2 - edgeHandleWidth / 2, cropArea.y - edgeHandleHeight / 2, edgeHandleWidth, edgeHandleHeight)
      ctx.fillRect(cropArea.x + cropArea.width / 2 - edgeHandleWidth / 2, cropArea.y + cropArea.height - edgeHandleHeight / 2, edgeHandleWidth, edgeHandleHeight)
      ctx.fillRect(cropArea.x - edgeHandleHeight / 2, cropArea.y + cropArea.height / 2 - edgeHandleWidth / 2, edgeHandleHeight, edgeHandleWidth)
      ctx.fillRect(cropArea.x + cropArea.width - edgeHandleHeight / 2, cropArea.y + cropArea.height / 2 - edgeHandleWidth / 2, edgeHandleHeight, edgeHandleWidth)
    }
    img.src = selectedImage
  }

  const handleProcess = async () => {
    if (selectedImage) {
      sessionStorage.setItem("insectImage", selectedImage)
      router.push("/processing")
    }
  }

  useEffect(() => {
    if (isCropMode && cropArea.width > 0 && cropArea.height > 0) {
      drawCropCanvas()
    }
  }, [cropArea, isCropMode])

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="bg-primary text-primary-foreground py-3 px-4 md:px-6 flex items-center gap-3 md:gap-4 flex-shrink-0">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg md:text-xl font-bold">しゃしんをえらぶ</h1>
      </header>

      <main className="flex-1 min-h-0 p-3 md:p-4 flex flex-col items-center justify-center gap-3 md:gap-4 overflow-y-auto">
        {!selectedImage && !isCropMode && (
          <Card className="w-full max-w-2xl p-4 md:p-6 space-y-4">
            <div className="space-y-4">
              <Button
                size="lg"
                className="w-full h-14 md:h-16 text-base md:text-lg font-bold gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5" />
                じぶんのしゃしんをえらぶ
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs md:text-sm">
                  <span className="bg-card px-3 text-muted-foreground font-bold">または</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm md:text-base font-bold text-center text-gray-700">
                  <ImageIcon className="w-5 h-5 inline-block mr-2 mb-1 text-primary" />
                  サンプルがぞうでためす
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {SAMPLE_IMAGES.map((src, index) => (
                    <button
                      key={index}
                      onClick={() => handleSampleSelect(src)}
                      className="aspect-square border-2 border-gray-200 rounded-lg overflow-hidden hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Sample ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t space-y-2">
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                <strong>ヒント：</strong>
              </p>
              <ul className="text-xs md:text-sm text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                <li>こんちゅうがはっきりうつっているしゃしんをえらんでね</li>
                <li>あかるいばしょでとったしゃしんがいいよ</li>
              </ul>
            </div>
          </Card>
        )}

        {selectedImage && !isCropMode && (
          <Card className="w-full max-w-4xl p-3 md:p-4 space-y-3 flex-shrink-0" style={{ maxHeight: "calc(100vh - 140px)" }}>
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <img src={selectedImage} alt="Selected insect" className="w-full h-full object-contain" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant="outline" className="h-12 md:h-14 flex items-center justify-center gap-2 text-sm md:text-base font-bold bg-transparent" onClick={startCrop} disabled={isProcessing}>
                <Crop className="w-4 h-4" /> トリミング
              </Button>
              <Button size="lg" variant="outline" className="h-12 md:h-14 text-sm md:text-base font-bold bg-transparent" onClick={() => setSelectedImage(null)} disabled={isProcessing}>
                やりなおす
              </Button>
            </div>
            <Button size="lg" className="w-full h-12 md:h-14 text-base md:text-lg font-bold" onClick={handleProcess} disabled={isProcessing}>
              {isProcessing ? "しょりちゅう..." : "つぎへ"}
            </Button>
          </Card>
        )}

        {isCropMode && (
          <Card className="w-full max-w-4xl p-3 md:p-4 space-y-3 flex-shrink-0" style={{ maxHeight: "calc(100vh - 140px)" }}>
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <canvas
                ref={cropCanvasRef}
                className="w-full h-full object-contain"
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
              />
            </div>
            <p className="text-xs md:text-sm text-center text-muted-foreground">
              わくのかどやへんをドラッグして、きりぬきたいはんいをちょうせいしてね
            </p>
            <div className="flex gap-2">
              <Button size="lg" className="flex-1 h-12 md:h-14 text-base md:text-lg font-bold" onClick={applyCrop}>
                ✓ 切り抜く
              </Button>
              <Button size="lg" variant="outline" className="flex-1 h-12 md:h-14 text-base md:text-lg font-bold bg-transparent" onClick={cancelCrop}>
                キャンセル
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}