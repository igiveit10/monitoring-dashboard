import { PrismaClient } from '@prisma/client'
import { getTodayDateString } from '../lib/utils'
import { checkUrl } from '../lib/checker'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 샘플 targets 생성
  const targets = [
    {
      keyword: '테스트키워드1',
      url: 'https://www.naver.com',
      currentStatus: '노출',
      myComment: '네이버 메인',
    },
    {
      keyword: '테스트키워드2',
      url: 'https://www.google.com',
      currentStatus: '미노출',
      myComment: '구글 메인',
    },
    {
      keyword: '테스트키워드3',
      url: 'https://academic.naver.com',
      currentStatus: '노출',
      myComment: '학술검색',
    },
  ]

  for (const targetData of targets) {
    await prisma.target.upsert({
      where: { url: targetData.url },
      update: targetData,
      create: targetData,
    })
  }

  console.log(`Created ${targets.length} targets`)

  // 오늘 날짜로 Run 생성 및 체크 실행
  const today = getTodayDateString()
  let run = await prisma.run.findUnique({
    where: { runDate: today },
  })

  if (!run) {
    run = await prisma.run.create({
      data: { runDate: today },
    })
    console.log(`Created run for ${today}`)
  }

  // 모든 targets 체크
  const allTargets = await prisma.target.findMany()
  console.log(`Checking ${allTargets.length} URLs...`)

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
      console.log(`✓ Checked ${target.url}`)
    } catch (error) {
      console.error(`✗ Error checking ${target.url}:`, error)
    }
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

