import { Channel, Input, InputSecurityGroup } from "@aws-sdk/client-medialive";
import bodyParser from "body-parser";
import express from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { is } from "typescript-is";
import { cloudfront } from "./cloudfront";
import { medialive } from "./medialive";
import { mediapackage } from "./mediapackage";

async function createInputSecurityGroup(): Promise<InputSecurityGroup> {
    const securityGroup = await medialive.createInputSecurityGroup({
        WhitelistRules: [{ Cidr: "0.0.0.1/32" }],
    });

    if (securityGroup.SecurityGroup) {
        return securityGroup.SecurityGroup;
    } else {
        throw new Error("No input security group returned");
    }
}

// async function getInputs(): Promise<Input[]> {
//     const existingInputs = await medialive.listInputs({});
//     if (existingInputs.Inputs) {
//         return existingInputs.Inputs;
//     } else {
//         throw new Error("No inputs returned");
//     }
// }

// async function getChannels(): Promise<ChannelSummary[]> {
//     const existingChannels = await medialive.listChannels({});
//     if (existingChannels.Channels) {
//         return existingChannels.Channels;
//     } else {
//         throw new Error("No channel list returned");
//     }
// }

async function createInput(name: string): Promise<Input> {
    const securityGroup = await createInputSecurityGroup();
    if (!securityGroup.Id) {
        throw new Error("ID missing from new input security group");
    }

    const input = await medialive.createInput({
        Destinations: [{ StreamName: `ml-input-stream-${name}` }],
        Name: `ml-input-${name}`,
        Type: "RTMP_PUSH",
        InputSecurityGroups: [securityGroup.Id],
    });
    if (input.Input) {
        return input.Input;
    } else {
        throw new Error("No input was returned");
    }
}

async function createChannel(
    inputId: string,
    name: string,
    mediaPackageId: string
): Promise<Channel> {
    const channel = await medialive.createChannel({
        Name: `ml-channel-${name}`,
        ChannelClass: "SINGLE_PIPELINE",
        InputAttachments: [
            {
                InputAttachmentName: `input-attachment-${name}`,
                InputId: inputId,
            },
        ],
        RoleArn: "arn:aws:iam::772617020864:role/MediaLiveAccessRole",
        EncoderSettings: {
            AudioDescriptions: [
                {
                    CodecSettings: {
                        AacSettings: {
                            InputType: "NORMAL",
                            Bitrate: 192000,
                            CodingMode: "CODING_MODE_2_0",
                            RawFormat: "NONE",
                            Spec: "MPEG4",
                            Profile: "LC",
                            RateControlMode: "CBR",
                            SampleRate: 48000,
                        },
                    },
                    AudioTypeControl: "FOLLOW_INPUT",
                    LanguageCodeControl: "FOLLOW_INPUT",
                    Name: "audio_ni9p5e",
                    AudioSelectorName: undefined,
                },
            ],
            OutputGroups: [
                {
                    Name: `output-group-${name}`,
                    Outputs: [
                        {
                            OutputName: "1080p30",
                            VideoDescriptionName: "video_si0fak",
                            AudioDescriptionNames: ["audio_ni9p5e"],
                            OutputSettings: {
                                MediaPackageOutputSettings: {},
                            },
                        },
                    ],
                    OutputGroupSettings: {
                        MediaPackageGroupSettings: {
                            Destination: {
                                DestinationRefId: `ml-output-${name}`,
                            },
                        },
                    },
                },
            ],
            TimecodeConfig: { Source: "EMBEDDED" },
            VideoDescriptions: [
                {
                    CodecSettings: {
                        H264Settings: {
                            AfdSignaling: "NONE",
                            ColorMetadata: "INSERT",
                            AdaptiveQuantization: "MEDIUM",
                            EntropyEncoding: "CABAC",
                            FlickerAq: "ENABLED",
                            ForceFieldPictures: "DISABLED",
                            FramerateControl: "SPECIFIED",
                            FramerateNumerator: 30,
                            FramerateDenominator: 1,
                            GopBReference: "DISABLED",
                            GopClosedCadence: 1,
                            GopNumBFrames: 2,
                            GopSize: 90,
                            GopSizeUnits: "FRAMES",
                            SubgopLength: "FIXED",
                            ScanType: "PROGRESSIVE",
                            Level: "H264_LEVEL_AUTO",
                            LookAheadRateControl: "MEDIUM",
                            NumRefFrames: 1,
                            ParControl: "SPECIFIED",
                            ParNumerator: 1,
                            ParDenominator: 1,
                            Profile: "MAIN",
                            RateControlMode: "CBR",
                            Syntax: "DEFAULT",
                            SceneChangeDetect: "ENABLED",
                            SpatialAq: "ENABLED",
                            TemporalAq: "ENABLED",
                            TimecodeInsertion: "DISABLED",
                        },
                    },
                    Height: 1080,
                    Name: "video_si0fak",
                    RespondToAfd: "NONE",
                    Sharpness: 50,
                    ScalingBehavior: "DEFAULT",
                    Width: 1920,
                },
            ],
        },
        InputSpecification: {
            Codec: "AVC",
            Resolution: "HD",
            MaximumBitrate: "MAX_20_MBPS",
        },
        Destinations: [
            {
                Id: `ml-output-${name}`,
                Settings: [],
                MediaPackageSettings: [{ ChannelId: mediaPackageId }],
            },
        ],
    });
    if (channel.Channel) {
        return channel.Channel;
    } else {
        throw new Error("No channel was returned");
    }
}

