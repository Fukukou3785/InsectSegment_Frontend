"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

export default function ProcessingPage() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("がぞうをよみこんでいます...")

  useEffect(() => {
    const image = sessionStorage.getItem("insectImage")
    if (!image) {
      router.push("/upload")
      return
    }

    // Simulate processing steps
    const steps = [
      { progress: 20, status: "がぞうをよみこんでいます...", delay: 500 },
      { progress: 40, status: "こんちゅうをさがしています...", delay: 1000 },
      { progress: 60, status: "かたちをかいせきしています...", delay: 1000 },
      { progress: 80, status: "マスクをつくっています...", delay: 1000 },
      { progress: 100, status: "かんりょう！", delay: 500 },
    ]

    let currentStep = 0
    const processNextStep = () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep]
        setProgress(step.progress)
        setStatus(step.status)
        currentStep++

        if (currentStep === steps.length) {
          // Generate a simple mask (for demo purposes)
          generateDemoMask(image)
          setTimeout(() => {
            router.push("/editor")
          }, 800)
        } else {
          setTimeout(processNextStep, step.delay)
        }
      }
    }

    setTimeout(processNextStep, 300)
  }, [router])

  const generateDemoMask = (imageData: string) => {
    // Create a simple demo mask
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")

      if (ctx) {
        // Draw the original image
        ctx.drawImage(img, 0, 0)

        // Create a simple elliptical mask in the center
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const radiusX = canvas.width * 0.3
        const radiusY = canvas.height * 0.4

        // Create mask canvas
        const maskCanvas = document.createElement("canvas")
        maskCanvas.width = canvas.width
        maskCanvas.height = canvas.height
        const maskCtx = maskCanvas.getContext("2d")

        if (maskCtx) {
          maskCtx.fillStyle = "white"
          maskCtx.beginPath()
          maskCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
          maskCtx.fill()

          const maskData = maskCanvas.toDataURL("image/png")
          sessionStorage.setItem("insectMask", maskData)
        }
      }
    }
    img.src = imageData
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-6">
        <h1 className="text-xl md:text-2xl font-bold text-center">しょりちゅう</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <Card className="w-full max-w-md p-8 space-y-8">
          <div className="flex flex-col items-center gap-6">
            <Spinner className="w-16 h-16 text-primary" />

            <div className="w-full space-y-3">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-lg font-medium">{status}</p>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground leading-relaxed">
            AIがこんちゅうのかたちをかいせきしています。
            <br />
            すこしまってね！
          </div>
        </Card>
      </main>
    </div>
  )
}
