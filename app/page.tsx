'use client'

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { RefreshCw, CheckCircle2, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
// @ts-ignore
import * as XLSXStyle from 'xlsx-js-style'

interface Run {
  id: string
  runDate: string
  createdAt: string
}

interface DashboardData {
  kpi: {
    totalTargets: number
    foundAcademicNaver: {
      count: number
      percentage: number
      previousCount?: number | null
      change?: number | null
      csvCount?: number
      csvChange?: number
    }
    isPdf: {
      count: number
      percentage: number
      previousCount?: number | null
      change?: number | null
      csvCount?: number
      csvChange?: number
    }
    checked: {
      count: number
      total: number
      previousCount?: number | null
      change?: number | null
    }
  }
  diffs: Array<{
    targetId: string
    keyword: string
    url: string
    note?: string | null
    diffs: Array<{
      field: string
      oldValue: any
      newValue: any
    }>
  }>
  diffsByDate?: Record<string, Array<{
    targetId: string
    keyword: string
    url: string
    note?: string | null
    diffs: Array<{
      field: string
      oldValue: any
      newValue: any
    }>
  }>>
  tableData: Array<{
    id: string
    keyword: string
    url: string
    currentStatus: string | null
    myComment: string | null // RunResult.myComment 단일 소스
    csv통검노출: string | null
    csvPdf노출: string
    foundAcademicNaver: boolean
    isPdf: boolean
    httpStatus: number | null
    finalUrl: string | null
    checkedAt: string
    errorMessage: string | null
  }>
  runDate: string
  allRuns: Array<{
    runDate: string
    results: Array<{
      targetId: string
      foundAcademicNaver: boolean
      isPdf: boolean
      httpStatus: number | null
      finalUrl: string | null
      checkedAt: string
      errorMessage: string | null
      myComment: string | null // RunResult.myComment
    }>
  }>
}

export default function Dashboard() {
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRunDate, setSelectedRunDate] = useState<string>('')
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null)
  const [monitoringDate, setMonitoringDate] = useState<string>('')
  const [filter, setFilter] = useState<string>('all')
  const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false)
  const [monitoringModalDate, setMonitoringModalDate] = useState<string>('')
  const [monitoringData, setMonitoringData] = useState<
    Record<string, { 통검노출: string; pdf노출: string; 완료: boolean }>
  >({})

  // localStorage에서 모니터링 데이터 복원
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`monitoring_${monitoringModalDate}`)
      if (saved && monitoringModalDate) {
        try {
          const parsed = JSON.parse(saved)
          setMonitoringData(parsed)
        } catch (e) {
          console.error('Failed to parse saved monitoring data', e)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoringModalDate])

  // 모니터링 데이터 변경 시 localStorage에 저장
  useEffect(() => {
    if (monitoringModalDate && Object.keys(monitoringData).length > 0) {
      localStorage.setItem(`monitoring_${monitoringModalDate}`, JSON.stringify(monitoringData))
    }
  }, [monitoringData, monitoringModalDate])

  const [monitoringColumnWidths, setMonitoringColumnWidths] = useState<Record<string, number>>({
    keyword: 200,
    url: 300,
    csv통검노출: 100,
    csvPdf노출: 100,
    csv비고: 150,
    monitoring통검노출: 120,
    monitoringPdf노출: 120,
    monitoring비고: 200,
  })
  const [monitoringResizingColumn, setMonitoringResizingColumn] = useState<string | null>(null)
  // 기본 정렬: 정답셋 기준 (YY > YN > NY > NN)
  // 사용자가 다른 컬럼을 클릭하면 그 컬럼으로 정렬됨
  const [sortBy, setSortBy] = useState<string>('answerSet')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    id: 120,
    keyword: 250,
    url: 350,
    csv통검노출: 100,
    csvPdf노출: 100,
    note: 150,
    check: 80,
  })
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)

  // Runs 로드
  useEffect(() => {
    loadRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 선택된 Run이 변경되면 대시보드 데이터 로드 (Run이 없어도 로드)
  useEffect(() => {
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunDate])

  // 날짜별 변경사항이 로드되면 최신 날짜를 기본으로 펼침
  useEffect(() => {
    if (dashboardData?.diffsByDate) {
      const dates = Object.keys(dashboardData.diffsByDate).sort((a, b) => b.localeCompare(a))
      if (dates.length > 0 && expandedDates.size === 0) {
        setExpandedDates(new Set([dates[0]])) // 최신 날짜만 펼침
      }
    }
  }, [dashboardData?.diffsByDate])

  // 모니터링 날짜가 변경되면 대시보드 데이터 로드 (선택된 Run 날짜로 설정)
  useEffect(() => {
    if (monitoringDate) {
      setSelectedRunDate(monitoringDate)
      loadDashboardData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoringDate])

  const loadRuns = async () => {
    try {
      const res = await fetch('/api/runs')
      if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`)
      const data = await res.json()
      setRuns(data)

      if (data.length > 0) setSelectedRunDate(data[0].runDate)
      else setSelectedRunDate(new Date().toISOString().split('T')[0])
    } catch (error) {
      console.error('Error loading runs:', error)
      setSelectedRunDate(new Date().toISOString().split('T')[0])
    }
  }

  const loadDashboardData = async () => {
    const runDateToUse = selectedRunDate || new Date().toISOString().split('T')[0]
    setLoading(true)
    try {
      const params = new URLSearchParams({ runDate: runDateToUse })
      const res = await fetch(`/api/dashboard?${params}`)
      const data = await res.json()
      if (!res.ok) {
        console.error('API Error:', data)
        alert(`에러 발생: ${data.message || data.error}\n자세한 내용은 콘솔을 확인하세요.`)
        setDashboardData(null)
        return
      }
      setDashboardData(data)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      alert(`데이터 로드 실패: ${error instanceof Error ? error.message : String(error)}`)
      setDashboardData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckTarget = async (targetId: string) => {
    try {
      const res = await fetch(`/api/check/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runDate: selectedRunDate }),
      })
      if (res.ok) await loadDashboardData()
    } catch (error) {
      console.error('Error checking target:', error)
    }
  }

  // ✅ 안전한 기본값(로딩 중에도 터지지 않게)
  const kpi = dashboardData?.kpi
  const kpiTotalTargets = kpi?.totalTargets ?? 0
  const kpiFoundCount = kpi?.foundAcademicNaver?.count ?? 0
  const kpiFoundPct = kpi?.foundAcademicNaver?.percentage ?? 0
  const kpiPdfCount = kpi?.isPdf?.count ?? 0
  const kpiPdfPct = kpi?.isPdf?.percentage ?? 0
  const kpiCheckedCount = kpi?.checked?.count ?? 0
  const kpiCheckedTotal = kpi?.checked?.total ?? 0

  // 필터링된 테이블 데이터
  const filteredTableData = (dashboardData?.tableData ?? []).filter((row) => {
    if (filter === 'all') return true
    if (filter === 'exposed') return row.foundAcademicNaver
    if (filter === 'notExposed') return !row.foundAcademicNaver
    if (filter === 'pdf') return row.isPdf
    if (filter === 'error') return Boolean(row.errorMessage || (row.httpStatus && row.httpStatus >= 400))
    if (filter === 'changed') return dashboardData?.diffs?.some((d) => d.targetId === row.id) ?? false
    return true
  })

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-30" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 inline" />
    )
  }

  // 컬럼 리사이즈 핸들러 (현재 테이블에서 아직 안 쓰는 듯 하지만 안전하게 둠)
  const handleMouseDown = (column: string, e: ReactMouseEvent) => {
    e.preventDefault()
    setResizingColumn(column)
    const startX = e.clientX
    const startWidth = columnWidths[column] || 150

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX
      const newWidth = Math.max(50, startWidth + diff)
      setColumnWidths((prev) => ({ ...prev, [column]: newWidth }))
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // 정렬
  const sortedTableData = [...filteredTableData].sort((a, b) => {
    // 기본 정렬: 정답셋 기준 (YY > YN > NY > NN)
    if (sortBy === 'answerSet') {
      // answer_search_exposed 계산 (csv통검노출이 'Y'이면 'Y', 아니면 'N')
      const aSearchExposed = a.csv통검노출 === 'Y' ? 'Y' : 'N'
      const bSearchExposed = b.csv통검노출 === 'Y' ? 'Y' : 'N'
      
      // answer_pdf_exposed 계산 (csvPdf노출이 'Y'이면 'Y', 아니면 'N')
      const aPdfExposed = a.csvPdf노출 === 'Y' ? 'Y' : 'N'
      const bPdfExposed = b.csvPdf노출 === 'Y' ? 'Y' : 'N'
      
      // score 계산: (answer_search_exposed=='Y'?2:0) + (answer_pdf_exposed=='Y'?1:0)
      const aScore = (aSearchExposed === 'Y' ? 2 : 0) + (aPdfExposed === 'Y' ? 1 : 0)
      const bScore = (bSearchExposed === 'Y' ? 2 : 0) + (bPdfExposed === 'Y' ? 1 : 0)
      
      // score desc (높은 점수부터)
      if (aScore !== bScore) {
        return sortDirection === 'desc' ? bScore - aScore : aScore - bScore
      }
      
      // tie-breaker: id asc
      return a.id.localeCompare(b.id)
    }

    let comparison = 0

    if (sortBy === 'id') comparison = a.id.localeCompare(b.id)
    else if (sortBy === 'keyword') comparison = (a.keyword || '').localeCompare(b.keyword || '')
    else if (sortBy === 'url') comparison = (a.url || '').localeCompare(b.url || '')
    else if (sortBy === 'csv통검노출') comparison = (a.csv통검노출 || '').localeCompare(b.csv통검노출 || '')
    else if (sortBy === 'csvPdf노출') comparison = (a.csvPdf노출 || '').localeCompare(b.csvPdf노출 || '')
    else if (sortBy === 'foundAcademicNaver') comparison = (a.foundAcademicNaver ? 1 : 0) - (b.foundAcademicNaver ? 1 : 0)
    else if (sortBy === 'isPdf') comparison = (a.isPdf ? 1 : 0) - (b.isPdf ? 1 : 0)
    else if (sortBy === 'note') comparison = 0 // note 필드 제거됨
    else if (sortBy === 'httpStatus') comparison = (a.httpStatus ?? 0) - (b.httpStatus ?? 0)
    else if (sortBy === 'finalUrl') comparison = (a.finalUrl || '').localeCompare(b.finalUrl || '')
    else if (sortBy === 'checkedAt') {
      const aTime = a.checkedAt ? new Date(a.checkedAt).getTime() : 0
      const bTime = b.checkedAt ? new Date(b.checkedAt).getTime() : 0
      comparison = aTime - bTime
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })

  const formatFieldName = (field: string) => {
    const map: Record<string, string> = {
      foundAcademicNaver: '통합 노출',
      isPdf: 'PDF 노출',
      httpStatus: 'HTTP 상태',
      finalUrl: '최종 URL',
      errorMessage: '에러 메시지',
    }
    return map[field] || field
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'boolean') return value ? 'Y' : 'N'
    return String(value)
  }

  const handleExcelDownload = () => {
    if (!dashboardData) return

    // 엑셀 데이터 준비 (변경 여부도 함께 계산)
    const excelDataWithChange = sortedTableData.map((row) => {
      const runResultsMap = new Map<string, any>()
      ;(dashboardData?.allRuns ?? []).forEach((run) => {
        const result = run.results.find((r) => r.targetId === row.id)
        if (result) runResultsMap.set(run.runDate, result)
      })

      // 변경사항이 있는지 확인
      let hasChange = false
      for (const run of dashboardData?.allRuns ?? []) {
        const result = runResultsMap.get(run.runDate)
        if (result) {
          const 모니터링통검노출 = result.foundAcademicNaver ?? false
          const 모니터링Pdf노출 = result.isPdf ?? false
          
          const 통검일치 =
            (row.csv통검노출 === 'Y' && 모니터링통검노출) ||
            (row.csv통검노출 === 'N' && !모니터링통검노출) ||
            row.csv통검노출 === null
          const Pdf일치 =
            (row.csvPdf노출 === 'Y' && 모니터링Pdf노출) || (row.csvPdf노출 === 'N' && !모니터링Pdf노출)
          
          if (!통검일치 || !Pdf일치) {
            hasChange = true
            break
          }
        }
      }

      // 기본 데이터
      const rowData: any = {
        _id: row.id,
        title: row.keyword,
        url: row.url,
        '정답셋 통검노출': row.csv통검노출 || '-',
        '정답셋 PDF노출': row.csvPdf노출 || 'N',
        '정답셋 비고': row.myComment && row.myComment.trim() !== '' ? row.myComment : '-',
      }

      // 각 Run 날짜별 모니터링 결과 추가 (최종URL, 에러, HTTP상태 제외)
      ;(dashboardData?.allRuns ?? []).forEach((run) => {
        const result = runResultsMap.get(run.runDate)
        if (result) {
          rowData[`${run.runDate} 통검`] = result.foundAcademicNaver ? 'Y' : 'N'
          rowData[`${run.runDate} PDF`] = result.isPdf ? 'Y' : 'N'
        } else {
          rowData[`${run.runDate} 통검`] = '-'
          rowData[`${run.runDate} PDF`] = '-'
        }
      })

      return { data: rowData, hasChange }
    })

    // 워크북 생성
    const wb = XLSXStyle.utils.book_new()
    const excelData = excelDataWithChange.map((item) => item.data)
    const ws = XLSXStyle.utils.json_to_sheet(excelData)

    // 컬럼 너비 설정
    const colWidths = [
      { wch: 25 }, // _id
      { wch: 50 }, // title
      { wch: 60 }, // url
      { wch: 15 }, // 정답셋 통검노출
      { wch: 15 }, // 정답셋 PDF노출
      { wch: 20 }, // 정답셋 비고
    ]
    // Run 날짜별 컬럼 너비 추가 (통검, PDF만)
    ;(dashboardData?.allRuns ?? []).forEach(() => {
      colWidths.push({ wch: 12 }, { wch: 12 }) // 통검, PDF
    })
    ws['!cols'] = colWidths

    // 헤더 스타일 설정
    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'E0E0E0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }

    // 헤더 행 스타일 적용
    const range = XLSXStyle.utils.decode_range(ws['!ref'] || 'A1')
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSXStyle.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddress]) continue
      ws[cellAddress].s = headerStyle
    }

    // 데이터 행에 배경색 적용 (변경된 행만)
    for (let row = 1; row <= excelDataWithChange.length; row++) {
      const item = excelDataWithChange[row - 1]
      if (item.hasChange) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSXStyle.utils.encode_cell({ r: row, c: col })
          if (!ws[cellAddress]) continue
          ws[cellAddress].s = {
            ...ws[cellAddress].s,
            fill: { fgColor: { rgb: 'FFF9C4' } }, // 노란색 배경
          }
        }
      }
    }

    XLSXStyle.utils.book_append_sheet(wb, ws, '모니터링 데이터')

    // 파일 다운로드
    const fileName = `모니터링_${selectedRunDate || new Date().toISOString().split('T')[0]}.xlsx`
    XLSXStyle.writeFile(wb, fileName)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">URL 모니터링 대시보드</h1>
        </div>

        {loading && !dashboardData && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">로딩 중...</p>
          </div>
        )}

        {dashboardData && (
          <>
            {/* KPI 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">전체 URL</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpiTotalTargets}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">통합 노출</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpiFoundCount}</div>
                  <div className="text-sm text-gray-500 mt-1">{kpiFoundPct}%</div>

                  {/* 정답셋 대비 변경량 표시 */}
                  {kpi?.foundAcademicNaver?.csvCount !== undefined &&
                    kpi?.foundAcademicNaver?.csvChange !== undefined &&
                    kpi?.foundAcademicNaver?.csvChange !== 0 && (
                      <div className="text-xs text-gray-400 mt-2">
                        정답셋: {kpi.foundAcademicNaver.csvCount}
                        <span
                          className={`ml-2 ${
                            kpi.foundAcademicNaver.csvChange > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          ({kpi.foundAcademicNaver.csvChange > 0 ? '+' : ''}
                          {kpi.foundAcademicNaver.csvChange})
                        </span>
                      </div>
                    )}

                  {/* 이전 Run 대비 변경량 표시 */}
                  {kpi?.foundAcademicNaver?.previousCount !== null &&
                    kpi?.foundAcademicNaver?.previousCount !== undefined &&
                    kpi?.foundAcademicNaver?.change !== null &&
                    kpi?.foundAcademicNaver?.change !== undefined &&
                    kpi?.foundAcademicNaver?.change !== 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        이전 Run: {kpi.foundAcademicNaver.previousCount}
                        <span
                          className={`ml-2 ${
                            kpi.foundAcademicNaver.change > 0
                              ? 'text-green-600'
                              : kpi.foundAcademicNaver.change < 0
                                ? 'text-red-600'
                                : 'text-gray-500'
                          }`}
                        >
                          ({kpi.foundAcademicNaver.change > 0 ? '+' : ''}
                          {kpi.foundAcademicNaver.change})
                        </span>
                      </div>
                    )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">PDF 노출</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpiPdfCount}</div>
                  <div className="text-sm text-gray-500 mt-1">{kpiPdfPct}%</div>

                  {/* 정답셋 대비 변경량 표시 */}
                  {kpi?.isPdf?.csvCount !== undefined &&
                    kpi?.isPdf?.csvChange !== undefined &&
                    kpi?.isPdf?.csvChange !== 0 && (
                      <div className="text-xs text-gray-400 mt-2">
                        정답셋: {kpi.isPdf.csvCount}
                        <span className={`ml-2 ${kpi.isPdf.csvChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({kpi.isPdf.csvChange > 0 ? '+' : ''}
                          {kpi.isPdf.csvChange})
                        </span>
                      </div>
                    )}

                  {/* 이전 Run 대비 변경량 표시 */}
                  {kpi?.isPdf?.previousCount !== null &&
                    kpi?.isPdf?.previousCount !== undefined &&
                    kpi?.isPdf?.change !== null &&
                    kpi?.isPdf?.change !== undefined &&
                    kpi?.isPdf?.change !== 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        이전 Run: {kpi.isPdf.previousCount}
                        <span
                          className={`ml-2 ${
                            kpi.isPdf.change > 0 ? 'text-green-600' : kpi.isPdf.change < 0 ? 'text-red-600' : 'text-gray-500'
                          }`}
                        >
                          ({kpi.isPdf.change > 0 ? '+' : ''}
                          {kpi.isPdf.change})
                        </span>
                      </div>
                    )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">체크 상태</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {kpiCheckedCount} / {kpiCheckedTotal}
                  </div>

                  {kpi?.checked?.previousCount !== null && kpi?.checked?.previousCount !== undefined && (
                    <div className="text-xs text-gray-400 mt-2">
                      이전: {kpi.checked.previousCount} / {kpiCheckedTotal}
                      {kpi?.checked?.change !== null && kpi?.checked?.change !== undefined && (
                        <span
                          className={`ml-2 ${
                            kpi.checked.change > 0 ? 'text-green-600' : kpi.checked.change < 0 ? 'text-red-600' : 'text-gray-500'
                          }`}
                        >
                          ({kpi.checked.change > 0 ? '+' : ''}
                          {kpi.checked.change})
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 변경 감지 영역 - 날짜별 표시 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>변경 감지</CardTitle>
                <CardDescription>날짜별 변경사항</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData?.diffsByDate && Object.keys(dashboardData.diffsByDate).length > 0 ? (
                  <div className="space-y-2">
                    {Object.keys(dashboardData.diffsByDate)
                      .sort((a, b) => b.localeCompare(a)) // 최신 날짜부터
                      .map((date) => {
                        const diffs = dashboardData.diffsByDate![date]
                        const isExpanded = expandedDates.has(date)
                        const isLatest = date === Object.keys(dashboardData.diffsByDate!).sort((a, b) => b.localeCompare(a))[0]

                        return (
                          <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedDates)
                                if (isExpanded) {
                                  newExpanded.delete(date)
                                } else {
                                  newExpanded.add(date)
                                }
                                setExpandedDates(newExpanded)
                              }}
                              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-600" />
                                )}
                                <span className="font-medium text-gray-900">{date}</span>
                                {isLatest && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">최신</span>}
                              </div>
                              <span className="text-sm text-gray-600">{diffs.length}개의 변경사항</span>
                            </button>
                            {isExpanded && (
                              <div className="p-4 bg-white space-y-3">
                                {diffs.map((diff, idx) => (
                                  <div key={idx} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="font-medium text-sm mb-2">
                                      {diff.keyword} - {diff.url}
                                    </div>


                                    <div className="space-y-1 text-sm">
                                      {diff.diffs.map((d, i) => (
                                        <div key={i} className="text-gray-700">
                                          <span className="font-medium">{formatFieldName(d.field)}:</span>{' '}
                                          <span className="text-red-600">{formatValue(d.oldValue)}</span> {' → '}
                                          <span className="text-green-600">{formatValue(d.newValue)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                ) : (dashboardData?.diffs?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 bg-green-50 rounded-lg border-2 border-green-200">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-xl font-semibold text-green-700">변경 없음</p>
                  </div>
                ) : (
                  // 하위 호환성: diffsByDate가 없으면 기존 방식으로 표시
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 mb-3">{dashboardData.diffs.length}개의 변경사항이 발견되었습니다.</p>

                    {dashboardData.diffs.slice(0, 10).map((diff, idx) => (
                      <div key={idx} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="font-medium text-sm mb-2">
                          {diff.keyword} - {diff.url}
                        </div>


                        <div className="space-y-1 text-sm">
                          {diff.diffs.map((d, i) => (
                            <div key={i} className="text-gray-700">
                              <span className="font-medium">{formatFieldName(d.field)}:</span>{' '}
                              <span className="text-red-600">{formatValue(d.oldValue)}</span> {' → '}
                              <span className="text-green-600">{formatValue(d.newValue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {dashboardData.diffs.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">... 외 {dashboardData.diffs.length - 10}개 더</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 테이블 */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>모니터링 테이블</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleExcelDownload}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={!dashboardData || sortedTableData.length === 0}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      엑셀 다운로드
                    </Button>
                    <Button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0]
                      setMonitoringModalDate(today)

                      const initialData: Record<string, { 통검노출: string; pdf노출: string; 완료: boolean }> = {}
                      dashboardData.tableData.forEach((row) => {
                        // 가장 최근 Run의 결과 찾기
                        const sortedRuns = [...(dashboardData.allRuns || [])].sort((a, b) => b.runDate.localeCompare(a.runDate))
                        let latest통검노출 = row.csv통검노출 || 'N'
                        let latestPdf노출 = row.csvPdf노출 || 'N'
                        
                        for (const run of sortedRuns) {
                          const result = run.results.find((r) => r.targetId === row.id)
                          if (result) {
                            latest통검노출 = result.foundAcademicNaver ? 'Y' : 'N'
                            latestPdf노출 = result.isPdf ? 'Y' : 'N'
                            break
                          }
                        }
                        
                        initialData[row.id] = {
                          통검노출: latest통검노출,
                          pdf노출: latestPdf노출,
                          완료: false,
                        }
                      })
                      setMonitoringData(initialData)
                      setIsMonitoringModalOpen(true)
                    }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      모니터링하기
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4 items-center mt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mr-2">필터:</label>
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="w-40 px-2 py-1 text-sm border rounded"
                    >
                      <option value="all">전체</option>
                      <option value="exposed">노출만</option>
                      <option value="notExposed">미노출만</option>
                      <option value="pdf">PDF만</option>
                      <option value="error">에러만</option>
                      <option value="changed">변경만</option>
                    </select>
                  </div>
                  <div className="text-sm text-gray-600">컬럼 헤더를 클릭하여 정렬 | 컬럼 경계를 드래그하여 너비 조정</div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th
                          rowSpan={2}
                          className="text-left p-2 text-sm font-medium cursor-pointer hover:bg-gray-100 select-none relative border-r"
                          onClick={() => handleSort('id')}
                        >
                          <div className="flex items-center">
                            _id
                            {getSortIcon('id')}
                          </div>
                        </th>
                        <th
                          rowSpan={2}
                          className="text-left p-2 text-sm font-medium cursor-pointer hover:bg-gray-100 select-none relative border-r"
                          onClick={() => handleSort('keyword')}
                        >
                          <div className="flex items-center">
                            title
                            {getSortIcon('keyword')}
                          </div>
                        </th>
                        <th
                          rowSpan={2}
                          className="text-left p-2 text-sm font-medium cursor-pointer hover:bg-gray-100 select-none relative border-r"
                          onClick={() => handleSort('url')}
                        >
                          <div className="flex items-center">
                            url
                            {getSortIcon('url')}
                          </div>
                        </th>

                        <th colSpan={3} className="text-center p-2 text-sm font-medium border-r bg-blue-50">
                          정답셋
                        </th>

                        <th colSpan={dashboardData?.allRuns?.length ?? 0} className="text-center p-2 text-sm font-medium bg-green-50">
                          모니터링
                        </th>
                      </tr>

                      <tr className="border-b">
                        <th
                          className="text-left p-2 text-sm font-medium cursor-pointer hover:bg-gray-100 select-none relative border-r"
                          onClick={() => handleSort('csv통검노출')}
                        >
                          <div className="flex items-center">
                            통검 노출
                            {getSortIcon('csv통검노출')}
                          </div>
                        </th>
                        <th
                          className="text-left p-2 text-sm font-medium cursor-pointer hover:bg-gray-100 select-none relative border-r"
                          onClick={() => handleSort('csvPdf노출')}
                        >
                          <div className="flex items-center">
                            PDF 노출
                            {getSortIcon('csvPdf노출')}
                          </div>
                        </th>
                        <th
                          className="text-left p-2 text-sm font-medium cursor-pointer hover:bg-gray-100 select-none relative border-r"
                          onClick={() => handleSort('note')}
                        >
                          <div className="flex items-center">
                            비고
                            {getSortIcon('note')}
                          </div>
                        </th>

                        {(dashboardData?.allRuns ?? []).map((run) => (
                          <th key={run.runDate} className="text-left p-2 text-sm font-medium bg-green-50 border-r">
                            <div className="flex flex-col gap-1">
                              <div>{run.runDate}</div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-6"
                                onClick={() => {
                                  setMonitoringModalDate(run.runDate)

                                  if (typeof window !== 'undefined') {
                                    const saved = localStorage.getItem(`monitoring_${run.runDate}`)
                                    if (saved) {
                                      try {
                                        const parsed = JSON.parse(saved)
                                        setMonitoringData(parsed)
                                        setIsMonitoringModalOpen(true)
                                        return
                                      } catch (e) {
                                        console.error('Failed to parse saved monitoring data', e)
                                      }
                                    }
                                  }

                                  const initialData: Record<string, { 통검노출: string; pdf노출: string; 완료: boolean }> = {}
                                  dashboardData.tableData.forEach((row) => {
                                    // 해당 Run의 결과를 먼저 확인
                                    const runResult = run.results.find((r) => r.targetId === row.id)
                                    
                                    // 해당 Run에 결과가 없으면 가장 최근 Run의 결과 찾기
                                    let latest통검노출 = runResult?.foundAcademicNaver ? 'Y' : (row.csv통검노출 || 'N')
                                    let latestPdf노출 = runResult?.isPdf ? 'Y' : (row.csvPdf노출 || 'N')
                                    
                                    if (!runResult) {
                                      const sortedRuns = [...(dashboardData.allRuns || [])].sort((a, b) => b.runDate.localeCompare(a.runDate))
                                      for (const otherRun of sortedRuns) {
                                        const otherResult = otherRun.results.find((r) => r.targetId === row.id)
                                        if (otherResult) {
                                          latest통검노출 = otherResult.foundAcademicNaver ? 'Y' : 'N'
                                          latestPdf노출 = otherResult.isPdf ? 'Y' : 'N'
                                          break
                                        }
                                      }
                                    }
                                    
                                    initialData[row.id] = {
                                      통검노출: latest통검노출,
                                      pdf노출: latestPdf노출,
                                      완료: false,
                                    }
                                  })
                                  setMonitoringData(initialData)
                                  setIsMonitoringModalOpen(true)
                                }}
                              >
                                수정
                              </Button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {sortedTableData.map((row) => {
                        const runResultsMap = new Map<string, any>()
                        ;(dashboardData?.allRuns ?? []).forEach((run) => {
                          const result = run.results.find((r) => r.targetId === row.id)
                          if (result) runResultsMap.set(run.runDate, result)
                        })

                        // 변경사항이 있는지 확인 (어떤 Run에서든 정답셋과 다른 경우)
                        let hasChange = false
                        for (const run of dashboardData?.allRuns ?? []) {
                          const result = runResultsMap.get(run.runDate)
                          if (result) {
                            const 모니터링통검노출 = result.foundAcademicNaver ?? false
                            const 모니터링Pdf노출 = result.isPdf ?? false
                            
                            const 통검일치 =
                              (row.csv통검노출 === 'Y' && 모니터링통검노출) ||
                              (row.csv통검노출 === 'N' && !모니터링통검노출) ||
                              row.csv통검노출 === null
                            const Pdf일치 =
                              (row.csvPdf노출 === 'Y' && 모니터링Pdf노출) || (row.csvPdf노출 === 'N' && !모니터링Pdf노출)
                            
                            if (!통검일치 || !Pdf일치) {
                              hasChange = true
                              break
                            }
                          }
                        }

                        return (
                          <tr key={row.id} className={`border-b ${hasChange ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}`}>
                            <td className="p-2 text-sm overflow-hidden text-ellipsis border-r">{row.id.slice(0, 12)}</td>
                            <td className="p-2 text-sm overflow-hidden text-ellipsis border-r">{row.keyword}</td>
                            <td className="p-2 text-sm overflow-hidden text-ellipsis border-r">
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate block"
                                title={row.url}
                              >
                                {row.url}
                              </a>
                            </td>

                            <td className="p-2 text-sm border-r text-center">
                              {row.csv통검노출 === 'Y' ? (
                                <span className="text-green-600 font-bold">Y</span>
                              ) : row.csv통검노출 === 'N' ? (
                                <span className="text-red-600 font-bold">N</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>

                            <td className="p-2 text-sm border-r text-center">
                              {row.csvPdf노출 === 'Y' ? <span className="text-green-600 font-bold">Y</span> : <span className="text-red-600 font-bold">N</span>}
                            </td>

                            <td className="p-2 text-sm border-r overflow-hidden text-ellipsis" title="">
                              -
                            </td>

                            {(dashboardData?.allRuns ?? []).map((run) => {
                              const result = runResultsMap.get(run.runDate)
                              const 모니터링통검노출 = result?.foundAcademicNaver ?? false
                              const 모니터링Pdf노출 = result?.isPdf ?? false

                              const 통검일치 =
                                (row.csv통검노출 === 'Y' && 모니터링통검노출) ||
                                (row.csv통검노출 === 'N' && !모니터링통검노출) ||
                                row.csv통검노출 === null
                              const Pdf일치 =
                                (row.csvPdf노출 === 'Y' && 모니터링Pdf노출) || (row.csvPdf노출 === 'N' && !모니터링Pdf노출)
                              const 모두일치 = 통검일치 && Pdf일치

                              return (
                                <td key={run.runDate} className="p-2 text-sm text-center border-r">
                                  {result ? (
                                    <div
                                      className={`flex gap-1 items-center justify-center ${
                                        모두일치 ? 'text-green-600' : 'text-yellow-600'
                                      }`}
                                    >
                                      <span className="font-bold">{모니터링통검노출 ? 'Y' : 'N'}</span>
                                      <span>/</span>
                                      <span className="font-bold">{모니터링Pdf노출 ? 'Y' : 'N'}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {sortedTableData.length === 0 && <div className="text-center py-8 text-gray-500">데이터가 없습니다.</div>}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 모니터링 모달 */}
      {isMonitoringModalOpen && dashboardData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold">모니터링 입력</h2>
                <input
                  type="date"
                  value={monitoringModalDate}
                  onChange={(e) => {
                    const newDate = e.target.value
                    setMonitoringModalDate(newDate)

                    if (typeof window !== 'undefined') {
                      const saved = localStorage.getItem(`monitoring_${newDate}`)
                      if (saved) {
                        try {
                          const parsed = JSON.parse(saved)
                          setMonitoringData(parsed)
                          return
                        } catch (e) {
                          console.error('Failed to parse saved monitoring data', e)
                        }
                      }
                    }

                    const initialData: Record<string, { 통검노출: string; pdf노출: string; 완료: boolean }> = {}
                    dashboardData.tableData.forEach((row) => {
                      // 가장 최근 Run의 결과 찾기
                      const sortedRuns = [...(dashboardData.allRuns || [])].sort((a, b) => b.runDate.localeCompare(a.runDate))
                      let latest통검노출 = row.csv통검노출 || 'N'
                      let latestPdf노출 = row.csvPdf노출 || 'N'
                      
                      for (const run of sortedRuns) {
                        const result = run.results.find((r) => r.targetId === row.id)
                        if (result) {
                          latest통검노출 = result.foundAcademicNaver ? 'Y' : 'N'
                          latestPdf노출 = result.isPdf ? 'Y' : 'N'
                          break
                        }
                      }
                      
                      initialData[row.id] = {
                        통검노출: latest통검노출,
                        pdf노출: latestPdf노출,
                        완료: false,
                      }
                    })
                    setMonitoringData(initialData)
                  }}
                  className="px-3 py-2 border rounded"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    setLoading(true)
                    try {
                      console.log(`[Frontend] Saving monitoring data for date: ${monitoringModalDate}, entries: ${Object.keys(monitoringData).length}`)
                      
                      const promises = Object.entries(monitoringData).map(async ([targetId, data]) => {
                        try {
                          console.log(`[Frontend] Saving target ${targetId}: 통검=${data.통검노출}, PDF=${data.pdf노출}`)
                          
                          const response = await fetch('/api/monitoring', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              runDate: monitoringModalDate,
                              targetId,
                              foundAcademicNaver: data.통검노출 === 'Y',
                              isPdf: data.pdf노출 === 'Y',
                            }),
                          })

                          if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}))
                            console.error(`[Frontend] API error for ${targetId}:`, response.status, errorData)
                            throw new Error(`Failed to save ${targetId}: ${errorData.message || response.statusText}`)
                          }

                          const result = await response.json()
                          console.log(`[Frontend] Successfully saved ${targetId}:`, result)
                          return result
                        } catch (error) {
                          console.error(`[Frontend] Error saving target ${targetId}:`, error)
                          throw error
                        }
                      })

                      const results = await Promise.allSettled(promises)
                      const failed = results.filter(r => r.status === 'rejected')
                      
                      if (failed.length > 0) {
                        console.error(`[Frontend] ${failed.length} targets failed to save:`, failed)
                        alert(`저장 중 오류가 발생했습니다. ${failed.length}개 항목 저장 실패. 콘솔을 확인하세요.`)
                      } else {
                        console.log(`[Frontend] All ${results.length} targets saved successfully`)
                      }

                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(`monitoring_${monitoringModalDate}`)
                      }

                      setIsMonitoringModalOpen(false)
                      setSelectedRunDate(monitoringModalDate)
                      await loadDashboardData()
                    } catch (error) {
                      console.error('[Frontend] Error saving monitoring data:', error)
                      alert(`저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  저장
                </Button>

                <Button
                  onClick={() => {
                    const hasUnsavedChanges = Object.keys(monitoringData).length > 0
                    if (hasUnsavedChanges) {
                      const confirmed = confirm(
                        '저장하지 않은 변경사항이 있습니다. 정말 닫으시겠습니까? (작업 내용은 자동 저장되어 있습니다)'
                      )
                      if (!confirmed) return
                    }
                    setIsMonitoringModalOpen(false)
                  }}
                  variant="outline"
                >
                  닫기
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4 text-sm text-gray-600">
                완료된 항목: {Object.values(monitoringData).filter((d) => d.완료).length} / {dashboardData.tableData.length}
              </div>

              <table className="w-full border-collapse table-fixed">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border p-2 text-left relative" style={{ width: monitoringColumnWidths.keyword }}>
                      키워드
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setMonitoringResizingColumn('keyword')
                          const startX = e.clientX
                          const startWidth = monitoringColumnWidths.keyword
                          const handleMouseMove = (e: MouseEvent) => {
                            const diff = e.clientX - startX
                            const newWidth = Math.max(50, startWidth + diff)
                            setMonitoringColumnWidths((prev) => ({ ...prev, keyword: newWidth }))
                          }
                          const handleMouseUp = () => {
                            setMonitoringResizingColumn(null)
                            document.removeEventListener('mousemove', handleMouseMove)
                            document.removeEventListener('mouseup', handleMouseUp)
                          }
                          document.addEventListener('mousemove', handleMouseMove)
                          document.addEventListener('mouseup', handleMouseUp)
                        }}
                      />
                    </th>

                    <th className="border p-2 text-left relative" style={{ width: monitoringColumnWidths.url }}>
                      URL
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setMonitoringResizingColumn('url')
                          const startX = e.clientX
                          const startWidth = monitoringColumnWidths.url
                          const handleMouseMove = (e: MouseEvent) => {
                            const diff = e.clientX - startX
                            const newWidth = Math.max(50, startWidth + diff)
                            setMonitoringColumnWidths((prev) => ({ ...prev, url: newWidth }))
                          }
                          const handleMouseUp = () => {
                            setMonitoringResizingColumn(null)
                            document.removeEventListener('mousemove', handleMouseMove)
                            document.removeEventListener('mouseup', handleMouseUp)
                          }
                          document.addEventListener('mousemove', handleMouseMove)
                          document.addEventListener('mouseup', handleMouseUp)
                        }}
                      />
                    </th>

                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.csv통검노출 }}>
                      정답셋 통검
                    </th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.csvPdf노출 }}>
                      정답셋 PDF
                    </th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.csv비고 }}>
                      정답셋 비고
                    </th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoring통검노출 }}>
                      모니터링 통검
                    </th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoringPdf노출 }}>
                      모니터링 PDF
                    </th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoring비고 }}>
                      완료
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(() => {
                    // 디버깅: myComment가 있는 row 확인
                    const rowWithComment = dashboardData?.tableData?.find(row => row.myComment)
                    if (rowWithComment) {
                      console.log('[Dashboard UI] Sample row with myComment:', {
                        id: rowWithComment.id,
                        keyword: rowWithComment.keyword,
                        myComment: rowWithComment.myComment,
                        myCommentType: typeof rowWithComment.myComment,
                        hasMyComment: !!rowWithComment.myComment,
                      })
                    }
                    return null
                  })()}
                  {[...dashboardData.tableData]
                    .sort((a, b) => {
                      // 정답셋 통검노출 Y가 먼저
                      const a통검 = a.csv통검노출 === 'Y' ? 0 : a.csv통검노출 === 'N' ? 1 : 2
                      const b통검 = b.csv통검노출 === 'Y' ? 0 : b.csv통검노출 === 'N' ? 1 : 2
                      if (a통검 !== b통검) return a통검 - b통검
                      
                      // 정답셋 PDF노출 Y가 먼저
                      const aPdf = a.csvPdf노출 === 'Y' ? 0 : 1
                      const bPdf = b.csvPdf노출 === 'Y' ? 0 : 1
                      if (aPdf !== bPdf) return aPdf - bPdf
                      
                      return 0
                    })
                    .map((row) => {
                      // 가장 최근 Run의 결과 찾기
                      const sortedRuns = [...(dashboardData.allRuns || [])].sort((a, b) => b.runDate.localeCompare(a.runDate))
                      let latest통검노출 = row.csv통검노출 || 'N'
                      let latestPdf노출 = row.csvPdf노출 || 'N'
                      
                      for (const run of sortedRuns) {
                        const result = run.results.find((r) => r.targetId === row.id)
                        if (result) {
                          latest통검노출 = result.foundAcademicNaver ? 'Y' : 'N'
                          latestPdf노출 = result.isPdf ? 'Y' : 'N'
                          break
                        }
                      }
                      
                      const data =
                        monitoringData[row.id] || {
                          통검노출: latest통검노출,
                          pdf노출: latestPdf노출,
                          완료: false,
                        }

                      const 통검변동 = row.csv통검노출 !== null && data.통검노출 !== row.csv통검노출
                      const Pdf변동 = data.pdf노출 !== row.csvPdf노출
                      const hasChange = 통검변동 || Pdf변동

                    return (
                      <tr
                        key={row.id}
                        className={`${hasChange ? 'bg-yellow-50' : ''} ${data.완료 ? 'opacity-60' : ''}`}
                      >
                        <td
                          className="border p-2 overflow-hidden text-ellipsis whitespace-nowrap"
                          style={{ width: monitoringColumnWidths.keyword }}
                          title={row.keyword}
                        >
                          {row.keyword.length > 20 ? `${row.keyword.substring(0, 20)}...` : row.keyword}
                        </td>

                        <td className="border p-2 overflow-hidden text-ellipsis" style={{ width: monitoringColumnWidths.url }}>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate block"
                            title={row.url}
                          >
                            {row.url}
                          </a>
                        </td>

                        <td className="border p-2 text-center" style={{ width: monitoringColumnWidths.csv통검노출 }}>
                          {row.csv통검노출 === 'Y' ? (
                            <span className="text-green-600 font-bold">Y</span>
                          ) : row.csv통검노출 === 'N' ? (
                            <span className="text-red-600 font-bold">N</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        <td className="border p-2 text-center" style={{ width: monitoringColumnWidths.csvPdf노출 }}>
                          {row.csvPdf노출 === 'Y' ? (
                            <span className="text-green-600 font-bold">Y</span>
                          ) : (
                            <span className="text-red-600 font-bold">N</span>
                          )}
                        </td>

                        <td
                          className="border p-2 overflow-hidden text-ellipsis"
                          style={{ width: monitoringColumnWidths.csv비고 }}
                          title={row.myComment || ''}
                        >
                          {row.myComment && row.myComment.trim() !== '' ? row.myComment : '-'}
                        </td>

                        <td className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoring통검노출 }}>
                          <select
                            value={data.통검노출}
                            onChange={(e) => {
                              setMonitoringData({
                                ...monitoringData,
                                [row.id]: { ...data, 통검노출: e.target.value },
                              })
                            }}
                            className={`w-16 px-2 py-1 text-sm border rounded ${통검변동 ? 'bg-yellow-100' : ''}`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </td>

                        <td className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoringPdf노출 }}>
                          <select
                            value={data.pdf노출}
                            onChange={(e) => {
                              setMonitoringData({
                                ...monitoringData,
                                [row.id]: { ...data, pdf노출: e.target.value },
                              })
                            }}
                            className={`w-16 px-2 py-1 text-sm border rounded ${Pdf변동 ? 'bg-yellow-100' : ''}`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </td>

                        <td className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoring비고 }}>
                          <Button
                            size="sm"
                            variant={data.완료 ? 'default' : 'outline'}
                            onClick={() => {
                              setMonitoringData({
                                ...monitoringData,
                                [row.id]: { ...data, 완료: !data.완료 },
                              })
                            }}
                            className={data.완료 ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                          >
                            {data.완료 ? '✓ 완료' : '완료'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
