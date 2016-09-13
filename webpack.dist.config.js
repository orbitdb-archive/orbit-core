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
    libraryTarget: 'var',
    library: 'Orbit',
    filename: './dist/orbit.min.js'
  },
  debug: false,
  devtool: false,
  node: {
    console: false,
    process: 'mock',
    Buffer: 'buffer'
  },
  stats: {
    colors: true,
    reasons: false
  },
  plugins: [
    new webpack.optimize.AggressiveMergingPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      mangle: false,
      compress: {
        warnings: false
      }
    }),
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
      'node_modules': path.join(__dirname + '/node_modules'),
      'fs': path.join(__dirname + '/node_modules', 'html5-fs')
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
      include: /node_modules\/(hoek|qs|wreck|boom|promisify-es|logplease|uport.*|ipfs-.+|orbit.*|crdts)/,
      loader: 'babel',
      query: babel
    }, {
      test: /\.json$/,
      loader: 'json'
    }]
  },
  externals: {
    du: '{}',
    net: '{}',
    tls: '{}',
    console: '{}',
    'require-dir': '{}',
    mkdirp: '{}'
  }
}
