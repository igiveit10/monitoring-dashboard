import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * 엑셀 파일을 runs.csv로 변환하는 스크립트
 * 
 * 사용법:
 * npx tsx scripts/convert-excel-to-runs-csv.ts [엑셀파일경로]
 * 
 * 엑셀 파일 형식:
 * - id 컬럼: target_id로 사용
 * - 날짜별 컬럼 (예: 2025-12-28, 2025-12-29, 2025-12-31): Y/N 값
 * - 비고 컬럼: comment로 사용
 */

async function main() {
  // 엑셀 파일 경로 확인
  const excelPath = process.argv[2] || join(process.cwd(), '모니터링_2025-12-31.xlsx')
  
  if (!existsSync(excelPath)) {
    console.error(`[ERROR] 엑셀 파일을 찾을 수 없습니다: ${excelPath}`)
    console.error(`사용법: npx tsx scripts/convert-excel-to-runs-csv.ts [엑셀파일경로]`)
    process.exit(1)
  }

  console.log(`[CONVERT] 엑셀 파일 읽기: ${excelPath}`)

  // 엑셀 파일 읽기
  const workbook = XLSX.readFile(excelPath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

  console.log(`[CONVERT] 시트: ${sheetName}, 행 수: ${data.length}`)

  // 컬럼명 확인
  const firstRow = data[0] as any
  const columns = Object.keys(firstRow)
  console.log(`[CONVERT] 컬럼: ${columns.join(', ')}`)

  // 날짜 컬럼 찾기 (YYYY-MM-DD 통검, YYYY-MM-DD PDF 패턴)
  const datePattern = /^(\d{4}-\d{2}-\d{2})\s+(통검|PDF)$/
  const dateGroups = new Map<string, { tonggeomCol?: string; pdfCol?: string }>()
  
  for (const col of columns) {
    const match = col.trim().match(datePattern)
    if (match) {
      const date = match[1]
      const type = match[2]
      if (!dateGroups.has(date)) {
        dateGroups.set(date, {})
      }
      const group = dateGroups.get(date)!
      if (type === '통검') {
        group.tonggeomCol = col
      } else if (type === 'PDF') {
        group.pdfCol = col
      }
    }
  }

  const dates = Array.from(dateGroups.keys()).sort()
  console.log(`[CONVERT] 날짜 발견: ${dates.join(', ')}`)

  if (dates.length === 0) {
    console.error(`[ERROR] 날짜 형식 컬럼(YYYY-MM-DD 통검/PDF)을 찾을 수 없습니다.`)
    console.error(`[ERROR] 발견된 컬럼: ${columns.join(', ')}`)
    process.exit(1)
  }

  // ID 컬럼 찾기 (id, _id, target_id 등)
  const idColumn = columns.find(col => 
    ['id', '_id', 'target_id', 'ID', '_ID', 'TARGET_ID'].includes(col.trim())
  ) || columns[0]

  console.log(`[CONVERT] ID 컬럼: ${idColumn}`)

  // 비고 컬럼 찾기
  const commentColumn = columns.find(col => 
    col.includes('비고') || ['comment', 'Comment', 'NOTE', 'note'].includes(col.trim())
  )

  console.log(`[CONVERT] 비고 컬럼: ${commentColumn || '(없음)'}`)

  // CSV 행 생성
  const csvRows: string[] = []
  csvRows.push('target_id,run_date,found_academic,found_pdf,comment')

  for (const row of data as any[]) {
    const targetId = String(row[idColumn] || '').trim()
    if (!targetId) continue

    const comment = commentColumn ? String(row[commentColumn] || '').trim() : ''

    // 각 날짜별로 행 생성
    for (const date of dates) {
      const group = dateGroups.get(date)!
      const tonggeomValue = group.tonggeomCol ? String(row[group.tonggeomCol] || '').trim().toUpperCase() : ''
      const pdfValue = group.pdfCol ? String(row[group.pdfCol] || '').trim().toUpperCase() : ''

      // Y/N 값이 없으면 스킵
      if (!tonggeomValue && !pdfValue) continue

      const foundAcademic = tonggeomValue === 'Y' ? 'Y' : 'N'
      const foundPdf = pdfValue === 'Y' ? 'Y' : 'N'

      csvRows.push(`${targetId},${date},${foundAcademic},${foundPdf},"${comment.replace(/"/g, '""')}"`)
    }
  }

  // CSV 파일 저장
  const outputPath = join(process.cwd(), 'src', 'data', 'runs.csv')
  const csvContent = csvRows.join('\n')
  writeFileSync(outputPath, csvContent, 'utf-8')

  console.log(`[CONVERT] 완료: ${outputPath}`)
  console.log(`[CONVERT] 생성된 행 수: ${csvRows.length - 1} (헤더 제외)`)
}

main().catch((error) => {
  console.error('[CONVERT] 에러:', error)
  process.exit(1)
})

