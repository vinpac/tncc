import chalk from 'chalk'
import commander from 'commander'
import path from 'path'
import pkg from '../package.json'
import compile, { CompileOptions } from './compile.js'

let entry = ''
const command = new commander.Command(pkg.name)
  .version(pkg.version)
  .action((src: string) => {
    entry = src
  })
  .option('-o, --output <output-file>', 'output file path')
  .option('-p, --project <typescript-config-file>', 'tsconfig.json')
  .option('-w, --watch', 'watch mode', false)
  .option('-v, --verbose', 'verbose mode', false)
  .option('-q, --quiet', 'quiet mode', false)
  .option('-s, --silent', 'silent mode', false)
  .option('-c, --config <config-file>', 'configuration file', 'tncc.config.js')
  .option('--run', 'run compiled output', false)
  .option('-t, --type-check', 'enable type checking')
  .option('--release', 'build to production')
  .option('-e, --exec <exec-command>', 'exec when compiled')
  .on('--help', () => {
    console.info()
    console.info(
      '    If you have any problems, do not hesitate to file an issue:',
    )
    console.info(
      `      ${chalk.cyan(`https://github.com/vinpac/${pkg.name}/issues/new`)}`,
    )
    console.info()
  })
  .parse(process.argv)

const options: CompileOptions = {
  entry,
  output: command.output,
  verbose: Boolean(command.verbose),
  execCommand: command.exec,
  dev: !command.release,
  quiet: Boolean(command.quiet),
  silent: Boolean(command.silent),
  watch: Boolean(command.watch),
  run: Boolean(command.run),
  checkTypes: Boolean(command.typeCheck),
  tsConfigPath: command.project || path.resolve('tsconfig.json'),
  configPath: path.resolve(command.config || 'tncc.config.js'),
}

compile({
  ...options,
  onCompile: error => {
    if (error) {
      process.exit(1)
    }
  },
})
