import * as fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import compile from '../compile'

const readFile = promisify(fs.readFile)
const fixturesDir = path.resolve('src', '__fixtures__')
const distDir = path.resolve(fixturesDir, 'dist')

describe('Compile', () => {
  it('should work', async () => {
    const outputPath = path.resolve(distDir, 'basics.js')
    await new Promise(resolve => {
      compile({
        output: outputPath,
        configPath: path.resolve(fixturesDir, 'tsconfig.json'),
        dev: true,
        entry: path.resolve(fixturesDir, 'basics.ts'),
        onCompile: resolve,
        run: true,
      })
    })

    const output = await readFile(outputPath, 'utf8')

    expect(output).toMatchSnapshot('basics')
  })

  it('should work', async () => {
    const outputPath = path.resolve(distDir, 'paths.js')
    await new Promise(resolve => {
      compile({
        output: outputPath,
        configPath: path.resolve(fixturesDir, 'tsconfig.json'),
        dev: true,
        entry: path.resolve(fixturesDir, 'paths.ts'),
        onCompile: resolve,
        run: true,
      })
    })

    const output = await readFile(outputPath, 'utf8')

    expect(output).toMatchSnapshot('paths')
  })
})
