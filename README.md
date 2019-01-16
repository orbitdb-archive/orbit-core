# orbit-core

[![npm version](https://badge.fury.io/js/orbit_.svg)](https://badge.fury.io/js/orbit_)
[![CircleCI Status](https://circleci.com/gh/orbitdb/orbit-core.svg?style=shield)](https://circleci.com/gh/orbitdb/orbit-core)
[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/orbitdb/Lobby)
[![Project Status](https://badge.waffle.io/haadcode/orbit.svg?label=In%20Progress&title=Roadmap)](https://waffle.io/haadcode/orbit)

>  Communication protocol on IPFS

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
/* NOTE! To run this example, you need to have an IPFS daemon running */

'use strict'

const IpfsApi = require('ipfs-api')
const Orbit = require('orbit_')

const ipfs = IpfsApi()
const orbit = new Orbit(ipfs)

const channel = 'HelloWorld'

orbit.events.on('connected', (network) => {
  console.log(`-!- Connected to ${network.name}`)
  orbit.join(channel)
})

orbit.events.on('joined', (channel) => {
  orbit.send(channel, "/me is now caching this channel")
  console.log(`-!- Joined #${channel}`)
})

// Listen for new messages
orbit.events.on('message', (channel, post) => {
  console.log(`[${post.meta.ts}] < ${post.meta.from.name}> ${post.content}`)
})

// Connect to Orbit network
orbit.connect('Example Bot')
  .catch((e) => logger.error(e))
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
  - [get(channel, [lessThanHash], [greaterThanHash], [amount])](https://github.com/orbitdb/orbit-core/blob/master/API.md#getchannel-lessthanhash-greaterthanhash-amount)
  - [getPost(hash, [withUserProfile = true])](https://github.com/orbitdb/orbit-core/blob/master/API.md#getposthash-withuserprofile--true)
  - [getUser(hash)](https://github.com/orbitdb/orbit-core/blob/master/API.md#getuserhash)
  - [addFile(channel, source)](https://github.com/orbitdb/orbit-core/blob/master/API.md#addfilechannel-source)
  - [getFile(hash)](https://github.com/orbitdb/orbit-core/blob/master/API.md#getfilehash)
  - [getDirectory(hash)](https://github.com/orbitdb/orbit-core/blob/master/API.md#getdirectoryhash)

## Development
### Install Dependencies

```
git clone https://github.com/haadcode/orbit-core.git
cd orbit-core/
npm install
```

### Run Tests
```
npm test
```

### Build Library and Distributables
```
npm run build
```

Library (ES5 for older browsers and Node.js) will be located in `lib/`.

Distributable (ES5 minified for browsers) will be located in `dist/`.

## Contribute

We would be happy to accept PRs! If you want to work on something, it'd be good to talk beforehand to make sure nobody else is working on it. You can reach us [on Gitter](https://gitter.im/orbitdb/Lobby), or in the [issues section](https://github.com/orbitdb/orbit-core/issues).

We also have **regular community calls**, which we announce in the issues in [the @orbitdb welcome repository](https://github.com/orbitdb/welcome/issues). Join us!

If you want to code but don't know where to start, check out the issues labelled ["help wanted"](https://github.com/orbitdb/orbit-core/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22+sort%3Areactions-%2B1-desc).

For specific guidelines for contributing to this repository, check out the [Contributing guide](CONTRIBUTING.md). For more on contributing to OrbitDB in general, take a look at the [@OrbitDB welcome repository](https://github.com/orbitdb/welcome). Please note that all interactions in [@OrbitDB](https://github.com/orbitdb) fall under our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © 2016-2018 Protocol Labs Inc., Haja Networks Oy
