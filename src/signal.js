/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';

const ByteBuffer = require('bytebuffer');
const Api = require('libsignal-service');
//const ProtocolStore = require('./protocol_store.js');
const ProtocolStore = require('./LocalSignalProtocolStore.js');
const Adapter = require('hubot/es2015').Adapter;
const asyncOnExit = require('async-on-exit');

const PRODUCTION_SERVER_URL = "https://textsecure-service.whispersystems.org";
const STAGING_SERVER_URL = "https://textsecure-service-staging.whispersystems.org";
const PRODUCTION_ATTACHMENT_URL = "https://whispersystems-textsecure-attachments.s3.amazonaws.com";
const STAGING_ATTACHMENT_URL = "https://whispersystems-textsecure-attachments-staging.s3.amazonaws.com";

class Signal extends Adapter {

  constructor(...args) {
    super(...args);
    this.number = process.env.HUBOT_SIGNAL_NUMBER;
    this.password = process.env.HUBOT_SIGNAL_PASSWORD;
    this.server_url = process.env.NODE_ENV === 'production' ? PRODUCTION_SERVER_URL : STAGING_SERVER_URL;
    this.attachment_url = process.env.NODE_ENV === 'production' ? PRODUCTION_ATTACHMENT_URL : STAGING_ATTACHMENT_URL;
    //this.store = new ProtocolStore(this.robot.brain);
    this.store = new ProtocolStore('./scratch');
    this.accountManager = new Api.AccountManager(this.server_url, this.number, this.password, this.store);
    this.robot.logger.info("Constructed!");
  }

  send(envelope, ...strings) {
    if ((envelope.room == null)) {
      this.robot.logger.error("Cannot send a message without a valid room. Envelopes should contain a room property set to a phone number.");
      return;
    }
    const text = strings.join();
    const now = Date.now();
    this.messageSender
      .sendToNumber(envelope.room, text, now, null, 0, this.store.get('profileKey'))
      .then(function(result) {
        return this.robot.logger.info("result");
      })
      .catch(this.robot.logger.error);
    this.robot.logger.info("Send");
  }

  reply(envelope, ...strings) {
    if ((envelope.room == null)) {
      this.robot.logger.error("Cannot send a message without a valid room. Envelopes should contain a room property set to a phone number.");
      return;
    }
    const text = strings.join();
    const now = Date.now();
    this.messageSender
      .sendToNumber(envelope.room, text, now, null, 0, this.store.get('profileKey'))
      .then(function(result) {
        return this.robot.logger.info(result);
      })
      .catch(this.robot.logger.error);
    this.robot.logger.info("Reply");
  }

  _request() {
    this.robot.logger.info("Requesting code.");
    return this.accountManager
      .requestSMSVerification(this.number);
    //  .catch(this.robot.logger.error);
  }

  _register() {
    this.robot.logger.info("Registering account.");
    return this.accountManager
      .registerSingleDevice(this.number, process.env.HUBOT_SIGNAL_CODE)
      .then(function(result) {
        this.robot.logger.info(result);
      })
      .catch(this.robot.logger.error);
  }

  run() {
    const logger = this.robot.logger;
    const number = this.number;
    logger.info("Running adapter.");
    if (process.env.HUBOT_SIGNAL_CODE == null) {
      //const request = this._request.bind(this);
      //asyncOnExit(request, false);
      Promise.resolve(this._request()).then(function () {
        logger.info(`Sending verification code to ${number}. Once you receive the code, start the bot again while supplying the code via the environment variable HUBOT_SIGNAL_CODE.`);
        process.exit(0);
      }).catch(function(err) {
        logger.error('Error requesting verification code: ', err.stack);
        process.exit(1);
      })
    }

    if (!(typeof this.store.get === 'function' ? this.store.get('profileKey') : undefined)) {
      Promise.resolve(this._register());
    }

    this.messageSender = new Api.MessageSender(this.server_url, this.number, this.password, this.attachment_url, this.store);
    const key = this.store.get("signaling_key");
    this.robot.logger.info(key);
    const signaling_key = ByteBuffer.wrap(
      this.store.get("signaling_key"),
      "binary"
    ).toArrayBuffer();
    this.messageReceiver = new Api.MessageReceiver(this.server_url, this.number.concat(".1"), this.password, signaling_key, this.store);
    this.emit("connected");
  }
}

exports.use = robot => new Signal(robot)
