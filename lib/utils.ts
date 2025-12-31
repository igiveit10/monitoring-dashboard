import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Target } from '@prisma/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Asia/Seoul 기준으로 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getTodayDateString(): string {
  const now = new Date()
  const seoulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const year = seoulTime.getFullYear()
  const month = String(seoulTime.getMonth() + 1).padStart(2, '0')
  const day = String(seoulTime.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 정답셋 기준으로 targets를 정렬하는 함수
 * 정렬 우선순위: YY (3) > YN (2) > NY (1) > NN (0)
 * 같은 그룹 내에서는 id asc로 정렬
 * 
 * @param targets Target 배열
 * @returns 정렬된 Target 배열
 */
export function sortTargetsByAnswerSet(targets: Target[]): Target[] {
  return [...targets].sort((a, b) => {
    // answer_search_exposed 계산 (currentStatus === '노출'이면 'Y', 아니면 'N')
    const aSearchExposed = a.currentStatus === '노출' ? 'Y' : 'N'
    const bSearchExposed = b.currentStatus === '노출' ? 'Y' : 'N'
    
    // answer_pdf_exposed 계산 (csvPdfExposure가 true이면 'Y', 아니면 'N')
    const aPdfExposed = a.csvPdfExposure ? 'Y' : 'N'
    const bPdfExposed = b.csvPdfExposure ? 'Y' : 'N'
    
    // score 계산: (answer_search_exposed=='Y'?2:0) + (answer_pdf_exposed=='Y'?1:0)
    const aScore = (aSearchExposed === 'Y' ? 2 : 0) + (aPdfExposed === 'Y' ? 1 : 0)
    const bScore = (bSearchExposed === 'Y' ? 2 : 0) + (bPdfExposed === 'Y' ? 1 : 0)
    
    // score desc (높은 점수부터)
    if (aScore !== bScore) {
      return bScore - aScore
    }
    
    // tie-breaker: id asc
    return a.id.localeCompare(b.id)
  })
}

/**
 * 정답셋 기준으로 tableData를 정렬하는 함수
 * tableData는 { csv통검노출, csvPdf노출, id, ... } 형태의 객체 배열
 * 정렬 우선순위: YY (3) > YN (2) > NY (1) > NN (0)
 * 같은 그룹 내에서는 id asc로 정렬
 * 
 * @param tableData 테이블 데이터 배열
 * @returns 정렬된 테이블 데이터 배열
 */
export function sortTableDataByAnswerSet<T extends { csv통검노출: string | null; csvPdf노출: string; id: string }>(tableData: T[]): T[] {
  return [...tableData].sort((a, b) => {
    // answer_search_exposed 계산 (csv통검노출이 'Y'이면 'Y', 아니면 'N')
    const aSearchExposed = a.csv통검노출 === 'Y' ? 'Y' : 'N'
    const bSearchExposed = b.csv통검노출 === 'Y' ? 'Y' : 'N'
    
    // answer_pdf_exposed 계산 (csvPdf노출이 'Y'이면 'Y', 아니면 'N')
    const aPdfExposed = a.csvPdf노출 === 'Y' ? 'Y' : 'N'
    const bPdfExposed = b.csvPdf노출 === 'Y' ? 'Y' : 'N'
    
    // score 계산: (answer_search_exposed=='Y'?2:0) + (answer_pdf_exposed=='Y'?1:0)
    const aScore = (aSearchExposed === 'Y' ? 2 : 0) + (aPdfExposed === 'Y' ? 1 : 0)
    const bScore = (bSearchExposed === 'Y' ? 2 : 0) + (bPdfExposed === 'Y' ? 1 : 0)
    
    // score desc (높은 점수부터)
    if (aScore !== bScore) {
      return bScore - aScore
    }
    
    // tie-breaker: id asc
    return a.id.localeCompare(b.id)
  })
}

