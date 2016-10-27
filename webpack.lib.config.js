'use strict'

const webpack = require('webpack')
const path = require('path')

const babel = {
  "plugins": [
    "syntax-flow",
    "transform-flow-strip-types"
  ].map((p) => require.resolve('babel-plugin-' + p)),
  "presets": ["es2015"].map((p) => require.resolve('babel-preset-' + p))
}

module.exports = {
  entry: './src/Orbit.js',
  output: {
    path: __dirname + "/lib",
    libraryTarget: 'commonjs2',
    library: 'Orbit',
    filename: 'orbit.js'
  },
  target: 'node',
  debug: false,
  stats: {
    colors: true,
    reasons: false
  },
  plugins: [
    new webpack.optimize.AggressiveMergingPlugin(),
    new webpack.NoErrorsPlugin()
  ],
  resolveLoader: {
    root: path.join(__dirname, 'node_modules')
  },
  resolve: {
    modulesDirectories: [
      path.join(__dirname, 'node_modules')
    ],
    alias: {
      'node_modules': path.join(__dirname + '/node_modules')
    }
  },
  module: {
    loaders: [{
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      loader: 'babel',
      query: babel
    }, {
      test: /\.js$/,
      include: /node_modules\/(hoek|qs|wreck|boom|promisify-es|logplease|ipfs-.+|orbit.*|crdts)/,
      loader: 'babel',
      query: babel
    }, {
      test: /\.json$/,
      loader: 'json'
    }]
  }
}
