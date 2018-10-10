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
const TextMessage = require('hubot/es2015').TextMessage;
const User = require('hubot/es2015').User;

class Signal extends Adapter {

  constructor(...args) {
    super(...args);
    this.number = process.env.HUBOT_SIGNAL_NUMBER;
    this.password = process.env.HUBOT_SIGNAL_PASSWORD;
    //this.store = new ProtocolStore(this.robot.brain);
    this.store = new ProtocolStore('./scratch');
    this.accountManager = new Api.AccountManager(this.number, this.password, this.store);
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
      .sendMessageToNumber(envelope.room, text, null, now, undefined, this.store.get('profileKey'))
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
      .sendMessageToNumber(envelope.room, text, null, now, undefined, this.store.get('profileKey'))
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
      .registerSingleDevice(this.number, process.env.HUBOT_SIGNAL_CODE);
      //.then(function(result) {
      //  this.robot.logger.info(result);
      //})
      //.catch(this.robot.logger.error);
  }

  _receive(userId, text, msgId, group) {
    if (group == null) {
      group = userId;
    }
    const user = this.robot.brain.userForId(userId, { room: group });
    const message = new TextMessage(user, text, msgId);
    console.log(message);
    if (message instanceof TextMessage) {
      console.log("Created TextMessage");
    }
    this.robot.receive(message);
  }

  _connect() {
    this.robot.logger.info("Connecting to service.");
    const signalingKey = this.store.get("signaling_key");
    if (!signalingKey) {
      this.robot.logger.error("No signaling key is defined, perhaps we didn't successfully register?");
      process.exit(1);
    }

    this.messageSender = new Api.MessageSender(this.number, this.password, this.store);
    const signalingKeyBytes = ByteBuffer.wrap(
      signalingKey,
      "binary"
    ).toArrayBuffer();
    this.messageReceiver = new Api.MessageReceiver(this.number.concat(".1"), this.password, signalingKeyBytes, this.store);
    this.messageReceiver.addEventListener("message", ev => {
      const id = ev.data.source.toString();
      this._receive(id, ev.data.message.body.toString(), ev.data.timestamp.toString(), ev.data.message.group);
    });
    this.emit("connected");
  }

  run() {
    this.robot.logger.info("Running adapter.");
    if (!this.store.get('profileKey')) {
      if (!process.env.HUBOT_SIGNAL_CODE) {
        Promise.resolve(this._request()).then(result => {
          this.robot.logger.info(`Sending verification code to ${this.number}. Once you receive the code, start the bot again while supplying the code via the environment variable HUBOT_SIGNAL_CODE.`);
          process.exit(0);
        }).catch(err => {
          this.robot.logger.error('Error requesting verification code: ', err.stack);
          process.exit(1);
        });
      } else {
        Promise.resolve(this._register()).then(result => {
          this.robot.logger.info(result);
          this._connect();
        }).catch(err => {
          this.robot.logger.error('Error registering with service: ', err.stack);
          process.exit(1);
        })
      }
    } else {
      this._connect();
    }
  }
}

exports.use = robot => new Signal(robot)
