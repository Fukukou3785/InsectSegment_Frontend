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
    // 1. 画像がない場合は戻る
    const image = sessionStorage.getItem("insectImage")
    if (!image) {
      router.push("/upload")
      return
    }

    // --- AI処理の実行関数 ---
    const runAIProcess = async () => {
      try {
        // 画像データの準備（data:image/png;base64, の部分を取り除く）
        const imageToSegment = image.replace(/^data:image\/\w+;base64,/, "")

        // ★ここでAPIにリクエストを送ります（非同期）
        // 127.0.0.1 (localhost) を使用
        const response = await fetch('http://127.0.0.1:8000/api/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: imageToSegment }),
        });

        if (!response.ok) {
          throw new Error('AIしょりにしっぱいしました');
        }

        // 結果を受け取る
        const result = await response.json();

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