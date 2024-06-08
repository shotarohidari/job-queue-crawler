import type { Result } from "./type"

const retryableFetch = async (
  url: string,
  retryCount = 0
): Promise<Response> => {
  try {
    const controller = new AbortController()
    const res = await fetch(url, { signal: controller.signal })
    const timerId = setTimeout(() => {
      controller.abort()
    }, 3000)
    clearTimeout(timerId)
    return res
  } catch (e) {
    if (e instanceof Error) {
      if (retryCount < 3) {
        return retryableFetch(url, retryCount + 1)
      }
    }
    throw new Error("max retry fetch error.")
  }
}

export const fetchHtmlText = async (url: string): Promise<Result<string>> => {
  try {
    const res = await retryableFetch(url)
    const text = await res.text()
    return { status: "success", data: text }
  } catch (e) {
    if (e instanceof Error) {
      return { status: "failure", error: e }
    }
    return { status: "failure", error: new Error("unknown error.") }
  }
}
