/**
 * Hubot-signal is an adapter for the Hubot chatbot framework which allows a
 * Hubot instance to communicate via the Signal messaging system.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const Api = require("@throneless/libsignal-service");
const ProtocolStore = require("./protocol_store.js");
const Adapter = require("hubot/es2015").Adapter;
const TextMessage = require("hubot/es2015").TextMessage;
const User = require("hubot/es2015").User;
const Response = require("hubot/es2015").Response;

/**
 * An extension of Hubot's TextMessage to ensure attachments and group ID's
 * are available to other external Hubot scripts that may want to use them.
 * @class
 */
class SignalMessage extends TextMessage {
  constructor(user, body, attachments, timestamp, group) {
    super(user, body, timestamp);
    this.attachments = attachments || [];
    if (group) {
      this.group = group.id;
    }
  }
}

/**
 * An extension of Hubot's Response object which makes available methods for
 * sending attachments to users.
 * @class
 */
class SignalResponse extends Response {
  sendAttachments(attachments, ...strings) {
    const attachmentPointers = [];
    if (typeof attachments === "string") {
      attachments = [attachments];
    }
    if (typeof attachments === "array") {
      attachments.map(path => {
        Api.AttachmentHelper.loadFile(path).then(file => {
          attachmentPointers.push(file);
        });
      });
    }
    this.robot.adapter._send(this.envelope, attachmentPointers, ...strings);
  }

  replyAttachments(attachments, ...strings) {
    const attachmentPointers = [];
    if (typeof attachments === "string") {
      attachments = [attachments];
    }
    if (typeof attachments === "array") {
      attachments.map(path => {
        Api.AttachmentHelper.loadFile(path).then(file => {
          attachmentPointers.push(file);
        });
      });
    }
    this.robot.adapter._reply(this.envelope, attachments, ...strings);
  }
}

/**
 * An implementation of the Hubot class Adapter, this is loaded by Hubot at
 * runtime and attempts to connect to the Signal messenger server. It passes
 * the available Hubot Brain object to the Signal library for key storage.
 * @class
 */
class Signal extends Adapter {
  send(envelope, ...strings) {
    this._send(envelope, [], ...strings);
    this.robot.logger.debug("Sent!");
  }

  reply(envelope, ...strings) {
    this._send(envelope, [], ...strings);
    this.robot.logger.debug("Replied!");
  }

  _send(envelope, attachments, ...strings) {
    if (envelope.room == null) {
      this.emit(
        "error",
        new Error(
          "Cannot send a message without a valid room. Envelopes should contain a room property set to a phone number."
        )
      );
      return;
    }
    const text = strings.join();
    const numbers = this.store.groupsGetNumbers(envelope.room);
    if (numbers === null || numbers === undefined) {
      this.robot.logger.debug("Sending direct message to " + envelope.room);
      this.messageSender
        .sendMessageToNumber({
          number: envelope.room,
          body: text,
          attachments: attachments || []
        })
        .then(result => {
          this.robot.logger.debug(result);
        })
        .catch(err => {
          this.emit("error", err);
        });
    } else {
      this.robot.logger.debug("Sending message to group " + envelope.room);
      this.messageSender
        .sendMessageToGroup({
          groupId: envelope.room,
          groupNumbers: numbers,
          body: text,
          attachments: attachments || []
        })
        .then(result => {
          this.robot.logger.debug(result);
        })
        .catch(err => {
          this.emit("error", err);
        });
    }
  }

  _request() {
    this.robot.logger.info("Requesting code.");
    return this.accountManager.requestSMSVerification();
  }

  _register() {
    this.robot.logger.info("Registering account.");
    return this.accountManager.registerSingleDevice(
      process.env.HUBOT_SIGNAL_CODE
    );
  }

