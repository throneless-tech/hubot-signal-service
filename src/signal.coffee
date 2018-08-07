Api = require('libsignal-service-javascript')
ProtocolStore = require('./protocol_store.js')

PRODUCTION_URL = 

PRODUCTION_SERVER_URL = "https://textsecure-service.whispersystems.org"
STAGING_SERVER_URL = "https://textsecure-service-staging.whispersystems.org"
PRODUCTION_ATTACHMENT_URL = "https://whispersystems-textsecure-attachments.s3.amazonaws.com"
STAGING_ATTACHMENT_URL = "https://whispersystems-textsecure-attachments-staging.s3.amazonaws.com"

class Signal extends Adapter

  constructor: ->
    super
    @number = process.env.HUBOT_SIGNAL_NUMBER
    @password = process.env.HUBOT_SIGNAL_PASSWORD
    @server_url = if process.env.NODE_ENV == production then PRODUCTION_SERVER_URL else STAGING_SERVER_URL
    @attachment_url = if process.env.NODE_ENV == production then PRODUCTION_ATTACHMENT_URL else STAGING_ATTACHMENT_URL
    @store = new ProtocolStore
    @accountManager = new Api.AccountManager(@server_url, @number, @password, @store)
    @robot.logger.info "Constructor"

  send: (envelope, strings...) ->
    @robot.logger.info "Send"

  reply: (envelope, strings...) ->
    @robot.logger.info "Reply"

  run: ->
    @robot.logger.info "Run"
    @emit "connected"
    user = new User 1001, name: 'Signal User'
    message = new TextMessage user, 'Some Signal Message', 'MSG-001'
    @robot.receive message


exports.use = (robot) ->
  new Signal robot
