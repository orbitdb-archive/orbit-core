# orbit-core

[![npm version](https://badge.fury.io/js/orbit_.svg)](https://badge.fury.io/js/orbit_)
[![CircleCI Status](https://circleci.com/gh/orbitdb/orbit-core.svg?style=shield)](https://circleci.com/gh/orbitdb/orbit-core)
[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/orbitdb/Lobby) [![Matrix](https://img.shields.io/badge/matrix-%23orbitdb%3Apermaweb.io-blue.svg)](https://riot.permaweb.io/#/room/#orbitdb:permaweb.io) [![Discord](https://img.shields.io/discord/475789330380488707?color=blueviolet&label=discord)](https://discord.gg/cscuf5T)

> Communication protocol on IPFS

Orbit is a serverless, distributed, p2p communication library and protocol that enables feed-based information sharing, such as real-time chat, in the [IPFS](https://ipfs.io) peer-to-peer network.

This repository is the core library of Orbit. This library is intended to be used in your Node.js or Browser applications.

Used in the various Orbit projects:

- [orbit-web](https://github.com/orbitdb/orbit-web) - Orbit browser app
- [orbit-electron](https://github.com/orbitdb/orbit-electron) - Orbit desktop app
- [orbit-textui](https://github.com/orbitdb/orbit-textui) - Orbit terminal client

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Development](#development)
  - [Install Dependencies](#install-dependencies)
  - [Run Tests](#run-tests)
  - [Build Library and Distributables](#build-library-and-distributables)
- [License](#license)

## Install

This module uses [npm](https://www.npmjs.com/) and [node](https://nodejs.org/en/).

```sh
npm install orbit_
```

## Usage

See [examples/browser/index.html](examples/browser/index.html) for a more detailed example.

```javascript
'use strict'

const Orbit = require('orbit_')

const ipfs = new Ipfs()

ipfs.on('ready', () => {
  const orbit = new Orbit(ipfs)

  const username = 'Example Bot'
  const channel = 'HelloWorld'

  orbit.events.on('connected', () => {
    console.log(`-!- Orbit connected`)
    orbit.join(channel)
  })

  orbit.events.on('joined', channelName => {
    orbit.send(channelName, '/me is now caching this channel')
    console.log(`-!- Joined #${channelName}`)
  })

  // Listen for new messages
  orbit.events.on('entry', (entry, channelName) => {
    const post = entry.payload.value
    console.log(`[${post.meta.ts}] &lt;${post.meta.from.name}&gt; ${post.content}`)
  })

  // Connect to Orbit network
  orbit.connect(username).catch(e => console.error(e))
})
```

## API

See [API documentation](https://github.com/orbitdb/orbit-core/blob/master/API.md) for full details.

- [Getting Started](https://github.com/orbitdb/orbit-core/blob/master/API.md#getting-started)
- [Constructor](https://github.com/orbitdb/orbit-core/blob/master/API.md#constructor)
- [Properties](https://github.com/orbitdb/orbit-core/blob/master/API.md#properties)
  - [user](https://github.com/orbitdb/orbit-core/blob/master/API.md#user)
  - [network](https://github.com/orbitdb/orbit-core/blob/master/API.md#network)
  - [channels](https://github.com/orbitdb/orbit-core/blob/master/API.md#channels)
  - [peers](https://github.com/orbitdb/orbit-core/blob/master/API.md#peers)
- [Methods](https://github.com/orbitdb/orbit-core/blob/master/API.md#methods)
  - [connect(username)](https://github.com/orbitdb/orbit-core/blob/master/API.md#connectusername)
  - [disconnect()](https://github.com/orbitdb/orbit-core/blob/master/API.md#disconnect)
  - [join(channel)](https://github.com/orbitdb/orbit-core/blob/master/API.md#joinchannel)
  - [leave(channel)](https://github.com/orbitdb/orbit-core/blob/master/API.md#leavechannel)
  - [send(channel, message)](https://github.com/orbitdb/orbit-core/blob/master/API.md#sendchannel-message)
  - [addFile(channel, source)](https://github.com/orbitdb/orbit-core/blob/master/API.md#addfilechannel-source)
  - [getFile(hash)](https://github.com/orbitdb/orbit-core/blob/master/API.md#getfilehash)
  - [getDirectory(hash)](https://github.com/orbitdb/orbit-core/blob/master/API.md#getdirectoryhash)

## Development

### Install Dependencies

```sh
git clone https://github.com/orbitdb/orbit-core.git
cd orbit-core/
npm install
```

### Run example development environment

```sh
npm run dev
```

### Run Tests

```sh
npm test
```

### Build Library and Distributables

```sh
npm run build
```

Distributable (ES5 minified for browsers) will be located in `dist/`.

## Contribute

We would be happy to accept PRs! If you want to work on something, it'd be good to talk beforehand to make sure nobody else is working on it. You can reach us [on Gitter](https://gitter.im/orbitdb/Lobby), or in the [issues section](https://github.com/orbitdb/orbit-core/issues).

We also have **regular community calls**, which we announce in the issues in [the @orbitdb welcome repository](https://github.com/orbitdb/welcome/issues). Join us!

If you want to code but don't know where to start, check out the issues labelled ["help wanted"](https://github.com/orbitdb/orbit-core/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22+sort%3Areactions-%2B1-desc).

For specific guidelines for contributing to this repository, check out the [Contributing guide](CONTRIBUTING.md). For more on contributing to OrbitDB in general, take a look at the [@OrbitDB welcome repository](https://github.com/orbitdb/welcome). Please note that all interactions in [@OrbitDB](https://github.com/orbitdb) fall under our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © 2016-2019 Protocol Labs Inc., Haja Networks Oy
