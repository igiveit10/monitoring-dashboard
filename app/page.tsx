'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Select } from './components/ui/select'
import { RefreshCw, Upload, CheckCircle2, XCircle, FileText, AlertCircle } from 'lucide-react'

interface Run {
  id: string
  runDate: string
  createdAt: string
}

interface DashboardData {
  kpi: {
    totalTargets: number
    foundAcademicNaver: { count: number; percentage: number }
    isPdf: { count: number; percentage: number }
    checked: { count: number; total: number }
  }
  diffs: Array<{
    targetId: string
    keyword: string
    url: string
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
    foundAcademicNaver: boolean
    isPdf: boolean
    httpStatus: number | null
    finalUrl: string | null
    checkedAt: string
    errorMessage: string | null
  }>
  runDate: string
  baselineRunDate: string | null
}

export default function Dashboard() {
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRunDate, setSelectedRunDate] = useState<string>('')
  const [baselineRunDate, setBaselineRunDate] = useState<string>('')
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('checkedAt')

  // Runs 로드
  useEffect(() => {
    loadRuns()
  }, [])

  // 선택된 Run이 변경되면 대시보드 데이터 로드
  useEffect(() => {
    if (selectedRunDate) {
      loadDashboardData()
    }
  }, [selectedRunDate, baselineRunDate])

  const loadRuns = async () => {
    try {
      const res = await fetch('/api/runs')
      const data = await res.json()
      setRuns(data)
      if (data.length > 0 && !selectedRunDate) {
        setSelectedRunDate(data[0].runDate)
        if (data.length > 1) {
          setBaselineRunDate(data[data.length - 1].runDate) // 가장 오래된 것
        }
      }
    } catch (error) {
      console.error('Error loading runs:', error)
    }
  }

  const loadDashboardData = async () => {
    if (!selectedRunDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ runDate: selectedRunDate })
      if (baselineRunDate) {
        params.append('baselineRunDate', baselineRunDate)
      }
      const res = await fetch(`/api/dashboard?${params}`)
      const data = await res.json()
      setDashboardData(data)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTodayCheck = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/runs/today', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await loadRuns()
        setSelectedRunDate(data.runDate)
      }
    } catch (error) {
      console.error('Error running today check:', error)
      alert('재검사 실행 중 오류가 발생했습니다.')
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/targets/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        alert(`성공적으로 ${data.recordCount}개의 레코드를 업로드했습니다.`)
        await loadRuns()
        if (selectedRunDate) {
          await loadDashboardData()
        }
      } else {
        alert('업로드 실패: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      e.target.value = ''
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

  // 정렬
  const sortedTableData = [...filteredTableData].sort((a, b) => {
    if (sortBy === 'foundAcademicNaver') {
      return (b.foundAcademicNaver ? 1 : 0) - (a.foundAcademicNaver ? 1 : 0)
    }
    if (sortBy === 'isPdf') {
      return (b.isPdf ? 1 : 0) - (a.isPdf ? 1 : 0)
    }
    if (sortBy === 'checkedAt') {
      return new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
    }
    return 0
  })

  const formatFieldName = (field: string) => {
    const map: Record<string, string> = {
      foundAcademicNaver: '통합 노출',
      isPdf: 'PDF',
      httpStatus: 'HTTP 상태',
      finalUrl: '최종 URL',
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
          <div className="flex gap-4 items-center flex-wrap">
            <Button
              onClick={handleTodayCheck}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              오늘 전체 재검사
            </Button>
            <label className="flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span className="text-sm">CSV 업로드</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {uploading && <span className="text-sm text-gray-500">업로드 중...</span>}
          </div>
        </div>

        {/* Run 선택 */}
        <div className="mb-6 flex gap-4 items-center">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Run 선택:</label>
            <Select
              value={selectedRunDate}
              onChange={(e) => setSelectedRunDate(e.target.value)}
              className="w-48"
            >
              {runs.map((run) => (
                <option key={run.id} value={run.runDate}>
                  {run.runDate}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">베이스라인:</label>
            <Select
              value={baselineRunDate}
              onChange={(e) => setBaselineRunDate(e.target.value)}
              className="w-48"
            >
              <option value="">자동 (최초 Run)</option>
              {runs.map((run) => (
                <option key={run.id} value={run.runDate}>
                  {run.runDate}
                </option>
              ))}
            </Select>
          </div>
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
                </CardContent>
              </Card>
            </div>

            {/* 변경 없음 영역 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>변경 감지</CardTitle>
                <CardDescription>
                  베이스라인 ({dashboardData.baselineRunDate || '최초 Run'})과 비교
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
                <CardTitle>모니터링 테이블</CardTitle>
                <div className="flex gap-4 items-center mt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mr-2">필터:</label>
                    <Select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="w-40"
                    >
                      <option value="all">전체</option>
                      <option value="exposed">노출만</option>
                      <option value="notExposed">미노출만</option>
                      <option value="pdf">PDF만</option>
                      <option value="error">에러만</option>
                      <option value="changed">변경만</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mr-2">정렬:</label>
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-40"
                    >
                      <option value="checkedAt">마지막 체크시간</option>
                      <option value="foundAcademicNaver">통합노출</option>
                      <option value="isPdf">PDF노출</option>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 text-sm font-medium">ID</th>
                        <th className="text-left p-2 text-sm font-medium">키워드</th>
                        <th className="text-left p-2 text-sm font-medium">URL</th>
                        <th className="text-left p-2 text-sm font-medium">통합 노출</th>
                        <th className="text-left p-2 text-sm font-medium">PDF 노출</th>
                        <th className="text-left p-2 text-sm font-medium">비고</th>
                        <th className="text-left p-2 text-sm font-medium">HTTP 상태</th>
                        <th className="text-left p-2 text-sm font-medium">최종 URL</th>
                        <th className="text-left p-2 text-sm font-medium">체크시간</th>
                        <th className="text-left p-2 text-sm font-medium">체크</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTableData.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-sm">{row.id.slice(0, 8)}</td>
                          <td className="p-2 text-sm">{row.keyword}</td>
                          <td className="p-2 text-sm">
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate max-w-xs block"
                            >
                              {row.url}
                            </a>
                          </td>
                          <td className="p-2 text-sm">
                            {row.foundAcademicNaver ? (
                              <span className="text-green-600">Y</span>
                            ) : (
                              <span className="text-red-600">N</span>
                            )}
                          </td>
                          <td className="p-2 text-sm">
                            {row.isPdf ? (
                              <span className="text-green-600">Y</span>
                            ) : (
                              <span className="text-red-600">N</span>
                            )}
                          </td>
                          <td className="p-2 text-sm">{row.myComment || '-'}</td>
                          <td className="p-2 text-sm">
                            {row.errorMessage ? (
                              <span className="text-red-600" title={row.errorMessage}>
                                <AlertCircle className="w-4 h-4 inline" />
                              </span>
                            ) : (
                              row.httpStatus || '-'
                            )}
                          </td>
                          <td className="p-2 text-sm">
                            {row.finalUrl ? (
                              <a
                                href={row.finalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate max-w-xs block"
                              >
                                {row.finalUrl}
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2 text-sm text-gray-500">
                            {new Date(row.checkedAt).toLocaleString('ko-KR')}
                          </td>
                          <td className="p-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCheckTarget(row.id)}
                              disabled={loading}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
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
    </div>
  )
}

