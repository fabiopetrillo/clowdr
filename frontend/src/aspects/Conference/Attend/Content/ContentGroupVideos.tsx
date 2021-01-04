import { Box, Flex, Heading, Spinner } from "@chakra-ui/react";
import { assertIsContentItemDataBlob, VideoContentBlob } from "@clowdr-app/shared-types/build/content";
import { WebVTTConverter } from "@clowdr-app/srt-webvtt";
import AmazonS3URI from "amazon-s3-uri";
import * as R from "ramda";
import React, { useMemo, useState } from "react";
import { useAsync } from "react-async-hook";
import ReactPlayer, { Config, TrackProps } from "react-player";
import { ContentGroupDataFragment, ContentType_Enum } from "../../../../generated/graphql";

export function ContentGroupVideos({ contentGroupData }: { contentGroupData: ContentGroupDataFragment }): JSX.Element {
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

    const videoContentItems = useMemo(() => {
        return contentGroupData.contentItems
            .filter(
                (contentItem) =>
                    contentItem.contentTypeName === ContentType_Enum.VideoBroadcast ||
                    contentItem.contentTypeName === ContentType_Enum.VideoPrepublish
            )
            .map((contentItem) => {
                try {
                    assertIsContentItemDataBlob(contentItem?.data);
                    const latestVersion = R.last(contentItem.data);

                    if (latestVersion?.data.baseType === "video") {
                        return (
                            <Box
                                key={contentItem.id}
                                flexGrow={1}
                                flexShrink={1}
                                transition="max-width 1s, width 1s, margin 1s"
                                width={selectedVideoId === contentItem.id ? "100%" : "0"}
                                maxWidth={selectedVideoId && selectedVideoId === contentItem.id ? "100%" : "30%"}
                                mx={!selectedVideoId || selectedVideoId === contentItem.id ? 5 : 0}
                                visibility={
                                    !selectedVideoId || selectedVideoId === contentItem.id ? "visible" : "hidden"
                                }
                                overflow="hidden"
                            >
                                <ContentGroupVideo
                                    title={contentItem.name}
                                    videoContentItemData={latestVersion.data}
                                    onPlay={() => setSelectedVideoId(contentItem.id)}
                                    onPause={() => setSelectedVideoId(null)}
                                />
                            </Box>
                        );
                    } else {
                        return <></>;
                    }
                } catch (e) {
                    return <></>;
                }
            });
    }, [contentGroupData.contentItems, selectedVideoId]);
    return (
        <Flex justifyContent="center" alignItems="center" background="gray.900" borderRadius={5} py={5} minH="80vh">
            {videoContentItems}
        </Flex>
    );
}

export function ContentGroupVideo({
    videoContentItemData,
    title,
    onPlay,
    onPause,
}: {
    videoContentItemData: VideoContentBlob;
    title: string;
    onPlay?: () => void;
    onPause?: () => void;
}): JSX.Element {
    const previewTranscodeUrl = useMemo(() => {
        if (!videoContentItemData.transcode?.s3Url) {
            return undefined;
        }
        const { bucket, key } = new AmazonS3URI(videoContentItemData.transcode.s3Url);

        return `https://s3.${import.meta.env.SNOWPACK_PUBLIC_AWS_REGION}.amazonaws.com/${bucket}/${key}`;
    }, [videoContentItemData.transcode?.s3Url]);

    const { result: subtitlesUrl, loading, error } = useAsync(async () => {
        if (!videoContentItemData.subtitles["en_US"] || !videoContentItemData.subtitles["en_US"].s3Url) {
            return undefined;
        } else {
            try {
                const { bucket, key } = new AmazonS3URI(videoContentItemData.subtitles["en_US"].s3Url);
                const s3Url = `https://s3.${import.meta.env.SNOWPACK_PUBLIC_AWS_REGION}.amazonaws.com/${bucket}/${key}`;

                const response = await fetch(s3Url);

                if (!response.ok) {
                    throw new Error(`Could not retrieve subtitles file: ${response.status}`);
                }

                const blob = await response.blob();

                return await new WebVTTConverter(blob).getURL();
            } catch (e) {
                console.error("Failure while parsing subtitle location", e);
            }
        }
    }, [videoContentItemData.subtitles["en_US"]]);

    const subtitlesConfig = useMemo<Config | null>(() => {
        if (loading) {
            return null;
        }
        if (error || !subtitlesUrl) {
            return {};
        }
        const track: TrackProps = {
            kind: "subtitles",
            src: subtitlesUrl,
            srcLang: "en",
            default: true,
            label: "English",
        };
        return {
            file: {
                tracks: [track],
            },
        };
    }, [error, loading, subtitlesUrl]);

    const player = useMemo(() => {
        // Only render the player once both the video URL and the subtitles config are available
        // react-player memoizes internally and only re-renders if the url or key props change.
        return !previewTranscodeUrl || !subtitlesConfig ? (
            <Spinner />
        ) : (
            <ReactPlayer
                url={previewTranscodeUrl}
                controls={true}
                width="100%"
                height="auto"
                onPlay={onPlay}
                onPause={onPause}
                config={subtitlesConfig}
                style={{ borderRadius: "10px", overflow: "hidden" }}
            />
        );
    }, [onPause, onPlay, previewTranscodeUrl, subtitlesConfig]);

    return (
        <>
            <Heading as="h3" fontSize={24} mb={4} color="gray.50">
                {title === "Livestream broadcast video"
                    ? "Lightning talk"
                    : title === "Pre-published video"
                    ? "Presentation"
                    : title}
            </Heading>
            {player}
        </>
    );
}