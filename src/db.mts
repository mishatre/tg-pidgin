
// Remember to set type: module in package.json or use .mjs extension
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

// File path
const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '../data.json');

interface Data {
    topics: {
        topicId: number;
        lastMessageId: number;
        name: string;
    }[];
    rosters: {
        name: string;
        jid: string;
    }[]
}

// Configure lowdb to write to JSONFile
const adapter = new JSONFile<Data>(file)
const db = new Low(adapter);

// Read data from JSON file, this will set db.data content
await db.read();
db.data ||= { topics: [], rosters: [] };
console.log(db.data)


// function getSenderTopicId(senderName: string) {

//     if (!db.data) {
//         throw new Error('UNINITIALIZED');
//     }

//     return db.data.senders.find(v => v.sender === senderName)?.threadId;

// }

// function getSenderInfoByTopicId(topicId: number) {

//     if (!db.data) {
//         throw new Error('UNINITIALIZED');
//     }

//     return db.data.senders.find(v => v.threadId === topicId)?.sender;

// }

// async function setSendersTopicId(senderName: string, threadId: number) {

//     if (!db.data) {
//         throw new Error('UNINITIALIZED');
//     }

//     const senderInfo = db.data.senders.find(v => v.sender === senderName);

//     if (senderInfo) {
//         senderInfo.threadId = threadId;
//     } else {
//         db.data.senders.push({
//             threadId: threadId,
//             sender: senderName,
//         });
//     }

//     await db.write();

// }

function getTopics() {
    if (!db.data) {
        throw new Error('UNINITIALIZED');
    }

    return db.data.topics;
}

async function setTopic(name: string, topicId: number) {

    if (!db.data) {
        throw new Error('UNINITIALIZED');
    }

    const topicInfo = db.data.topics.find(v => v.name === name);

    if (topicInfo) {
        topicInfo.topicId = topicId;
    } else {
        db.data.topics.push({
            topicId,
            lastMessageId: -1,
            name,
        });
    }

    await db.write();

}

async function setTopicLastMessageId(topicId: number, lastMessageId: number) {

    if (!db.data) {
        throw new Error('UNINITIALIZED');
    }

    db.data.topics = db.data.topics.map(v => {
        if (v.topicId === topicId) {
            return {...v, lastMessageId};
        }
        return v;
    });

    await db.write();

}

function getTopic(topicIdOrName: string | number) {

    if (!db.data) {
        throw new Error('UNINITIALIZED');
    }

    return db.data.topics.find(v => v.name === topicIdOrName || v.topicId === topicIdOrName);

}

async function removeTopic(topicId: number) {

    if (!db.data) {
        throw new Error('UNINITIALIZED');
    }

    db.data.topics.filter(v => v.topicId !== topicId);

    await db.write();
    
}

async function setRosters(items: { name: string, jid: Object }[]) {

    if (!db.data) {
        throw new Error('UNINITIALIZED');
    }

    db.data.rosters = items.map(v => ({ name: v.name, jid: v.jid.toString() }));

    await db.write();

}

async function findRoster(name: string) {

    if (!db.data) {
        throw new Error('UNINITIALIZED');
    }

    return db.data.rosters.find(v => v.name.startsWith(name) || v.jid.startsWith(name));

}

export {

    getTopics,

    setTopic,
    getTopic,
    removeTopic,
    setTopicLastMessageId,

    setRosters,
    findRoster
};