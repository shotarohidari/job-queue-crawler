import { EventEmitter } from "node:events"
import { memoryUsage } from "node:process"
import { JSDOM } from "jsdom"
import { fetchHtmlText } from "./util"

type CrawlingOption = {
  sameDomain: boolean
  max_request: number
  debug_mode: boolean
}
export class Crawler {
  private concurrency = 1
  private intervalId: NodeJS.Timeout
  private emitter = new EventEmitter()
  // もっといい方法ないだろうか
  private isProcessing = false
  private promise: Promise<{ title: string }[]>
  private requestQueue: string[] = []
  private results: Map<string, { title: string }> = new Map()
  private option: CrawlingOption
  constructor(urls: string[], option?: Partial<CrawlingOption>) {
    this.option = {
      sameDomain: true,
      max_request: 100,
      debug_mode: false,
      ...option,
    }
    this.requestQueue.push(...urls)
    const { promise, resolve } = Promise.withResolvers<{ title: string }[]>()
    this.promise = promise
    this.emitter.on("finish", () => {
      clearInterval(this.intervalId)
      resolve([...this.results.values()])
    })
    this.emitter.on("dequeue", async () => {
      const url = this.requestQueue.pop()
      if (!url) {
        return
      }
      if (this.results.has(url)) {
        return
      }
      this.isProcessing = true
      this.concurrency += 1
      // timeoutしたらabortしてもう一回やり直すようにした方がいい

      const result = await fetchHtmlText(url)
      if (result.status === "failure") {
        console.log(`レスポンス取得失敗: url: ${url}`)
        return
      }
      const htmlText = result.data
      const jsdom = new JSDOM(htmlText)
      const document = jsdom.window.document
      const title = document.title

      this.results.set(url, { title })

      const anchors = [...document.body.querySelectorAll("a")]
      const resolvedHrefs = anchors
        .map((anchor) => new URL(anchor.href, url).toString())
        .filter((resolvedURL) =>
          this.option.sameDomain
            ? new URL(resolvedURL).hostname === new URL(url).hostname
            : true
        )
        .filter((resolvedURL) => /^https?/.test(new URL(resolvedURL).protocol))
      this.requestQueue.push(...resolvedHrefs)
      this.isProcessing = false
      this.concurrency -= 1
      this.results.size % 10 === 0 &&
        console.log(
          `${this.results.size} crawled!, concurrency: ${this.concurrency}`
        )
    })
  }
  async run() {
    this.schedule()
    return await this.promise
  }
  schedule() {
    this.intervalId = setInterval(() => {
      const heapUsedInMb = memoryUsage().heapUsed / 1000 / 1024

      if (heapUsedInMb < 2000) {
        this.emitter.emit("dequeue")
      }
      if (
        (this.requestQueue.length === 0 && !this.isProcessing) ||
        this.results.size >= this.option.max_request
      ) {
        console.log("crawling finished!")
        this.emitter.emit("finish")
      }
    }, 5)
  }
}
