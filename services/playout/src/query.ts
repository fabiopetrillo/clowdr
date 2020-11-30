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

gql`
    mutation setRtmpUri($sessionId: uuid!, $rtmpUri: String!) {
        update_Channel(
            where: { id: { _eq: $sessionId } }
            _set: { rtmp_uri: $rtmpUri }
        ) {
            affected_rows
        }
    }
`;
