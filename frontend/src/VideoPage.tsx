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
    useCreateChannelMutation,
    useSelectChannelsQuery,
} from "../../generated/graphql";
import { useForm } from "react-hook-form";
import React from "react";
import Column from "../Columns/Column";

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
            id
            name
        }
    }
`;

interface FormData {
    name: string;
}

export default function VideoPage(): JSX.Element {
    const [
        createChannelMutation,
        {
            loading: createChannelMutationLoading,
            error: createChannelMutationError,
        },
    ] = useCreateChannelMutation({ variables: { name: "empty" } });

    const { refetch } = useSelectChannelsQuery();

    const { register, errors, handleSubmit, formState } = useForm();

    async function onSubmit(data: FormData) {
        const result = await createChannelMutation({
            variables: {
                name: data.name,
            },
        });
        if (result.data) {
            await refetch();
        }
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
            <ChannelList />
        </Box>
    );
}

function ChannelList(): JSX.Element {
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
                    <li key={channel.id}>{channel.name}</li>
                ))}
            </ul>
        </Box>
    );
}
