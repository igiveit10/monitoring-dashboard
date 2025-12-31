/**
 * 배포 환경에서 data 폴더와 필요한 디렉토리가 존재하는지 확인
 * 없으면 생성
 * 또한 seed에 필요한 CSV 파일들을 data/ 폴더로 복사
 */
import { promises as fs } from 'fs'
import { existsSync, copyFileSync } from 'fs'
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

function copyIfExists(source: string, dest: string) {
  if (existsSync(source) && !existsSync(dest)) {
    copyFileSync(source, dest)
    console.log(`Copied ${source} to ${dest}`)
  }
}

async function main() {
  try {
    await ensureDir(dataDir)
    await ensureDir(uploadsDir)
    await ensureDir(snapshotsDir)
    await ensureDir(logsDir)
    
    // seed에 필요한 CSV 파일들을 data/ 폴더로 복사
    // src/data/ 폴더의 파일들을 data/ 폴더로 복사 (Render 빌드 후에도 접근 가능하도록)
    const srcDataDir = join(process.cwd(), 'src', 'data')
    const srcRunsCsv = join(srcDataDir, 'runs.csv')
    const dataRunsCsv = join(dataDir, 'runs.csv')
    
    copyIfExists(srcRunsCsv, dataRunsCsv)
    
    console.log('Data directories ensured')
  } catch (error) {
    console.error('Error ensuring data directories:', error)
    process.exit(1)
  }
}

main()

