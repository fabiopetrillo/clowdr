import { gql } from "graphql-request";
import { sdk } from "../../graphqlClient";
import { createSession } from "../../opentok";

export const createChannel = gql`
    mutation insert_Channel_one($name: String!, $vonage_session_id: String!) {
        insert_Channel_one(
            object: { name: $name, vonage_session_id: $vonage_session_id }
        ) {
            id
        }
    }
`;

export default async function createChannelHandler(
    name: string
): Promise<CreateChannelOutput> {
    let session;
    try {
        session = await createSession({ mediaMode: "routed" });
    } catch (e) {
        console.error("Error creating OpenTok session", e);
        throw new Error("Error creating session");
    }

    if (!session) {
        throw new Error("Error creating session");
    }

    const result = await sdk.insert_Channel_one({
        name,
        vonage_session_id: session.sessionId,
    });
    if (result.insert_Channel_one?.id) {
        return {
            id: result.insert_Channel_one.id,
        };
    } else {
        throw new Error("Error creating channel: missing id");
    }
}
