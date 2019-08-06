import chalk from 'chalk'
import { ChildProcess, spawn } from 'child_process'
import clearConsole from 'clear-console'
import * as path from 'path'
import webpack from 'webpack'
import createWebpackConfig from './create-webpack-config'

export interface CompileOptions {
  entry: string
  output: string
  verbose?: boolean
  execCommand?: string
  dev: boolean
  watch?: boolean
  run?: boolean
  checkTypes?: boolean
  quiet?: boolean
  configPath: string
  onCompile?: () => any
}

export default function compile(options: CompileOptions) {
  const webpackConfig = createWebpackConfig(options)

  let outputDir: string | undefined
  let outputFile = 'index.js'

  if (options.output.endsWith('/')) {
    outputDir = options.output
  } else {
    outputDir = path.dirname(options.output)
    outputFile = path.basename(options.output)
  }

  if (!options.entry) {
    throw new Error("'entry' is a required parameter")
  }

  if (!options.output) {
    throw new Error("'output' is a required parameter")
  }

  const compiler = webpack(webpackConfig)
  let childProcesses: ChildProcess[] = []

  const onChildNodeProcessExit = () => {
    console.info(chalk.red('> Process finished'))
  }

  const onFinish = (elapsedTime: number) => {
    console.info(chalk.green(`> Successfully compiled in ${elapsedTime}ms`))

    if (options.run) {
      const runChild = spawn('node', [path.join(outputDir!, outputFile)], {
        env: Object.assign(
          { NODE_ENV: options.dev ? 'development' : 'production' },
          process.env,
        ),
        stdio: options.quiet ? 'ignore' : 'inherit',
      })
      runChild.once('exit', () => {
        childProcesses = childProcesses.filter(
          childProcess => childProcess !== runChild,
        )
        runChild.removeListener('exit', onChildNodeProcessExit)
        runChild.kill('SIGTERM')

        onChildNodeProcessExit()

        if (
          childProcesses.length === 0 &&
          !options.watch &&
          options.onCompile
        ) {
          options.onCompile()
        }
      })

      childProcesses.push(runChild)
    }

    if (options.execCommand) {
      console.info(chalk.blue('> Running exec command'))
      const [command, ...args] = options.execCommand.split(' ')
      const execChild = spawn(command, args, {
        env: Object.assign(
          { NODE_ENV: options.dev ? 'development' : 'production' },
          process.env,
        ),
        stdio: options.quiet ? 'ignore' : 'inherit',
      })
      execChild.once('exit', onChildNodeProcessExit)
      childProcesses.push(execChild)
    }

    if (
      !options.run &&
      !options.execCommand &&
      !options.watch &&
      options.onCompile
    ) {
      options.onCompile()
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
        console.info(failedMessage)
        console.error(error)
        return
      }

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
      return
    }

    if (!options.watch) {
      onFinish(
        stats.endTime && stats.startTime ? stats.endTime - stats.startTime : 0,
      )
    }
  }

  if (options.checkTypes) {
    // @ts-ignore
    compiler.hooks.forkTsCheckerDone.tap(
      'should',
      (_: any, __: any, elapsed: number) => {
        clearConsole()
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
