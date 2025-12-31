import { PrismaClient } from '@prisma/client'
import { checkUrl } from '../lib/checker'

const prisma = new PrismaClient()

async function main() {
  console.log('12/28 검수 데이터 생성 시작...')

  // 2024-12-28 날짜로 Run 생성
  const runDate = '2024-12-28'
  let run = await prisma.run.findUnique({
    where: { runDate },
  })

  if (!run) {
    run = await prisma.run.create({
      data: { runDate },
    })
    console.log(`Created run for ${runDate}`)
  } else {
    console.log(`Run for ${runDate} already exists`)
  }

  // 모든 targets 가져오기
  const allTargets = await prisma.target.findMany()
  console.log(`Checking ${allTargets.length} URLs...`)

  let checkedCount = 0
  let errorCount = 0

  // 모든 targets 체크
  for (const target of allTargets) {
    try {
      const checkResult = await checkUrl(target.url)
      await prisma.runResult.upsert({
        where: {
          runId_targetId: {
            runId: run.id,
            targetId: target.id,
          },
        },
        update: {
          foundAcademicNaver: checkResult.foundAcademicNaver,
          isPdf: checkResult.isPdf,
          httpStatus: checkResult.httpStatus,
          finalUrl: checkResult.finalUrl,
          errorMessage: checkResult.errorMessage,
          checkedAt: new Date(),
        },
        create: {
          runId: run.id,
          targetId: target.id,
          foundAcademicNaver: checkResult.foundAcademicNaver,
          isPdf: checkResult.isPdf,
          httpStatus: checkResult.httpStatus,
          finalUrl: checkResult.finalUrl,
          errorMessage: checkResult.errorMessage,
        },
      })
      checkedCount++
      console.log(`✓ Checked ${target.url}`)
    } catch (error) {
      errorCount++
      console.error(`✗ Error checking ${target.url}:`, error)
    }
  }

  console.log(`\n완료:`)
  console.log(`  - 성공: ${checkedCount}개`)
  console.log(`  - 실패: ${errorCount}개`)
  console.log(`12/28 검수 데이터 생성 완료!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

