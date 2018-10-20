/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
"use strict";

const ByteBuffer = require("bytebuffer");
const Api = require("libsignal-service");
const ProtocolStore = require("./protocol_store.js");
//const ProtocolStore = require("./LocalSignalProtocolStore.js");
const Adapter = require("hubot/es2015").Adapter;
const TextMessage = require("hubot/es2015").TextMessage;
const User = require("hubot/es2015").User;
const Response = require("hubot/es2015").Response;

// @flow
class SignalMessage extends TextMessage {
  // @flow
  constructor(user, group, text, timestamp, attachments) {
    super(user, text, timestamp);
    this.attachments = attachments || [];
    if (this.group) {
      this.group = group.id;
    }
  }
}

// @flow
class SignalResponse extends Response {
  // @flow
  sendAttachments(attachments, ...strings) {
    this.robot.adapter._send(this.envelope, attachments, ...strings);
  }

  // @flow
  replyAttachments(attachments, ...strings) {
    this.robot.adapter._reply(this.envelope, attachments, ...strings);
  }
}

// @flow
class Signal extends Adapter {
  // @flow
  constructor(args?: Array<mixed>): void {
    super(args);
    this.number = process.env.HUBOT_SIGNAL_NUMBER;
    this.password = process.env.HUBOT_SIGNAL_PASSWORD;
    this.store = new ProtocolStore(this.robot);
    this.accountManager = new Api.AccountManager(
      this.number,
      this.password,
      this.store
    );
    this.loaded = false;
    this.robot.logger.info("Constructed!");
  }

  // @flow
  send(envelope, ...strings) {
    this._send(envelope, [], ...strings);
    this.robot.logger.debug("Sent!");
  }

  // @flow
  reply(envelope, ...strings) {
    this._send(envelope, [], ...strings);
    this.robot.logger.debug("Replied!");
  }

  // @flow
  _send(envelope, attachments, ...strings) {
    if (envelope.room == null) {
      this.robot.logger.error(
        "Cannot send a message without a valid room. Envelopes should contain a room property set to a phone number."
      );
      return;
    }
    const text = strings.join();
    const now = Date.now();
    const group = this.store.getGroup(envelope.room);
    if (group === null || group === undefined) {
      this.robot.logger.debug("Sending direct message to " + envelope.room);
      this.messageSender
        .sendMessageToNumber(
          envelope.room,
          text,
          attachments || [],
          now,
          undefined,
          this.store.get("profileKey")
        )
        .then(function(result) {
          return this.robot.logger.debug(result);
        })
        .catch(this.robot.logger.error);
    } else {
      this.robot.logger.debug("Sending message to group " + envelope.room);
      this.messageSender
        .sendMessageToGroup(
          envelope.room,
          text,
          attachments || [],
          now,
          undefined,
          this.store.get("profileKey")
        )
        .then(function(result) {
          return this.robot.logger.debug(result);
        })
        .catch(this.robot.logger.error);
    }
  }

  // @flow
  _request() {
    this.robot.logger.info("Requesting code.");
    return this.accountManager.requestSMSVerification(this.number);
    //  .catch(this.robot.logger.error);
  }

  // @flow
  _register() {
    this.robot.logger.info("Registering account.");
    return this.accountManager.registerSingleDevice(
      this.number,
      process.env.HUBOT_SIGNAL_CODE
    );
    //.then(function(result) {
    //  this.robot.logger.info(result);
    //})
    //.catch(this.robot.logger.error);
  }

  // @flow
  _receive(userId, text, msgId, group) {
    if (group == null) {
      group = userId;
    }
    const user = this.robot.brain.userForId(userId, { room: group });
    this.robot.receive(new SignalMessage(user, text, msgId));
  }

  // @flow
  _connect() {
    this.robot.logger.debug("Connecting to service.");
    const signalingKey = this.store.get("signaling_key");
    if (!signalingKey) {
      this.robot.logger.error(
        "No signaling key is defined, perhaps we didn't successfully register?"
      );
      process.exit(1);
    }

    this.robot.Response = SignalResponse;

    this.messageSender = new Api.MessageSender(
      this.number,
      this.password,
      this.store
    );
    const signalingKeyBytes = ByteBuffer.wrap(
      signalingKey,
      "binary"
    ).toArrayBuffer();
    this.messageReceiver = new Api.MessageReceiver(
      this.number.concat(".1"),
      this.password,
      signalingKeyBytes,
      this.store
    );
    this.messageReceiver.addEventListener("message", ev => {
      const id = ev.data.source.toString();
      this._receive(
        id,
        ev.data.message.body.toString(),
        ev.data.timestamp.toString(),
        ev.data.message.group
      );
    });
  }

  // @flow
  _run() {
    this.loaded = true;
    this.robot.logger.debug("Received 'loaded' event, running adapter.");
    if (!this.store.get("profileKey")) {
      if (!process.env.HUBOT_SIGNAL_CODE) {
        Promise.resolve(this._request())
          .then(result => {
            this.robot.logger.info(
              `Sending verification code to ${
                this.number
              }. Once you receive the code, start the bot again while supplying the code via the environment variable HUBOT_SIGNAL_CODE.`
            );
            process.exit(0);
          })
          .catch(err => {
            this.robot.logger.error(
              "Error requesting verification code: ",
              err.stack
            );
            process.exit(1);
          });
      } else {
        Promise.resolve(this._register())
          .then(result => {
            this.robot.logger.info(result);
            this._connect();
          })
          .catch(err => {
            this.robot.logger.error(
              "Error registering with service: ",
              err.stack
            );
            process.exit(1);
          });
      }
    } else {
      this._connect();
    }
  }

  // @flow
  run() {
    this.robot.logger.debug("Loading signal-service adapter.");
    // We need to wait until the brain is loaded so we can grab keys.
    this.robot.brain.on("loaded", () => {
      this.loaded || this._run();
    });
    // Lies!
    this.emit("connected");
  }
}

exports.use = robot => new Signal(robot);
