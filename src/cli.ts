import chalk from 'chalk'
import commander from 'commander'
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
  .option('-r, --run', 'run compiled output', false)
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
  watch: Boolean(command.watch),
  run: Boolean(command.run),
  checkTypes: Boolean(command.typeCheck),
  configPath: command.project,
}

try {
  compile(options)
} catch (error) {
  process.exit(1)
}
