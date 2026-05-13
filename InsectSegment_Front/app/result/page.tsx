"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Home, RotateCcw, Sparkles } from "lucide-react"
import Link from "next/link"

type BodyPart = {
  name: string
  color: string
  description: string
  funFact: string
}

const bodyParts: BodyPart[] = [
  {
    name: "あたま",
    color: "#3b82f6",
    description: "めやくち、しょっかくがあるよ",
    funFact: "こんちゅうのめは、たくさんのちいさなめがあつまってできているんだ！これを「ふくがん」っていうよ。",
  },
  {
    name: "むね",
    color: "#22c55e",
    description: "あしやはねがついているよ",
    funFact: "こんちゅうのあしは、ぜんぶで6ほん！ぜんぶむねからはえているんだよ。はねもむねについているよ。",
  },
  {
    name: "おなか",
    color: "#ef4444",
    description: "しょくもつをしょうかするよ",
    funFact: "おなかには、たべたものをしょうかするきかんや、たまごをつくるきかんがあるよ。",
  },
  {
    name: "あし",
    color: "#a855f7",
    description: "むねからはえているよ",
    funFact: "こんちゅうのあしは、まえあし・なかあし・うしろあしの3つのペアにわかれているよ。",
  },
]

export default function ResultPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedPart, setSelectedPart] = useState<number | null>(null)
  const [quizMode, setQuizMode] = useState(false)
  const [quizQuestion, setQuizQuestion] = useState<number>(0)
  const [isDrawingLine, setIsDrawingLine] = useState(false)
  const [lineY, setLineY] = useState<number | null>(null)
  const [drawnLines, setDrawnLines] = useState<number[]>([])
  const [quizResult, setQuizResult] = useState<string | null>(null)

  useEffect(() => {
    const imageData = sessionStorage.getItem("insectImage")
    const maskData = sessionStorage.getItem("editedMask")

    if (!imageData) {
      router.push("/upload")
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      if (maskData) {
        const maskImg = new Image()
        maskImg.onload = () => {
          ctx.drawImage(maskImg, 0, 0)

          if (!quizMode) {
            drawDividingLines(ctx, canvas.width, canvas.height)
          } else {
            drawnLines.forEach((y) => {
              ctx.strokeStyle = "#fbbf24"
              ctx.lineWidth = 8
              ctx.setLineDash([15, 10])
              ctx.beginPath()
              ctx.moveTo(0, y)
              ctx.lineTo(canvas.width, y)
              ctx.stroke()
              ctx.setLineDash([])
            })
          }
        }
        maskImg.src = maskData
      } else if (quizMode) {
        drawnLines.forEach((y) => {
          ctx.strokeStyle = "#fbbf24"
          ctx.lineWidth = 8
          ctx.setLineDash([15, 10])
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(canvas.width, y)
          ctx.stroke()
          ctx.setLineDash([])
        })
      } else {
        drawDividingLines(ctx, canvas.width, canvas.height)
      }
    }
    img.src = imageData
  }, [router, quizMode, drawnLines])

  const drawDividingLines = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const headEnd = height * 0.25
    const thoraxEnd = height * 0.5
    const abdomenEnd = height * 0.75

    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 8
    ctx.setLineDash([])

    ctx.beginPath()
    ctx.moveTo(0, headEnd)
    ctx.lineTo(width, headEnd)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, thoraxEnd)
    ctx.lineTo(width, thoraxEnd)
    ctx.stroke()

    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 6
    ctx.setLineDash([])

    ctx.beginPath()
    ctx.moveTo(0, headEnd)
    ctx.lineTo(width, headEnd)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, thoraxEnd)
    ctx.lineTo(width, thoraxEnd)
    ctx.stroke()

    // Draw labels with background
    ctx.font = "bold 28px sans-serif"
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"

    const labels = [
      { text: "あたま", y: headEnd / 2, color: bodyParts[0].color },
      { text: "むね", y: (headEnd + thoraxEnd) / 2, color: bodyParts[1].color },
      { text: "おなか", y: (thoraxEnd + abdomenEnd) / 2, color: bodyParts[2].color },
    ]

    labels.forEach((label) => {
      // Draw background
      const metrics = ctx.measureText(label.text)
      const padding = 12
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
      ctx.fillRect(width - metrics.width - padding * 2 - 10, label.y - 20, metrics.width + padding * 2, 40)

      // Draw text
      ctx.fillStyle = label.color
      ctx.fillText(label.text, width - padding - 10, label.y)
    })
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!quizMode || drawnLines.length >= 2) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleY = canvas.height / rect.height
    const y = (e.clientY - rect.top) * scaleY

    setDrawnLines([...drawnLines, y])
  }

  const checkQuizAnswer = () => {
    if (drawnLines.length < 2) {
      setQuizResult("せんを2ほんひいてね！")
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const sortedLines = [...drawnLines].sort((a, b) => a - b)
    const line1 = sortedLines[0]
    const line2 = sortedLines[1]

    const headEnd = canvas.height * 0.25
    const thoraxEnd = canvas.height * 0.5

    // Check if lines are close to correct positions
    const tolerance = canvas.height * 0.1
    const line1Correct = Math.abs(line1 - headEnd) < tolerance
    const line2Correct = Math.abs(line2 - thoraxEnd) < tolerance

    if (line1Correct && line2Correct) {
      setQuizResult("せいかい！とてもじょうずだね！")
    } else if (line1Correct || line2Correct) {
      setQuizResult("おしい！もういちどためしてみよう！")
    } else {
      setQuizResult("ざんねん...もういちどためしてみよう！")
    }
  }

  const resetQuiz = () => {
    setDrawnLines([])
    setQuizResult(null)

    // Redraw canvas
    const imageData = sessionStorage.getItem("insectImage")
    const maskData = sessionStorage.getItem("editedMask")
    const canvas = canvasRef.current
    if (!canvas || !imageData) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      if (maskData) {
        const maskImg = new Image()
        maskImg.onload = () => {
          ctx.drawImage(maskImg, 0, 0)
        }
        maskImg.src = maskData
      }
    }
    img.src = imageData
  }

  const startQuiz = () => {
    setQuizMode(true)
    setDrawnLines([])
    setQuizResult(null)
  }

  const endQuiz = () => {
    setQuizMode(false)
    setDrawnLines([])
    setQuizResult(null)
  }

  const handleRestart = () => {
    sessionStorage.clear()
    router.push("/")
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-green-50 to-blue-50 overflow-hidden">
      <header className="bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 px-4 flex items-center gap-3 shadow-lg flex-shrink-0">
        <Link href="/editor">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <h1 className="text-base md:text-lg font-bold">{quizMode ? "クイズにちょうせん！" : "からだのつくり"}</h1>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-2 md:p-3 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col lg:flex-row gap-2 md:gap-3">
          {/* Left side - Insect image */}
          <Card className="p-2 md:p-3 bg-white shadow-lg flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden">
            <div className="relative w-full h-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className={`max-w-full max-h-full object-contain ${quizMode ? "cursor-crosshair" : ""}`}
                onClick={handleCanvasClick}
              />
            </div>
            {quizMode && drawnLines.length < 2 && (
              <div className="mt-2 p-2 bg-blue-100 rounded-lg text-center flex-shrink-0">
                <p className="text-xs md:text-sm font-bold text-blue-800">
                  あと {2 - drawnLines.length} ほんひけるよ！
                </p>
              </div>
            )}
          </Card>

          {/* Right side - Body parts info or quiz */}
          <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-2 md:gap-3 min-h-0 overflow-hidden">
            {quizMode ? (
              <>
                <Card className="p-2 md:p-3 bg-blue-50 border-2 border-blue-300 flex-shrink-0">
                  <h2 className="text-base md:text-lg font-bold text-center mb-1">クイズ</h2>
                  <p className="text-xs md:text-sm text-center mb-1 leading-snug">
                    こんちゅうのからだを、あたま・むね・おなかにわけるせんを2ほんひいてね！
                  </p>
                  <p className="text-xs text-center text-gray-600">がめんをタップして、せんをひこう</p>
                </Card>

                {quizResult && (
                  <Card
                    className={`p-2 md:p-3 flex-shrink-0 ${
                      quizResult.includes("せいかい")
                        ? "bg-green-100 border-2 border-green-500"
                        : quizResult.includes("おしい")
                          ? "bg-yellow-100 border-2 border-yellow-500"
                          : "bg-red-100 border-2 border-red-500"
                    }`}
                  >
                    <p className="text-sm md:text-base font-bold text-center mb-2">{quizResult}</p>
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
                {/* Body parts list - Make scrollable within fixed height */}
                <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
                  {bodyParts.map((part, index) => (
                    <Card
                      key={index}
                      className={`p-2 cursor-pointer transition-all flex-shrink-0 ${
                        selectedPart === index ? "ring-2 ring-yellow-400 shadow-lg" : "hover:shadow-md"
                      }`}
                      onClick={() => setSelectedPart(selectedPart === index ? null : index)}
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

                {/* Fun fact card */}
                <Card className="p-2 md:p-3 bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-300 flex-shrink-0">
                  <p className="text-xs leading-snug">
                    <strong className="text-xs md:text-sm">こんちゅうのからだ：</strong>
                    <br />
                    こんちゅうのからだは、<strong>あたま・むね・はら</strong>の3つのぶぶんにわかれているよ！
                    あしは6ほんあって、ぜんぶむねからはえているんだ。
                  </p>
                </Card>

                {/* Action buttons */}
                <Button
                  size="sm"
                  className="w-full h-10 md:h-12 text-sm md:text-base font-bold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-xl flex-shrink-0"
                  onClick={startQuiz}
                >
                  🎯 クイズにちょうせん！
                </Button>

                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-9 md:h-10 text-xs md:text-sm font-bold gap-1 bg-white"
                    onClick={handleRestart}
                  >
                    <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
                    さいしょから
                  </Button>
                  <Link href="/" className="flex-1">
                    <Button
                      size="sm"
                      className="w-full h-9 md:h-10 text-xs md:text-sm font-bold gap-1 bg-gradient-to-r from-green-500 to-blue-500"
                    >
                      <Home className="w-3 h-3 md:w-4 md:h-4" />
                      ホームへ
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
