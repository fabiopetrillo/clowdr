import { Captions, InputCaptions } from "@aws-sdk/client-elastic-transcoder";
import {
    AacCodingMode,
    AacRateControlMode,
    AacVbrQuality,
    AudioCodec,
    AudioDescription,
    AudioSelectorType,
    CaptionDestinationType,
    CaptionSourceType,
    ContainerType,
    FileSourceConvert608To708,
    H264RateControlMode,
    OutputGroupType,
    VideoCodec,
    VideoDescription,
} from "@aws-sdk/client-mediaconvert";
import { AWSJobStatus, TranscodeDetails, VideoContentBlob } from "@clowdr-app/shared-types/build/content";
import { TranscodeMode } from "@clowdr-app/shared-types/build/sns/mediaconvert";
import AmazonS3URI from "amazon-s3-uri";
import assert from "assert";
import R from "ramda";
import { is } from "typescript-is";
import { v4 as uuidv4 } from "uuid";
import { ContentItemAddNewVersionDocument } from "../generated/graphql";
import { apolloClient } from "../graphqlClient";
import { ElasticTranscoder, MediaConvert } from "./aws/awsClient";
import { addNewContentItemVersion, createNewVersionFromPreviewTranscode, getLatestVersion } from "./contentItem";

interface StartTranscodeOutput {
    jobId: string;
    timestamp: Date;
}

export const videoDescription: VideoDescription = {
    CodecSettings: {
        Codec: VideoCodec.H_264,
        H264Settings: {
            MaxBitrate: 6000000,
            RateControlMode: H264RateControlMode.QVBR,
            QvbrSettings: {
                QvbrQualityLevel: 9,
            },
        },
    },
};

export const audioDescription: AudioDescription = {
    CodecSettings: {
        Codec: AudioCodec.AAC,
        AacSettings: {
            CodingMode: AacCodingMode.CODING_MODE_2_0,
            SampleRate: 48000,
            VbrQuality: AacVbrQuality.MEDIUM_HIGH,
            RateControlMode: AacRateControlMode.VBR,
        },
    },
};

export async function startPreviewTranscode(s3InputUrl: string, contentItemId: string): Promise<StartTranscodeOutput> {
    console.log(`Creating preview MediaConvert job for ${s3InputUrl}`);

    assert(MediaConvert, "AWS MediaConvert client is not initialised");
    const result = await MediaConvert.createJob({
        Role: process.env.AWS_MEDIACONVERT_SERVICE_ROLE_ARN,
        UserMetadata: {
            contentItemId,
            mode: TranscodeMode.PREVIEW,
            environment: process.env.AWS_PREFIX ?? "unknown",
        },
        Settings: {
            Inputs: [
                {
                    FileInput: s3InputUrl,
                    AudioSelectors: {
                        "Audio Selector 1": {
                            SelectorType: AudioSelectorType.TRACK,
                        },
                    },
                },
            ],
            OutputGroups: [
                {
                    CustomName: "File Group",
                    OutputGroupSettings: {
                        FileGroupSettings: {
                            Destination: `s3://${process.env.AWS_CONTENT_BUCKET_ID}/`,
                        },
                        Type: OutputGroupType.FILE_GROUP_SETTINGS,
                    },
                    Outputs: [
                        {
                            NameModifier: "-preview",
                            ContainerSettings: {
                                Mp4Settings: {},
                                Container: ContainerType.MP4,
                            },
                            VideoDescription: videoDescription,
                            AudioDescriptions: [audioDescription],
                        },
                    ],
                },
            ],
        },
    });

    assert(result.Job?.Id && result.Job.CreatedAt, `Failed to create MediaConvert preview job for ${s3InputUrl}`);

    console.log(`Started preview MediaConvert job for ${s3InputUrl} (id: ${result.Job?.Id})`);

    return {
        jobId: result.Job.Id,
        timestamp: result.Job.CreatedAt,
    };
}

