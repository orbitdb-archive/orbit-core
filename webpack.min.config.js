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
  target: 'web',
  node: {
    console: false,
    Buffer: true
  },
  stats: {
    colors: true,
    reasons: false
  },
  plugins: [
    new webpack.optimize.AggressiveMergingPlugin(),
    new webpack.NoErrorsPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      mangle: false,
      compress: {
        warnings: false
      }
    }),
  ],
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
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    alias: {
      // These are needed because node-libs-browser depends on outdated
      // versions
      //
      // Can be dropped once https://github.com/devongovett/browserify-zlib/pull/18
      // is shipped
      zlib: 'browserify-zlib',
      // Can be dropped once https://github.com/webpack/node-libs-browser/pull/41
      // is shipped
      http: 'stream-http'
    }
  },
  resolveLoader: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    moduleExtensions: ['-loader']
  },
  externals: {
    fs: '{}',
    // du: '{}',
    // net: '{}',
    // tls: '{}',
    // console: '{}',
    // 'require-dir': '{}',
    // mkdirp: '{}'
  },
}
