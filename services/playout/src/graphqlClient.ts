import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";

const useSecureProtocols = process.env.GRAPHQL_API_SECURE_PROTOCOLS !== "false";
const httpProtocol = useSecureProtocols ? "https" : "http";
const wsProtocol = useSecureProtocols ? "wss" : "ws";

const httpLink = new HttpLink({
    uri: `${httpProtocol}://${process.env.GRAPHQL_API_DOMAIN}/v1/graphql`,
});

const wsLink = new WebSocketLink({
    uri: `${wsProtocol}://${process.env.GRAPHQL_API_DOMAIN}/v1/graphql`, // use wss for a secure endpoint
    options: {
        reconnect: true,
        connectionParams: async () => {
            return {
                headers: {
                    "x-hasura-admin-secret": process.env.HASURA_ADMIN_SECRET,
                },
            };
        },
    },
});

const link = split(
    ({ query }) => {
        const definition = getMainDefinition(query);
        return (
            definition.kind === "OperationDefinition" &&
            definition.operation === "subscription"
        );
    },
    wsLink,
    httpLink
);

const cache = new InMemoryCache();

export const client = new ApolloClient({
    link,
    cache,
    defaultOptions: {
        query: {
            partialRefetch: true,
            // TODO: Remove cast to any when this Apollo Client issue is resolved:
            //       https://github.com/apollographql/apollo-client/issues/6177
        } as any,
    },
});
