import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import * as path from 'path'
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin'
import * as webpack from 'webpack'
import nodeExternals from 'webpack-node-externals'

interface CreateWebpackConfigOptions {
  dev: boolean
  entry: string
  outputDir: string
  outputFile: string
  checkTypes?: boolean
  useExternals?: boolean
  tsConfigPath: string
}

export default function createWebpackConfig(
  {
    outputDir,
    outputFile,
    useExternals = true,
    dev,
    entry,
    checkTypes,
    tsConfigPath,
  }: CreateWebpackConfigOptions,
  tsconfig: any,
): webpack.Configuration {
  return {
    target: 'node',
    mode: dev ? 'development' : 'production',
    devtool: dev ? 'cheap-module-eval-source-map' : 'source-map',
    context: path.resolve(),
    entry: path.resolve(entry),
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
            configFile: path.resolve(tsConfigPath),
          },
        },
      ],
    },
    plugins: checkTypes ? ([new ForkTsCheckerWebpackPlugin()] as any[]) : [],
    bail: true,
    externals: useExternals ? [nodeExternals()] : [],
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      plugins:
        tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.baseUrl
          ? [
              new TsconfigPathsPlugin({
                configFile: path.resolve(tsConfigPath),
              }),
            ]
          : undefined,
    },
  }
}
