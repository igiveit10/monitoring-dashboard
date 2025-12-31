import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { normalizeRunDate } from '../lib/utils'

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
  console.log('[SEED-RUNS] start')
  console.log(`[SEED-RUNS] cwd=${process.cwd()}`)
  console.log(`[SEED-RUNS] DATABASE_URL present=${!!process.env.DATABASE_URL}`)

  const prisma = getPrisma()

  try {
    // FORCE_SEED 옵션 확인
    const forceSeed = process.env.FORCE_SEED === 'true'
    console.log(`[SEED-RUNS] FORCE_SEED=${forceSeed}`)

    // 기존 runs 개수 확인
    const existingRunsCount = await prisma.run.count()
    console.log(`[SEED-RUNS] Existing runs count=${existingRunsCount}`)

    // 멱등성 보장: FORCE_SEED가 false이고 runs가 이미 있으면 절대 건드리지 않음
    // 사용자가 추가한 모니터링 데이터를 보호하는 것이 최우선
    if (!forceSeed && existingRunsCount > 0) {
      console.log(`[SEED-RUNS] Runs already exist (count=${existingRunsCount}), skipping seed completely.`)
      console.log(`[SEED-RUNS] This prevents overwriting user-added monitoring data on server restart.`)
      console.log(`[SEED-RUNS] To force re-seed, set FORCE_SEED=true (WARNING: will delete all existing runs)`)
      process.exit(0)
    }

    // FORCE_SEED=true일 때만 기존 runs 삭제 (매우 위험한 작업)
    if (forceSeed && existingRunsCount > 0) {
      console.log(`[SEED-RUNS] WARNING: FORCE_SEED=true, deleting ${existingRunsCount} existing runs...`)
      await prisma.runResult.deleteMany({}) // 먼저 결과 삭제
      await prisma.run.deleteMany({}) // 그 다음 run 삭제
      console.log(`[SEED-RUNS] Deleted all existing runs and results`)
    }

    // CSV 파일 경로 확인 (우선순위: data/runs.csv → src/data/runs.csv)
    const dataRunsCsvPath = join(process.cwd(), 'data', 'runs.csv')
    const srcRunsCsvPath = join(process.cwd(), 'src', 'data', 'runs.csv')

    let csvPath: string | null = null

    if (existsSync(dataRunsCsvPath)) {
      csvPath = dataRunsCsvPath
      console.log(`[SEED-RUNS] source=${csvPath}`)
    } else if (existsSync(srcRunsCsvPath)) {
      csvPath = srcRunsCsvPath
      console.log(`[SEED-RUNS] source=${csvPath}`)
    } else {
      console.log(`[SEED-RUNS] CSV not found, skipping runs seed`)
      console.log(`[SEED-RUNS] Checked paths:`)
      console.log(`  - ${dataRunsCsvPath}`)
      console.log(`  - ${srcRunsCsvPath}`)
      process.exit(0) // CSV가 없으면 스킵 (에러 아님)
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

    console.log(`[SEED-RUNS] rows=${records.length}`)

    if (records.length === 0) {
      console.log(`[SEED-RUNS] CSV empty, skipping`)
      process.exit(0)
    }

    // runDate별로 그룹화
    const runsByDate = new Map<string, any[]>()
    for (const record of records) {
      const runDate = record.run_date?.trim()
      if (!runDate) continue

      if (!runsByDate.has(runDate)) {
        runsByDate.set(runDate, [])
      }
      runsByDate.get(runDate)!.push(record)
    }

    console.log(`[SEED-RUNS] run dates found: ${Array.from(runsByDate.keys()).join(', ')}`)

    let runCreatedCount = 0
    let runUpdatedCount = 0
    let resultCreatedCount = 0
    let resultUpdatedCount = 0
    let skippedCount = 0

    // 각 runDate별로 처리
    for (const [runDate, records] of Array.from(runsByDate.entries())) {
      // 날짜 정규화
      const normalizedRunDate = normalizeRunDate(runDate)
      if (runDate !== normalizedRunDate) {
        console.log(`[SEED-RUNS] RunDate normalized: ${runDate} -> ${normalizedRunDate}`)
      }

      // Run 생성 또는 조회
      let run = await prisma.run.findUnique({
        where: { runDate: normalizedRunDate },
      })

      if (!run) {
        run = await prisma.run.create({
          data: {
            runDate: normalizedRunDate,
          },
        })
        runCreatedCount++
        console.log(`[SEED-RUNS] Created run for ${normalizedRunDate}`)
      } else {
        // 멱등성 보장: 기존 Run이 있으면 절대 건드리지 않음
        // FORCE_SEED=true일 때는 이미 위에서 모든 runs를 삭제했으므로 여기 도달하면 안 됨
        // 하지만 방어적 코딩: 혹시 모를 경우를 대비해 스킵
        console.log(`[SEED-RUNS] Run ${normalizedRunDate} already exists, skipping to preserve user data`)
        console.log(`[SEED-RUNS] This should not happen if FORCE_SEED logic worked correctly`)
        continue
      }

      // 각 레코드를 RunResult로 처리
      for (const record of records) {
        // 필드 trim 처리
        const targetId = record.id?.trim()
        const foundAcademic = record.found_academic?.trim().toUpperCase()
        const foundPdf = record.found_pdf?.trim().toUpperCase()

        if (!targetId) {
          skippedCount++
          continue
        }

        // Target 존재 확인
        const target = await prisma.target.findUnique({
          where: { id: targetId },
        })

        if (!target) {
          console.log(`[SEED-RUNS] Target ${targetId} not found, skipping`)
          skippedCount++
          continue
        }

        // RunResult upsert
        const foundAcademicNaver = foundAcademic === 'Y'
        const isPdf = foundPdf === 'Y'

        try {
          const existingResult = await prisma.runResult.findUnique({
            where: {
              runId_targetId: {
                runId: run.id,
                targetId: target.id,
              },
            },
          })

          if (existingResult) {
            await prisma.runResult.update({
              where: { id: existingResult.id },
              data: {
                foundAcademicNaver,
                isPdf,
              },
            })
            resultUpdatedCount++
          } else {
            await prisma.runResult.create({
              data: {
                runId: run.id,
                targetId: target.id,
                foundAcademicNaver,
                isPdf,
              },
            })
            resultCreatedCount++
          }
        } catch (error: any) {
          console.error(`[SEED-RUNS] Error processing result for ${targetId} on ${runDate}:`, error.message)
          skippedCount++
        }
      }
    }

    const totalRuns = await prisma.run.count()
    const totalResults = await prisma.runResult.count()

    const insertedCount = runCreatedCount + resultCreatedCount
    const updatedCount = runUpdatedCount + resultUpdatedCount

    console.log(`[SEED-RUNS] inserted=${insertedCount}, updated=${updatedCount}, skipped=${skippedCount}`)
    console.log(`[SEED-RUNS] runs created=${runCreatedCount}, updated=${runUpdatedCount}`)
    console.log(`[SEED-RUNS] results created=${resultCreatedCount}, updated=${resultUpdatedCount}`)
    console.log(`[SEED-RUNS] total runs in DB=${totalRuns}, total results=${totalResults}`)
    console.log(`[SEED-RUNS] completed successfully`)
  } catch (error) {
    console.error('[SEED-RUNS] Seed error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error('[SEED-RUNS] Fatal error:', e)
    process.exit(1)
  })

