'use strict'

const path = require('path')

module.exports = {
  entry: ['babel-polyfill', path.join(__dirname, 'src/Orbit.js')],
  output: {
    path: path.join(__dirname, 'dist'),
    libraryTarget: 'var',
    library: 'Orbit',
    filename: 'orbit.min.js'
  },
  target: 'web',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      }
    ]
  },
  devServer: {
    contentBase: path.join(__dirname, 'examples/browser'),
    publicPath: '/lib/',
    compress: true,
    port: 8000
  }
}
