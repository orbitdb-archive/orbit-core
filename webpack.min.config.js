'use strict'

const path = require('path')

module.exports = {
  entry: './src/Orbit.js',
  output: {
    path: path.join(__dirname, 'dist'),
    libraryTarget: 'var',
    library: 'Orbit',
    filename: 'orbit.min.js'
  },
  target: 'web',
  node: {
    console: false,
    Buffer: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },
      {
        test: /\.js$/,
        include: /node_modules\/(hoek|qs|wreck|boom|promisify-es|logplease|ipfs-.+|orbit.*|crdts)/,
        use: ['babel-loader']
      }
    ]
  },
  resolve: {
    modules: ['node_modules', path.resolve(__dirname, '../node_modules')]
  }
}
