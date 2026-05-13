"use client"

import type React from "react"
import { useEffect } from "react"
import type { ReactElement } from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Camera, Upload, Loader2, Crop } from "lucide-react"
import Link from "next/link"

type CropHandle = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r" | null

export default function UploadPage(): ReactElement {
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
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

  const startCamera = async () => {
    setIsCameraLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsCameraActive(true)
        setIsCameraLoading(false)
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      setIsCameraLoading(false)
      alert("カメラにアクセスできませんでした。ブラウザの設定でカメラの使用を許可してください。")
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL("image/jpeg")
        setCapturedPhoto(imageData)
      }
    }
  }

  const confirmPhoto = () => {
    setSelectedImage(capturedPhoto)
    setCapturedPhoto(null)
    stopCamera()
  }

  const retakePhoto = () => {
    setCapturedPhoto(null)
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      setIsCameraActive(false)
    }
  }

  // page.tsx L:93
  const startCrop = () => {
    setIsCropMode(true)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // --- 修正ここから ---
      // 画像の80%のサイズを計算
      const initialWidth = img.width * 0.8
      const initialHeight = img.height * 0.8
      // 中央に配置するためのX, Y座標を計算
      const x = (img.width - initialWidth) / 2
      const y = (img.height - initialHeight) / 2
      
      setCropArea({ x: x, y: y, width: initialWidth, height: initialHeight })
      // --- 修正ここまで ---

      //setTimeout(() => drawCropCanvas(), 50)
    }
    img.src = selectedImage!
  }


// page.tsxの166行目の「前」に追加

  /**
   * object-containによる余白を考慮し、
   * Canvas上の正しいマウス座標（x, y）を計算するヘルパー関数
   */
  const getMousePosOnCanvas = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = cropCanvasRef.current!
    const rect = canvas.getBoundingClientRect()

    // 1. CanvasのDOM要素としての表示サイズと比率
    const displayWidth = rect.width
    const displayHeight = rect.height
    const displayAspect = displayWidth / displayHeight

    // 2. Canvasの内部解像度（＝画像の元サイズ）と比率
    const imageWidth = canvas.width
    const imageHeight = canvas.height
    const imageAspect = imageWidth / imageHeight

    let scale: number
    let offsetX = 0
    let offsetY = 0

    // 3. 余白（オフセット）の計算
    if (imageAspect > displayAspect) {
      // 画像が横長の場合 (上下に余白)
      scale = displayWidth / imageWidth
      offsetY = (displayHeight - imageHeight * scale) / 2
    } else {
      // 画像が縦長の場合 (左右に余白)
      scale = displayHeight / imageHeight
      offsetX = (displayWidth - imageWidth * scale) / 2
    }

    // 4. マウスクリック位置から余白を減算し、スケールで割って元の座標を求める
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const x = (mouseX - offsetX) / scale
    const y = (mouseY - offsetY) / scale

    return { x, y }
  }

