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
    console.log(`[SEED] target count before=${beforeCount}`)

    // 3. FORCE_SEED가 false이고 데이터가 이미 있으면 스킵 (재시작 시 불필요한 시드 방지)
    if (!forceSeed && beforeCount > 0) {
      console.log(`[SEED] Targets already exist (count=${beforeCount}), skipping seed. Set FORCE_SEED=true to force re-seed.`)
      process.exit(0)
    }

    // 4. FORCE_SEED가 true이면 기존 데이터 삭제
    if (forceSeed && beforeCount > 0) {
      console.log(`[SEED] FORCE_SEED=true, deleting ${beforeCount} existing targets...`)
      await prisma.target.deleteMany({})
      console.log(`[SEED] deleted all existing targets`)
    }

    console.log('[SEED] proceeding with seed...')

    // 5. 파일 존재 확인 (우선순위: data/targets.csv → src/data/targets.csv → sample.csv)
    const dataTargetsCsvPath = join(process.cwd(), 'data', 'targets.csv')
    const srcTargetsCsvPath = join(process.cwd(), 'src', 'data', 'targets.csv')
    const sampleCsvPath = join(process.cwd(), 'sample.csv')

    let csvPath: string | null = null

    if (existsSync(dataTargetsCsvPath)) {
      csvPath = dataTargetsCsvPath
      console.log(`[SEED] source=${csvPath}`)
    } else if (existsSync(srcTargetsCsvPath)) {
      csvPath = srcTargetsCsvPath
      console.log(`[SEED] source=${csvPath}`)
    } else if (existsSync(sampleCsvPath)) {
      csvPath = sampleCsvPath
      console.log(`[SEED] source=${csvPath}`)
    } else {
      const errorMsg = `[SEED] ERROR: csv not found`
      console.error(errorMsg)
      console.error(`[SEED] Checked paths:`)
      console.error(`  - ${dataTargetsCsvPath}`)
      console.error(`  - ${srcTargetsCsvPath}`)
      console.error(`  - ${sampleCsvPath}`)
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
    let updatedCount = 0
    let skippedCount = 0

    // 각 레코드를 처리
    for (const record of records) {
      // 모든 필드 trim 처리
      const trimRecord: Record<string, string> = {}
      for (const key in record) {
        trimRecord[key] = String(record[key] || '').trim()
      }

      // CSV에서 id 추출
      const csvId = trimRecord.id || trimRecord._id || undefined
      
      // keyword/title 추출
      const keyword = trimRecord.keyword || trimRecord.title || undefined
      const url = trimRecord.url || undefined

      if (!keyword || !url) {
        skippedCount++
        continue
      }

      // answer_search_exposed (통검 노출) 처리: Y/N -> "노출"/"미노출"
      let currentStatus: string | null = null
      const answerSearchExposed = trimRecord.answer_search_exposed?.toUpperCase()
      if (answerSearchExposed === 'Y') {
        currentStatus = '노출'
      } else if (answerSearchExposed === 'N') {
        currentStatus = '미노출'
      }
      // answer_search_exposed가 없으면 null 유지

      // answer_pdf_exposed (PDF 노출) 처리: Y/N -> boolean
      const answerPdfExposed = trimRecord.answer_pdf_exposed?.toUpperCase()
      const csvPdfExposure = answerPdfExposed === 'Y'

      // note -> myComment
      const myComment = trimRecord.note || null

      // 기존 레코드 확인: URL로 먼저 확인
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

      // FORCE_SEED 모드에서는 이미 삭제했으므로 create만 사용
      // 일반 모드에서는 기존 레코드가 있으면 upsert, 없으면 create
      if (forceSeed) {
        // FORCE_SEED 모드: create만 사용 (이미 삭제했으므로)
        try {
          await prisma.target.create({
            data: {
              ...(csvId ? { id: csvId } : {}),
              keyword,
              url,
              currentStatus,
              csvPdfExposure,
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
      } else if (existing) {
        // 일반 모드에서 기존 레코드가 있으면 upsert로 업데이트
        try {
          await prisma.target.update({
            where: { id: existing.id },
            data: {
              keyword,
              url,
              currentStatus,
              csvPdfExposure,
              myComment,
            },
          })
          updatedCount++
        } catch (error: any) {
          console.error(`Error updating target ${keyword}:`, error.message)
          skippedCount++
        }
      } else {
        // 일반 모드에서 새 레코드 생성
        try {
          await prisma.target.create({
            data: {
              ...(csvId ? { id: csvId } : {}),
              keyword,
              url,
              currentStatus,
              csvPdfExposure,
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
    }

    // 작업 후 target count 확인
    const afterCount = await prisma.target.count()
    
    console.log(`[SEED] rows=${records.length}`)
    console.log(`[SEED] inserted=${createdCount}, updated=${updatedCount}, skipped=${skippedCount}`)
    console.log(`[SEED] target count before=${beforeCount}, after=${afterCount}`)
    
    // 검증: 작업이 수행되었는지 확인
    if (createdCount === 0 && updatedCount === 0 && skippedCount === records.length) {
      const errorMsg = `[SEED] ERROR: no records processed (all skipped)`
      console.error(errorMsg)
      throw new Error(errorMsg)
    }
    
    // FORCE_SEED 모드에서는 count 증가 검증 스킵 (삭제 후 재삽입이므로)
    if (forceSeed) {
      console.log(`[SEED] FORCE_SEED mode: skipping count validation`)
    } else {
      // 일반 모드: 업데이트만 있어도 성공 (count는 증가하지 않을 수 있음)
      if (createdCount === 0 && updatedCount === 0) {
        const errorMsg = `[SEED] ERROR: no records created or updated`
        console.error(errorMsg)
        throw new Error(errorMsg)
      }
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

