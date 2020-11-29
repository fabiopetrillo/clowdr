import { MediaPackage } from "@aws-sdk/client-mediapackage";
import { fromEnv } from "@aws-sdk/region-provider";

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS credentials");
}

export const mediapackage = new MediaPackage({
    apiVersion: "2017-10-14",
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    },
    region: fromEnv({ environmentVariableName: "AWS_REGION" }),
});
