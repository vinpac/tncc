import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import * as path from 'path'
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin'
import * as webpack from 'webpack'
import nodeExternals from 'webpack-node-externals'
import { CompileOptions } from './compile'

export default function createWebpackConfig(
  options: CompileOptions,
): webpack.Configuration {
  const isOutputADir = options.output.endsWith('/')
  const outputDir = isOutputADir ? options.output : path.dirname(options.output)
  const outputFile = isOutputADir ? 'index.js' : path.basename(options.output)

  return {
    target: 'node',
    mode: options.dev ? 'development' : 'production',
    devtool: options.dev ? 'cheap-module-eval-source-map' : 'source-map',
    context: path.resolve(),
    entry: path.resolve(options.entry),
    output: {
      path: outputDir,
      filename: outputFile,
      // Point sourcemap entries to original disk location (format as URL on Windows)
      devtoolModuleFilenameTemplate: (info: any) =>
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
            configFile: path.resolve(options.configPath),
          },
        },
      ],
    },
    plugins: (options.checkTypes
      ? ([new ForkTsCheckerWebpackPlugin()] as any[])
      : []
    ).concat([
      // Adds a banner to the top of each generated chunk
      // https://webpack.js.org/plugins/banner-plugin/
      new webpack.BannerPlugin({
        banner: 'require("source-map-support").install();',
        raw: true,
        entryOnly: false,
      }),
    ]),
    bail: true,
    externals: [nodeExternals()],
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      plugins: [
        new TsconfigPathsPlugin({
          configFile: path.resolve(options.configPath),
        }),
      ],
    },
  }
}
