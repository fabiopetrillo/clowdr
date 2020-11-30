import { awsId, mediapackage } from "./aws";

async function createChannel(roomName: string): Promise<string> {
    const channel = await mediapackage.createChannel({
        Id: awsId(),
        Tags: { roomName },
    });
    if (!channel.Id) {
        throw new Error("Failed to create new MediaPackage Channel");
    }
    return channel.Id;
}

interface OriginEndpoint {
    id: string;
    endpointUri: string;
}

async function createOriginEndpoint(
    roomName: string,
    mediaPackageId: string
): Promise<OriginEndpoint> {
    const originEndpoint = await mediapackage.createOriginEndpoint({
        ChannelId: mediaPackageId,
        Tags: { roomName },
        Id: awsId(),
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
    if (originEndpoint.Id && originEndpoint.Url) {
        return { id: originEndpoint.Id, endpointUri: originEndpoint.Url };
    }
    throw new Error("Failed to create OriginEndpoint");
}

async function deleteChannelResources(channelId: string): Promise<void> {
    console.log(`Cleaning up resources for MediaPackage channel ${channelId}`);
    const channel = await mediapackage.describeChannel({ Id: channelId });

    const originEndpointIds = channel.HlsIngest?.IngestEndpoints?.map(
        (endpoint) => endpoint.Id
    );

    try {
        await Promise.all(
            originEndpointIds?.map(async (inputId) => {
                await mediapackage.deleteOriginEndpoint({ Id: inputId });
            }) ?? []
        );
        // eslint-disable-next-line no-empty
    } catch (_) {}

    try {
        await mediapackage.deleteChannel({ Id: channelId });
        // eslint-disable-next-line no-empty
    } catch (_) {}
}

export {
    createChannel,
    createOriginEndpoint,
    deleteChannelResources,
    OriginEndpoint,
};
