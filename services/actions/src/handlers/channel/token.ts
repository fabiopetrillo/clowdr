import { gql } from "graphql-request";
import { sdk } from "../../graphqlClient";
import { opentok } from "../../opentok";

export const getChannel = gql`
    query getChannel($channelId: uuid!) {
        Channel(where: { id: { _eq: $channelId } }) {
            vonage_session_id
        }
    }
`;

export default async function getChannelTokenHandler(
    input: getChannelTokenArgs
): Promise<GetChannelTokenOutput> {
    try {
        const result = await sdk.getChannel({ channelId: input.channelId });
        if (result.Channel.length === 1) {
            const token = opentok.generateToken(
                result.Channel[0].vonage_session_id,
                { data: "", role: "publisher" }
            );
            return { token };
        } else {
            throw new Error("Error while creating token");
        }
    } catch (e) {
        console.error("Error while creating token", e);
        throw new Error("Error while creating token: could not find channel.");
    }
}
