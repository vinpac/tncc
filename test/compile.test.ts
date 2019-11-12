import { ChildProcess } from 'child_process'
import * as fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import compile, { CompileOptions } from '../src/compile'

const readFile = promisify(fs.readFile)
const fixturesDir = path.resolve('test', '__fixtures__')
const distDir = path.resolve(fixturesDir, 'dist')

const fixture = (filename: string) => path.resolve(fixturesDir, filename)
const compileAsync = (filename: string, options?: Partial<CompileOptions>) => {
  const output = path.resolve(distDir, filename.replace(/\.tsx?$/g, '.js'))

  return new Promise((resolve, reject) =>
    compile({
      dev: true,
      output,
      tsConfigPath: path.resolve(fixturesDir, 'tsconfig.json'),
      entry: fixture(filename),
      quiet: true,
      configPath: undefined,
      run: createRunFn(resolve, reject),
      ...options,
      onCompile: error => (error ? reject(error) : resolve()),
    }),
  ).then(() => readFile(output, 'utf8'))
}

const createRunFn = (
  resolve: (payload: any) => void,
  reject: (error: any) => void,
  outputExpected?: string[],
) => {
  return (child: ChildProcess) => {
    let outputIndex = 0
    if (outputExpected) {
      child.stdout!.on('data', data => {
        expect(String(data)).toBe(outputExpected[outputIndex])
        outputIndex += 1
      })
    }
    child.on('close', code => {
      if (outputExpected && outputIndex !== outputExpected.length) {
        reject(
          new Error(`Expected ${outputExpected.length} logs before exiting`),
        )
        return
      }

      if (code === 1) {
        reject('Exited with code 1')
      } else {
        resolve('Exited')
      }
    })
  }
}

describe('Compile', () => {
  it('should compile a file without problems', async () => {
    const outputPath = path.resolve(distDir, 'basics.js')
    await compileAsync('basics.ts')
    const output = await readFile(outputPath, 'utf8')

    expect(output).toMatchSnapshot('basics')
  })

  it('should use detect baseUrl and add TsconfigPathsPlugin', async () => {
    const output = await compileAsync('paths.ts')
    expect(output).toMatchSnapshot('paths')
  })

  it('should compile into a executable jasvascript file', async () => {
    await new Promise((resolve, reject) => {
      compileAsync('paths.ts', {
        run: createRunFn(resolve, reject, ['Basics\n', 'foo =  foo\n']),
      })
    })
  })

  it("should throw an error if tsconfig doesn't exist", async () => {
    try {
      await compileAsync('paths.ts', {
        tsConfigPath: '__',
      })
    } catch (error) {
      expect(error.message).toBe(
        "Unable to find a valid configuration JSON for typescript at '__'",
      )
      return
    }

    throw Error('Compiled without problems')
  })

  it("should throw an error if the entry file doesn't compile", async () => {
    try {
      await compileAsync('broken-compilation.ts', { silent: true })
    } catch (error) {
      expect(error.message).toMatchSnapshot()
      return
    }

    throw Error('Compiled without problems')
  })

  it('should use tncc.config', async () => {
    await compileAsync('with-react.tsx', {
      configPath: fixture('tncc.config.js'),
    })
  })

  it('should work without output', async () => {
    await compileAsync('with-react.tsx', {
      configPath: fixture('tncc.config.js'),
      output: undefined,
    })
  })
})
