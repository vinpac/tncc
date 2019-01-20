import path from 'path'
import chalk from 'chalk'
import commander from 'commander'
import webpack from 'webpack'
import nodeExternals from 'webpack-node-externals'
import { spawn } from 'child_process'
import clearConsole from 'clear-console'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin'
import pkg from '../package.json'

let entry = ''
const {
  output,
  verbose = false,
  exec: commandToExec,
  release: isRelease,
  watch: watchEnabled,
  run: runEnabled,
  tsConfigFilePath = 'tsconfig.json',
} = new commander.Command(pkg.name)
  .version(pkg.version)
  .action(src => {
    entry = src
  })
  .option('-o, --output <output-file>', 'output file path')
  .option('-c, --ts-config <typescript-config-file>', 'tsconfig.json')
  .option('-w, --watch', 'watch mode', false)
  .option('-v, --verbose', 'verbose mode', false)
  .option('-r, --run', 'run compiled output', false)
  .option('--release', 'build to production')
  .option('-e, --exec <exec-command>', 'exec when compiled')
  .on('--help', () => {
    console.info()
    console.info('    If you have any problems, do not hesitate to file an issue:')
    console.info(`      ${chalk.cyan(`https://github.com/vinpac/${pkg.name}/issues/new`)}`)
    console.info()
  })
  .parse(process.argv)

const dev = !isRelease
let outputDir
let outputFile = 'index.js'

if (!entry) {
  console.error('Missing entry')
  process.exit(1)
}

if (!output) {
  console.error('Missing output')
  process.exit(1)
}

if (output.endsWith('/')) {
  outputDir = output
} else {
  outputDir = path.dirname(output)
  outputFile = path.basename(output)
}

let webpackConfig = {
  target: 'node',
  mode: isRelease ? 'production' : 'development',
  devtool: 'source-map',
  context: path.resolve(),
  entry: path.resolve(entry),
  output: {
    path: path.resolve(outputDir),
    filename: outputFile,
    // Point sourcemap entries to original disk location (format as URL on Windows)
    devtoolModuleFilenameTemplate: info =>
      path.resolve(info.absoluteResourcePath).replace(/\\/g, '/'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /^node_modules/,
        loader: 'ts-loader',
        options: {
          silent: true,
          // disable type checker - we will use it in fork plugin
          transpileOnly: true,
          configFile: path.resolve(tsConfigFilePath),
        },
      },
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin(),
    // Adds a banner to the top of each generated chunk
    // https://webpack.js.org/plugins/banner-plugin/
    new webpack.BannerPlugin({
      banner: 'require("source-map-support").install();',
      raw: true,
      entryOnly: false,
    }),
  ],
  bail: true,
  externals: [nodeExternals()],
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    plugins: [new TsconfigPathsPlugin({ configFile: path.resolve(tsConfigFilePath) })],
  },
}

try {
  const { webpack: webpackConfigOverrides } = require(path.resolve('tncc.config'))

  webpackConfig = webpackConfigOverrides(webpackConfig, {
    entry,
    output,
    watchEnabled,
    runEnabled,
    verbose,
    dev,
    tsConfigFilePath,
  })
} catch (error) {
  // ...
}

const compiler = webpack(webpackConfig)

let childs = []
const onNodeChildExit = () => {
  console.info(chalk.red('> Process finished'))
}

const onExecChildExit = () => {
  console.info(chalk.red('> Exec process finished'))
}

const onDone = elapsed => {
  console.info(chalk.green(`> Successfully compiled in ${elapsed}ms`))

  if (runEnabled) {
    const runChild = spawn('node', [path.join(outputDir, outputFile)], {
      env: Object.assign({ NODE_ENV: isRelease ? 'production' : 'development' }, process.env),
      silent: false,
      stdio: 'inherit',
    })
    runChild.once('exit', onNodeChildExit)
    childs.push(runChild)
  }

  if (commandToExec) {
    console.info(chalk.blue('> Running exec command'))
    const [command, ...args] = commandToExec.split(' ')
    const execChild = spawn(command, args, {
      env: Object.assign({ NODE_ENV: isRelease ? 'production' : 'development' }, process.env),
      silent: false,
      stdio: 'inherit',
    })
    execChild.once('exit', onExecChildExit)
    childs.push(execChild)
  }
}

const onCompile = (error, stats) => {
  const failedMessage = chalk.red(
    `> Compilation failed${stats ? ` after ${stats.endTime - stats.startTime}ms` : ''}`,
  )

  // Kill current childs
  if (childs.length) {
    childs = childs.filter(child => {
      child.removeListener('exit', onNodeChildExit)
      child.kill('SIGTERM')

      return false
    })
  }

  if (error) {
    console.info(failedMessage)
    console.error(error)
    return
  }

  if (stats.hasErrors()) {
    console.info(failedMessage)
    console.info(
      stats.toString({
        assets: verbose,
        builtAt: verbose,
        entrypoints: verbose,
        timings: false,
        cached: verbose,
        cachedAssets: verbose,
        chunks: verbose,
        chunkModules: verbose,
        colors: true,
        hash: verbose,
        modules: verbose,
        reasons: dev,
        version: verbose,
      }),
    )
    return
  }

  if (!watchEnabled) {
    onDone(stats.endTime - stats.startTime)
  }
}

compiler.hooks.forkTsCheckerDone.tap('should', (_, __, elapsed) => {
  clearConsole()
  setTimeout(() => onDone(Math.round(elapsed / 1000000)), 1)
})

if (watchEnabled) {
  compiler.watch({}, onCompile)
} else {
  compiler.run(onCompile)
}
