'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { RefreshCw, CheckCircle2, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

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
    myComment?: string | null
    diffs: Array<{
      field: string
      oldValue: any
      newValue: any
    }>
  }>
  tableData: Array<{
    id: string
    keyword: string
    url: string
    currentStatus: string | null
    myComment: string | null
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
  const [monitoringData, setMonitoringData] = useState<Record<string, { 통검노출: string; pdf노출: string; 비고: string; 완료: boolean }>>({})

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
  const [sortBy, setSortBy] = useState<string>('checkedAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    id: 120,
    keyword: 250,
    url: 350,
    csv통검노출: 100,
    csvPdf노출: 100,
    myComment: 150,
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
      if (!res.ok) {
        throw new Error(`Failed to fetch runs: ${res.status}`)
      }
      const data = await res.json()
      setRuns(data)
      // 최신 Run을 자동으로 선택 (없으면 오늘 날짜 사용)
      if (data.length > 0) {
        setSelectedRunDate(data[0].runDate)
      } else {
        // Run이 없어도 대시보드 데이터는 로드해야 함
        setSelectedRunDate(new Date().toISOString().split('T')[0])
      }
    } catch (error) {
      console.error('Error loading runs:', error)
      // 에러가 발생해도 대시보드 데이터는 로드해야 함
      setSelectedRunDate(new Date().toISOString().split('T')[0])
    }
  }

  const loadDashboardData = async () => {
    // Run이 없어도 정답셋 데이터는 표시해야 함
    const runDateToUse = selectedRunDate || new Date().toISOString().split('T')[0]
    setLoading(true)
    try {
      const params = new URLSearchParams({ runDate: runDateToUse })
      const res = await fetch(`/api/dashboard?${params}`)
      const data = await res.json()
      setDashboardData(data)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
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
      if (res.ok) {
        await loadDashboardData()
      }
    } catch (error) {
      console.error('Error checking target:', error)
    }
  }

  // 필터링된 테이블 데이터
  const filteredTableData = dashboardData?.tableData.filter((row) => {
    if (filter === 'all') return true
    if (filter === 'exposed') return row.foundAcademicNaver
    if (filter === 'notExposed') return !row.foundAcademicNaver
    if (filter === 'pdf') return row.isPdf
    if (filter === 'error') return row.errorMessage || (row.httpStatus && row.httpStatus >= 400)
    if (filter === 'changed') {
      return dashboardData.diffs.some((d) => d.targetId === row.id)
    }
    return true
  }) || []

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // 같은 컬럼이면 방향 토글
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // 다른 컬럼이면 새로 정렬
      setSortBy(column)
      setSortDirection('asc')
    }
  }

  // 정렬 아이콘 표시
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-30" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 inline" />
    )
  }

  // 컬럼 리사이즈 핸들러
  const handleMouseDown = (column: string, e: React.MouseEvent) => {
    e.preventDefault()
    setResizingColumn(column)
    const startX = e.clientX
    const startWidth = columnWidths[column] || 150

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX
      const newWidth = Math.max(50, startWidth + diff) // 최소 50px
      setColumnWidths((prev) => ({
        ...prev,
        [column]: newWidth,
      }))
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
    let comparison = 0

    if (sortBy === 'id') {
      comparison = a.id.localeCompare(b.id)
    } else if (sortBy === 'keyword') {
      comparison = (a.keyword || '').localeCompare(b.keyword || '')
    } else if (sortBy === 'url') {
      comparison = (a.url || '').localeCompare(b.url || '')
    } else if (sortBy === 'csv통검노출') {
      comparison = (a.csv통검노출 || '').localeCompare(b.csv통검노출 || '')
    } else if (sortBy === 'csvPdf노출') {
      comparison = (a.csvPdf노출 || '').localeCompare(b.csvPdf노출 || '')
    } else if (sortBy === 'foundAcademicNaver') {
      comparison = (a.foundAcademicNaver ? 1 : 0) - (b.foundAcademicNaver ? 1 : 0)
    } else if (sortBy === 'isPdf') {
      comparison = (a.isPdf ? 1 : 0) - (b.isPdf ? 1 : 0)
    } else if (sortBy === 'myComment') {
      comparison = (a.myComment || '').localeCompare(b.myComment || '')
    } else if (sortBy === 'httpStatus') {
      const aStatus = a.httpStatus ?? 0
      const bStatus = b.httpStatus ?? 0
      comparison = aStatus - bStatus
    } else if (sortBy === 'finalUrl') {
      comparison = (a.finalUrl || '').localeCompare(b.finalUrl || '')
    } else if (sortBy === 'checkedAt') {
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            URL 모니터링 대시보드
          </h1>
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
                  <div className="text-3xl font-bold">
                    {dashboardData.kpi.totalTargets}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">통합 노출</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {dashboardData.kpi.foundAcademicNaver.count}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {dashboardData.kpi.foundAcademicNaver.percentage}%
                  </div>
                  {/* 정답셋 대비 변경량 표시 */}
                  {dashboardData.kpi.foundAcademicNaver.csvCount !== undefined &&
                    dashboardData.kpi.foundAcademicNaver.csvChange !== undefined &&
                    dashboardData.kpi.foundAcademicNaver.csvChange !== 0 && (
                      <div className="text-xs text-gray-400 mt-2">
                        정답셋: {dashboardData.kpi.foundAcademicNaver.csvCount}
                        <span
                          className={`ml-2 ${
                            dashboardData.kpi.foundAcademicNaver.csvChange > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          ({dashboardData.kpi.foundAcademicNaver.csvChange > 0 ? '+' : ''}
                          {dashboardData.kpi.foundAcademicNaver.csvChange})
                        </span>
                      </div>
                    )}
                  {/* 이전 Run 대비 변경량 표시 */}
                  {dashboardData.kpi.foundAcademicNaver.previousCount !== null &&
                    dashboardData.kpi.foundAcademicNaver.previousCount !== undefined &&
                    dashboardData.kpi.foundAcademicNaver.change !== null &&
                    dashboardData.kpi.foundAcademicNaver.change !== undefined &&
                    dashboardData.kpi.foundAcademicNaver.change !== 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        이전 Run: {dashboardData.kpi.foundAcademicNaver.previousCount}
                        <span
                          className={`ml-2 ${
                            dashboardData.kpi.foundAcademicNaver.change > 0
                              ? 'text-green-600'
                              : dashboardData.kpi.foundAcademicNaver.change < 0
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}
                        >
                          ({dashboardData.kpi.foundAcademicNaver.change > 0 ? '+' : ''}
                          {dashboardData.kpi.foundAcademicNaver.change})
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
                  <div className="text-3xl font-bold">
                    {dashboardData.kpi.isPdf.count}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {dashboardData.kpi.isPdf.percentage}%
                  </div>
                  {/* 정답셋 대비 변경량 표시 */}
                  {dashboardData.kpi.isPdf.csvCount !== undefined &&
                    dashboardData.kpi.isPdf.csvChange !== undefined &&
                    dashboardData.kpi.isPdf.csvChange !== 0 && (
                      <div className="text-xs text-gray-400 mt-2">
                        정답셋: {dashboardData.kpi.isPdf.csvCount}
                        <span
                          className={`ml-2 ${
                            dashboardData.kpi.isPdf.csvChange > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          ({dashboardData.kpi.isPdf.csvChange > 0 ? '+' : ''}
                          {dashboardData.kpi.isPdf.csvChange})
                        </span>
                      </div>
                    )}
                  {/* 이전 Run 대비 변경량 표시 */}
                  {dashboardData.kpi.isPdf.previousCount !== null &&
                    dashboardData.kpi.isPdf.previousCount !== undefined &&
                    dashboardData.kpi.isPdf.change !== null &&
                    dashboardData.kpi.isPdf.change !== undefined &&
                    dashboardData.kpi.isPdf.change !== 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        이전 Run: {dashboardData.kpi.isPdf.previousCount}
                        <span
                          className={`ml-2 ${
                            dashboardData.kpi.isPdf.change > 0
                              ? 'text-green-600'
                              : dashboardData.kpi.isPdf.change < 0
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}
                        >
                          ({dashboardData.kpi.isPdf.change > 0 ? '+' : ''}
                          {dashboardData.kpi.isPdf.change})
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
                    {dashboardData.kpi.checked.count} / {dashboardData.kpi.checked.total}
                  </div>
                  {dashboardData.kpi.checked.previousCount !== null &&
                    dashboardData.kpi.checked.previousCount !== undefined && (
                      <div className="text-xs text-gray-400 mt-2">
                        이전: {dashboardData.kpi.checked.previousCount} /{' '}
                        {dashboardData.kpi.checked.total}
                        {dashboardData.kpi.checked.change !== null &&
                          dashboardData.kpi.checked.change !== undefined && (
                            <span
                              className={`ml-2 ${
                                dashboardData.kpi.checked.change > 0
                                  ? 'text-green-600'
                                  : dashboardData.kpi.checked.change < 0
                                  ? 'text-red-600'
                                  : 'text-gray-500'
                              }`}
                            >
                              ({dashboardData.kpi.checked.change > 0 ? '+' : ''}
                              {dashboardData.kpi.checked.change})
                            </span>
                          )}
                      </div>
                    )}
                </CardContent>
              </Card>
            </div>

            {/* 변경 없음 영역 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>변경 감지</CardTitle>
                <CardDescription>
                  최초 Run과 비교
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData.diffs.length === 0 ? (
                  <div className="text-center py-12 bg-green-50 rounded-lg border-2 border-green-200">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-xl font-semibold text-green-700">변경 없음</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 mb-3">
                      {dashboardData.diffs.length}개의 변경사항이 발견되었습니다.
                    </p>
                    {dashboardData.diffs.slice(0, 10).map((diff, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                      >
                        <div className="font-medium text-sm mb-2">
                          {diff.keyword} - {diff.url}
                        </div>
                        {diff.myComment && (
                          <div className="text-xs text-gray-600 mb-2 italic">
                            비고: {diff.myComment}
                          </div>
                        )}
                        <div className="space-y-1 text-sm">
                          {diff.diffs.map((d, i) => (
                            <div key={i} className="text-gray-700">
                              <span className="font-medium">{formatFieldName(d.field)}:</span>{' '}
                              <span className="text-red-600">{formatValue(d.oldValue)}</span>
                              {' → '}
                              <span className="text-green-600">{formatValue(d.newValue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {dashboardData.diffs.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... 외 {dashboardData.diffs.length - 10}개 더
                      </p>
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
                  <Button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0]
                      setMonitoringModalDate(today)
                      // 기존 모니터링 데이터 초기화 (정답셋 값을 기본값으로)
                      const initialData: Record<string, { 통검노출: string; pdf노출: string; 비고: string; 완료: boolean }> = {}
                      dashboardData.tableData.forEach((row) => {
                        initialData[row.id] = {
                          통검노출: row.csv통검노출 || 'N', // 정답셋 값을 기본값으로
                          pdf노출: row.csvPdf노출 || 'N', // 정답셋 값을 기본값으로
                          비고: row.myComment || '', // 기존 비고
                          완료: false, // 완료 상태 초기화
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
                  <div className="text-sm text-gray-600">
                    컬럼 헤더를 클릭하여 정렬 | 컬럼 경계를 드래그하여 너비 조정
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      {/* 첫 번째 헤더 행: 병합 헤더 */}
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
                        <th colSpan={dashboardData?.allRuns.length || 0} className="text-center p-2 text-sm font-medium bg-green-50">
                          모니터링
                        </th>
                      </tr>
                      {/* 두 번째 헤더 행: 실제 컬럼명 */}
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
                          onClick={() => handleSort('myComment')}
                        >
                          <div className="flex items-center">
                            비고
                            {getSortIcon('myComment')}
                          </div>
                        </th>
                        {dashboardData?.allRuns.map((run) => (
                          <th key={run.runDate} className="text-left p-2 text-sm font-medium bg-green-50 border-r">
                            <div className="flex flex-col gap-1">
                              <div>{run.runDate}</div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-6"
                                onClick={() => {
                                  setMonitoringModalDate(run.runDate)
                                  // localStorage에서 저장된 데이터 확인
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
                                  // localStorage에 저장된 데이터가 없으면 정답셋 값을 기본값으로
                                  const initialData: Record<string, { 통검노출: string; pdf노출: string; 비고: string; 완료: boolean }> = {}
                                  dashboardData.tableData.forEach((row) => {
                                    const runResult = run.results.find((r) => r.targetId === row.id)
                                    initialData[row.id] = {
                                      통검노출: runResult?.foundAcademicNaver ? 'Y' : (row.csv통검노출 || 'N'),
                                      pdf노출: runResult?.isPdf ? 'Y' : (row.csvPdf노출 || 'N'),
                                      비고: row.myComment || '',
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
                        // 각 Run별 결과를 맵으로 생성
                        const runResultsMap = new Map<string, any>()
                        dashboardData?.allRuns.forEach((run) => {
                          const result = run.results.find((r) => r.targetId === row.id)
                          if (result) {
                            runResultsMap.set(run.runDate, result)
                          }
                        })

                        return (
                          <tr key={row.id} className="border-b hover:bg-gray-50">
                            {/* _id */}
                            <td className="p-2 text-sm overflow-hidden text-ellipsis border-r">
                              {row.id.slice(0, 12)}
                            </td>
                            {/* title */}
                            <td className="p-2 text-sm overflow-hidden text-ellipsis border-r">
                              {row.keyword}
                            </td>
                            {/* url */}
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
                            {/* 정답셋: 통검 노출 (읽기 전용) */}
                            <td className="p-2 text-sm border-r text-center">
                              {row.csv통검노출 === 'Y' ? (
                                <span className="text-green-600 font-bold">Y</span>
                              ) : row.csv통검노출 === 'N' ? (
                                <span className="text-red-600 font-bold">N</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {/* 정답셋: PDF 노출 (읽기 전용) */}
                            <td className="p-2 text-sm border-r text-center">
                              {row.csvPdf노출 === 'Y' ? (
                                <span className="text-green-600 font-bold">Y</span>
                              ) : (
                                <span className="text-red-600 font-bold">N</span>
                              )}
                            </td>
                            {/* 정답셋: 비고 (읽기 전용) */}
                            <td className="p-2 text-sm border-r overflow-hidden text-ellipsis" title={row.myComment || ''}>
                              {row.myComment || '-'}
                            </td>
                            {/* 모니터링: 각 날짜별 결과 */}
                            {dashboardData?.allRuns.map((run) => {
                              const result = runResultsMap.get(run.runDate)
                              const 모니터링통검노출 = result?.foundAcademicNaver ?? false
                              const 모니터링Pdf노출 = result?.isPdf ?? false
                              
                              // 정답셋과 비교
                              const 통검일치 = (row.csv통검노출 === 'Y' && 모니터링통검노출) || 
                                              (row.csv통검노출 === 'N' && !모니터링통검노출) ||
                                              (row.csv통검노출 === null)
                              const Pdf일치 = (row.csvPdf노출 === 'Y' && 모니터링Pdf노출) || 
                                             (row.csvPdf노출 === 'N' && !모니터링Pdf노출)
                              const 모두일치 = 통검일치 && Pdf일치

                              return (
                                <td key={run.runDate} className="p-2 text-sm text-center border-r">
                                  {result ? (
                                    <div className="flex flex-col gap-1">
                                      <div className={`flex gap-1 items-center justify-center ${모두일치 ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {모니터링통검노출 ? (
                                          <span className="font-bold">Y</span>
                                        ) : (
                                          <span className="font-bold">N</span>
                                        )}
                                        <span>/</span>
                                        {모니터링Pdf노출 ? (
                                          <span className="font-bold">Y</span>
                                        ) : (
                                          <span className="font-bold">N</span>
                                        )}
                                      </div>
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
                  {sortedTableData.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      데이터가 없습니다.
                    </div>
                  )}
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
                    // 날짜 변경 시 localStorage에서 저장된 데이터 확인
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
                    // localStorage에 저장된 데이터가 없으면 정답셋 값을 기본값으로
                    const initialData: Record<string, { 통검노출: string; pdf노출: string; 비고: string; 완료: boolean }> = {}
                    dashboardData.tableData.forEach((row) => {
                      initialData[row.id] = {
                        통검노출: row.csv통검노출 || 'N', // 정답셋 값을 기본값으로
                        pdf노출: row.csvPdf노출 || 'N', // 정답셋 값을 기본값으로
                        비고: row.myComment || '', // 기존 비고
                        완료: false, // 완료 상태 초기화
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
                      // 모든 변경사항 저장
                      const promises = Object.entries(monitoringData).map(([targetId, data]) => {
                        const promises = []
                        // 모니터링 결과 저장
                        promises.push(
                          fetch('/api/monitoring', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              runDate: monitoringModalDate,
                              targetId,
                              foundAcademicNaver: data.통검노출 === 'Y',
                              isPdf: data.pdf노출 === 'Y',
                            }),
                          })
                        )
                        // 비고 저장 (변경된 경우만)
                        const originalRow = dashboardData.tableData.find(r => r.id === targetId)
                        if (originalRow && originalRow.myComment !== data.비고) {
                          promises.push(
                            fetch(`/api/targets/${targetId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ myComment: data.비고 || null }),
                            })
                          )
                        }
                        return Promise.all(promises)
                      })
                      await Promise.all(promises)
                      // 저장 성공 후 localStorage에서 해당 날짜 데이터 삭제
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(`monitoring_${monitoringModalDate}`)
                      }
                      setIsMonitoringModalOpen(false)
                      // 저장한 날짜를 선택된 Run으로 설정하여 즉시 반영
                      setSelectedRunDate(monitoringModalDate)
                      await loadDashboardData()
                    } catch (error) {
                      console.error('Error saving monitoring data:', error)
                      alert('저장 중 오류가 발생했습니다.')
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
                    // 닫을 때 확인 메시지 표시 (저장하지 않은 경우)
                    const hasUnsavedChanges = Object.keys(monitoringData).length > 0
                    if (hasUnsavedChanges) {
                      const confirmed = confirm('저장하지 않은 변경사항이 있습니다. 정말 닫으시겠습니까? (작업 내용은 자동 저장되어 있습니다)')
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
                완료된 항목: {Object.values(monitoringData).filter(d => d.완료).length} / {dashboardData.tableData.length}
              </div>
              <table className="w-full border-collapse table-fixed">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border p-2 text-left relative" style={{ width: monitoringColumnWidths.keyword }}>
                      키워드
                      <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400" onMouseDown={(e) => {
                        e.preventDefault()
                        setMonitoringResizingColumn('keyword')
                        const startX = e.clientX
                        const startWidth = monitoringColumnWidths.keyword
                        const handleMouseMove = (e: MouseEvent) => {
                          const diff = e.clientX - startX
                          const newWidth = Math.max(50, startWidth + diff)
                          setMonitoringColumnWidths(prev => ({ ...prev, keyword: newWidth }))
                        }
                        const handleMouseUp = () => {
                          setMonitoringResizingColumn(null)
                          document.removeEventListener('mousemove', handleMouseMove)
                          document.removeEventListener('mouseup', handleMouseUp)
                        }
                        document.addEventListener('mousemove', handleMouseMove)
                        document.addEventListener('mouseup', handleMouseUp)
                      }} />
                    </th>
                    <th className="border p-2 text-left relative" style={{ width: monitoringColumnWidths.url }}>
                      URL
                      <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400" onMouseDown={(e) => {
                        e.preventDefault()
                        setMonitoringResizingColumn('url')
                        const startX = e.clientX
                        const startWidth = monitoringColumnWidths.url
                        const handleMouseMove = (e: MouseEvent) => {
                          const diff = e.clientX - startX
                          const newWidth = Math.max(50, startWidth + diff)
                          setMonitoringColumnWidths(prev => ({ ...prev, url: newWidth }))
                        }
                        const handleMouseUp = () => {
                          setMonitoringResizingColumn(null)
                          document.removeEventListener('mousemove', handleMouseMove)
                          document.removeEventListener('mouseup', handleMouseUp)
                        }
                        document.addEventListener('mousemove', handleMouseMove)
                        document.addEventListener('mouseup', handleMouseUp)
                      }} />
                    </th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.csv통검노출 }}>정답셋 통검</th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.csvPdf노출 }}>정답셋 PDF</th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.csv비고 }}>정답셋 비고</th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoring통검노출 }}>모니터링 통검</th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoringPdf노출 }}>모니터링 PDF</th>
                    <th className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoring비고 }}>
                      완료 / 모니터링 비고
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.tableData.map((row) => {
                    const data = monitoringData[row.id] || { 통검노출: row.csv통검노출 || 'N', pdf노출: row.csvPdf노출 || 'N', 비고: row.myComment || '', 완료: false }
                    // 정답셋 값과 모니터링 값 비교
                    const 통검변동 = row.csv통검노출 !== null && data.통검노출 !== row.csv통검노출
                    const Pdf변동 = data.pdf노출 !== row.csvPdf노출
                    const 모두일치 = !통검변동 && !Pdf변동

                    return (
                      <tr key={row.id} className={`${모두일치 ? 'bg-green-50' : 'bg-yellow-50'} ${data.완료 ? 'opacity-60' : ''}`}>
                        <td className="border p-2 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: monitoringColumnWidths.keyword }} title={row.keyword}>
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
                        <td className="border p-2 overflow-hidden text-ellipsis" style={{ width: monitoringColumnWidths.csv비고 }} title={row.myComment || ''}>
                          {row.myComment || '-'}
                        </td>
                        <td className="border p-2 text-center" style={{ width: monitoringColumnWidths.monitoring통검노출 }}>
                          <select
                            value={data.통검노출}
                            onChange={(e) => {
                              setMonitoringData({
                                ...monitoringData,
                                [row.id]: {
                                  ...data,
                                  통검노출: e.target.value,
                                },
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
                                [row.id]: {
                                  ...data,
                                  pdf노출: e.target.value,
                                },
                              })
                            }}
                            className={`w-16 px-2 py-1 text-sm border rounded ${Pdf변동 ? 'bg-yellow-100' : ''}`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </td>
                        <td className="border p-2" style={{ width: monitoringColumnWidths.monitoring비고 }}>
                          <div className="flex gap-2 items-center">
                            <Button
                              size="sm"
                              variant={data.완료 ? "default" : "outline"}
                              onClick={() => {
                                setMonitoringData({
                                  ...monitoringData,
                                  [row.id]: {
                                    ...data,
                                    완료: !data.완료,
                                  },
                                })
                              }}
                              className={data.완료 ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                            >
                              {data.완료 ? '✓ 완료' : '완료'}
                            </Button>
                            <input
                              type="text"
                              value={data.비고}
                              onChange={(e) => {
                                setMonitoringData({
                                  ...monitoringData,
                                  [row.id]: {
                                    ...data,
                                    비고: e.target.value,
                                  },
                                })
                              }}
                              className="flex-1 px-2 py-1 text-sm border rounded"
                              placeholder="비고 입력"
                            />
                          </div>
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