  _receive(source, body = "", attachments, timestamp, group) {
    this.robot.logger.debug("Received message from " + source + ".");
    let room;
    if (!group) {
      // Prepend robot name to direct messages that don't include it.
      const startOfText = body.indexOf("@") === 0 ? 1 : 0;
      const robotIsNamed =
        body.indexOf(this.robot.name) === startOfText ||
        body.indexOf(this.robot.alias) === startOfText;
      if (!robotIsNamed) {
        body = `${this.robot.name} ${body}`;
      }
      room = source;
    } else {
      room = group;
    }
    const user = this.robot.brain.userForId(source, {
      name: source,
      room: room
    });
    this.robot.receive(
      new SignalMessage(user, body, attachments, timestamp, group)
    );
  }

  _connect() {
    this.robot.logger.debug("Connecting to service.");
    if (!this.store.getLocalRegistrationId()) {
      this.emit(
        "error",
        new Error(
          "No registrationId is defined, perhaps we didn't successfully register?"
        )
      );
      process.exit(1);
    }

    // Override the default response object.
    this.robot.Response = SignalResponse;

    this.messageSender = new Api.MessageSender(this.store);
    this.messageSender
      .connect()
      .then(this.robot.logger.debug("Started MessageSender."));
    this.messageReceiver = new Api.MessageReceiver(this.store);

    this.messageReceiver.connect().then(() => {
      this.robot.logger.debug("Started MessageReceiver.");
      this.messageReceiver.addEventListener("message", ev => {
        if (process.env.HUBOT_SIGNAL_DOWNLOADS) {
          const savePath = path.normalize(process.env.HUBOT_SIGNAL_DOWNLOADS);
          fs.promises
            .access(savePath, fs.constants.R_OK | fs.constants.W_OK)
            .then(() => {
              ev.data.message.attachments.map(attachment => {
                this.messageReceiver
                  .handleAttachment(attachment)
                  .then(attachmentPointer => {
                    Api.AttachmentHelper.saveFile(attachmentPointer, "./").then(
                      fileName => {
                        this.robot.logger.info("Wrote file to: ", fileName);
                      }
                    );
                  });
              });
            })
            .catch(() =>
              this.robot.logger.error(
                "Can't write attachment to HUBOT_SIGNAL_DOWNLOADS."
              )
            );
        }
        const source = ev.data.source.toString();
        const body = ev.data.message.body
          ? ev.data.message.body.toString()
          : "";
        const group = ev.data.message.group ? ev.data.message.group.id : null;
        this._receive(
          source,
          body,
          ev.data.message.attachments,
          ev.data.timestamp.toString(),
          group
        );
      });
      this.robot.logger.debug("Listening for messages.");
    });
  }

  _run() {
    this.loaded = true;
    this.robot.logger.debug("Received 'loaded' event, running adapter.");
    this.store.getLocalRegistrationId().then(id => {
      if (!id) {
        if (!process.env.HUBOT_SIGNAL_CODE) {
          Promise.resolve(this._request())
            .then(result => {
              this.robot.logger.info(
                `Sending verification code to ${this.number}. Once you receive the code, start the bot again while supplying the code via the environment variable HUBOT_SIGNAL_CODE.`
              );
              process.exit(0);
            })
            .catch(err => {
              this.emit("error", err);
              process.exit(1);
            });
        } else {
          Promise.resolve(this._register())
            .then(result => {
              this.robot.logger.info(result);
              this._connect();
            })
            .catch(err => {
              this.emit("error", err);
              process.exit(1);
            });
        }
      } else {
        this._connect();
      }
    });
  }

  run() {
    this.number = process.env.HUBOT_SIGNAL_NUMBER;
    this.loaded = false;
    this.robot.logger.debug("Loading signal-service adapter.");
    this.store = new Api.ProtocolStore(new ProtocolStore(this.robot));
    this.store
      .load()
      .then(this.store.getPassword())
      .then(password => {
        if (!password) {
          password = Api.KeyHelper.generatePassword();
          this.store.setPassword(password);
        }

        this.accountManager = new Api.AccountManager(
          this.number,
          password,
          this.store
        );
        // We need to wait until the brain is loaded so we can grab keys.
        this.robot.brain.on("loaded", () => {
          this.loaded || this._run();
        });
        // Lies!
        this.emit("connected");
      })
      .catch(err => {
        this.emit("error", err);
        process.exit(1);
      });
  }
}

exports.use = robot => new Signal(robot);
