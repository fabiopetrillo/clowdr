import { CloudFront } from "@aws-sdk/client-cloudfront";
import { MediaLive } from "@aws-sdk/client-medialive";
import { MediaPackage } from "@aws-sdk/client-mediapackage";
import { fromEnv } from "@aws-sdk/region-provider";
import { Credentials } from "@aws-sdk/types";
import { customAlphabet } from "nanoid";

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
        "Missing AWS credentials: AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY"
    );
}

const credentials: Credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

if (!process.env.AWS_REGION) {
    throw new Error("Missing AWS_REGION");
}

const region = fromEnv({ environmentVariableName: "AWS_REGION" });

const medialive = new MediaLive({
    apiVersion: "2017-10-14",
    credentials,
    region,
});

const mediapackage = new MediaPackage({
    apiVersion: "2017-10-14",
    credentials,
    region,
});

const cloudfront = new CloudFront({
    apiVersion: "2020-05-31",
    credentials,
    region,
});

const awsId = customAlphabet("abcdefghijklmnopqrstuvwxyz1234567890", 10);

export { mediapackage, medialive, cloudfront, awsId };
