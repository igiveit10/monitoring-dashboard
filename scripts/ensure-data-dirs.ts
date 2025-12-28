/**
 * 배포 환경에서 data 폴더와 필요한 디렉토리가 존재하는지 확인
 * 없으면 생성
 */
import { promises as fs } from 'fs'
import { join } from 'path'

const dataDir = join(process.cwd(), 'data')
const uploadsDir = join(dataDir, 'uploads')
const snapshotsDir = join(dataDir, 'snapshots')
const logsDir = join(dataDir, 'logs')

async function ensureDir(dir: string) {
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
    console.log(`Created directory: ${dir}`)
  }
}

async function main() {
  try {
    await ensureDir(dataDir)
    await ensureDir(uploadsDir)
    await ensureDir(snapshotsDir)
    await ensureDir(logsDir)
    console.log('Data directories ensured')
  } catch (error) {
    console.error('Error ensuring data directories:', error)
    process.exit(1)
  }
}

main()

