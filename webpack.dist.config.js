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
  devtool: false,
  node: {
    console: false,
    process: 'mock',
    Buffer: true
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
    new webpack.NoErrorsPlugin(),
    new webpack.LoaderOptionsPlugin({
      debug: true
    })    
  ],
  resolve: {
    alias: {
      'node_modules': path.join(__dirname + '/node_modules'),
    }
  },
  module: {
    loaders: [{
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
      query: babel
    }, {
      test: /\.js$/,
      include: /node_modules\/(hoek|qs|wreck|boom|promisify-es|logplease|ipfs-.+|orbit.*|crdts)/,
      loader: 'babel-loader',
      query: babel
    }, {
      test: /\.json$/,
      loader: 'json-loader'
    }]
  },
  externals: {
    fs: '{}',
    du: '{}',
    net: '{}',
    tls: '{}',
    console: '{}',
    'require-dir': '{}',
    mkdirp: '{}'
  }
}
