import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('QA 데이터 임포트 시작...')

  // CSV 파일 읽기
  const csvPath = join(process.cwd(), 'scripts', 'QA_re.csv')
  let content = readFileSync(csvPath, 'utf-8')
  
  // BOM 제거
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1)
  }

  // CSV 파싱
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
  
  // 컬럼명 정규화 (BOM 제거)
  const normalizedRecords = records.map((record: any) => {
    const normalized: any = {}
    for (const key in record) {
      const normalizedKey = key.replace(/^\uFEFF/, '').trim()
      normalized[normalizedKey] = record[key]
    }
    return normalized
  })

  console.log(`총 ${normalizedRecords.length}개의 레코드를 발견했습니다.`)

  let successCount = 0
  let skipCount = 0

  // 각 레코드를 upsert
  for (const record of normalizedRecords) {
    const title = record.title
    const url = record.통검url3
    const 통검노출 = record.통검노출
    const pdf노출 = record['PDF 노출']
    const 비고 = record.비고

    if (!title || !url) {
      skipCount++
      continue
    }

    // 통검노출: Y -> "노출", N -> "미노출"
    let currentStatus: string | null = null
    if (통검노출 === 'Y') {
      currentStatus = '노출'
    } else if (통검노출 === 'N') {
      currentStatus = '미노출'
    }

    // PDF 노출은 별도 필드로 저장 (비고와 분리)
    const csvPdfExposure = pdf노출 === 'Y'
    // 비고는 참고용 텍스트만 저장 (PDF 노출 정보 제외)
    const myComment = 비고 || null

    try {
      await prisma.target.upsert({
        where: { url },
        update: {
          keyword: title,
          currentStatus,
          csvPdfExposure,
          myComment,
          updatedAt: new Date(),
        },
        create: {
          keyword: title,
          url,
          currentStatus,
          csvPdfExposure,
          myComment,
        },
      })
      successCount++
    } catch (error) {
      console.error(`Error importing record: ${title}`, error)
      skipCount++
    }
  }

  console.log(`\n임포트 완료:`)
  console.log(`  - 성공: ${successCount}개`)
  console.log(`  - 스킵: ${skipCount}개`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

