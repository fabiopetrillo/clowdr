import { gql } from "@apollo/client";
import { Button, Divider, Heading } from "@chakra-ui/react";
import {
    OTPublisher,
    OTSession,
    OTStreams,
    OTSubscriber,
    preloadScript,
} from "opentok-react";
import React, { useEffect, useMemo, useState } from "react";
import {
    RoomFieldsFragment,
    useAllRoomsSubscription,
    useGenerateVonageTokenMutation,
} from "../../generated/graphql";

gql`
    subscription AllRooms {
        Room {
            ...RoomFields
        }
    }

    fragment RoomFields on Room {
        id
        hlsUri
        name
        vonageSessionId
    }
`;

export default preloadScript(RoomsPage);

function RoomsPage(): JSX.Element {
    const { loading, error, data } = useAllRoomsSubscription();
    const [room, setRoom] = useState<RoomFieldsFragment | undefined>();

    const contents = useMemo(() => {
        if (error) {
            return <p>{JSON.stringify(error)}</p>;
        }
        if (loading) {
            return <p>Loading...</p>;
        }
        if (data) {
            return data?.Room.map((room) => (
                <li key={room.id}>
                    <Button as="a" onClick={() => setRoom(room)}>
                        {room.name}
                    </Button>
                </li>
            ));
        }
        return <p>Error</p>;
    }, [data, error, loading]);

    return (
        <>
            <Heading
                as="h1"
                fontSize="4.25rem"
                lineHeight="4.25rem"
                fontWeight="thin"
                marginBottom="4rem"
            >
                Rooms
            </Heading>

            <Divider marginBottom="1rem" />
            {contents}
            <Divider marginBottom="1rem" />
            {room && <Room room={room} />}
        </>
    );
}

interface RoomProps {
    room: RoomFieldsFragment;
}

gql`
    mutation GenerateVonageToken($roomId: uuid!) {
        generateVonageToken(roomId: $roomId) {
            token
        }
    }
`;

function Room(props: RoomProps): JSX.Element {
    const [
        generateVonageTokenMutation,
        { data, loading, error },
    ] = useGenerateVonageTokenMutation({
        variables: {
            roomId: props.room.id,
        },
    });

    useEffect(() => {
        generateVonageTokenMutation();
    }, [generateVonageTokenMutation]);

    const openTokApiKey = import.meta.env.SNOWPACK_PUBLIC_OPENTOK_API_KEY;

    return error ? (
        <p>Error: {error}</p>
    ) : loading ? (
        <p>Loading...</p>
    ) : data ? (
        <OTSession
            apiKey={openTokApiKey}
            sessionId={props.room.vonageSessionId ?? ""}
            token={data.generateVonageToken?.token ?? ""}
        >
            <OTPublisher />
            <OTStreams>
                <OTSubscriber />
            </OTStreams>
        </OTSession>
    ) : (
        <p>Error</p>
    );
}
