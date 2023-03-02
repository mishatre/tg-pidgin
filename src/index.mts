
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

import XMPP from './xmpp.mjs';
import * as db from './db.mjs';

interface CreateTopicResponse {
    message_thread_id: number;
    name: string;
    icon_color: number;
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

if (!process.env.TELEGRAM_BOT_TOKEN) {
    dotenv.config();
}
if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Telegram bot token not provided");
}
if (!process.env.TELEGRAM_FORUM_CHAT) {
    throw new Error("Chat id for forum chat is not provided");
}
if (!process.env.XMPP_SERVICE ||
    !process.env.XMPP_USERNAME ||
    !process.env.XMPP_PASSWORD) {
    throw new Error("XMPP_SERVICE, XMPP_USERNAME, and XMPP_PASSWORD must be provided");
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_FORUM_CHAT;

const xmppClient = new XMPP(
    process.env.XMPP_SERVICE,
    process.env.XMPP_USERNAME,
    process.env.XMPP_PASSWORD
);

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {
    polling: true
});

async function editGeneralTopicName(name: string) {

    try {
        return await bot.editGeneralForumTopic(chatId, name);
    } catch(error) {
        return false
    }

}

async function editTopicIcon(topicId: number, iconId: string) {

    try {
        return await bot.editForumTopic(chatId, topicId, {
            icon_custom_emoji_id: iconId,
        });
    } catch(error) {
        return false;
    }

}

await bot.setMyCommands(
    [
        {
            command: 'online',
            description: 'Connect to XMPP server',
        },
        {
            command: 'offline',
            description: 'Disconnect from XMPP server',
        }
    ],
    {
        scope: {
            type: 'chat_administrators',
            chat_id: chatId,
        }
    }
);

bot.on('message', async (msg) => {

    if (msg.forum_topic_edited) {
        try {
            await bot.deleteMessage(chatId, String(msg.message_id));
        } catch (error) {}
        return;
    }

    if (msg.text?.startsWith('/')) {
        await bot.deleteMessage(chatId, String(msg.message_id));
        switch (msg.text.split("@")[0]) {
            case "/online": {
                await bot.sendChatAction(chatId, 'typing');
                const result = await xmppClient.connect();
                if (result) {
                    await editGeneralTopicName("Connecting");
                } else {
                    await editGeneralTopicName("Connecting error");
                }
                break;
            }
            case '/offline': {
                await bot.sendChatAction(chatId, 'typing');
                const result = await xmppClient.disconnect();
                if (result) {
                    await editGeneralTopicName("Disconnecting");
                } else {
                    await editGeneralTopicName("Disconnecting error");
                }
                break;
            }
        }
        return;
    }

    if (!msg.is_topic_message || !msg.message_thread_id) {

        if (msg.text?.length === 3) {

            const foundRoster = await db.findRoster(msg.text);
            if (!foundRoster) {
                await bot.sendMessage(chatId, `User not found: ${msg.text}`);
                return;
            }

            const topicInfo = db.getTopic(foundRoster.name);
            if (!topicInfo) {
                const response = await bot.createForumTopic(chatId, foundRoster.name) as unknown as CreateTopicResponse;
                await db.setTopic(foundRoster.name, response.message_thread_id);
            }

        }

        return;
    }

    const topicId = msg.message_thread_id;

    if (msg.forum_topic_closed) {
        // await bot.deleteForumTopic(chatId, topicId);
        // await db.removeTopic(topicId);
        return;
    } else if (msg.forum_topic_created) {

        const topicName = msg.forum_topic_created.name;
        const topicInfo = db.getTopic(topicName);
        if (topicInfo) {

            if (topicInfo.topicId !== topicId) {
                await bot.closeForumTopic(chatId, topicId);
                await bot.sendMessage(chatId, `Topic already exist: ${topicInfo.name}`);
            }

            // If topic was created by bot then we don't need to handle this event
            return;
        }

        const foundRoster = await db.findRoster(topicName);
        if (!foundRoster) {
            await bot.closeForumTopic(chatId, topicId);
            await bot.sendMessage(chatId, `User not found: ${msg.text}`);
            return;
        }

        await db.setTopic(foundRoster.name, topicId);
    
        return;

    } else if (msg.text) {

        const topicInfo = db.getTopic(topicId);
        if (!topicInfo) {
            await bot.closeForumTopic(chatId, topicId);
            await bot.sendMessage(chatId, `Topic not found: ${topicId}`);
            await db.removeTopic(topicId);
            return;
        }

        if (msg.message_id <= topicInfo.lastMessageId) {
            // Skip already sended messages
            return;
        }

        const foundRoster = await db.findRoster(topicInfo.name);
        if (!foundRoster) {
            await bot.closeForumTopic(chatId, topicId);
            await bot.sendMessage(chatId, `User not found: ${msg.text}`);
            await db.removeTopic(topicId);
            return;
        }

        await xmppClient.sendMessage(foundRoster.jid, msg.text);
        await db.setTopicLastMessageId(topicId, msg.message_id);

    }

});

await editGeneralTopicName('Started');

async function sendXMPPMessageToTopic(from: string, message: string) {

    const foundRoster = await db.findRoster(from);
    if (!foundRoster) {
        await bot.sendMessage(chatId, `User not found: ${from}. Message: ${message}`);
        return;
    }

    let topicInfo = db.getTopic(foundRoster.name);
    if (!topicInfo) {
        const response = await bot.createForumTopic(chatId, foundRoster.name) as unknown as CreateTopicResponse;
        await db.setTopic(foundRoster.name, response.message_thread_id);
        topicInfo = db.getTopic(foundRoster.name);
    }

    if (!topicInfo) {
        await bot.sendMessage(chatId, `Error creating topic for user: ${from}. Message: ${message}`);
        return;
    }

    await bot.sendMessage(chatId, message, {
        message_thread_id: topicInfo.topicId,

    });

}

xmppClient.on('status', async (sender, online, show, status) => {


    // const foundRoster = await db.findRoster(sender);
    // if (!foundRoster) {
    //     return;
    // }

    // let topicInfo = db.getTopic(foundRoster.name);
    // if (!topicInfo) {
    //     return;
    // }

    // console.log(sender, online, show);

    // if (online) {

    //     if (show === 'chat') {
    //         await editTopicIcon(topicInfo.topicId, '5312016608254762256');
    //     } else if (show === 'away') {
    //         await editTopicIcon(topicInfo.topicId, '5350344462612570293');
    //     } else if (show === 'dnd') {
    //         await editTopicIcon(topicInfo.topicId, '5377498341074542641');
    //     } else {
    //         await editTopicIcon(topicInfo.topicId, '5312016608254762256');
    //     }

    // } else {
    //     await editTopicIcon(topicInfo.topicId, '5312486108309757006');
    // }

});

xmppClient.on('message', async (message: any) => {

    const { to, from } = message.attrs;

    const sender = from.split('/')[0];
    const messageBody = message.getChild("body")?.getText();

    if (messageBody) {

        const success = await sendXMPPMessageToTopic(sender, messageBody);
        console.log("stanza", message.toString());
    }

});

xmppClient.on('online', async () => {
    await editGeneralTopicName("Online");
});

xmppClient.on('offline', async () => {
    await editGeneralTopicName("Offline");
});

await xmppClient.connect();