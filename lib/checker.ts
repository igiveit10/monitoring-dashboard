/**
 * URL 체크 로직
 * - URL fetch (follow redirect)
 * - HTTP status, finalUrl 기록
 * - PDF 여부 판별
 * - 통합 노출 판별 (academic.naver.com 포함 여부)
 */

export interface CheckResult {
  foundAcademicNaver: boolean
  isPdf: boolean
  httpStatus: number | null
  finalUrl: string | null
  errorMessage: string | null
}

const TIMEOUT_MS = 15000 // 15초
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function checkUrl(url: string): Promise<CheckResult> {
  const result: CheckResult = {
    foundAcademicNaver: false,
    isPdf: false,
    httpStatus: null,
    finalUrl: null,
    errorMessage: null,
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    result.httpStatus = response.status
    result.finalUrl = response.url

    // PDF 판별
    const contentType = response.headers.get('content-type') || ''
    const urlLower = url.toLowerCase()
    const finalUrlLower = response.url.toLowerCase()

    if (
      contentType.includes('application/pdf') ||
      urlLower.endsWith('.pdf') ||
      finalUrlLower.endsWith('.pdf')
    ) {
      result.isPdf = true
      // PDF는 본문을 읽지 않고 헤더만 확인
      return result
    }

    // HTML 본문 읽기 (PDF가 아닌 경우만)
    const text = await response.text()

    // 통합 노출 판별: academic.naver.com 포함 여부
    const searchText = text.toLowerCase() + response.url.toLowerCase()
    if (searchText.includes('academic.naver.com')) {
      result.foundAcademicNaver = true
    }

    return result
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        result.errorMessage = 'Request timeout'
      } else {
        result.errorMessage = error.message
      }
    } else {
      result.errorMessage = 'Unknown error occurred'
    }
    return result
  }
}

/**
 * 동시성 제어를 위한 체크 함수
 */
export async function checkUrlsWithConcurrency(
  urls: Array<{ id: string; url: string }>,
  concurrency: number = 5,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>()
  let completed = 0

  const processBatch = async (batch: typeof urls) => {
    const promises = batch.map(async ({ id, url }) => {
      const result = await checkUrl(url)
      results.set(id, result)
      completed++
      onProgress?.(completed, urls.length)
    })
    await Promise.all(promises)
  }

  // 배치로 나누어 처리
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    await processBatch(batch)
  }

  return results
}

