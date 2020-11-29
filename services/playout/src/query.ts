import { gql } from "@apollo/client";

gql`
    query getChannels {
        Channel {
            id
            name
            vonage_session_id
        }
    }
`;
