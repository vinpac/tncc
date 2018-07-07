import path from 'path'
import chalk from 'chalk'
import commander from 'commander'
import webpack from 'webpack'
import nodeExternals from 'webpack-node-externals'
import { spawn } from 'child_process'
import clearConsole from 'clear-console'
import { CheckerPlugin } from 'awesome-typescript-loader'
import pkg from '../package.json'

const {
  entry,
  output,
  watch: watchMode = false,
  run: runMode = false,
  verbose = false,
  env = process.env.NODE_ENV || 'development',
  tsConfigFilepath = 'tsconfig.json',
} = new commander.Command(pkg.name)
  .version(pkg.version)
  .option('--env <env>', 'environment')
  .option('-e, --entry <entry-file>', 'entry file path')
  .option('-o, --output <output-file>', 'output file path')
  .option('-c, --ts-config <typescript-config-file>', 'tsconfig.json')
  .option('--watch', 'watch mode', false)
  .option('--verbose', 'verbose mode', false)
  .option('--run', 'run compiled output', false)
  .on('--help', () => {
    /* eslint-disable no-console */
    console.info()
    console.info('    If you have any problems, do not hesitate to file an issue:')
    console.info(`      ${chalk.cyan(`https://github.com/vinpac/${pkg.name}/issues/new`)}`)
    console.info()
    /* eslint-enable no-console */
  })
  .parse(process.argv)

const dev = env !== 'production'
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
  const slashIndex = output.lastIndexOf('/')
  outputDir = output.substr(0, slashIndex)
  outputFile = output.substr(slashIndex + 1)
}

const tsConfig = require(path.resolve(tsConfigFilepath))
let alias = {}

try {
  Object.keys(tsConfig.compilerOptions.paths).forEach(key => {
    let aliasKey = key
    if (aliasKey.endsWith('/*')) {
      aliasKey = aliasKey.substr(0, aliasKey.length - 2)
    } else {
      aliasKey += '$'
    }

    tsConfig.compilerOptions.paths[key].forEach(target => {
      alias[aliasKey] = path.resolve(
        target.endsWith('/*') ? target.substr(0, target.length - 2) : target,
      )
    })
  })
} catch (error) {
  console.info(error)
  // ...
}

const compiler = webpack({
  target: 'node',
  mode: env,
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
        loader: 'awesome-typescript-loader',
        options: {
          silent: true,
          useCache: true,
          cacheDirectory: '.cache',
          configFileName: path.resolve(tsConfigFilepath),
        },
      },
    ],
  },
  plugins: [
    // Adds a banner to the top of each generated chunk
    // https://webpack.js.org/plugins/banner-plugin/
    new webpack.BannerPlugin({
      banner: 'require("source-map-support").install();',
      raw: true,
      entryOnly: false,
    }),
    new CheckerPlugin(),
  ],
  externals: [nodeExternals()],
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias,
  },
})

let child
const onChildExit = () => {
  console.info(chalk.red(`${chalk.black.bgRed(' DONE ')} Process finished`))
}

const run = () => {
  if (child) {
    child.removeListener('exit', onChildExit)
    child.kill('SIGTERM')
  }

  child = spawn('node', [path.join(outputDir, outputFile)], {
    env: Object.assign({ NODE_ENV: env }, process.env),
    silent: false,
    stdio: 'inherit',
  })
  child.once('exit', onChildExit)
}

const onCompile = (error, stats) => {
  if (watchMode) {
    clearConsole()
  }

  const failedMessage = chalk.red(
    `${chalk.bgRed.black(' FAIL ')} Compilation failed after ${stats.endTime - stats.startTime}ms`,
  )

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

  if (runMode) {
    console.info(
      chalk.green(
        `${chalk.bgGreen.black(' DONE ')} Successfully compiled server in ${stats.endTime -
          stats.startTime}ms`,
      ),
    )

    run()
  }
}

if (watchMode) {
  compiler.watch({}, onCompile)
} else {
  compiler.run(onCompile)
}
