import chalk from 'chalk'
import { ChildProcess, spawn } from 'child_process'
import clearConsole from 'clear-console'
import * as fs from 'fs'
import mkdirp from 'mkdirp'
import * as path from 'path'
import tmp from 'tmp'
import webpack from 'webpack'
import createWebpackConfig from './create-webpack-config'

export interface CompileOptions {
  configPath?: string
  entry: string
  output?: string
  verbose?: boolean
  execCommand?: string
  dev: boolean
  watch?: boolean
  run?: boolean | ((child: ChildProcess) => void)
  runArgs: string[]
  checkTypes?: boolean
  quiet?: boolean
  silent?: boolean
  tsConfigPath: string
  onCompile?: (error?: Error) => any
}

export default function compile(options: CompileOptions) {
  const defaultConfigPath = path.resolve('tncc.config.js')
  const configPath = options.configPath || defaultConfigPath
  const silent = options.silent
  const quiet = options.quiet || silent

  let tsconfig
  try {
    tsconfig = require(path.resolve(options.tsConfigPath))
  } catch (error) {
    throw new Error(
      `Unable to find a valid configuration JSON for typescript at '${options.tsConfigPath}'`,
    )
  }
  if (!options.entry) {
    throw new Error(`'entry' parameter is required`)
  }

  if (typeof options.entry !== 'string') {
    throw new Error(
      `'entry' parameter must be of type string. ${JSON.stringify(
        options.entry,
      )} was given instead`,
    )
  }

  const output = options.output
    ? path.resolve(options.output)
    : tmp.fileSync().name

  let outputDir: string | undefined
  let outputFile = 'index.js'

  if (output.endsWith('/')) {
    outputDir = output
  } else {
    outputDir = path.dirname(output)
    outputFile = path.basename(output)
  }

  mkdirp.sync(outputDir)

  let webpackConfig = createWebpackConfig(
    {
      ...options,
      outputDir,
      outputFile,
      useExternals: Boolean(options.output),
    },
    tsconfig,
  )
  if (configPath) {
    let configFileExists = false
    try {
      configFileExists = Boolean(fs.statSync(configPath))
    } catch (error) {
      if (configPath !== defaultConfigPath) {
        throw error
      }
    }

    if (configFileExists) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tnccConfig = require(configPath)
      if (tnccConfig.webpack) {
        webpackConfig = tnccConfig.webpack(webpackConfig, options)
      }
    }
  }

  const compiler = webpack(webpackConfig)
  let childProcesses: ChildProcess[] = []

  const onChildNodeProcessExit = () => {
    if (!quiet) {
      console.info(chalk.red('> Process finished'))
    }
  }

  const onFinish = (elapsedTime: number) => {
    if (!quiet) {
      clearConsole()
      console.info(chalk.green(`> Successfully compiled in ${elapsedTime}ms`))
    }

    if (options.onCompile) {
      options.onCompile()
    }

    if (options.run || !options.output) {
      const isFn = typeof options.run === 'function'
      const nodeChild = spawn(
        'node',
        [path.join(outputDir!, outputFile), ...options.runArgs],
        {
          env: Object.assign(
            { NODE_ENV: options.dev ? 'development' : 'production' },
            process.env,
          ),
          stdio: isFn ? undefined : silent ? 'ignore' : 'inherit',
        },
      )
      nodeChild.once('exit', () => {
        childProcesses = childProcesses.filter(
          childProcess => childProcess !== nodeChild,
        )
        nodeChild.removeListener('exit', onChildNodeProcessExit)
        nodeChild.kill('SIGTERM')

        onChildNodeProcessExit()
      })

      if (isFn) {
        ;(options.run as any)(nodeChild)
      }

      childProcesses.push(nodeChild)
    }

    if (options.execCommand) {
      console.info(chalk.blue('> Running exec command'))
      const [command, ...args] = options.execCommand.split(' ')
      const execChild = spawn(command, args, {
        env: Object.assign(
          { NODE_ENV: options.dev ? 'development' : 'production' },
          process.env,
        ),
        stdio: quiet ? 'ignore' : 'inherit',
      })
      execChild.once('exit', onChildNodeProcessExit)
      childProcesses.push(execChild)
    }
  }

  const onCompilationFinish: webpack.ICompiler.Handler = (error, stats) => {
    // Kill current childs
    if (childProcesses.length) {
      childProcesses.forEach(childProcess => {
        childProcess.removeListener('exit', onChildNodeProcessExit)
        childProcess.kill('SIGTERM')

        return false
      })
      childProcesses = []
    }

    if (error || stats.hasErrors()) {
      const failedMessage = chalk.red(
        `> Compilation failed${
          stats && stats.endTime && stats.startTime
            ? ` after ${stats.endTime - stats.startTime}ms`
            : ''
        }`,
      )

      if (error) {
        if (!quiet) {
          console.info(failedMessage)
        }

        if (!silent) {
          console.info(error)
        }

        if (options.onCompile) {
          options.onCompile(error)
        }

        return
      }

      if (!silent) {
        console.info(failedMessage)
        console.info(
          stats.toString({
            assets: options.verbose,
            builtAt: options.verbose,
            entrypoints: options.verbose,
            timings: false,
            cached: options.verbose,
            cachedAssets: options.verbose,
            chunks: options.verbose,
            chunkModules: options.verbose,
            colors: true,
            hash: options.verbose,
            modules: options.verbose,
            reasons: options.dev,
            version: options.verbose,
          }),
        )
      }

      if (options.onCompile) {
        options.onCompile(stats.compilation.errors[0])
      }

      return
    }

    if (!options.watch || !options.checkTypes) {
      onFinish(
        stats.endTime && stats.startTime ? stats.endTime - stats.startTime : 0,
      )
    }
  }

  if (options.checkTypes) {
    ;(compiler.hooks as any).forkTsCheckerDone.tap(
      'should',
      (_: any, __: any, elapsed: number) => {
        if (!quiet) {
          clearConsole()
        }

        setTimeout(() => onFinish(Math.round(elapsed / 1000000)), 1)
      },
    )
  }

  if (options.watch) {
    compiler.watch({}, onCompilationFinish)
  } else {
    compiler.run(onCompilationFinish)
  }
}
