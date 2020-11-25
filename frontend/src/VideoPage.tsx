import { gql } from "@apollo/client";
import {
    Box,
    Button,
    FormControl,
    FormErrorMessage,
    FormLabel,
    Input,
} from "@chakra-ui/react";
import {
    ChannelFieldsFragment,
    useCreateChannelMutation,
    useSelectChannelsQuery,
    useGetChannelTokenQuery,
} from "../../generated/graphql";
import { useForm } from "react-hook-form";
import React, { useEffect, useState } from "react";
import {
    OTSession,
    OTPublisher,
    OTStreams,
    OTSubscriber,
    preloadScript,
} from "opentok-react";

const _createChannel = gql`
    mutation createChannel($name: String!) {
        createChannel(name: $name) {
            id
        }
    }
`;

const _queryChannels = gql`
    query selectChannels {
        Channel {
            ...ChannelFields
        }
    }

    fragment ChannelFields on Channel {
        id
        name
        vonage_session_id
    }
`;

const _getChannelToken = gql`
    query getChannelToken($channelId: uuid!) {
        getChannelToken(channelId: $channelId) {
            token
        }
    }
`;

interface FormData {
    name: string;
}

export default preloadScript(VideoPage);

function VideoPage(): JSX.Element {
    const [createChannelMutation] = useCreateChannelMutation();
    const { refetch } = useSelectChannelsQuery();
    const { register, errors, handleSubmit, formState, reset } = useForm();
    const [selectedChannel, setSelectedChannel] = useState<
        ChannelFieldsFragment | undefined
    >();
    const openTokApiKey = import.meta.env.SNOWPACK_PUBLIC_OPENTOK_API_KEY;

    async function onSubmit(data: FormData) {
        const result = await createChannelMutation({
            variables: {
                name: data.name,
            },
        });
        if (result.data) {
            await refetch();
        }
        reset();
    }

    return (
        <Box>
            <form onSubmit={handleSubmit(onSubmit)}>
                <FormControl isInvalid={errors.name}>
                    <FormLabel htmlFor="name">Name</FormLabel>
                    <Input
                        type="text"
                        name="name"
                        id="name"
                        ref={register({ required: true })}
                    />
                    <FormErrorMessage>
                        {errors.name && "Name is required"}
                    </FormErrorMessage>
                </FormControl>
                <Button mt={4} type="submit" isLoading={formState.isSubmitting}>
                    Create video session
                </Button>
            </form>
            <ChannelList setSelectedChannel={setSelectedChannel} />
            {selectedChannel && (
                <Channel apiKey={openTokApiKey} channel={selectedChannel} />
            )}
        </Box>
    );
}

interface ChannelListProps {
    setSelectedChannel(channel: ChannelFieldsFragment): void;
}

function ChannelList(props: ChannelListProps): JSX.Element {
    const { loading, error, data } = useSelectChannelsQuery();

    return loading ? (
        error ? (
            <p>{error.message}</p>
        ) : (
            <>Loading</>
        )
    ) : (
        <Box>
            <ul>
                {data?.Channel.map((channel) => (
                    <li key={channel.id}>
                        <Button
                            as="a"
                            onClick={() => props.setSelectedChannel(channel)}
                        >
                            {channel.name}
                        </Button>
                    </li>
                ))}
            </ul>
        </Box>
    );
}

interface ChannelProps {
    apiKey: string;
    channel: ChannelFieldsFragment;
}

function Channel(props: ChannelProps): JSX.Element {
    // const [token, setToken] = useState<string | undefined>();
    const { loading, error, data } = useGetChannelTokenQuery({
        variables: { channelId: props.channel.id },
    });

    return error ? (
        <p>Error: {error.message}</p>
    ) : loading ? (
        <p>Loading</p>
    ) : (
        <OTSession
            apiKey={props.apiKey}
            sessionId={props.channel.vonage_session_id}
            token={data?.getChannelToken?.token ?? ""}
        >
            <OTPublisher />
            <OTStreams>
                <OTSubscriber />
            </OTStreams>
        </OTSession>
    );
}
