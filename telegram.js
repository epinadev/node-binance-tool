// Per https://github.com/yagop/node-telegram-bot-api/issues/540#issuecomment-372475173
process.env.NTBA_FIX_319 = 1;

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHATID = process.env.TELEGRAM_CHATID;

class TeleBot {
    constructor(polling = false) {
        this.bot = new TelegramBot(TOKEN, { polling: polling });

        if (polling) this.initEvents();
    }

    send(message) {
        try {
            this.bot.sendMessage(CHATID, message, { parse_mode: 'html' });
        } catch (err) {
            console.log('Error sending telegram message', err);
        }
    }

    initEvents() {
        this.bot.onText(/\/cmd (.+)/, (msg, command) => {
            const chatId = msg.chat.id;
            const commandStr = command[1];

            console.log(commandStr);
            // answer with resp message
            this.bot.sendMessage(chatId, `I received ${commandStr}`);
        });
    }
}

module.exports.TeleBot = TeleBot;
