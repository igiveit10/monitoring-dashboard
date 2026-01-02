import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// 진단 API: DB 상태 확인
export async function GET(request: NextRequest) {
  try {
    // Targets 개수
    const targetsCount = await prisma.target.count()

    // Runs 전체 조회 (날짜별 정렬)
    const runs = await prisma.run.findMany({
      include: {
        results: true,
      },
      orderBy: {
        runDate: 'desc',
      },
    })

    // 날짜별 runs 개수 집계
    const runsByDate: Record<string, number> = {}
    runs.forEach((run) => {
      const date = run.runDate
      runsByDate[date] = (runsByDate[date] || 0) + 1
    })

    // 날짜별 상세 정보
    const runsSummary = runs.map((run) => ({
      runDate: run.runDate,
      runId: run.id,
      resultsCount: run.results.length,
      createdAt: run.createdAt,
    }))

    // 최신 runs 5개 샘플 (상세 정보 포함)
    const latestRuns = runs.slice(0, 5).map((run) => ({
      runDate: run.runDate,
      runId: run.id,
      resultsCount: run.results.length,
      createdAt: run.createdAt,
      sampleResults: run.results.slice(0, 3).map((result) => ({
        targetId: result.targetId,
        foundAcademicNaver: result.foundAcademicNaver,
        isPdf: result.isPdf,
        checkedAt: result.checkedAt,
      })),
    }))

    // 전체 RunResult 개수
    const totalResultsCount = await prisma.runResult.count()

    return NextResponse.json({
      success: true,
      data: {
        targets_count: targetsCount,
        runs_count: runs.length,
        runs_by_date: runsByDate,
        latest_runs: latestRuns,
        total_results_count: totalResultsCount,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Admin Diag API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch diagnostic data',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