async function createMediaPackage(name: string): Promise<string> {
    const channel = await mediapackage.createChannel({
        Id: `mp-channel-${name}`,
    });
    if (!channel.Id) {
        throw new Error("No MediaPackage channel was returned");
    }
    return channel.Id;
}

async function createOriginEndpoint(
    mediaPackageId: string,
    name: string
): Promise<{ id: string; endpointUri: string }> {
    const originEndpoint = await mediapackage.createOriginEndpoint({
        ChannelId: mediaPackageId,
        Id: `mp-origin-endpoint-${name}`,
        HlsPackage: {
            AdMarkers: "NONE",
            IncludeIframeOnlyStream: false,
            PlaylistType: "EVENT",
            PlaylistWindowSeconds: 60,
            ProgramDateTimeIntervalSeconds: 0,
            SegmentDurationSeconds: 6,
            StreamSelection: {
                MaxVideoBitsPerSecond: 2147483647,
                MinVideoBitsPerSecond: 0,
                StreamOrder: "ORIGINAL",
            },
            UseAudioRenditionGroup: false,
        },
        Origination: "ALLOW",
        StartoverWindowSeconds: 300,
        TimeDelaySeconds: 0,
    });
    if (!originEndpoint.Id || !originEndpoint.Url) {
        throw new Error("No origin endpoint was returned");
    }
    return { id: originEndpoint.Id, endpointUri: originEndpoint.Url };
}

async function createDistribution(
    name: string,
    originEndpoint: { id: string; endpointUri: string }
): Promise<string> {
    const originEndpointDomain = new URL(originEndpoint.endpointUri).hostname;

    const distribution = await cloudfront.createDistribution({
        DistributionConfig: {
            Origins: {
                Items: [
                    {
                        Id: `mp-distribution-origin-${name}`,
                        DomainName: originEndpointDomain,
                        CustomOriginConfig: {
                            HTTPPort: 80,
                            HTTPSPort: 443,
                            OriginProtocolPolicy: "match-viewer",
                            OriginSslProtocols: {
                                Quantity: 3,
                                Items: ["TLSv1", "TLSv1.1", "TLSv1.2"],
                            },
                            OriginReadTimeout: 30,
                            OriginKeepaliveTimeout: 5,
                        },
                        ConnectionAttempts: 3,
                        ConnectionTimeout: 10,
                        OriginShield: {
                            Enabled: false,
                        },
                    },
                ],
                Quantity: 1,
            },
            DefaultCacheBehavior: {
                TargetOriginId: `mp-distribution-origin-${name}`,
                TrustedSigners: {
                    Enabled: false,
                    Quantity: 0,
                },
                TrustedKeyGroups: {
                    Enabled: false,
                    Quantity: 0,
                },
                ViewerProtocolPolicy: "redirect-to-https",
                AllowedMethods: {
                    Quantity: 2,
                    Items: ["HEAD", "GET"],
                    CachedMethods: {
                        Quantity: 2,
                        Items: ["HEAD", "GET"],
                    },
                },
                SmoothStreaming: false,
                Compress: false,
                LambdaFunctionAssociations: {
                    Quantity: 0,
                },
                FieldLevelEncryptionId: "",
                ForwardedValues: {
                    QueryString: true,
                    Cookies: {
                        Forward: "none",
                    },
                    Headers: {
                        Quantity: 0,
                    },
                    QueryStringCacheKeys: {
                        Quantity: 3,
                        Items: ["end", "m", "start"],
                    },
                },
                MinTTL: 0,
                DefaultTTL: 86400,
                MaxTTL: 31536000,
            },
            PriceClass: "PriceClass_100",
            CallerReference: `${new Date().getTime()}`,
            Comment: `CloudFront distribution for ${name}`,
            Enabled: true,
        },
    });

    if (!distribution.Distribution?.DomainName) {
        throw new Error("No distribution was returned");
    }
    return distribution.Distribution.DomainName;
}

