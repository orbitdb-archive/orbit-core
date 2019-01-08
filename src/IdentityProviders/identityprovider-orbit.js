'use strict'

const Identities = require('orbit-db-identity-provider')

const IdentityProviderInterface = require('./identityprovider-interface')
const OrbitUser = require('../orbit-user')

class OrbitIdentityProvider extends IdentityProviderInterface {
  static get type () {
    return 'orbitdb'
  }

  static checkType (providerType) {
    if (providerType !== OrbitIdentityProvider.type) {
      throw new Error(`OrbitIdentityProvider can not handle provider type '${providerType}'`)
    }
  }

  static checkCredentials (credentials) {
    if (!credentials.username) throw new Error("'username' not specified")
  }

  static async authorize (ipfs, credentials = {}) {
    OrbitIdentityProvider.checkType(credentials.provider)
    OrbitIdentityProvider.checkCredentials(credentials)

    const identity = await Identities.createIdentity({
      id: credentials.username,
      type: OrbitIdentityProvider.type
    })

    const profile = {
      name: credentials.username,
      location: 'Earth',
      image: null
    }

    return new OrbitUser(identity, profile)
  }
}

module.exports = OrbitIdentityProvider
