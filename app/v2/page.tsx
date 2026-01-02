'use client'

import { useState, useEffect } from 'react'

interface Target {
  id: string
  title: string
  url: string
  expectedSearch: boolean
  expectedPdf: boolean
  note: string | null
}

interface RunResult {
  id: string
  runDate: string
  targetId: string
  foundSearch: boolean
  foundPdf: boolean
  isDone: boolean
  checkedAt: string
}

interface DashboardData {
  targets: Target[]
  runResults: Record<string, RunResult[]> // runDate -> RunResult[]
  runDates: string[]
}

export default function DashboardV2() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [monitoringData, setMonitoringData] = useState<Record<string, {
    foundSearch: boolean
    foundPdf: boolean
    isDone: boolean
    note: string
  }>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v2/dashboard')
      if (!response.ok) throw new Error('Failed to load data')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error loading data:', error)
      showToast('데이터 로드 실패', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const openModal = (runDate?: string) => {
    const date = runDate || new Date().toISOString().split('T')[0]
    setSelectedDate(date)
    
    // Initialize monitoring data
    const initialData: Record<string, {
      foundSearch: boolean
      foundPdf: boolean
      isDone: boolean
      note: string
    }> = {}
    
    if (data) {
      data.targets.forEach(target => {
        const existingResult = data.runResults[date]?.find(r => r.targetId === target.id)
        initialData[target.id] = {
          foundSearch: existingResult?.foundSearch ?? false,
          foundPdf: existingResult?.foundPdf ?? false,
          isDone: existingResult?.isDone ?? false,
          note: target.note || '',
        }
      })
    }
    
    setMonitoringData(initialData)
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!data) return
    
    try {
      setSaving(true)
      
      // Collect note updates
      const noteUpdates: Array<{ targetId: string; note: string }> = []
      data.targets.forEach(target => {
        const newNote = monitoringData[target.id]?.note || ''
        if (newNote !== (target.note || '')) {
          noteUpdates.push({ targetId: target.id, note: newNote })
        }
      })

      // Save run results
      const runResults = data.targets.map(target => ({
        targetId: target.id,
        foundSearch: monitoringData[target.id]?.foundSearch ?? false,
        foundPdf: monitoringData[target.id]?.foundPdf ?? false,
        isDone: monitoringData[target.id]?.isDone ?? false,
      }))

      const response = await fetch('/api/v2/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runDate: selectedDate,
          runResults,
          noteUpdates,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to save')
      }

      showToast('저장 완료', 'success')
      setIsModalOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error saving:', error)
      showToast(error instanceof Error ? error.message : '저장 실패', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">데이터를 불러올 수 없습니다</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">모니터링 대시보드 v2</h1>
            <div className="flex gap-2">
              <button
                onClick={() => openModal()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                모니터링 입력
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">ID</th>
                  <th className="border p-2 text-left">제목</th>
                  <th className="border p-2 text-left">URL</th>
                  <th className="border p-2 text-center">정답셋 검색</th>
                  <th className="border p-2 text-center">정답셋 PDF</th>
                  <th className="border p-2 text-left">정답셋 비고</th>
                  {data.runDates.map(date => (
                    <th key={date} className="border p-2 text-center">
                      {date}
                      <button
                        onClick={() => openModal(date)}
                        className="ml-2 text-xs text-blue-600 hover:underline"
                      >
                        편집
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.targets.map(target => (
                  <tr key={target.id}>
                    <td className="border p-2 text-sm">{target.id.slice(0, 8)}</td>
                    <td className="border p-2">{target.title}</td>
                    <td className="border p-2">
                      <a href={target.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {target.url}
                      </a>
                    </td>
                    <td className="border p-2 text-center">
                      {target.expectedSearch ? (
                        <span className="text-green-600 font-bold">Y</span>
                      ) : (
                        <span className="text-red-600 font-bold">N</span>
                      )}
                    </td>
                    <td className="border p-2 text-center">
                      {target.expectedPdf ? (
                        <span className="text-green-600 font-bold">Y</span>
                      ) : (
                        <span className="text-red-600 font-bold">N</span>
                      )}
                    </td>
                    <td className="border p-2 text-sm">{target.note || '-'}</td>
                    {data.runDates.map(date => {
                      const result = data.runResults[date]?.find(r => r.targetId === target.id)
                      return (
                        <td key={date} className="border p-2 text-center">
                          {result ? (
                            <div className="flex gap-1 justify-center">
                              <span className={result.foundSearch ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                {result.foundSearch ? 'Y' : 'N'}
                              </span>
                              <span>/</span>
                              <span className={result.foundPdf ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                {result.foundPdf ? 'Y' : 'N'}
                              </span>
                              {result.isDone && <span className="text-gray-500 text-xs">✓</span>}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 모니터링 입력 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">모니터링 입력</h2>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border rounded"
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border p-2 text-left">제목</th>
                    <th className="border p-2 text-left">URL</th>
                    <th className="border p-2 text-center">검색</th>
                    <th className="border p-2 text-center">PDF</th>
                    <th className="border p-2 text-center">완료</th>
                    <th className="border p-2 text-left">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {data.targets.map(target => (
                    <tr key={target.id}>
                      <td className="border p-2">{target.title}</td>
                      <td className="border p-2">
                        <a href={target.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {target.url}
                        </a>
                      </td>
                      <td className="border p-2 text-center">
                        <select
                          value={monitoringData[target.id]?.foundSearch ? 'Y' : 'N'}
                          onChange={(e) => {
                            setMonitoringData({
                              ...monitoringData,
                              [target.id]: {
                                ...monitoringData[target.id],
                                foundSearch: e.target.value === 'Y',
                                foundPdf: monitoringData[target.id]?.foundPdf ?? false,
                                isDone: monitoringData[target.id]?.isDone ?? false,
                                note: monitoringData[target.id]?.note || '',
                              },
                            })
                          }}
                          className="w-16 px-2 py-1 border rounded"
                        >
                          <option value="N">N</option>
                          <option value="Y">Y</option>
                        </select>
                      </td>
                      <td className="border p-2 text-center">
                        <select
                          value={monitoringData[target.id]?.foundPdf ? 'Y' : 'N'}
                          onChange={(e) => {
                            setMonitoringData({
                              ...monitoringData,
                              [target.id]: {
                                ...monitoringData[target.id],
                                foundSearch: monitoringData[target.id]?.foundSearch ?? false,
                                foundPdf: e.target.value === 'Y',
                                isDone: monitoringData[target.id]?.isDone ?? false,
                                note: monitoringData[target.id]?.note || '',
                              },
                            })
                          }}
                          className="w-16 px-2 py-1 border rounded"
                        >
                          <option value="N">N</option>
                          <option value="Y">Y</option>
                        </select>
                      </td>
                      <td className="border p-2 text-center">
                        <input
                          type="checkbox"
                          checked={monitoringData[target.id]?.isDone ?? false}
                          onChange={(e) => {
                            setMonitoringData({
                              ...monitoringData,
                              [target.id]: {
                                ...monitoringData[target.id],
                                foundSearch: monitoringData[target.id]?.foundSearch ?? false,
                                foundPdf: monitoringData[target.id]?.foundPdf ?? false,
                                isDone: e.target.checked,
                                note: monitoringData[target.id]?.note || '',
                              },
                            })
                          }}
                        />
                      </td>
                      <td className="border p-2">
                        <input
                          type="text"
                          value={monitoringData[target.id]?.note || ''}
                          onChange={(e) => {
                            setMonitoringData({
                              ...monitoringData,
                              [target.id]: {
                                ...monitoringData[target.id],
                                foundSearch: monitoringData[target.id]?.foundSearch ?? false,
                                foundPdf: monitoringData[target.id]?.foundPdf ?? false,
                                isDone: monitoringData[target.id]?.isDone ?? false,
                                note: e.target.value,
                              },
                            })
                          }}
                          placeholder="-"
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

