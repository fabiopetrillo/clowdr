import { gql } from "graphql-request";
import { sdk } from "../../graphqlClient";

export const createChannel = gql`
    mutation insert_Channel_one($name: String) {
        insert_Channel_one(object: { name: $name, vonage_session_id: "foo" }) {
            id
        }
    }
`;

export default async function createChannelHandler(
    name: string
): Promise<CreateChannelOutput> {
    const result = await sdk.insert_Channel_one({ name });
    if (result.insert_Channel_one?.id) {
        return {
            id: result.insert_Channel_one.id,
        };
    } else {
        throw new Error("Error creating channel: missing id");
    }
}
