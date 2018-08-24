ByteBuffer = require('bytebuffer')
Api = require('libsignal-service')
ProtocolStore = require('./protocol_store.js')

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
    @store = new ProtocolStore @robot.brain
    @accountManager = new Api.AccountManager @server_url, @number, @password, @store
    @robot.logger.info "Constructor"

  send: (envelope, strings...) ->
    if not envelope.room?
      @robot.logger.error "Cannot send a message without a valid room. Envelopes should contain a room property set to a phone number."
      return
    text = strings.join()
    now = Date.now()
    @messageSender.sendToNumber envelope.room, text, now, null, 0, @store.get('profileKey')
      .then (result) ->
        @robot.logger.info "result"
      .catch @robot.logger.error
    @robot.logger.info "Send"

  reply: (envelope, strings...) ->
    if not envelope.room?
      @robot.logger.error "Cannot send a message without a valid room. Envelopes should contain a room property set to a phone number."
      return
    text = strings.join()
    now = Date.now()
    @messageSender.sendToNumber envelope.room, text, now, null, 0, @store.get('profileKey')
      .then (result) ->
        @robot.logger.info result
      .catch @robot.logger.error
    @robot.logger.info "Reply"

  run: ->
    @robot.logger.info "Run"
    unless process.env.HUBOT_SIGNAL_CODE?
      @accountManager.requestSMSVerification @number
        .catch @robot.logger.error
      @robot.logger.info "Sending verification code to #{@number}. Once you receive the code, start the bot again while supplying the code via the environment variable HUBOT_SIGNAL_CODE."
      return

    unless @store.get?('profileKey')
      @accountManager.registerSingleDevice @number process.env.HUBOT_SIGNAL_CODE
        .then (result) ->
          @robot.logger.info result
        .catch @robot.logger.error

    @messageSender = new Api.MessageSender @server_url, @number, @password, @attachment_url, @store
    signaling_key = ByteBuffer.wrap @store.get('signaling_key'), "binary"
      .toArrayBuffer
    @messageReceiver = new Api.MessageReceiver @server_url, @number, @password, @attachment_url, @signaling_key, @store
    @emit "connected"

exports.use = (robot) ->
  new Signal robot
