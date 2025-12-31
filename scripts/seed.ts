import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database from CSV...')

  // CSV 파일 경로 확인 (여러 위치 시도)
  const possiblePaths = [
    join(process.cwd(), 'data', 'targets.csv'),
    join(process.cwd(), 'scripts', 'targets.csv'),
    join(process.cwd(), 'sample.csv'),
  ]

  let csvPath: string | null = null
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      csvPath = path
      console.log(`Found CSV file at: ${path}`)
      break
    }
  }

  if (!csvPath) {
    console.error('CSV file not found. Please ensure data/targets.csv exists.')
    console.log('Tried paths:', possiblePaths)
    process.exit(1)
  }

  // CSV 파일 읽기
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

  console.log(`Parsed ${records.length} records from CSV`)

  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0

  // 각 레코드를 upsert
  for (const record of records) {
    let keyword: string | undefined
    let url: string | undefined
    let currentStatus: string | null = null
    let myComment: string | null = null
    let csvId: string | undefined = undefined
    let csvPdfExposure: boolean | undefined = undefined

    // CSV에서 id 추출
    csvId = record.id || record._id || undefined
    
    // keyword/title 추출
    keyword = record.keyword || record.title || undefined

    if (record.keyword && record.url) {
      // 표준 형식: keyword,url,currentStatus,myComment
      url = record.url
      currentStatus = record.currentStatus || null
      myComment = record.myComment || null
      csvPdfExposure = record.csvPdfExposure === 'Y' || record.csvPdfExposure === true
    } else if (record.title && record.통검url3) {
      // QA 형식: _id,title,통검url3,통검노출,PDF 노출,비고
      url = record.통검url3
      if (record.통검노출 === 'Y') {
        currentStatus = '노출'
      } else if (record.통검노출 === 'N') {
        currentStatus = '미노출'
      }
      csvPdfExposure = record['PDF 노출'] === 'Y'
      myComment = record.비고 || null
    } else if (keyword && record.url) {
      // keyword/title과 url이 있는 경우
      url = record.url
      currentStatus = record.currentStatus || null
      myComment = record.myComment || null
      csvPdfExposure = record.csvPdfExposure === 'Y' || record.csvPdfExposure === true
    }

    if (!keyword || !url) {
      skippedCount++
      continue
    }

    // 기존 레코드 찾기
    let existing: any = null

    if (csvId) {
      try {
        existing = await prisma.target.findUnique({
          where: { id: csvId },
        })
      } catch (e) {
        // ID 형식이 잘못된 경우 무시
      }
    }

    if (!existing && url) {
      existing = await prisma.target.findUnique({
        where: { url },
      })
    }

    if (existing) {
      // 업데이트
      const updateData: any = {
        keyword,
        updatedAt: new Date(),
      }
      
      if (currentStatus !== null) updateData.currentStatus = currentStatus
      if (csvPdfExposure !== undefined) updateData.csvPdfExposure = csvPdfExposure
      if (myComment !== null) updateData.myComment = myComment
      if (url && url !== existing.url) {
        const urlExists = await prisma.target.findUnique({
          where: { url },
        })
        if (!urlExists) {
          updateData.url = url
        }
      }

      await prisma.target.update({
        where: { id: existing.id },
        data: updateData,
      })
      updatedCount++
    } else {
      // 생성
      try {
        await prisma.target.create({
          data: {
            ...(csvId ? { id: csvId } : {}),
            keyword,
            url,
            currentStatus,
            csvPdfExposure: csvPdfExposure ?? false,
            myComment,
          },
        })
        createdCount++
      } catch (error: any) {
        if (error.code === 'P2002' && csvId) {
          // ID 충돌 시 자동 생성 ID 사용
          await prisma.target.create({
            data: {
              keyword,
              url,
              currentStatus,
              csvPdfExposure: csvPdfExposure ?? false,
              myComment,
            },
          })
          createdCount++
        } else {
          console.error(`Error creating target ${keyword}:`, error.message)
          skippedCount++
        }
      }
    }
  }

  const totalCount = await prisma.target.count()
  console.log(`\nSeeding completed!`)
  console.log(`  - Created: ${createdCount}`)
  console.log(`  - Updated: ${updatedCount}`)
  console.log(`  - Skipped: ${skippedCount}`)
  console.log(`  - Total targets in DB: ${totalCount}`)
}

main()
  .catch((e) => {
    console.error('Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

