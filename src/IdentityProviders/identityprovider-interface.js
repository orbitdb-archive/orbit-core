'use strict'

class IdentityProvider {
  static get type () {
    throw new Error('IdentityProvider "get type" not implemented')
  }

  static checkType (providerType) {
    throw new Error('IdentityProvider "checkType" not implemented')
  }

  static async authorize (ipfs, credentials = {}) {
    throw new Error('IdentityProvider "authorize" not implemented')
  }
}

module.exports = IdentityProvider
