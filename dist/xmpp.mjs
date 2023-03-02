import { client, xml, } from '@xmpp/client';
import { EventEmitter } from 'node:events';
// @ts-ignore
import setupRoster from "@xmpp-plugins/roster";
class XMPP extends EventEmitter {
    xmpp;
    roster;
    constructor() {
        super();
        this.xmpp = client({
            service: "debian2019",
            domain: "debian2019",
            resource: "example",
            username: "369_mt",
            password: "1qazxsw2",
        });
        this.roster = setupRoster(this.xmpp);
        this.xmpp.on("online", this.#online.bind(this));
        this.xmpp.on("offline", this.#offline.bind(this));
        this.xmpp.on("stanza", this.#stanza.bind(this));
    }
    async #stanza(stanza) {
        if (stanza.is("message")) {
            this.#message(stanza);
        }
        else if (stanza.is("presence")) {
            this.#presence(stanza);
        }
        else {
            console.log(stanza.toString());
        }
    }
    async #online(jid) {
        console.log('XMPP is online');
        // Makes itself available
        await this.xmpp.send(xml("presence"));
        // await this.roster.get();
        // const response = await this.xmpp.iqCaller.request(
        //     xml('iq', {type: 'get'}, xml('query', {xmlns: 'jabber:iq:last'}))
        // );
        this.emit("online");
    }
    async #offline(jid) {
        console.log('XMPP is online');
        // Makes itself available
        await this.xmpp.send(xml("presence"));
        this.emit("offline");
    }
    async #message(message) {
        this.emit("message", message);
    }
    async #presence(presence) {
        const { to, from, type } = presence.attrs;
        const sender = from.split('/')[0];
        const show = presence.getChild("show")?.getText();
        const status = presence.getChild("status")?.getText();
        const online = type !== "unavailable";
        this.emit("status", sender, online, show, status);
    }
    async connect() {
        return new Promise(async (resolve) => {
            this.xmpp.on('connect', () => {
                return true;
            });
            try {
                await this.xmpp.start();
            }
            catch (error) {
                console.log(error);
                return false;
            }
        });
    }
    disconnect() {
        return new Promise(async (resolve) => {
            this.xmpp.on('disconnect', () => {
                return true;
            });
            try {
                await this.xmpp.stop();
            }
            catch (error) {
                console.log(error);
                return false;
            }
        });
    }
    async sendMessage(jid, text) {
        const message = xml("message", { type: "chat", to: jid }, xml("body", {}, text || ""));
        await this.xmpp.send(message);
    }
}
export default XMPP;
// // debug(xmpp, true);
// xmpp.on("error", (err) => {
//     console.error("error", err);
// });
// xmpp.on("offline", async () => {
//     await editGeneralTopicName("Offline");
// });
// xmpp.on("online", async (address) => {
//     console.log('XMPP is online');
//     await editGeneralTopicName("Online");
//     // Makes itself available
//     await xmpp.send(xml("presence"));
//     const rosterData = await roster.get();
//     db.setRosters(rosterData.items);
//     for (const { name, topicId } of db.getTopics()) {
//         const foundRoster = db.findRoster(name);
//         if(!foundRoster) {
//             continue;
//         }
//         //@ts-ignore
//         const response = await xmpp.iqCaller.request(
//             xml('iq', {type: 'get'}, xml('query', {xmlns: 'jabber:iq:last', to: '000_tst@debian2019'}))
//         );
//         const isOnline = response.getChild('query')?.attrs.seconds === '0';
//         await editTopicIcon(topicId, isOnline ? "5312016608254762256" : "5350344462612570293");
//     }
// });
// xmpp.on("stanza", async (stanza) => {
//     if (!stanza.is("message") || !stanza.attrs.from) {
//         return;
//     }
//     const { to, from } = stanza.attrs;
//     const sender = from.split('/')[0];
//     const messageBody = stanza.getChild("body")?.getText();
//     if (messageBody) {
//         const success = await sendXMPPMessageToTopic(sender, messageBody);
//         console.log("stanza", stanza.toString());
//     }
// });