// ここから元の getCropHandleAtPosition が続く...
// const getCropHandleAtPosition = (x: number, y: number): CropHandle => {
// ...

  // page.tsxの198行目から、この関数を丸ごと置き換えてください
  const getCropHandleAtPosition = (x: number, y: number): CropHandle => {
    const canvas = cropCanvasRef.current! // この関数が呼ばれる時点でCanvasは存在するはず

    // --- [NEW] ---
    // 画像サイズと表示サイズの縮尺率(scale)を計算し、
    // 常に一定の「見た目のサイズ」で検出できるようにする
    const rect = canvas.getBoundingClientRect()
    const displayWidth = rect.width
    const displayHeight = rect.height
    const displayAspect = displayWidth / displayHeight
    const imageAspect = canvas.width / canvas.height
    
    let scale: number
    if (imageAspect > displayAspect) {
      scale = displayWidth / canvas.width // 幅にフィット
    } else {
      scale = displayHeight / canvas.height // 高さにフィット
    }

    // 常に一定にしたい「見た目」の検出範囲（スクリーンピクセル）
    const DETECT_CORNER_RADIUS = 25 // (例: 見た目25pxの範囲で角を検出)
    const DETECT_EDGE_RADIUS = 20   // (例: 見た目20pxの範囲で辺を検出)

    // 見た目の検出範囲を、Canvasの内部座標系に変換
    const cornerHandleSize = DETECT_CORNER_RADIUS / scale
    const edgeThreshold = DETECT_EDGE_RADIUS / scale
    // --- [END NEW] ---

    // 1. 角 (Corners) - 最優先
    if (Math.abs(x - cropArea.x) < cornerHandleSize && Math.abs(y - cropArea.y) < cornerHandleSize) return "tl"
    if (Math.abs(x - (cropArea.x + cropArea.width)) < cornerHandleSize && Math.abs(y - cropArea.y) < cornerHandleSize)
      return "tr"
    if (Math.abs(x - cropArea.x) < cornerHandleSize && Math.abs(y - (cropArea.y + cropArea.height)) < cornerHandleSize)
      return "bl"
    if (
      Math.abs(x - (cropArea.x + cropArea.width)) < cornerHandleSize &&
      Math.abs(y - (cropArea.y + cropArea.height)) < cornerHandleSize
    )
      return "br"

    // 2. 辺 (Edges) - 角の範囲(cornerHandleSize)を除外してチェック
    // 左辺 (Left)
    if (
      Math.abs(x - cropArea.x) < edgeThreshold &&
      y > cropArea.y + cornerHandleSize && // 角(tl, bl)を除外
      y < cropArea.y + cropArea.height - cornerHandleSize
    )
      return "l"
    // 右辺 (Right)
    if (
      Math.abs(x - (cropArea.x + cropArea.width)) < edgeThreshold &&
      y > cropArea.y + cornerHandleSize && // 角(tr, br)を除外
      y < cropArea.y + cropArea.height - cornerHandleSize
    )
      return "r"
    // 上辺 (Top)
    if (
      Math.abs(y - cropArea.y) < edgeThreshold &&
      x > cropArea.x + cornerHandleSize && // 角(tl, tr)を除外
      x < cropArea.x + cropArea.width - cornerHandleSize
    )
      return "t"
    // 下辺 (Bottom)
    if (
      Math.abs(y - (cropArea.y + cropArea.height)) < edgeThreshold &&
      x > cropArea.x + cornerHandleSize && // 角(bl, br)を除外
      x < cropArea.x + cropArea.width - cornerHandleSize
    )
      return "b"

    return null
  }


  const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cropCanvasRef.current
    if (!canvas) return

    // 新しいヘルパー関数で正しい座標を取得
    const { x, y } = getMousePosOnCanvas(e)

    const handle = getCropHandleAtPosition(x, y)
    setActiveCropHandle(handle)
    setDragStart({
      x,
      y,
      cropX: cropArea.x,
      cropY: cropArea.y,
      cropWidth: cropArea.width,
      cropHeight: cropArea.height,
    })
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cropCanvasRef.current
    if (!canvas) return

    // 新しいヘルパー関数で正しい座標を取得
    const { x, y } = getMousePosOnCanvas(e)

    if (!activeCropHandle) {
      const handle = getCropHandleAtPosition(x, y)
      if (handle) {
        const cursors: Record<CropHandle, string> = {
          tl: "nwse-resize",
          tr: "nesw-resize",
          bl: "nesw-resize",
          br: "nwse-resize",
          t: "ns-resize",
          b: "ns-resize",
          l: "ew-resize",
          r: "ew-resize",
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
      case "tl":
        newX = dragStart.cropX + dx
        newY = dragStart.cropY + dy
        newWidth = dragStart.cropWidth - dx
        newHeight = dragStart.cropHeight - dy
        break
      case "tr":
        newY = dragStart.cropY + dy
        newWidth = dragStart.cropWidth + dx
        newHeight = dragStart.cropHeight - dy
        break
      case "bl":
        newX = dragStart.cropX + dx
        newWidth = dragStart.cropWidth - dx
        newHeight = dragStart.cropHeight + dy
        break
      case "br":
        newWidth = dragStart.cropWidth + dx
        newHeight = dragStart.cropHeight + dy
        break
      case "t":
        newY = dragStart.cropY + dy
        newHeight = dragStart.cropHeight - dy
        break
      case "b":
        newHeight = dragStart.cropHeight + dy
        break
      case "l":
        newX = dragStart.cropX + dx
        newWidth = dragStart.cropWidth - dx
        break
      case "r":
        newWidth = dragStart.cropWidth + dx
        break
    }

    const minSize = 50
    if (canvas) {
      // まず最小サイズを保証
      if (newWidth < minSize) {
        if (activeCropHandle === "l" || activeCropHandle === "tl" || activeCropHandle === "bl") {
          // 左側ハンドル: 右側の位置を固定
          newX = dragStart.cropX + dragStart.cropWidth - minSize
          newWidth = minSize
        } else {
          // 右側ハンドル: 左側の位置を固定
          newWidth = minSize
        }
      }
      if (newHeight < minSize) {
        if (activeCropHandle === "t" || activeCropHandle === "tl" || activeCropHandle === "tr") {
          // 上側ハンドル: 下側の位置を固定
          newY = dragStart.cropY + dragStart.cropHeight - minSize
          newHeight = minSize
        } else {
          // 下側ハンドル: 上側の位置を固定
          newHeight = minSize
        }
      }

      // キャンバスの境界を超えないように制約
      if (newX < 0) {
        newWidth = newWidth + newX
        newX = 0
      }
      if (newY < 0) {
        newHeight = newHeight + newY
        newY = 0
      }
      if (newX + newWidth > canvas.width) {
        newWidth = canvas.width - newX
      }
      if (newY + newHeight > canvas.height) {
        newHeight = canvas.height - newY
      }

      // 最小サイズを再度チェック
      newWidth = Math.max(minSize, newWidth)
      newHeight = Math.max(minSize, newHeight)
    }

    setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight })
  }

  const handleCropMouseUp = () => {
    setActiveCropHandle(null)
  }

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
    // ↓↓↓ この行を追加してください
    setCropArea({ x: 0, y: 0, width: 0, height: 0 }) // ステートを初期値に戻す
  }

  // page.tsxの437行目から、この関数を丸ごと置き換えてください
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

      // --- [NEW] ---
      // 画像サイズと表示サイズの縮尺率(scale)を計算
      const rect = canvas.getBoundingClientRect()
      const displayWidth = rect.width
      const displayHeight = rect.height
      const displayAspect = displayWidth / displayHeight
      const imageAspect = canvas.width / canvas.height
      
      let scale: number
      if (imageAspect > displayAspect) {
        scale = displayWidth / canvas.width // 幅にフィット
      } else {
        scale = displayHeight / canvas.height // 高さにフィット
      }
      // --- [END NEW] ---

      // Draw original image
      ctx.drawImage(img, 0, 0)

      ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Clear crop area to show original image
      ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

      // Redraw original image in crop area
      ctx.drawImage(
        img,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
      )

      ctx.strokeStyle = "#2563eb"
      ctx.lineWidth = 4 // 枠線の太さは4pxのまま
      ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

      // --- [NEW] ---
      // 常に一定にしたい「見た目」のハンドルサイズ（スクリーンピクセル）
      const VISUAL_CORNER_SIZE = 24  // (例: 見た目24px)
      const VISUAL_EDGE_WIDTH = 40   // (例: 見た目40px)
      const VISUAL_EDGE_HEIGHT = 16  // (例: 見た目16px)

      // 見た目のサイズを、Canvasの内部座標系での描画サイズに変換
      const handleSize = VISUAL_CORNER_SIZE / scale
      const edgeHandleWidth = VISUAL_EDGE_WIDTH / scale
      const edgeHandleHeight = VISUAL_EDGE_HEIGHT / scale
      // --- [END NEW] ---

      ctx.fillStyle = "#2563eb"

      // Corner handles (新しい handleSize を使用)
      ctx.fillRect(cropArea.x - handleSize / 2, cropArea.y - handleSize / 2, handleSize, handleSize)
      ctx.fillRect(cropArea.x + cropArea.width - handleSize / 2, cropArea.y - handleSize / 2, handleSize, handleSize)
      ctx.fillRect(cropArea.x - handleSize / 2, cropArea.y + cropArea.height - handleSize / 2, handleSize, handleSize)
      ctx.fillRect(
        cropArea.x + cropArea.width - handleSize / 2,
        cropArea.y + cropArea.height - handleSize / 2,
        handleSize,
        handleSize,
      )

      // Edge handles (新しい edgeHandleWidth / edgeHandleHeight を使用)
      // Top
      ctx.fillRect(
        cropArea.x + cropArea.width / 2 - edgeHandleWidth / 2,
        cropArea.y - edgeHandleHeight / 2,
        edgeHandleWidth,
        edgeHandleHeight,
      )
      // Bottom
      ctx.fillRect(
        cropArea.x + cropArea.width / 2 - edgeHandleWidth / 2,
        cropArea.y + cropArea.height - edgeHandleHeight / 2,
        edgeHandleWidth,
        edgeHandleHeight,
      )
      // Left
      ctx.fillRect(
        cropArea.x - edgeHandleHeight / 2,
        cropArea.y + cropArea.height / 2 - edgeHandleWidth / 2,
        edgeHandleHeight,
        edgeHandleWidth,
      )
      // Right
      ctx.fillRect(
        cropArea.x + cropArea.width - edgeHandleHeight / 2,
        cropArea.y + cropArea.height / 2 - edgeHandleWidth / 2,
        edgeHandleHeight,
        edgeHandleWidth,
      )
    }
    img.src = selectedImage
  }

  const handleProcess = async () => {
    if (selectedImage) {
      // 画像を保存して、すぐにprocessingページへ飛ばすだけにする
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
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-3 px-4 md:px-6 flex items-center gap-3 md:gap-4 flex-shrink-0">
        <Link href="/">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg md:text-xl font-bold">しゃしんをえらぶ</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 p-3 md:p-4 flex flex-col items-center justify-center gap-3 md:gap-4 overflow-y-auto">
        {!selectedImage && !isCameraActive && !isCameraLoading && !capturedPhoto && (
          <Card className="w-full max-w-2xl p-4 md:p-6 space-y-4">
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full h-14 md:h-16 text-base md:text-lg font-bold gap-2"
                onClick={startCamera}
              >
                <Camera className="w-5 h-5" />
                カメラでさつえい
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs md:text-sm">
                  <span className="bg-card px-3 text-muted-foreground">または</span>
                </div>
              </div>

              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 md:h-16 text-base md:text-lg font-bold gap-2 bg-transparent"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5" />
                しゃしんをえらぶ
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
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

        {isCameraLoading && (
          <Card className="w-full max-w-2xl p-6 md:p-8 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 md:w-12 md:h-12 animate-spin text-primary" />
            <p className="text-base md:text-lg font-bold">カメラをきどうちゅう...</p>
          </Card>
        )}

        {isCameraActive && !capturedPhoto && (
          <Card
            className="w-full max-w-4xl p-3 md:p-4 space-y-3 flex-shrink-0"
            style={{ maxHeight: "calc(100vh - 140px)" }}
          >
            <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2">
              <Button size="lg" className="flex-1 h-12 md:h-14 text-base md:text-lg font-bold" onClick={capturePhoto}>
                📸 さつえい
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 md:h-14 px-4 md:px-6 text-sm md:text-base font-bold bg-transparent"
                onClick={stopCamera}
              >
                キャンセル
              </Button>
            </div>
          </Card>
        )}

        {capturedPhoto && (
          <Card
            className="w-full max-w-4xl p-3 md:p-4 space-y-3 flex-shrink-0"
            style={{ maxHeight: "calc(100vh - 140px)" }}
          >
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <img
                src={capturedPhoto || "/placeholder.svg"}
                alt="Captured insect"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button size="lg" className="flex-1 h-12 md:h-14 text-base md:text-lg font-bold" onClick={confirmPhoto}>
                ✓ これでいい
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 h-12 md:h-14 text-base md:text-lg font-bold bg-transparent"
                onClick={retakePhoto}
              >
                とりなおす
              </Button>
            </div>
          </Card>
        )}

        {selectedImage && !isCameraActive && !capturedPhoto && !isCropMode && (
          <Card
            className="w-full max-w-4xl p-3 md:p-4 space-y-3 flex-shrink-0"
            style={{ maxHeight: "calc(100vh - 140px)" }}
          >
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <img
                src={selectedImage || "/placeholder.svg"}
                alt="Selected insect"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                variant="outline"
                className="h-12 md:h-14 flex items-center justify-center gap-2 text-sm md:text-base font-bold bg-transparent"
                onClick={startCrop}
                disabled={isProcessing}
              >
                <Crop className="w-4 h-4" />
                トリミング
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 md:h-14 text-sm md:text-base font-bold bg-transparent"
                onClick={() => setSelectedImage(null)}
                disabled={isProcessing}
              >
                やりなおす
              </Button>
            </div>
            <Button
              size="lg"
              className="w-full h-12 md:h-14 text-base md:text-lg font-bold"
              onClick={handleProcess}
              disabled={isProcessing}
            >
              {isProcessing ? "しょりちゅう..." : "つぎへ"}
            </Button>
          </Card>
        )}

        {isCropMode && (
          <Card
            className="w-full max-w-4xl p-3 md:p-4 space-y-3 flex-shrink-0"
            style={{ maxHeight: "calc(100vh - 140px)" }}
          >
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
              <Button
                size="lg"
                variant="outline"
                className="flex-1 h-12 md:h-14 text-base md:text-lg font-bold bg-transparent"
                onClick={cancelCrop}
              >
                キャンセル
              </Button>
            </div>
          </Card>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </main>
    </div>
  )
}
