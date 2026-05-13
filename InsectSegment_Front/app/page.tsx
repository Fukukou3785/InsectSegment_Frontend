import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-3 px-4 md:px-6 flex-shrink-0">
        <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-center text-balance">
          こんちゅうのからだをしらべよう！
        </h1>
      </header>

      {/* Main Content - scrollable if needed on very small screens */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 md:p-6 gap-4 md:gap-6 overflow-y-auto">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl flex-shrink-0">
          <div className="w-24 h-24 md:w-32 md:h-32 mx-auto bg-secondary rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 md:w-16 md:h-16 text-secondary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-base md:text-lg lg:text-xl font-bold text-pretty px-2">
            こんちゅうのしゃしんをとって、からだのつくりをべんきょうしよう！
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed px-2">
            カメラでこんちゅうをさつえいするか、しゃしんをえらんでね。
          </p>
        </div>

        {/* Action Card */}
        <Card className="w-full max-w-md p-4 md:p-6 space-y-4 flex-shrink-0">
          <Link href="/upload" className="block">
            <Button size="lg" className="w-full h-14 md:h-16 text-base md:text-lg font-bold">
              はじめる
            </Button>
          </Link>

          {/* Info Cards */}
          <div className="grid gap-2 pt-3 border-t">
            <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm">
                1
              </div>
              <p className="text-xs md:text-sm leading-relaxed pt-1">こんちゅうのしゃしんをとるか、えらぶ</p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm">
                2
              </div>
              <p className="text-xs md:text-sm leading-relaxed pt-1">AIがこんちゅうのかたちをみつける</p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm">
                3
              </div>
              <p className="text-xs md:text-sm leading-relaxed pt-1">ブラシでかたちをなおす</p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm">
                4
              </div>
              <p className="text-xs md:text-sm leading-relaxed pt-1">あたま・むね・はらのばしょがわかる！</p>
            </div>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-2 px-4 text-center text-xs text-muted-foreground flex-shrink-0">
        こんちゅうがくしゅうアプリ
      </footer>
    </div>
  )
}