export async function startElasticBroadcastTranscode(
    s3VideoUrl: string,
    s3CaptionsUrl: string | null,
    videoRenderJobId: string
): Promise<StartTranscodeOutput> {
    console.log(`Create broadcast Elastic Transcoder job for ${s3VideoUrl}`);

    assert(ElasticTranscoder, "AWS Elastic Transcoder client is not initialised");

    // Get or create the existing Elastic Transcoder pipeline (CloudFormation/CDK doesn't support ET)
    let pipeline;
    const allPipelines = await ElasticTranscoder.listPipelines({});
    pipeline = allPipelines.Pipelines?.find((pipeline) => pipeline.Name === process.env.AWS_PREFIX);

    if (!pipeline) {
        const output = await ElasticTranscoder.createPipeline({
            InputBucket: process.env.AWS_CONTENT_BUCKET_ID,
            Name: process.env.AWS_PREFIX,
            Role: process.env.AWS_ELASTIC_TRANSCODER_SERVICE_ROLE_ARN,
            OutputBucket: process.env.AWS_CONTENT_BUCKET_ID,
            Notifications: {
                Completed: process.env.AWS_ELASTIC_TRANSCODER_NOTIFICATIONS_TOPIC_ARN,
                Error: process.env.AWS_ELASTIC_TRANSCODER_NOTIFICATIONS_TOPIC_ARN,
                Progressing: process.env.AWS_ELASTIC_TRANSCODER_NOTIFICATIONS_TOPIC_ARN,
                Warning: process.env.AWS_ELASTIC_TRANSCODER_NOTIFICATIONS_TOPIC_ARN,
            },
        });
        pipeline = output.Pipeline;
    }

    assert(
        pipeline,
        `Failed to get or create AWS Elastic Transcoder pipeline for bucket ${process.env.AWS_CONTENT_BUCKET_ID}`
    );

    const { bucket: videoBucket, key: videoKey } = new AmazonS3URI(s3VideoUrl);
    assert(
        process.env.AWS_CONTENT_BUCKET_ID === videoBucket,
        `Cannot transcode a video that is not in the expected content bucket: ${s3VideoUrl}`
    );
    assert(videoKey, `Could not retrieve key from video S3 URL: ${s3VideoUrl}`);

    let inputCaptions: { InputCaptions?: InputCaptions } = {};
    let outputCaptions: { Captions?: Captions } = {};
    if (s3CaptionsUrl) {
        const { bucket: captionsBucket, key: captionsKey } = new AmazonS3URI(s3CaptionsUrl);
        assert(
            process.env.AWS_CONTENT_BUCKET_ID === captionsBucket,
            `Cannot use captions that are not in the expected content bucket: ${s3CaptionsUrl}`
        );
        assert(captionsKey, `Could not retrieve key from captions S3 URL: ${s3CaptionsUrl}`);
        inputCaptions = {
            InputCaptions: {
                MergePolicy: "Override",
                CaptionSources: [
                    {
                        Key: captionsKey,
                        Language: "eng",
                        Label: "English",
                    },
                ],
            },
        };
        outputCaptions = {
            Captions: {
                CaptionFormats: [{ Format: "cea-708" }],
            },
        };
    }

    const outputKey = `${uuidv4()}.mp4`;

    const jobOutput = await ElasticTranscoder.createJob({
        PipelineId: pipeline.Id,
        Inputs: [
            {
                Key: videoKey,
                ...inputCaptions,
            },
        ],
        Output: {
            Key: outputKey,
            PresetId: "1351620000001-000001", // "Generic 1080p"
            ...outputCaptions,
        },
        UserMetadata: {
            videoRenderJobId,
            bucket: process.env.AWS_CONTENT_BUCKET_ID,
        },
    });

    assert(jobOutput.Job?.Id, `Failed to start Elastic Transcoder job for ${s3VideoUrl}`);

    return {
        jobId: jobOutput.Job.Id,
        timestamp: new Date(),
    };
}

