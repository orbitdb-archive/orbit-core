'use strict'

const Crypto = require('orbit-crypto')
const OrbitUser = require('./orbit-user')

class OrbitIdentityProvider {
  static get id () {
    return 'orbit'
  }

  static async authorize (ipfs, credentials = {}) {
    if (credentials.provider !== OrbitIdentityProvider.id) {
      throw new Error(`OrbitIdentityProvider can't handle provider type '${credentials.provider}'`)
    }

    if (!credentials.username) throw new Error("'username' not specified")

    const keys = await Crypto.getKey(credentials.username)
    const pubKeyHash = await Crypto.exportKeyToIpfs(ipfs, keys.publicKey)

    const profileData = {
      name: credentials.username,
      location: 'Earth',
      image: null,
      signKey: pubKeyHash,
      updated: null,
      identityProvider: {
        provider: OrbitIdentityProvider.id,
        id: null
      }
    }

    const res = await ipfs.object.put(Buffer.from(JSON.stringify(profileData)))
    const hash = res.toJSON().multihash

    profileData.id = hash

    return new OrbitUser(keys, profileData)
  }

  static async load (ipfs, profile = {}) {
    if (profile.identityProvider.provider !== OrbitIdentityProvider.id) {
      throw new Error(
        `OrbitIdentityProvider can't handle provider type '${profile.identityProvider.provider}'`
      )
    }

    return profile
  }
}

module.exports = OrbitIdentityProvider
