"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
// ★変更: Wand2 (魔法の杖) を追加
import { ArrowLeft, Eraser, Paintbrush, RotateCcw, Sparkles, ZoomIn, ZoomOut, Lock, Unlock, Wand2 } from "lucide-react"
import Link from "next/link"

type BodyPartType = "head" | "thorax" | "abdomen" | "legs"
type BrushSizeType = "small" | "medium" | "large"
// ★変更: sam を追加
type ToolType = "brush" | "eraser" | "zoom-in" | "zoom-out" | "sam"

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

export default function EditorPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const guardCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState<BrushSizeType>("medium")
  const [tool, setTool] = useState<ToolType>("brush") // 初期値をbrushに
  const [selectedPart, setSelectedPart] = useState<BodyPartType>("head")
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [history, setHistory] = useState<ImageData[]>([])
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const [useGuard, setUseGuard] = useState(true)
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false)
  
  // ★追加: SAM処理中かどうかのフラグ
  const [isProcessingAI, setIsProcessingAI] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (originalImage) redrawCanvas()
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [originalImage])

 // 1. 【追加】この関数を、 handleResize の定義の下あたりに追加してください
  const updateGuardCanvas = () => {
    const maskCanvas = maskCanvasRef.current
    const guardCanvas = guardCanvasRef.current
    if (!maskCanvas || !guardCanvas) return
    const guardCtx = guardCanvas.getContext("2d")
    if (!guardCtx) return

    // ガード用キャンバスをクリアして、現在のマスクをコピー（同期）する
    guardCtx.clearRect(0, 0, guardCanvas.width, guardCanvas.height)
    guardCtx.drawImage(maskCanvas, 0, 0)
  }

  // カーソルの更新Effect
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
        // ★追加: SAMツールのカーソル（十字キーのような見た目に変更）
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
      router.push("/upload")
      return
    }

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
      const sessionId = sessionStorage.getItem("sessionId") // ← 追加

      const formData = new FormData()
      formData.append("current_mask", currentMaskBase64)
      if (sessionId) formData.append("session_id", sessionId) // ← 追加

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recalc_lines`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Recalc Failed")

      const data = await response.json()

      // 新しい線の位置(比率)を保存
      if (data.thorax_top !== undefined) {
        sessionStorage.setItem("thoraxTop", data.thorax_top.toString())
        sessionStorage.setItem("thoraxBottom", data.thorax_bottom.toString())
        
        // ★重要: ここでReactのstateも更新して、エディタ上の黄色い線を即座に動かす
        // Editorページ内で thoraxTop などの state を持っている場合は更新してください
        // setThoraxTop(data.thorax_top) 
        // setThoraxBottom(data.thorax_bottom)
        
        console.log("Lines updated based on brush strokes")
      }
    } catch (e) {
      console.error("Failed to recalculate lines:", e)
    }
  }

   // ... (前略)

  // ★修正: デモ動画用に「からだのつくり（構造）」の色で画像を生成して保存する関数
  const downloadDemoImage = () => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    try {
      // 1. 境界線データの取得 (比率)
      // sessionStorage には最新の計算結果が入っているはずです
      const storedTop = sessionStorage.getItem("thoraxTop")
      const storedBottom = sessionStorage.getItem("thoraxBottom")
      const ratioTop = storedTop ? parseFloat(storedTop) : 0.33
      const ratioBottom = storedBottom ? parseFloat(storedBottom) : 0.66

      // 2. 合成用の仮キャンバスを作成
      const tempCanvas = document.createElement("canvas")
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const ctx = tempCanvas.getContext("2d")
      if (!ctx) return

      // 3. 元の昆虫画像を描画
      ctx.drawImage(canvas, 0, 0)

      // 4. マスクデータを取得して「構造色」に塗り替える
      const maskCtx = maskCanvas.getContext("2d")
      if (!maskCtx) return
      
      const width = canvas.width
      const height = canvas.height
      
      // マスクのピクセルデータを取得
      const maskImageData = maskCtx.getImageData(0, 0, width, height)
      const data = maskImageData.data

      // 色定義 (Resultページと同じもの)
      const COLOR_HEAD = [31, 119, 180]    // 青
      const COLOR_THORAX = [44, 160, 44]  // 緑
      const COLOR_ABDOMEN = [214, 39, 40] // 赤
      const COLOR_LEG = [148, 103, 189]   // 紫

      // Y座標の境界線 (ピクセル)
      const yHeadEnd = ratioTop * height
      const yThoraxEnd = ratioBottom * height

      // 全ピクセルを走査して色を変換
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]

        if (a === 0) continue // 塗られていない場所はスキップ

        // 足判定 (紫に近いか)
        const distLeg = Math.abs(r - COLOR_LEG[0]) + Math.abs(g - COLOR_LEG[1]) + Math.abs(b - COLOR_LEG[2])
        const isLeg = distLeg < 80

        const pixelIndex = i / 4
        const y = Math.floor(pixelIndex / width)

        // 色の塗り替えロジック
        if (isLeg) {
             // 足は紫にする
             data[i] = COLOR_LEG[0]; data[i+1] = COLOR_LEG[1]; data[i+2] = COLOR_LEG[2]
        } else {
             // 体はY座標に応じて青・緑・赤にする
             if (y < yHeadEnd) {
                 data[i] = COLOR_HEAD[0]; data[i+1] = COLOR_HEAD[1]; data[i+2] = COLOR_HEAD[2]
             } else if (y < yThoraxEnd) {
                 data[i] = COLOR_THORAX[0]; data[i+1] = COLOR_THORAX[1]; data[i+2] = COLOR_THORAX[2]
             } else {
                 data[i] = COLOR_ABDOMEN[0]; data[i+1] = COLOR_ABDOMEN[1]; data[i+2] = COLOR_ABDOMEN[2]
             }
        }
        // 透明度を設定 (少し透けさせる)
        data[i + 3] = 180 
      }

      // 5. 塗り替えたマスク画像を、元画像の上に重ねる
      // (putImageDataだと透明度がうまく合成されないことがあるため、一度別キャンバスを経由)
      const coloredMaskCanvas = document.createElement("canvas")
      coloredMaskCanvas.width = width
      coloredMaskCanvas.height = height
      const coloredCtx = coloredMaskCanvas.getContext("2d")
      
      if (coloredCtx) {
          coloredCtx.putImageData(maskImageData, 0, 0)
          ctx.drawImage(coloredMaskCanvas, 0, 0)
      }

      // 6. ダウンロード実行
      const link = document.createElement("a")
      link.download = "demo_structure_mode.png" // ファイル名変更
      link.href = tempCanvas.toDataURL("image/png")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (e) {
      console.error("Demo download failed:", e)
    }
  }

  // ... (handleFinish などで呼び出し)

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

  const updateCursorPosition = (e: React.MouseEvent | React.TouchEvent) => {
    if (!cursorRef.current) return
    let clientX, clientY
    if ("touches" in e) {
       if (e.touches.length > 0) {
         clientX = e.touches[0].clientX
         clientY = e.touches[0].clientY
       } else return 
    } else {
       clientX = e.clientX
       clientY = e.clientY
    }
    cursorRef.current.style.transform = `translate(${clientX}px, ${clientY}px) translate(-50%, -50%)`
  }

  // --- 描画開始 (ブラシ・消しゴム用) ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === "sam") return // SAMモードの時はドラッグ描画しない
    if (tool === "zoom-in") { handleZoom(0.5); return }
    if (tool === "zoom-out") { handleZoom(-0.5); return }

    setIsDrawing(true)
    updateCursorPosition(e)
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
      
      // ★ここは updateGuardCanvas() ではなく、
      // さきほど作成した「線を再計算する関数」を呼び出します！
      if (tool === "brush" || tool === "eraser") {
          recalcLinesFromMask() 
      }
    }
  }

  // ★追加: クリック時の処理 (SAM用)
  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== "sam" || isProcessingAI) return

    const pos = getCanvasPosition(e)
    if (!pos) return

    try {
        setIsProcessingAI(true)
        
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas) return
        
        // 現在のマスク画像をサーバーに送る
        const currentMaskBase64 = maskCanvas.toDataURL("image/png")
        const sessionId = sessionStorage.getItem("sessionId") // ← 追加

        const formData = new FormData()
        formData.append('x', Math.round(pos.x).toString())
        formData.append('y', Math.round(pos.y).toString())
        formData.append('label_part', selectedPart)
        formData.append('current_mask', currentMaskBase64) 
        if (sessionId) formData.append('session_id', sessionId) // ← 追加

       const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/refine`, {
            method: 'POST',
            body: formData,
        })
        
        if (!response.ok) throw new Error("API Error")

        const data = await response.json()
        const newMaskBase64 = data.segmented_image_base64
        
        // ★追加: サーバーから新しい境界線データを受け取って更新
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
                 
                 // ★重要: ここでガード（枠）を更新する関数を呼び出す！
                 // これでAIが塗った場所もブラシで塗れるようになります
                 updateGuardCanvas()
                 
                 redrawCanvas()
                 saveToHistory()
                 setIsProcessingAI(false)
             }
             img.src = newMaskBase64
        }
    } catch (error) {
        console.error("SAM Error", error)
        setIsProcessingAI(false)
        alert("AI修正に失敗しました")
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
      // ★ここが超重要！一度キャンバスを「透明」にしてから描画する
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
      
      maskCtx.putImageData(previousState, 0, 0)
      setHistory(newHistory)
      redrawCanvas()
    }
  }

  

  const handleNext = async () => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return
    const userMaskData = maskCanvas.toDataURL("image/png")
    sessionStorage.setItem("editedMask", userMaskData)

    // ★追加: ここでデモ画像をダウンロード！
    downloadDemoImage()

    const shouldSave = window.confirm("研究のためにデータを保存しますか？\n（「はい」で保存、「いいえ」で保存せずに進みます）")

    if (shouldSave) {
      const originalData = sessionStorage.getItem("insectImage")
      const aiMaskData = sessionStorage.getItem("segmentedImage")
      const tTop = sessionStorage.getItem("thoraxTop")
      const tBottom = sessionStorage.getItem("thoraxBottom")
      if (originalData && aiMaskData) {
        try {
          // ★確認ポイント: session_id が確実に送られているか
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/save_log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              original_base64: originalData,
              ai_mask_base64: aiMaskData,
              user_mask_base64: userMaskData,
              thorax_top: Number(tTop) || 0,
              thorax_bottom: Number(tBottom) || 0,
              session_id: sessionStorage.getItem("sessionId") || "unknown" // ← ここ！
            }),
          })
          alert("データを保存しました！ご協力ありがとうございます。")
        } catch (e) {
          alert("保存に失敗しましたが、次へ進みます。")
        }
      }
    }
    router.push("/result")
  }

  const getCursorStyle = () => {
    if (tool === "zoom-in") return "zoom-in"
    if (tool === "zoom-out") return "zoom-out"
    if (tool === "sam" && isProcessingAI) return "wait"
    if (tool === "sam") return "pointer" // 修正: SAMのときはポインタ
    return "none"
  }


  

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-green-50 to-blue-50 overflow-hidden">
      
      {/* カスタムカーソル */}
      <div 
        ref={cursorRef}
        className="fixed pointer-events-none z-50 transition-opacity duration-75"
        style={{ 
            width: 0, height: 0, 
            opacity: (isHoveringCanvas && (tool === 'brush' || tool === 'eraser' || tool === 'sam')) ? 1 : 0,
            left: 0, top: 0,
            willChange: 'transform'
        }}
      />

      {/* ヘッダー部分は変更なし */}
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

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-32 sm:w-48 md:w-56 lg:w-64 xl:w-72 flex-shrink-0 flex flex-col p-1.5 sm:p-2 md:p-3 bg-white border-r border-gray-200 overflow-hidden">
          
          <div className="flex flex-col h-full gap-1.5 sm:gap-2 md:gap-3 overflow-y-auto">
            {/* 部位選択パネル (変更: 選択時に自動でSAMツールにならないようにする) */}
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
                    onClick={() => {
                      setSelectedPart(part)
                      // ここで強制的にツールを変えないほうが親切かも？
                      // ユーザーが「AIで修正」を選んでいたらそのままで
                    }}
                  >
                    <div className="text-base sm:text-xl mb-0.5">{bodyPartEmojis[part]}</div>
                    <div className="text-[8px] sm:text-[10px]">{bodyPartLabels[part]}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* 道具パネル (変更: AI修正ボタン追加) */}
            <Card className="p-1.5 sm:p-2 md:p-3 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md flex-shrink-0">
              <h3 className="text-[10px] sm:text-xs md:text-sm font-bold mb-1 sm:mb-2 text-center text-gray-800">
                どうぐ
              </h3>
              <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                {/* ★追加: AI修正ボタン */}
                <Button
                  size="sm"
                  className={`col-span-2 h-10 sm:h-12 md:h-14 flex flex-col gap-0.5 text-[9px] sm:text-xs font-bold transition-all transform hover:scale-105 ${
                    tool === "sam"
                      ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg scale-105 ring-2 ring-yellow-400"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                  }`}
                  onClick={() => setTool("sam")}
                >
                  <div className="flex items-center gap-2">
                     <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                     <span className="text-[10px] sm:text-xs">AIでしゅうせい</span>
                  </div>
                </Button>

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
                
                {/* 拡大縮小ボタン (そのまま) */}
                <Button
                  size="sm"
                  className={`h-10 sm:h-12 md:h-14 flex flex-col gap-0.5 text-[9px] sm:text-xs font-bold transition-all transform hover:scale-105 ${
                    tool === "zoom-in"
                      ? "bg-teal-500 hover:bg-teal-600 shadow-lg scale-105 ring-2 ring-yellow-400"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  onClick={() => setTool("zoom-in")}
                >
                  <ZoomIn className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-[8px] sm:text-[10px]">かくだい</span>
                </Button>
                <Button
                  size="sm"
                  className={`h-10 sm:h-12 md:h-14 flex flex-col gap-0.5 text-[9px] sm:text-xs font-bold transition-all transform hover:scale-105 ${
                    tool === "zoom-out"
                      ? "bg-teal-500 hover:bg-teal-600 shadow-lg scale-105 ring-2 ring-yellow-400"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  onClick={() => setTool("zoom-out")}
                >
                  <ZoomOut className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-[8px] sm:text-[10px]">しゅくしょう</span>
                </Button>
              </div>

              {/*<div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[9px] sm:text-xs font-bold text-gray-700">
                      {useGuard ? "わくからはみでない" : "じゆうにぬれるよ"}
                  </span>
                  <div 
                    className="cursor-pointer"
                    onClick={() => setUseGuard(!useGuard)}
                  >
                      {useGuard ? (
                          <div className="bg-green-500 text-white p-1 rounded-full"><Lock className="w-3 h-3" /></div>
                      ) : (
                          <div className="bg-gray-400 text-white p-1 rounded-full"><Unlock className="w-3 h-3" /></div>
                      )}
                  </div>
              </div>*/}
              
            </Card>

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
              className="h-10 sm:h-12 md:h-14 text-[9px] sm:text-xs md:text-sm font-bold bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 shadow-xl transform hover:scale-105 transition-all flex-shrink-0"
              onClick={handleNext}
            >
              できた！つぎへ →
            </Button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-0 flex overflow-hidden bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
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
                onMouseEnter={() => setIsHoveringCanvas(true)}
                onMouseLeave={() => { setIsHoveringCanvas(false); stopDrawing() }}
                
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}

                // ★追加: クリック時の処理
                onClick={handleCanvasClick}
              />
              <canvas ref={maskCanvasRef} className="hidden" />
              <canvas ref={guardCanvasRef} className="hidden" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}