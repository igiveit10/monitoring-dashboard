import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compareResults } from '@/lib/diff'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const runDate = searchParams.get('runDate')
    const baselineRunDate = searchParams.get('baselineRunDate')

    if (!runDate) {
      return NextResponse.json(
        { error: 'runDate parameter is required' },
        { status: 400 }
      )
    }

    // Run 조회
    const run = await prisma.run.findUnique({
      where: { runDate },
      include: {
        results: {
          include: {
            target: true,
          },
        },
      },
    })

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    // 베이스라인 Run 조회
    let baselineRun = null
    if (baselineRunDate) {
      baselineRun = await prisma.run.findUnique({
        where: { runDate: baselineRunDate },
        include: {
          results: true,
        },
      })
    } else {
      // 가장 오래된 Run을 베이스라인으로 사용
      baselineRun = await prisma.run.findFirst({
        orderBy: { runDate: 'asc' },
        include: {
          results: true,
        },
      })
    }

    // 전체 targets 개수
    const totalTargets = await prisma.target.count()

    // KPI 계산
    const results = run.results
    const foundAcademicNaverCount = results.filter(
      (r) => r.foundAcademicNaver
    ).length
    const isPdfCount = results.filter((r) => r.isPdf).length
    const checkedCount = results.length

    // 변경 감지
    let diffs: any[] = []
    if (baselineRun) {
      const baselineMap = new Map(
        baselineRun.results.map((r) => [r.targetId, r])
      )
      const currentMap = new Map(results.map((r) => [r.targetId, r]))
      const diffResults = compareResults(baselineMap, currentMap)

      // target 정보 추가
      diffs = await Promise.all(
        diffResults.map(async (diff) => {
          const target = await prisma.target.findUnique({
            where: { id: diff.targetId },
          })
          return {
            ...diff,
            keyword: target?.keyword || '',
            url: target?.url || diff.url,
          }
        })
      )
    }

    // 테이블 데이터 준비
    const tableData = results.map((result) => ({
      id: result.target.id,
      keyword: result.target.keyword,
      url: result.target.url,
      currentStatus: result.target.currentStatus,
      myComment: result.target.myComment,
      foundAcademicNaver: result.foundAcademicNaver,
      isPdf: result.isPdf,
      httpStatus: result.httpStatus,
      finalUrl: result.finalUrl,
      checkedAt: result.checkedAt,
      errorMessage: result.errorMessage,
    }))

    return NextResponse.json({
      kpi: {
        totalTargets,
        foundAcademicNaver: {
          count: foundAcademicNaverCount,
          percentage:
            totalTargets > 0
              ? Math.round((foundAcademicNaverCount / totalTargets) * 100)
              : 0,
        },
        isPdf: {
          count: isPdfCount,
          percentage:
            totalTargets > 0 ? Math.round((isPdfCount / totalTargets) * 100) : 0,
        },
        checked: {
          count: checkedCount,
          total: totalTargets,
        },
      },
      diffs,
      tableData,
      runDate,
      baselineRunDate: baselineRun?.runDate || null,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

