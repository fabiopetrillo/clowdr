import { GraphQLClient } from "graphql-request";
import { getSdk } from "./generated/graphql";

const useSecureProtocol = process.env.GRAPHQL_API_SECURE_PROTOCOLS !== "false";

const httpProtocol = useSecureProtocol ? "https" : "http";

const client = new GraphQLClient(
    `${httpProtocol}://${process.env.GRAPHQL_API_DOMAIN}/v1/graphql`,
    {
        headers: {
            "x-hasura-admin-secret": process.env.HASURA_ADMIN_SECRET ?? "",
        },
    }
);

const sdk = getSdk(client);

export { client, sdk };
