import { gql } from "@apollo/client/core";
import {
    CompleteRoomDocument,
    GetRoomBySessionIdDocument,
    GetRoomDocument,
} from "../generated/graphql";
import { client } from "../graphqlClient";
import { Payload } from "../types/event";
import { awsId } from "./aws";
import {
    createDistribution,
    deleteDistributionResources,
} from "./awsCloudFront";
import {
    createChannel as createMediaLiveChannel,
    createInput,
    createOrGetInputSecurityGroup,
    deleteChannelResources as deleteMediaLiveChannelResources,
} from "./awsMediaLive";
import {
    createChannel as createMediaPackageChannel,
    createOriginEndpoint,
    deleteChannelResources as deleteMediaPackageChannelResources,
} from "./awsMediaPackage";
import {
    createSession,
    listBroadcasts,
    opentok,
    startBroadcast,
    WebhookReqBody,
} from "./opentok";

interface Room {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    vonageSessionId: string | null;
    rtmpUri: string | null;
    hlsUri: string | null;
    mediaLiveChannelId: string | null;
    mediaPackageChannelId: string | null;
    cloudfrontDistributionId: string | null;
}

gql`
    mutation completeRoom(
        $id: uuid!
        $cloudfrontDistributionId: String!
        $hlsUri: String!
        $mediaLiveChannelId: String!
        $mediaPackageChannelId: String!
        $rtmpUri: String!
        $vonageSessionId: String!
    ) {
        update_Room(
            where: { id: { _eq: $id } }
            _set: {
                cloudfrontDistributionId: $cloudfrontDistributionId
                hlsUri: $hlsUri
                mediaLiveChannelId: $mediaLiveChannelId
                mediaPackageChannelId: $mediaPackageChannelId
                rtmpUri: $rtmpUri
                vonageSessionId: $vonageSessionId
            }
        ) {
            affected_rows
        }
    }
`;

async function handleRoomCreated(payload: Payload<Room>): Promise<void> {
    console.log(`Room ${payload.event.data.new?.name} created`);

    if (!payload.event.data.new) {
        throw new Error("No new data");
    }

    const roomName = payload.event.data.new.name;

    let channelId: string | undefined;
    let mediaPackageChannelId: string | undefined;
    try {
        console.log(`Creating AWS pipeline for room ${roomName}`);
        const securityGroupId = await createOrGetInputSecurityGroup();
        const input = await createInput(roomName, securityGroupId);
        mediaPackageChannelId = await createMediaPackageChannel(roomName);
        channelId = await createMediaLiveChannel(
            roomName,
            input.id,
            mediaPackageChannelId
        );
        const originEndpoint = await createOriginEndpoint(
            roomName,
            mediaPackageChannelId
        );
        const distribution = await createDistribution(roomName, originEndpoint);

        const finalUri = new URL(originEndpoint.endpointUri);
        finalUri.hostname = distribution.domain;

        console.log(`Creating OpenTok session for room ${roomName}`);
        const session = await createSession({ mediaMode: "routed" });
        if (!session?.sessionId) {
            throw new Error("Failed to create OpenTok session");
        }

        console.log(`Updating entry for room ${roomName}`);
        await client.mutate({
            mutation: CompleteRoomDocument,
            variables: {
                id: payload.event.data.new.id,
                cloudfrontDistributionId: distribution.id,
                mediaLiveChannelId: channelId,
                mediaPackageChannelId: mediaPackageChannelId,
                hlsUri: finalUri.toString(),
                rtmpUri: input.rtmpUri,
                vonageSessionId: session.sessionId,
            },
        });
        console.log(`Handled creation of room ${roomName}`);
    } catch (e) {
        console.error("Error while handling room creation", e);
        if (channelId) {
            try {
                await deleteMediaLiveChannelResources(channelId);
                // eslint-disable-next-line no-empty
            } catch (_) {}
        }
        if (mediaPackageChannelId) {
            try {
                await deleteMediaPackageChannelResources(mediaPackageChannelId);
                // eslint-disable-next-line no-empty
            } catch (_) {}
        }
        throw e;
    }
}

async function handleRoomDeleted(payload: Payload<Room>): Promise<void> {
    console.log(`Deleted room ${payload.event.data.old?.name ?? "<unknown>"}`);

    if (!payload.event.data.old) {
        throw new Error("No old data");
    }

    if (payload.event.data.old.mediaLiveChannelId) {
        console.log("Cleaning up MediaLive resources");
        await deleteMediaLiveChannelResources(
            payload.event.data.old.mediaLiveChannelId
        );
    }

    if (payload.event.data.old.mediaPackageChannelId) {
        console.log("Cleaning up MediaPackage resources");
        await deleteMediaPackageChannelResources(
            payload.event.data.old.mediaPackageChannelId
        );
    }

    if (payload.event.data.old.cloudfrontDistributionId) {
        console.log("Cleaning up CloudFront resources");
        await deleteDistributionResources(
            payload.event.data.old.cloudfrontDistributionId
        );
    }

    console.log(`Handled deletion of room ${payload.event.data.old.name}`);
}

gql`
    query getRoomBySessionId($vonageSessionId: String!) {
        Room(where: { vonageSessionId: { _eq: $vonageSessionId } }) {
            rtmpUri
        }
    }
`;

async function handleWebhook(payload: WebhookReqBody): Promise<void> {
    if (payload.event !== "connectionCreated") {
        return;
    }
    const broadcasts = await listBroadcasts({
        sessionId: payload.sessionId,
    });
    if (broadcasts && broadcasts?.length > 0) {
        return;
    }
    const result = await client.query({
        variables: { vonageSessionId: payload.sessionId },
        query: GetRoomBySessionIdDocument,
    });
    if (result.data.Room.length !== 1) {
        throw new Error("Room matching sessionId not found");
    }
    if (!result.data.Room[0].rtmpUri) {
        throw new Error("No RTMP URI set");
    }
    await startBroadcast(payload.sessionId, {
        layout: { type: "bestFit" },
        outputs: {
            rtmp: [
                {
                    id: awsId(),
                    serverUrl: result.data.Room[0].rtmpUri,
                    streamName: "broadcast",
                },
            ],
        },
    });
}

gql`
    query getRoom($roomId: uuid!) {
        Room(where: { id: { _eq: $roomId } }) {
            vonageSessionId
        }
    }
`;

async function handleGenerateToken(roomId: string): Promise<string> {
    const result = await client.query({
        query: GetRoomDocument,
        variables: { roomId },
    });
    if (result.data.Room.length !== 1) {
        throw new Error("Did not find a Room to generate the token for");
    }
    if (!result.data.Room[0].vonageSessionId) {
        throw new Error("No session associated with this room");
    }
    const token = opentok.generateToken(result.data.Room[0].vonageSessionId, {
        data: "",
        role: "publisher",
    });
    return token;
}

export {
    Room,
    handleRoomDeleted,
    handleRoomCreated,
    handleWebhook,
    handleGenerateToken,
};