export const app: express.Application = express();
app.use(bodyParser.json());

interface BroadcastReqBody {
    name: string;
}

type BroadcastResBody =
    | {
          type: "error";
          message: string;
      }
    | { type: "success"; hlsUri: string; rtmpUri: string };

app.post<ParamsDictionary, BroadcastResBody, BroadcastReqBody>(
    "/broadcast",
    async (req, res) => {
        if (!is<BroadcastReqBody>(req.body)) {
            console.log("Invalid input to /broadcast", req.body);
            res.status(500).json({
                message: "Invalid input to /broadcast",
                type: "error",
            });
            return;
        }

        const input = await createInput(req.body.name);

        if (!input.Id || !input.Destinations || !input.Destinations[0].Url) {
            res.status(500).json({
                type: "error",
                message: "Failed to create input",
            });
            return;
        }

        const mediaPackageId = await createMediaPackage(req.body.name);
        await createChannel(input.Id, req.body.name, mediaPackageId);
        const originEndpoint = await createOriginEndpoint(
            mediaPackageId,
            req.body.name
        );
        const distributionDomain = await createDistribution(
            req.body.name,
            originEndpoint
        );

        const finalUri = new URL(originEndpoint.endpointUri);
        finalUri.hostname = distributionDomain;

        res.status(200).json({
            type: "success",
            hlsUri: finalUri.toString(),
            rtmpUri: input.Destinations[0].Url,
        });
    }
);

type WebhookReqBody =
    | ConnectionCreated
    | ConnectionDestroyed
    | StreamCreated
    | StreamDestroyed;

interface WebhookBase {
    sessionId: string;
    projectId: string;
    event: string;
    timestamp: number;
}

interface ConnectionCreated extends WebhookBase {
    event: "connectionCreated";
    connection: ConnectionData;
}

interface ConnectionDestroyed extends WebhookBase {
    event: "connectionDestroyed";
    reason: "clientDisconnected" | "forceDisconnected" | "networkDisconnected";
    connection: ConnectionData;
}

interface StreamCreated extends WebhookBase {
    event: "streamCreated";
    stream: StreamData;
}

interface StreamDestroyed extends WebhookBase {
    event: "streamDestroyed";
    reason:
        | "clientDisconnected"
        | "forceDisconnected"
        | "forceUnpublished"
        | "mediaStopped"
        | "networkDisconnected";
    stream: StreamData;
}

interface ConnectionData {
    id: string;
    createdAt: number;
    data: string;
}

interface StreamData {
    id: string;
    connection: ConnectionData;
    createdAt: number;
    name: string;
    videoType?: "camera" | "screen";
}

interface WebhookResBody {}

app.post<ParamsDictionary, WebhookResBody, WebhookReqBody>(
    "/webhook",
    async (req, res) => {
        console.log("Received webhook call", req.body);
        if (is<BroadcastReqBody>(req.body)) {
            res.status(200).json({ message: "OK" });
        } else {
            res.status(200).json({ message: "Unexpected request" });
        }
    }
);

// app.get("/input/create", async (_req, res) => {
//     try {
//         const inputs = await getInputs();

//         if (inputs.length === 0) {
//             const newInput = await createInput();
//             console.log("Created new input", newInput.Id, newInput.Name);
//             res.status(200).json({
//                 message: `Created new input ${newInput.Id}`,
//             });
//         } else {
//             res.status(200).json({ message: "Input already exists" });
//         }
//     } catch (e) {
//         res.status(500).json(JSON.stringify(e));
//         throw e;
//     }
// });

// app.get("/channel/create", async (_req, res) => {
//     try {
//         const inputs = await getInputs();

//         if (inputs.length < 1 || !inputs[0].Id) {
//             throw new Error(
//                 "Can't create a channel without an input available"
//             );
//         }

//         const channels = await getChannels();

//         if (channels.length === 0) {
//             const newChannel = await createChannel(inputs[0].Id);
//             console.log("Created new channel", newChannel.Id, newChannel.Name);
//             res.status(200).json({
//                 message: `Created new channel ${newChannel.Id}`,
//             });
//         } else {
//             res.status(200).json({ message: "Input already exists" });
//         }
//     } catch (e) {
//         res.status(500).json(JSON.stringify(e));
//         throw e;
//     }
// });

const portNumber = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
export const server = app.listen(portNumber, function () {
    console.log(`App is listening on port ${process.env.PORT}!`);
});
