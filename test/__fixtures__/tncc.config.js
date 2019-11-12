module.exports = {
  webpack: config => {
    config.module.rules.push({
      test: /\.(?:t|j)sx?$/,
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-react'],
      },
    })
    return config
  },
}
