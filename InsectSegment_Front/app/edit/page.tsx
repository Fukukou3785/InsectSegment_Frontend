"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MaskEditor } from "@/components/mask-editor"

export default function EditPage() {
  const router = useRouter()

  const handleComplete = () => {
    router.push("/result")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-6 flex items-center gap-4">
        <Link href="/upload">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
        </Link>
        <h1 className="text-xl md:text-2xl font-bold flex-1 text-center">かたちをなおそう</h1>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Instructions */}
          <div className="bg-accent text-accent-foreground p-4 rounded-lg">
            <p className="text-sm md:text-base font-semibold leading-relaxed">
              みどりのぶぶんが、こんちゅうのからだです。
              <br />
              ブラシでかたちをなおしてね！
            </p>
          </div>

          {/* Editor */}
          <MaskEditor imageUrl="/insect-beetle.jpg" onComplete={handleComplete} />
        </div>
      </main>
    </div>
  )
}
