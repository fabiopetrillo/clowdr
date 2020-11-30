import { gql } from "graphql-request";
import { sdk } from "../../graphqlClient";
import { createSession } from "../../opentok";

gql`
    mutation createChannel(
        $name: String!
        $vonage_session_id: String!
        $hls_uri: String!
        $rtmp_uri: String!
    ) {
        insert_Channel_one(
            object: {
                name: $name
                vonage_session_id: $vonage_session_id
                hls_uri: $hls_uri
                rtmp_uri: $rtmp_uri
            }
        ) {
            id
        }
    }
`;

export default async function createChannelHandler(
    name: string,
    rtmpUri: string,
    hlsUri: string
): Promise<CreateChannelOutput> {
    let session;
    try {
        session = await createSession({ mediaMode: "routed" });
        if (!session?.sessionId) {
            throw new Error("Failed to create OpenTok session");
        }
    } catch (e) {
        console.error("Error creating OpenTok session", JSON.stringify(e));
        throw new Error("Error creating session");
    }

    if (!session) {
        throw new Error("Error creating session");
    }

    const result = await sdk.createChannel({
        name,
        vonage_session_id: session.sessionId,
        hls_uri: hlsUri,
        rtmp_uri: rtmpUri
    });
    if (result.insert_Channel_one?.id) {
        return {
            id: result.insert_Channel_one.id,
        };
    } else {
        throw new Error("Error creating channel: missing id");
    }
}
