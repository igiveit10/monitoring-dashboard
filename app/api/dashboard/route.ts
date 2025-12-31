import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { compareResults } from '@/lib/diff'
import { sortTargetsByAnswerSet, sortTableDataByAnswerSet } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// API 라우트에서 직접 Prisma 클라이언트 생성 (환경 변수 보장)
const getPrisma = () => {
  const rawDatabaseUrl = process.env.DATABASE_URL ?? ""
  const databaseUrl = rawDatabaseUrl.replace(/\s/g, "") // 개행/공백 제거
  
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

export async function GET(request: NextRequest) {
  const prisma = getPrisma()
  try {
    const searchParams = request.nextUrl.searchParams
    const runDate = searchParams.get('runDate')
    const baselineRunDate = searchParams.get('baselineRunDate')

    // Run이 없을 경우를 대비한 처리
    let run = null
    if (runDate) {
      run = await prisma.run.findUnique({
        where: { runDate },
        include: {
          results: {
            include: {
              target: true,
            },
          },
        },
      })
    }
    
    // Run이 없으면 가장 최신 Run을 찾거나 빈 Run 생성
    if (!run) {
      const latestRun = await prisma.run.findFirst({
        orderBy: { runDate: 'desc' },
        include: {
          results: {
            include: {
              target: true,
            },
          },
        },
      })
      run = latestRun || {
        id: '',
        runDate: '',
        createdAt: new Date(),
        results: [],
      }
    }

    // 모든 Run 조회 (모니터링 섹션용)
    const allRuns = await prisma.run.findMany({
      orderBy: { runDate: 'asc' },
      include: {
        results: true,
      },
    })

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
      baselineRun = allRuns.length > 0 ? allRuns[0] : null
    }

    // 전체 targets 개수 (CSV에서 가져온 데이터 기준)
    const totalTargets = await prisma.target.count()
    console.log(`[Dashboard API] Total targets in DB: ${totalTargets}`)

    // 테이블 데이터 준비 및 정답셋(CSV 원본) 기준 KPI 계산
    // Run 결과가 있는 targets와 없는 targets 모두 포함
    const allTargetsRaw = await prisma.target.findMany()
    // 정답셋 기준으로 정렬: YY > YN > NY > NN
    const allTargets = sortTargetsByAnswerSet(allTargetsRaw)
    console.log(`[Dashboard API] Fetched ${allTargets.length} targets from DB (sorted by answer set)`)

    // 정답셋(CSV 원본) 기준 KPI 계산
    const csv통검노출Count = allTargets.filter(
      (t) => t.currentStatus === '노출'
    ).length
    // csvPdfExposure 필드 확인 (디버깅용)
    const sampleTargets = allTargets.slice(0, 5).map(t => ({ 
      keyword: t.keyword?.substring(0, 20), 
      csvPdfExposure: t.csvPdfExposure,
      type: typeof t.csvPdfExposure
    }))
    console.log('Sample targets csvPdfExposure:', JSON.stringify(sampleTargets, null, 2))
    const csvPdf노출Count = allTargets.filter(
      (t) => t.csvPdfExposure === true
    ).length
    console.log('csvPdf노출Count:', csvPdf노출Count, 'total:', allTargets.length, 'filtered:', allTargets.filter(t => t.csvPdfExposure).length)

    // 선택된 Run의 체크 결과
    const results = run?.results || []
    const checkedCount = results.length

    // 현재 Run의 통합 노출 및 PDF 노출 수 계산 (모니터링 결과 기준)
    const current통검노출Count = results.filter((r) => r.foundAcademicNaver === true).length
    const currentPdf노출Count = results.filter((r) => r.isPdf === true).length

    // 이전 Run 조회 (현재 Run보다 이전의 가장 최근 Run)
    let previousRun = null
    if (run && run.runDate) {
      previousRun = await prisma.run.findFirst({
        where: {
          runDate: {
            lt: run.runDate,
          },
        },
        orderBy: { runDate: 'desc' },
        include: {
          results: true,
        },
      })
    }

    // 이전 Run의 통합 노출 및 PDF 노출 수 계산
    const previous통검노출Count = previousRun
      ? previousRun.results.filter((r) => r.foundAcademicNaver === true).length
      : null
    const previousPdf노출Count = previousRun
      ? previousRun.results.filter((r) => r.isPdf === true).length
      : null
    const previousCheckedCount = previousRun ? previousRun.results.length : null

    // 정답셋 기준 데이터 준비
    const csvMap = new Map<string, { foundAcademicNaver: boolean; isPdf: boolean }>()
    allTargets.forEach((target) => {
      const csv통검노출 = target.currentStatus === '노출'
      const csvPdf노출 = Boolean(target.csvPdfExposure) || false
      csvMap.set(target.id, {
        foundAcademicNaver: csv통검노출,
        isPdf: csvPdf노출,
      })
    })

    // 각 Run 날짜별 변경사항 계산
    const diffsByDate: Record<string, any[]> = {}
    
    // 모든 Run을 날짜순으로 정렬 (오래된 것부터)
    const sortedRuns = [...allRuns].sort((a, b) => a.runDate.localeCompare(b.runDate))
    
    for (let i = 0; i < sortedRuns.length; i++) {
      const currentRun = sortedRuns[i]
      const currentRunResults = new Map(currentRun.results.map((r) => [r.targetId, r]))
      const runDiffs: any[] = []
      
      // 이전 Run이 있으면 이전 Run과 비교, 없으면 정답셋과 비교
      const previousRun = i > 0 ? sortedRuns[i - 1] : null
      const previousRunResults = previousRun
        ? new Map(previousRun.results.map((r) => [r.targetId, r]))
        : null
      
      // 모든 target에 대해 비교
      for (const target of allTargets) {
        const currentResult = currentRunResults.get(target.id)
        const previousResult = previousRunResults?.get(target.id)
        
        // 비교 기준 결정: 이전 Run이 있으면 이전 Run과 비교, 없으면 정답셋과 비교
        let baselineData: { foundAcademicNaver: boolean; isPdf: boolean } | null = null
        if (previousRunResults && previousResult) {
          baselineData = {
            foundAcademicNaver: previousResult.foundAcademicNaver,
            isPdf: previousResult.isPdf,
          }
        } else {
          baselineData = csvMap.get(target.id) || {
            foundAcademicNaver: false,
            isPdf: false,
          }
        }
        
        if (!baselineData) continue
        
        const current통검노출 = currentResult ? currentResult.foundAcademicNaver : baselineData.foundAcademicNaver
        const currentPdf노출 = currentResult ? currentResult.isPdf : baselineData.isPdf
        
        const changes: Array<{ field: string; oldValue: any; newValue: any }> = []
        
        // 통검노출 비교
        if (baselineData.foundAcademicNaver !== current통검노출) {
          changes.push({
            field: 'foundAcademicNaver',
            oldValue: baselineData.foundAcademicNaver,
            newValue: current통검노출,
          })
        }
        
        // PDF 노출 비교
        if (baselineData.isPdf !== currentPdf노출) {
          changes.push({
            field: 'isPdf',
            oldValue: baselineData.isPdf,
            newValue: currentPdf노출,
          })
        }
        
        // HTTP 상태 변경도 감지 (Run 결과가 있는 경우)
        if (currentResult) {
          const baselineHttpStatus = previousResult?.httpStatus ?? 200
          if (currentResult.httpStatus !== null && currentResult.httpStatus !== baselineHttpStatus) {
            changes.push({
              field: 'httpStatus',
              oldValue: baselineHttpStatus,
              newValue: currentResult.httpStatus,
            })
          }
          
          // 에러 메시지가 있는 경우
          if (currentResult.errorMessage && !previousResult?.errorMessage) {
            changes.push({
              field: 'errorMessage',
              oldValue: previousResult?.errorMessage || null,
              newValue: currentResult.errorMessage,
            })
          }
        }
        
        if (changes.length > 0) {
          runDiffs.push({
            targetId: target.id,
            keyword: target.keyword || '',
            url: target.url || '',
            myComment: target.myComment || '',
            diffs: changes,
          })
        }
      }
      
      if (runDiffs.length > 0) {
        diffsByDate[currentRun.runDate] = runDiffs
      }
    }
    
    // 현재 선택된 Run의 변경사항 (하위 호환성)
    const currentMap = new Map(results.map((r) => [r.targetId, r]))
    const diffs: any[] = []
    for (const [targetId, csvData] of csvMap.entries()) {
      const currentResult = currentMap.get(targetId)
      const target = allTargets.find(t => t.id === targetId)
      
      const current통검노출 = currentResult ? currentResult.foundAcademicNaver : csvData.foundAcademicNaver
      const currentPdf노출 = currentResult ? currentResult.isPdf : csvData.isPdf
      
      const changes: Array<{ field: string; oldValue: any; newValue: any }> = []
      
      if (csvData.foundAcademicNaver !== current통검노출) {
        changes.push({
          field: 'foundAcademicNaver',
          oldValue: csvData.foundAcademicNaver,
          newValue: current통검노출,
        })
      }
      
      if (csvData.isPdf !== currentPdf노출) {
        changes.push({
          field: 'isPdf',
          oldValue: csvData.isPdf,
          newValue: currentPdf노출,
        })
      }
      
      if (currentResult) {
        if (currentResult.httpStatus !== null && currentResult.httpStatus !== 200) {
          changes.push({
            field: 'httpStatus',
            oldValue: 200,
            newValue: currentResult.httpStatus,
          })
        }
        
        if (currentResult.errorMessage) {
          changes.push({
            field: 'errorMessage',
            oldValue: null,
            newValue: currentResult.errorMessage,
          })
        }
      }
      
      if (changes.length > 0) {
        diffs.push({
          targetId,
          keyword: target?.keyword || '',
          url: target?.url || '',
          myComment: target?.myComment || '',
          diffs: changes,
        })
      }
    }

    const resultMap = new Map(
      results.map((r) => [r.targetId, r])
    )

    const tableDataRaw = allTargets.map((target) => {
      const result = resultMap.get(target.id)
      
      // CSV에서 가져온 값 파싱
      // currentStatus: "노출" 또는 "미노출" -> csv통검노출: Y 또는 N
      // csvPdfExposure: boolean -> csvPdf노출: Y 또는 N
      const csv통검노출 = target.currentStatus === '노출' ? 'Y' : target.currentStatus === '미노출' ? 'N' : null
      const csvPdf노출 = Boolean(target.csvPdfExposure) ? 'Y' : 'N'
      
      if (result) {
        // Run 결과가 있는 경우
        return {
          id: target.id,
          keyword: target.keyword,
          url: target.url,
          currentStatus: target.currentStatus,
          myComment: target.myComment,
          csv통검노출,
          csvPdf노출,
          foundAcademicNaver: result.foundAcademicNaver,
          isPdf: result.isPdf,
          httpStatus: result.httpStatus,
          finalUrl: result.finalUrl,
          checkedAt: result.checkedAt,
          errorMessage: result.errorMessage,
        }
      } else {
        // Run 결과가 없는 경우 (아직 체크 안 됨)
        return {
          id: target.id,
          keyword: target.keyword,
          url: target.url,
          currentStatus: target.currentStatus,
          myComment: target.myComment,
          csv통검노출,
          csvPdf노출,
          foundAcademicNaver: false,
          isPdf: false,
          httpStatus: null,
          finalUrl: null,
          checkedAt: null,
          errorMessage: '아직 체크되지 않음',
        }
      }
    })
    
    // 정답셋 기준으로 tableData 정렬: YY > YN > NY > NN
    const tableData = sortTableDataByAnswerSet(tableDataRaw)

    return NextResponse.json({
      kpi: {
        totalTargets,
        foundAcademicNaver: {
          count: current통검노출Count, // 현재 Run의 모니터링 결과 기준
          percentage:
            totalTargets > 0
              ? Math.round((current통검노출Count / totalTargets) * 100)
              : 0,
          previousCount: previous통검노출Count,
          change: previous통검노출Count !== null
            ? current통검노출Count - previous통검노출Count
            : null,
          csvCount: csv통검노출Count, // 정답셋 기준 값 (비교용)
          csvChange: current통검노출Count - csv통검노출Count, // 정답셋 대비 변경량
        },
        isPdf: {
          count: currentPdf노출Count, // 현재 Run의 모니터링 결과 기준
          percentage:
            totalTargets > 0 ? Math.round((currentPdf노출Count / totalTargets) * 100) : 0,
          previousCount: previousPdf노출Count,
          change: previousPdf노출Count !== null
            ? currentPdf노출Count - previousPdf노출Count
            : null,
          csvCount: csvPdf노출Count, // 정답셋 기준 값 (비교용)
          csvChange: currentPdf노출Count - csvPdf노출Count, // 정답셋 대비 변경량
        },
        checked: {
          count: checkedCount,
          total: totalTargets,
          previousCount: previousCheckedCount,
          change: previousCheckedCount !== null
            ? checkedCount - previousCheckedCount
            : null,
        },
      },
      diffs,
      diffsByDate, // 날짜별 변경사항
      tableData,
      runDate,
      baselineRunDate: baselineRun?.runDate || null,
      allRuns: allRuns.map((r) => ({
        runDate: r.runDate,
        results: r.results,
      })),
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        message: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