export async function startBroadcastTranscode(
    s3VideoUrl: string,
    s3CaptionsUrl: string | null,
    videoRenderJobId: string
): Promise<StartTranscodeOutput> {
    console.log(`Creating broadcast MediaConvert job for ${s3VideoUrl}`);

    assert(MediaConvert, "AWS MediaConvert client is not initialised");

    const captionSelector = s3CaptionsUrl
        ? {
              CaptionSelectors: {
                  "Caption Selector 1": {
                      SourceSettings: {
                          SourceType: CaptionSourceType.SRT,
                          FileSourceSettings: {
                              Convert608To708: FileSourceConvert608To708.UPCONVERT,
                              SourceFile: s3CaptionsUrl,
                          },
                      },
                  },
              },
          }
        : {};

    const captionDescriptions = s3CaptionsUrl
        ? [
              {
                  CaptionSelectorName: "Caption Selector 1",
                  CustomLanguageCode: "eng",
                  DestinationSettings: {
                      DestinationType: CaptionDestinationType.EMBEDDED,
                      EmbeddedDestinationSettings: {},
                  },
              },
          ]
        : [];

    const result = await MediaConvert.createJob({
        Role: process.env.AWS_MEDIACONVERT_SERVICE_ROLE_ARN,
        UserMetadata: {
            videoRenderJobId,
            mode: TranscodeMode.BROADCAST,
        },
        Settings: {
            Inputs: [
                {
                    FileInput: s3VideoUrl,
                    AudioSelectors: {
                        "Audio Selector 1": {
                            SelectorType: AudioSelectorType.TRACK,
                        },
                    },
                    ...captionSelector,
                },
            ],
            OutputGroups: [
                {
                    CustomName: "File Group",
                    OutputGroupSettings: {
                        FileGroupSettings: {
                            Destination: `s3://${process.env.AWS_CONTENT_BUCKET_ID}/`,
                        },
                        Type: OutputGroupType.FILE_GROUP_SETTINGS,
                    },
                    Outputs: [
                        {
                            NameModifier: "-broadcast",
                            ContainerSettings: {
                                Mp4Settings: {},
                                Container: ContainerType.MP4,
                            },
                            VideoDescription: videoDescription,
                            AudioDescriptions: [audioDescription],
                            CaptionDescriptions: captionDescriptions,
                        },
                    ],
                },
            ],
        },
    });

    assert(result.Job?.Id && result.Job.CreatedAt, `Failed to create MediaConvert broadcast job for ${s3VideoUrl}`);

    console.log(`Started broadcast MediaConvert job for ${s3VideoUrl} (id: ${result.Job?.Id})`);

    return {
        jobId: result.Job.Id,
        timestamp: result.Job.CreatedAt,
    };
}

export async function completePreviewTranscode(
    contentItemId: string,
    transcodeS3Url: string,
    transcodeJobId: string,
    timestamp: Date
): Promise<void> {
    const transcodeDetails: TranscodeDetails = {
        jobId: transcodeJobId,
        status: AWSJobStatus.Completed,
        updatedTimestamp: timestamp.getTime(),
        s3Url: transcodeS3Url,
    };
    const newVersion = await createNewVersionFromPreviewTranscode(contentItemId, transcodeDetails);
    await addNewContentItemVersion(contentItemId, newVersion);
}

export async function failPreviewTranscode(
    contentItemId: string,
    transcodeJobId: string,
    timestamp: Date,
    errorMessage: string
): Promise<void> {
    const { latestVersion } = await getLatestVersion(contentItemId);
    assert(latestVersion, `Could not find latest version of content item ${contentItemId}`);

    const newVersion = R.clone(latestVersion);
    assert(is<VideoContentBlob>(newVersion.data), `Content item ${contentItemId} is not a video`);

    if (
        latestVersion.data.baseType !== "video" ||
        !latestVersion.data.transcode ||
        latestVersion.data.transcode.jobId !== transcodeJobId
    ) {
        console.log("Received notification of transcode failure, but did not record it");
        return;
    }

    newVersion.data.transcode = {
        jobId: transcodeJobId,
        status: AWSJobStatus.Failed,
        updatedTimestamp: timestamp.getTime(),
        s3Url: undefined,
        message: errorMessage,
    };
    newVersion.createdAt = new Date().getTime();
    newVersion.createdBy = "system";

    const result = await apolloClient.mutate({
        mutation: ContentItemAddNewVersionDocument,
        variables: {
            id: contentItemId,
            newVersion,
        },
    });

    if (result.errors) {
        console.error(`Failed to record transcode failure for ${contentItemId}`, result.errors);
        throw new Error(`Failed to record transcode failure for ${contentItemId}`);
    }
}
