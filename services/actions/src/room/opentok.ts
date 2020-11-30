import OpenTok from "opentok";
import { promisify } from "util";

function initialiseOpenTok() {
    if (process.env.OPENTOK_API_KEY && process.env.OPENTOK_API_SECRET) {
        return new OpenTok(
            process.env.OPENTOK_API_KEY,
            process.env.OPENTOK_API_SECRET
        );
    } else {
        throw new Error(
            "OPENTOK_API_KEY and OPENTOK_API_SECRET environment vars must be set."
        );
    }
}

const opentok = initialiseOpenTok();
const createSession = promisify(opentok.createSession.bind(opentok));
const startBroadcast = promisify(opentok.startBroadcast.bind(opentok));
const stopBroadcast = promisify(opentok.stopBroadcast.bind(opentok));
const listBroadcasts = promisify(opentok.listBroadcasts.bind(opentok));

type WebhookReqBody =
    | ConnectionCreated
    | ConnectionDestroyed
    | StreamCreated
    | StreamDestroyed;

interface WebhookBase {
    sessionId: string;
    projectId: string;
    event: string;
    timestamp: number;
}

interface ConnectionCreated extends WebhookBase {
    event: "connectionCreated";
    connection: ConnectionData;
}

interface ConnectionDestroyed extends WebhookBase {
    event: "connectionDestroyed";
    reason: "clientDisconnected" | "forceDisconnected" | "networkDisconnected";
    connection: ConnectionData;
}

interface StreamCreated extends WebhookBase {
    event: "streamCreated";
    stream: StreamData;
}

interface StreamDestroyed extends WebhookBase {
    event: "streamDestroyed";
    reason:
        | "clientDisconnected"
        | "forceDisconnected"
        | "forceUnpublished"
        | "mediaStopped"
        | "networkDisconnected";
    stream: StreamData;
}

interface ConnectionData {
    id: string;
    createdAt: number;
    data: string;
}

interface StreamData {
    id: string;
    connection: ConnectionData;
    createdAt: number;
    name: string;
    videoType?: "camera" | "screen";
}

export {
    opentok,
    createSession,
    startBroadcast,
    listBroadcasts,
    stopBroadcast,
    WebhookReqBody,
};
