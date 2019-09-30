'use strict'

const path = require('path')

module.exports = {
  entry: ['@babel/polyfill', './src/Orbit.js'],
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
        use: ['babel-loader'],
        include: path.resolve('src')
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
