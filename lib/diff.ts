/**
 * 변경 감지 로직
 * 베이스라인과 현재 Run 결과를 비교하여 변경사항 추출
 */

import { RunResult } from '@prisma/client'

export interface FieldDiff {
  field: string
  oldValue: string | number | boolean | null
  newValue: string | number | boolean | null
}

export interface TargetDiff {
  targetId: string
  keyword: string
  url: string
  diffs: FieldDiff[]
}

export function compareResults(
  baselineResults: Map<string, RunResult>,
  currentResults: Map<string, RunResult>
): TargetDiff[] {
  const diffs: TargetDiff[] = []

  // 모든 target에 대해 비교
  const allTargetIds = new Set([
    ...baselineResults.keys(),
    ...currentResults.keys(),
  ])

  for (const targetId of allTargetIds) {
    const baseline = baselineResults.get(targetId)
    const current = currentResults.get(targetId)

    // 둘 다 없으면 스킵
    if (!baseline && !current) continue

    const fieldDiffs: FieldDiff[] = []

    // 각 필드 비교
    if (baseline && current) {
      if (baseline.foundAcademicNaver !== current.foundAcademicNaver) {
        fieldDiffs.push({
          field: 'foundAcademicNaver',
          oldValue: baseline.foundAcademicNaver,
          newValue: current.foundAcademicNaver,
        })
      }

      if (baseline.isPdf !== current.isPdf) {
        fieldDiffs.push({
          field: 'isPdf',
          oldValue: baseline.isPdf,
          newValue: current.isPdf,
        })
      }

      if (baseline.httpStatus !== current.httpStatus) {
        fieldDiffs.push({
          field: 'httpStatus',
          oldValue: baseline.httpStatus,
          newValue: current.httpStatus,
        })
      }

      const baselineUrl = baseline.finalUrl || ''
      const currentUrl = current.finalUrl || ''
      if (baselineUrl !== currentUrl) {
        fieldDiffs.push({
          field: 'finalUrl',
          oldValue: baselineUrl,
          newValue: currentUrl,
        })
      }
    } else if (baseline && !current) {
      // baseline만 있고 current가 없으면 모든 필드를 변경으로 표시
      fieldDiffs.push({
        field: 'status',
        oldValue: 'exists',
        newValue: 'missing',
      })
    } else if (!baseline && current) {
      // current만 있고 baseline이 없으면 새로 추가된 것으로 표시
      fieldDiffs.push({
        field: 'status',
        oldValue: 'missing',
        newValue: 'exists',
      })
    }

    if (fieldDiffs.length > 0) {
      diffs.push({
        targetId,
        keyword: '', // 나중에 채워짐
        url: current?.finalUrl || baseline?.finalUrl || '',
        diffs: fieldDiffs,
      })
    }
  }

  return diffs
}

