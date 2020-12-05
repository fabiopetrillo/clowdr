import { gql } from "@apollo/client/core";
import fs from "fs/promises";
import path from "path";
import slugify from "slugify";
import {
    CompleteRoomDocument,
    GetRoomBySessionIdDocument,
    GetRoomDocument,
} from "../generated/graphql";
import { client } from "../graphqlClient";
import { Payload } from "../types/event";
import { awsId, cloudformation, shortId } from "./aws";
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
    cloudFormationStackId: string | null;
    rtmpUri: string | null;
    hlsUri: string | null;
}

gql`
    mutation completeRoom(
        $id: uuid!
        $hlsUri: String!
        $cloudFormationStackId: String!
        $rtmpUri: String!
        $vonageSessionId: String!
    ) {
        update_Room(
            where: { id: { _eq: $id } }
            _set: {
                hlsUri: $hlsUri
                cloudFormationStackId: $cloudFormationStackId
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

    console.log(`Creating AWS pipeline for room ${roomName}`);

    const slug = `${shortId()}-${slugify(roomName, {
        lower: true,
        strict: true,
        locale: "en",
    }).substring(0, 7)}`;

    const channelTemplate = await fs.readFile(
        path.join(__dirname, "channelTemplate.yaml")
    );

    if (!channelTemplate) {
        throw new Error("Could not load channelTemplate.yaml");
    }

    const stackCreation = await cloudformation.createStack({
        StackName: `channel-${slug}`,
        Capabilities: ["CAPABILITY_IAM"],
        Parameters: [
            { ParameterKey: "RoomName", ParameterValue: slug },
            {
                ParameterKey: "S3BucketName",
                ParameterValue: "clowdr-1u2k34j12923uy",
            },
        ],

        TemplateBody: channelTemplate.toString(),
    });

    const stack = await cloudformation.describeStacks({
        StackName: stackCreation.StackId ?? `channel-${slug}`,
    });

    if (!stack.Stacks || !stack.Stacks[0].StackId) {
        throw new Error("No CloudFormation stacks found");
    }

    console.log(
        `Created channel as CloudFormation stack ${stack.Stacks[0].StackId}`
    );

    const rtmpUri = stack.Stacks[0].Outputs?.find(
        (output) => output.OutputKey === "RtmpUri"
    )?.OutputValue;
    const originEndpointUri = stack.Stacks[0].Outputs?.find(
        (output) => output.OutputKey === "OriginEndpointUri"
    )?.OutputValue;
    const distributionDomain = stack.Stacks[0].Outputs?.find(
        (output) => output.OutputKey === "DistributionDomain"
    )?.OutputValue;

    if (!rtmpUri || !originEndpointUri || !distributionDomain) {
        throw new Error(
            "Did not receive expected outputs from CloudFormation stack"
        );
    }

    const finalUri = new URL(originEndpointUri);
    finalUri.hostname = distributionDomain;

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
            cloudFormationStackId: stack.Stacks[0].StackId,
            hlsUri: finalUri.toString(),
            rtmpUri: rtmpUri,
            vonageSessionId: session.sessionId,
        },
    });
    console.log(`Handled creation of room ${roomName}`);
}

async function handleRoomDeleted(payload: Payload<Room>): Promise<void> {
    console.log(`Deleted room ${payload.event.data.old?.name ?? "<unknown>"}`);

    if (!payload.event.data.old) {
        throw new Error("No old data");
    }

    if (payload.event.data.old.cloudFormationStackId) {
        await cloudformation.deleteStack({
            StackName: payload.event.data.old.cloudFormationStackId,
        });
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

    const rtmpUri = result.data.Room[0].rtmpUri;
    const rtmpUriParts = rtmpUri.split("/");
    const streamName = rtmpUriParts[rtmpUriParts.length - 1];
    const serverUrl = rtmpUri.substring(0, rtmpUri.length - streamName.length);

    console.log("Starting broadcast", { serverUrl, streamName });

    await startBroadcast(payload.sessionId, {
        layout: { type: "bestFit" },
        outputs: {
            rtmp: [
                {
                    id: awsId(),
                    serverUrl,
                    streamName,
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

// gql`
//     query getMediaLiveChannel($roomId: uuid!) {
//         Room(where: { id: { _eq: $roomId } }) {
//             mediaLiveChannelId
//         }
//     }
// `;

// async function handleSwitch(roomId: string): Promise<void> {
// const result = await client.query({
//     query: GetMediaLiveChannelDocument,
//     variables: {
//         roomId,
//     },
// });
// if (
//     !result.data.Room ||
//     result.data.Room.length !== 1 ||
//     !result.data.Room[0].mediaLiveChannelId
// ) {
//     throw new Error("No MediaLive channel for this Room");
// }
// await medialive.batchUpdateSchedule({
//     ChannelId: result.data.Room[0].mediaLiveChannelId,
//     Creates: {
//         ScheduleActions: [
//             {
//                 ActionName: awsId(),
//                 ScheduleActionSettings: {},
//                 ScheduleActionStartSettings: {
//                     ImmediateModeScheduleActionStartSettings: {},
//                 },
//             },
//         ],
//     },
// });
// }

export {
    Room,
    handleRoomDeleted,
    handleRoomCreated,
    handleWebhook,
    handleGenerateToken,
};
