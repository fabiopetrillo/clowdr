import { CloudFront } from "@aws-sdk/client-cloudfront";
import { fromEnv } from "@aws-sdk/region-provider";

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS credentials");
}

export const cloudfront = new CloudFront({
    apiVersion: "2020-05-31",
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    },
    region: fromEnv({ environmentVariableName: "AWS_REGION" }),
});
