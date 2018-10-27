# hubot-signal-service
**This is a third-party effort, and is NOT a part of the official [Signal](https://signal.org) project or any other project of [Open Whisper Systems](https://whispersystems.org).**

**WARNING: This adapter is currently undergoing a security audit. It should not be regarded as secure, use at your own risk. I am not a cryptographer, I just encrypt a lot.**

A [Hubot](https://hubot.github.com) adapter that allows Hubot to utilize the [Signal](https://signal.org) messaging service.

## Requirements

Hubot-signal-service is only compatible with Hubot v3.0 and above. Unlike many other adapters, hubot-signal-service also requires a Hubot Brain with persistent storage so that it can store keys and other state information. Make sure that your Hubot instance has a functioning Redis instance or other backend storage before attempting to connect it to Signal. **Your Signal keys are only as secure as your storage**, so make sure your storage is secure and that you don't install unnecessary scripts on your Hubot instance that may provide a way to get access to your keys.

## Usage

To use this in your Hubot project, run the following from your project directory:

`npm install --save hubot-signal-service`

And then add `hubot-signal-service` to the `external-scripts.json` file. Hubot-signal-service uses the following environment variables for configuration:

* `HUBOT_SIGNAL_NUMBER`: This is the phone number that this Hubot instance will listen on in [E.164 format](https://en.wikipedia.org/wiki/E.164), i.e. a US phone number would look like `+15555555555`. It's not currently recommended to use this with a number that you already use Signal on except for testing, as in production you will screw up your existing keys. You only need to be able to receive an SMS message on this number in order to finalize the authentication process, so you can use any number on which you can receive SMS (you can get a phone number via [Google Voice](https://voice.google.com) or [Twilio](https://twilio.com). Technically after you authenticate the bot you no longer need the number, but you may want to retain it so that someone else can't start using it.

* `HUBOT_SIGNAL_PASSWORD`: This is an arbitrary password string, but it must be the same between initializations.

When you first start the bot with the above parameters, it will have the Signal server send you a numeric code via SMS at the number you specified, and then exit. On the next startup, in addition to the above parameters:

* `HUBOT_SIGNAL_CODE`: This is the code you receive via SMS at the number above (without the dash/hyphen). When you start up the bot for the second time with this code, it will authenticate that you have control over the number and Hubot will respond to Signal messages sent to the number above. The `HUBOT_SIGNAL_CODE` parameter will be ignored on subsequent startups and can be ommitted thereafter.

## Todo

* [ ] More inline documentation.
* [ ] Figure out a way to effectively unit test.
* [ ] Threaded conversation support.
* [ ] Better attachment handling (Hubot provides no built-in attachment handling method).

## License
[<img src="https://www.gnu.org/graphics/agplv3-155x51.png" alt="AGPLv3" >](http://www.gnu.org/licenses/agpl-3.0.html)

Hubot-signal-service is a free software project licensed under the GNU General Public License v3.0 (GPLv3) by [Throneless Tech](https://throneless.tech).
