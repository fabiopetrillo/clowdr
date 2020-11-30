import { awsId, medialive } from "./aws";

async function createOrGetInputSecurityGroup(): Promise<string> {
    const securityGroups = await medialive.listInputSecurityGroups({});
    if (
        securityGroups.InputSecurityGroups &&
        securityGroups.InputSecurityGroups.length > 0 &&
        securityGroups.InputSecurityGroups[0].Id
    ) {
        return securityGroups.InputSecurityGroups[0].Id;
    } else {
        const securityGroup = await medialive.createInputSecurityGroup({
            WhitelistRules: [{ Cidr: "0.0.0.1/32" }],
        });
        if (!securityGroup.SecurityGroup?.Id) {
            throw new Error("Failed to create new InputSecurityGroup");
        }
        return securityGroup.SecurityGroup.Id;
    }
}

interface Input {
    id: string;
    rtmpUri: string;
}

async function createInput(
    roomName: string,
    securityGroupId: string
): Promise<Input> {
    const input = await medialive.createInput({
        Destinations: [{ StreamName: awsId() }],
        Tags: { roomName },
        Name: awsId(),
        Type: "RTMP_PUSH",
        InputSecurityGroups: [securityGroupId],
    });
    if (
        input.Input?.Id &&
        input.Input.Destinations &&
        input.Input.Destinations.length > 0 &&
        input.Input.Destinations[0].Url
    ) {
        return {
            id: input.Input.Id,
            rtmpUri: input.Input.Destinations[0].Url,
        };
    }
    throw new Error("Failed to create new Input");
}

async function createChannel(
    roomName: string,
    inputId: string,
    mediaPackageId: string
): Promise<string> {
    const destinationId = awsId();
    const videoDescriptionName = awsId();
    const audioDescriptionName = awsId();
    const channel = await medialive.createChannel({
        Name: awsId(),
        Tags: { roomName },
        ChannelClass: "SINGLE_PIPELINE",
        InputAttachments: [
            {
                InputAttachmentName: awsId(),
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
                    Name: audioDescriptionName,
                    AudioSelectorName: undefined,
                },
            ],
            OutputGroups: [
                {
                    Name: awsId(),
                    Outputs: [
                        {
                            OutputName: "1080p30",
                            VideoDescriptionName: videoDescriptionName,
                            AudioDescriptionNames: [audioDescriptionName],
                            OutputSettings: {
                                MediaPackageOutputSettings: {},
                            },
                        },
                    ],
                    OutputGroupSettings: {
                        MediaPackageGroupSettings: {
                            Destination: {
                                DestinationRefId: destinationId,
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
                    Name: videoDescriptionName,
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
                Id: destinationId,
                Settings: [],
                MediaPackageSettings: [{ ChannelId: mediaPackageId }],
            },
        ],
    });
    if (channel.Channel?.Id) {
        return channel.Channel.Id;
    }
    throw new Error("Failed to create new Channel");
}

async function deleteChannelResources(channelId: string): Promise<void> {
    console.log(`Cleaning up resources for MediaLive channel ${channelId}`);
    const channel = await medialive.describeChannel({ ChannelId: channelId });

    const inputIds = channel.InputAttachments?.map((input) => input.InputId);
    try {
        await medialive.deleteChannel({
            ChannelId: channelId,
        });
        // eslint-disable-next-line no-empty
    } catch (_) {}

    try {
        await Promise.all(
            inputIds?.map(async (inputId) => {
                await medialive.deleteInput({ InputId: inputId });
            }) ?? []
        );
        // eslint-disable-next-line no-empty
    } catch (_) {}
}

export {
    createChannel,
    createOrGetInputSecurityGroup,
    createInput,
    deleteChannelResources,
};
