import { Button, Center, Divider, Flex, HStack, Text, useColorModeValue, VStack } from "@chakra-ui/react";
import React from "react";
import { Twemoji } from "react-emoji-render";
import { ChatMessageDataFragment, Chat_MessageType_Enum, Chat_ReactionType_Enum } from "../../../generated/graphql";
import { roundUpToNearest } from "../../Generic/MathUtils";
import { Markdown } from "../../Text/Markdown";
import { MessageTypeIndicator } from "../Compose/MessageTypeIndicator";
import { ChatSpacing, useChatConfiguration } from "../Configuration";
import MessageControls from "./MessageControls";
import PollOptions from "./PollOptions";
import ProfileBox from "./ProfileBox";
import ReactionsList from "./ReactionsList";
import { useReceiveMessageQueries } from "./ReceiveMessageQueries";

function MessageBody({ message }: { message: ChatMessageDataFragment }): JSX.Element {
    const config = useChatConfiguration();
    const messages = useReceiveMessageQueries();

    const scaleFactor = config.spacing / ChatSpacing.RELAXED;

    const pictureSizeMinPx = 35;
    const pictureSizeMaxPx = 50;
    const pictureSizeRange = pictureSizeMaxPx - pictureSizeMinPx;
    const pictureSize = Math.round(pictureSizeMinPx + pictureSizeRange * scaleFactor);

    const createdAt = new Date(message.created_at);
    const timeColour = useColorModeValue("gray.600", "gray.400");
    const timeFormat: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    };
    const smallFontSize = Math.max(config.fontSizeRange.value * 0.7, 10);

    if (message.type === Chat_MessageType_Enum.DuplicationMarker) {
        // TODO
        return <Divider w="100%" />;
    }

    return (
        <>
            <VStack
                alignItems="center"
                spacing={roundUpToNearest(config.spacing * 0.5, 1) + "px"}
                p={0}
                m={0}
                minW={pictureSize}
            >
                <Text as="div" fontSize={smallFontSize} color={timeColour} w="100%" textAlign="left">
                    {createdAt.toLocaleString(undefined, timeFormat)}
                </Text>
                {message.type !== Chat_MessageType_Enum.Message && message.type !== Chat_MessageType_Enum.Emote ? (
                    <MessageTypeIndicator messageType={message.type} fontSize={pictureSize * 0.8} opacity={0.7} />
                ) : message.senderId ? (
                    <ProfileBox attendeeId={message.senderId} w={pictureSize} />
                ) : undefined}
            </VStack>
            <VStack
                justifyContent={message.type === Chat_MessageType_Enum.Emote ? "center" : undefined}
                alignItems="flex-start"
                spacing={roundUpToNearest(config.spacing * 0.5, 1) + "px"}
                p={0}
                pr={config.spacing}
                m={0}
                w="100%"
                h={message.type === Chat_MessageType_Enum.Emote ? "100%" : "auto"}
            >
                <Flex flexDir="row" w="100%">
                    {message.type !== Chat_MessageType_Enum.Emote ? (
                        <Text as="span" fontSize={smallFontSize} color={timeColour}>
                            {message.sender?.displayName ?? "<Unknown>"}
                        </Text>
                    ) : undefined}
                    {/* TODO: Permissions */}
                    <MessageControls
                        duplicatedMessageId={message.duplicatedMessageId ?? undefined}
                        hideReactions={message.type === Chat_MessageType_Enum.Emote}
                        fontSize={smallFontSize}
                        ml="auto"
                        isOwnMessage={message.senderId === config.currentAttendeeId}
                        messageId={message.id}
                        usedReactions={message.reactions.reduce((acc, reaction) => {
                            if (
                                reaction.type === Chat_ReactionType_Enum.Emoji &&
                                reaction.senderId === config.currentAttendeeId
                            ) {
                                return [...acc, reaction.symbol];
                            }
                            return acc;
                        }, [] as string[])}
                        isPollOpen={
                            message.type === Chat_MessageType_Enum.Poll
                                ? !message.reactions.some(
                                      (reaction) => reaction.type === Chat_ReactionType_Enum.PollClosed
                                  )
                                : undefined
                        }
                        isPollIncomplete={
                            message.type === Chat_MessageType_Enum.Poll
                                ? !message.reactions.some(
                                      (reaction) => reaction.type === Chat_ReactionType_Enum.PollComplete
                                  )
                                : undefined
                        }
                    />
                </Flex>
                {message.type === Chat_MessageType_Enum.Emote ? (
                    <Center fontSize={pictureSize} w="100%" pt={config.spacing}>
                        <Twemoji text={message.message} />
                    </Center>
                ) : (
                    <Markdown restrictHeadingSize>{message.message}</Markdown>
                )}
                <ReactionsList
                    duplicatedMessageId={message.duplicatedMessageId ?? undefined}
                    reactions={message.reactions}
                    currentAttendeeId={config.currentAttendeeId}
                    messageId={message.id}
                    fontSize={smallFontSize}
                />
                {message.type === Chat_MessageType_Enum.Question ? (
                    message.reactions.some((x) => x.type === Chat_ReactionType_Enum.Answer) ? (
                        <Button
                            fontSize={smallFontSize}
                            p={config.spacing}
                            m={config.spacing}
                            colorScheme="green"
                            w="auto"
                            h="auto"
                            onClick={() => {
                                if (message.duplicatedMessageId) {
                                    messages.setAnsweringQuestionId.current?.f([
                                        message.id,
                                        message.duplicatedMessageId,
                                    ]);
                                } else {
                                    messages.setAnsweringQuestionId.current?.f([message.id]);
                                }
                            }}
                        >
                            Answered! (Answer again?)
                        </Button>
                    ) : (
                        <Button
                            fontSize={smallFontSize}
                            p={config.spacing}
                            m={config.spacing}
                            colorScheme="blue"
                            w="auto"
                            h="auto"
                            onClick={() => {
                                if (message.duplicatedMessageId) {
                                    messages.setAnsweringQuestionId.current?.f([
                                        message.id,
                                        message.duplicatedMessageId,
                                    ]);
                                } else {
                                    messages.setAnsweringQuestionId.current?.f([message.id]);
                                }
                            }}
                        >
                            Answer this question
                        </Button>
                    )
                ) : undefined}
                {message.type === Chat_MessageType_Enum.Poll ? <PollOptions message={message} /> : undefined}
                {/* TODO Render poll results*/}
            </VStack>
        </>
    );
}

