'use strict'

const Web3 = require('web3')
const Uport = require('uport-lib').Uport
const Persona = require('uport-persona').Persona

const Crypto = require('orbit-crypto')
const OrbitUser = require('./orbit-user')

const web3 = new Web3()

const ipfsProvider = {
  host: 'ipfs.infura.io',
  port: '5001',
  protocol: 'https',
  root: ''
}

class uPortIdentityProvider {
  static get id () {
    return 'uPort'
  }

  static async authorize (ipfs, credentials = {}) {
    if (credentials.provider !== uPortIdentityProvider.id) {
      throw new Error(`uPortIdentityProvider can't handle provider type '${credentials.provider}'`)
    }

    // console.log("Waiting for uPort authorization...")
    const uport = new Uport('Orbit', { ipfsProvider })
    const uportProvider = uport.getUportProvider()
    web3.setProvider(uportProvider)

    async function getOrbitSignKey (persona, profile) {
      const keys = await Crypto.getKey(persona.address)

      // TODO: These can and should be called concurrently e.g. with Promise.all
      const pubKeyHash = await Crypto.exportKeyToIpfs(ipfs, keys.publicKey)
      const privKey = await Crypto.exportPrivateKey(keys.privateKey)

      console.log('PROFILE', profile)

      if (profile.orbitKey && pubKeyHash === profile.orbitKey) {
        return profile.orbitKey
      }

      persona.signAttribute({ orbitKey: pubKeyHash }, privKey, persona.address)
      const tx = await persona.writeToRegistry()
      console.log('Got tx hash:', tx)
      return [pubKeyHash, keys]
    }

    // TODO: What is the point of this call?
    await web3.eth.getCoinbase()

    const persona = await uport.getUserPersona()
    const uportProfile = persona.getProfile()

    const [pubKeyHash, keys] = await getOrbitSignKey(persona, uportProfile)

    const profileData = {
      name: uportProfile.name,
      location: uportProfile.location,
      image:
        uportProfile.image && uportProfile.image.length > 0
          ? uportProfile.image[0].contentUrl.replace('/ipfs/', '')
          : null,
      signKey: pubKeyHash,
      updated: new Date().getTime(),
      identityProvider: {
        provider: uPortIdentityProvider.id,
        id: persona.address
      }
    }

    const res = await ipfs.object.put(Buffer.from(JSON.stringify(profileData)))
    const hash = res.toJSON().Hash

    profileData.id = hash

    return new OrbitUser(keys, profileData)
  }

  static async load (ipfs, profile = {}) {
    if (profile.identityProvider.provider !== uPortIdentityProvider.id) {
      throw new Error(
        `uPortIdentityProvider can't handle provider type '${profile.identityProvider.provider}'`
      )
    }

    const persona = new Persona(profile.identityProvider.id, ipfsProvider, web3.currentProvider)

    await persona.load()
    const uportProfile = await persona.getProfile()

    console.log('uPort Profile Data', uportProfile)

    const profileData = {
      name: uportProfile.name,
      location: uportProfile.location,
      image:
        uportProfile.image && uportProfile.image.length > 0
          ? uportProfile.image[0].contentUrl.replace('/ipfs/', '')
          : null,
      signKey: uportProfile.orbitKey || profile.signKey,
      updated: profile.updated,
      identityProvider: {
        provider: uPortIdentityProvider.id,
        id: persona.address
      }
    }
    return profileData
  }
}

module.exports = uPortIdentityProvider
