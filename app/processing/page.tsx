"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { readExperimentSession } from "@/lib/experiment-session"
import { getCurrentTaskType } from "@/lib/task-metrics"

export default function ProcessingPage() {
  const router = useRouter()
  const hasStartedRef = useRef(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("がぞうをよみこんでいます...")
  const [isTutorial, setIsTutorial] = useState(false)

  useEffect(() => {
    setIsTutorial(getCurrentTaskType() === "tutorial")
  }, [])

  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    const experimentSession = readExperimentSession()
    if (!experimentSession || experimentSession.status !== "active") {
      router.replace("/")
      return
    }

    // 1. 画像がない場合は戻る
    const image = sessionStorage.getItem("insectImage")
    if (!image) {
      router.push("/upload")
      return
    }

    // --- AI処理の実行関数 ---
    const runAIProcess = async () => {
      try {
        // ★修正: バックエンド側でカンマを基準に分割しているため、
        // 「data:image/png;base64,」の部分を消さずにそのまま送ります！
        // const imageToSegment = image.replace(/^data:image\/\w+;base64,/, "")

        // 実験開始時に生成したUUIDを、SAM状態の識別にも共通利用する
        const sessionId = experimentSession.sessionId

        const formData = new FormData();

        const imageName = sessionStorage.getItem("imageName")
       if (imageName) {
         formData.append("image_name", imageName)
        }
        // ★修正：imageToSegment ではなく、そのままの image を送る！
        formData.append("image_base64", image);
        formData.append("session_id", sessionId);

// ★修正：通信と3秒タイマーを同時に待つ安全な書き方
        const taskType = getCurrentTaskType()
        const segmentPath =
          taskType === "tutorial"
            ? "/api/tutorial/segment"
            : "/api/segment"
        const fetchPromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}${segmentPath}`, {
          method: "POST",
          body: formData,
        }).then(async (res) => {
          if (!res.ok) throw new Error("AIしょりにしっぱいしました");
          return res.json(); // ★ここで1回だけ確実に中身を取り出して返す
        });

        const timerPromise = new Promise((resolve) => setTimeout(resolve, 3000)); // 3秒待つ

        // 両方が終わるまで待ち、結果（result）を受け取る
        const [result] = await Promise.all([fetchPromise, timerPromise]);

        // データの保存
        sessionStorage.setItem("segmentedImage", result.segmented_image_base64);
        // 胸の座標も保存（あれば）
        if (result.thorax_top !== undefined) {
            sessionStorage.setItem("thoraxTop", String(result.thorax_top));
            sessionStorage.setItem("thoraxBottom", String(result.thorax_bottom));
        }

        // ★完了！進捗を100%にする
        setProgress(100)
        setStatus("かんりょう！")
        
        // 少しだけ余韻を残して次のページへ
        setTimeout(() => {
          router.push("/editor")
        }, 800)

      } catch (error) {
        console.error(error)
        setStatus("エラーがはっせいしました")
        alert("AIの処理に失敗しました。もう一度試してください。")
        router.push("/upload")
      }
    }

    // --- 進捗バーのアニメーション（AI待ちの間、ゆっくり進む） ---
    // AIが終わるまでは 90% で止まるようにしています
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          return 100
        }
        if (oldProgress >= 90) {
          // AIが終わるのを待っている状態
          return 90 
        }
        // 0~90%までは少しずつ進む
        const diff = Math.random() * 10
        return Math.min(oldProgress + diff, 90)
      })
    }, 500) // 0.5秒ごとに更新

    // メッセージの変化（雰囲気用）
    setTimeout(() => setStatus("こんちゅうをさがしています..."), 1000)
    setTimeout(() => setStatus("かたちをかいせきしています..."), 2500)
    setTimeout(() => setStatus("マスクをつくっています..."), 4500)

    // ★処理開始
    runAIProcess()

    // クリーンアップ
    return () => {
      clearInterval(timer)
    }
  }, [router])

  // ★ generateDemoMask は削除しました（本物のデータを上書きしてしまうため）

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-6">
        <h1 className="text-xl md:text-2xl font-bold text-center">
          {isTutorial ? "れんしゅうの じゅんび中" : "しょりちゅう"}
        </h1>
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
