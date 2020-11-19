const Hapi = require('@hapi/hapi')
const Nes = require('@hapi/nes')
const CCompare = require('./ccompare')

const init = async () => {
  const server = Hapi.server({
    port: 6798,
    host: 'localhost',
    routes: {
      cors: true
    }
  })
  await server.register(Nes)

  const cc = new CCompare({ server })
  await cc.start()

  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init()
