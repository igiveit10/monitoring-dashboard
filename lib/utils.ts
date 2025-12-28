import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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

