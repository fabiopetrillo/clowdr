import { gql } from "@apollo/client";

const _getChannels = gql`
    query getChannels {
        Channel {
            id
            name
            vonage_session_id
        }
    }
`;