export default function MessageBox({ message }: { message: ChatMessageDataFragment }): JSX.Element {
    const config = useChatConfiguration();

    const scaleFactor = config.spacing / ChatSpacing.RELAXED;

    const lineHeightMin = 2.3;
    const lineHeightMax = 4;
    const lineHeightRange = lineHeightMax - lineHeightMin;
    const lineHeight = lineHeightMin + lineHeightRange * scaleFactor;

    const isQuestion = message.type === Chat_MessageType_Enum.Question;
    const isAnswer = message.type === Chat_MessageType_Enum.Answer;
    const bgColour = useColorModeValue(
        isQuestion ? "blue.100" : isAnswer ? "orange.100" : "white",
        isQuestion ? "blue.700" : isAnswer ? "green.800" : "gray.800"
    );

    const createdAt = new Date(message.created_at);
    const timeFormat: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    };

    return (
        <HStack
            role="listitem"
            mr="1px"
            borderRadius={5}
            px="4px"
            pt="1px"
            pb="4px"
            bgColor={bgColour}
            mt={config.spacing}
            id={`message-${message.id}`}
            alignItems="flex-start"
            lineHeight={lineHeight + "ex"}
            _hover={{}}
            tabIndex={0}
            aria-label={`Message sent at ${createdAt.toLocaleString(undefined, timeFormat)} by ${
                message.sender?.displayName ?? "<Unknown>"
            }. ${message.message}`}
        >
            <MessageBody message={message} />
        </HStack>
    );
}
