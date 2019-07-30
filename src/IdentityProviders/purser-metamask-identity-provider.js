'use strict'
const IdentityProvider = require('./identity-provider-interface')
const { open } = require('@colony/purser-metamask')
const { verifyMessage } = require('@colony/purser-metamask/methodLinks')
const type = 'purser-metamask'

class MetamaskIdentityProvider extends IdentityProvider {
  // Returns the type of the identity provider
  static get type () {
    return type
  }

  // Returns the signer's id
  async getId (options = {}) {
    const wallet = await open()
    if (!wallet) {
      throw new Error(
        `No address detected. Make sure Metamask is unlocked and your defaultAccount is set in web3.`
      )
    }
    return wallet.address
  }

  // Returns a signature of pubkeysignature
  async signIdentity (data, options = {}) {
    const wallet = await open()
    if (!wallet) {
      throw new Error(`No defaultAccount set in web3`)
    }

    return wallet.signMessage({ message: data })
  }

  static async verifyIdentity (identity) {
    // Verify that identity was signed by the id
    const signerAddress = await verifyMessage(
      identity.publicKey + identity.signatures.id,
      identity.signatures.publicKey
    )
    return signerAddress === identity.id
  }
}

module.exports = MetamaskIdentityProvider
