import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'
import { readFileSync, existsSync, copyFileSync } from 'fs'
import { join } from 'path'

// DATABASE_URL 환경변수에서 Prisma 클라이언트 생성
const getPrisma = () => {
  const rawDatabaseUrl = process.env.DATABASE_URL ?? ""
  const databaseUrl = rawDatabaseUrl.replace(/\s/g, "")
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다')
  }
  
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error(`DATABASE_URL이 올바른 형식이 아닙니다: ${databaseUrl}`)
  }
  
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`DATABASE_URL 프로토콜이 postgres가 아닙니다: ${parsed.protocol}`)
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

async function main() {
  console.log('[SEED] start')
  console.log(`[SEED] cwd=${process.cwd()}`)
  console.log(`[SEED] DATABASE_URL present=${!!process.env.DATABASE_URL}`)

  const prisma = getPrisma()

  try {
    // 1. FORCE_SEED 옵션 확인
    const forceSeed = process.env.FORCE_SEED === 'true'
    console.log(`[SEED] FORCE_SEED=${forceSeed}`)

    // 2. 작업 전 target count 확인
    const beforeCount = await prisma.target.count()
    console.log(`[SEED] target count=${beforeCount}`)

    // 3. FORCE_SEED가 아니고 이미 데이터가 있으면 스킵
    if (!forceSeed && beforeCount > 0) {
      console.log(`[SEED] already seeded, skip`)
      process.exit(0)
    }

    // 4. FORCE_SEED가 true이면 기존 데이터 삭제
    if (forceSeed && beforeCount > 0) {
      console.log(`[SEED] FORCE_SEED=true, deleting ${beforeCount} existing targets...`)
      await prisma.target.deleteMany({})
      console.log(`[SEED] deleted all existing targets`)
    }

    console.log('[SEED] proceeding with seed...')

    // 5. 파일 존재 확인 (src/data/targets.csv 우선, 없으면 data/targets.csv)
    const srcTargetsCsvPath = join(process.cwd(), 'src', 'data', 'targets.csv')
    const dataTargetsCsvPath = join(process.cwd(), 'data', 'targets.csv')

    let csvPath: string | null = null

    if (existsSync(srcTargetsCsvPath)) {
      csvPath = srcTargetsCsvPath
      console.log(`[SEED] source=${csvPath}`)
    } else if (existsSync(dataTargetsCsvPath)) {
      csvPath = dataTargetsCsvPath
      console.log(`[SEED] source=${csvPath}`)
    } else {
      const errorMsg = `[SEED] ERROR: csv not found`
      console.error(errorMsg)
      console.error(`[SEED] Checked paths:`)
      console.error(`  - ${srcTargetsCsvPath}`)
      console.error(`  - ${dataTargetsCsvPath}`)
      throw new Error(errorMsg)
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

    console.log(`[SEED] rows=${records.length}`)

    if (records.length === 0) {
      const errorMsg = '[SEED] ERROR: csv empty or invalid'
      console.error(errorMsg)
      throw new Error(errorMsg)
    }

    let createdCount = 0
    let skippedCount = 0

    // 각 레코드를 upsert (중복 방지)
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

      // 중복 확인: URL로 먼저 확인
      let existing = await prisma.target.findUnique({
        where: { url },
      })

      // URL로 못 찾았고 ID가 있으면 ID로 확인
      if (!existing && csvId) {
        try {
          existing = await prisma.target.findUnique({
            where: { id: csvId },
          })
        } catch (e) {
          // ID 형식이 잘못된 경우 무시
        }
      }

      if (existing) {
        // 이미 존재하는 경우 스킵 (중복 insert 방지)
        skippedCount++
        continue
      }

      // 새 레코드 생성
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
        if (error.code === 'P2002') {
          // Unique constraint violation (중복)
          skippedCount++
        } else {
          console.error(`Error creating target ${keyword}:`, error.message)
          skippedCount++
        }
      }
    }

    // 4. 작업 후 target count 확인
    const afterCount = await prisma.target.count()
    
    console.log(`[SEED] inserted=${createdCount}, skipped=${skippedCount}`)
    console.log(`[SEED] target count after=${afterCount}`)
    
    if (afterCount === beforeCount && createdCount === 0) {
      const errorMsg = `[SEED] ERROR: no records inserted`
      console.error(errorMsg)
      throw new Error(errorMsg)
    }
    
    if (afterCount <= beforeCount) {
      const errorMsg = `[SEED] ERROR: target count did not increase`
      console.error(errorMsg)
      throw new Error(errorMsg)
    }
    
    console.log(`[SEED] completed successfully`)
  } catch (error) {
    console.error('Seed error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })

