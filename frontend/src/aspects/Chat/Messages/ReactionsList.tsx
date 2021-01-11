import { Box, BoxProps } from "@chakra-ui/react";
import React, { useMemo } from "react";
import { ChatReactionDataFragment, Chat_ReactionType_Enum } from "../../../generated/graphql";
import ReactionBadge from "./ReactionBadge";
import { useReactions } from "./ReactionsProvider";
import { useReceiveMessageQueries } from "./ReceiveMessageQueries";

export default function ReactionsList({
    reactions,
    currentAttendeeId,
    messageId,
    duplicatedMessageId,
    ...rest
}: {
    currentAttendeeId?: string;
    messageId: number;
    duplicatedMessageId: number | undefined;
    reactions: readonly ChatReactionDataFragment[];
} & BoxProps): JSX.Element {
    const reactionQs = useReactions();
    const messageQs = useReceiveMessageQueries();

    const reactionsGrouped: Array<[
        string,
        {
            count: number;
            attendeeHasThis: number | false;
        }
    ]> = useMemo(() => {
        return [
            ...reactions
                .reduce(
                    (acc, reaction) => {
                        if (reaction.type === Chat_ReactionType_Enum.Emoji) {
                            const info = acc.get(reaction.symbol) ?? { count: 0, attendeeHasThis: false };
                            acc.set(reaction.symbol, {
                                count: info.count + 1,
                                attendeeHasThis:
                                    info.attendeeHasThis !== false
                                        ? info.attendeeHasThis
                                        : reaction.senderId === currentAttendeeId
                                        ? reaction.id
                                        : false,
                            });
                        }
                        return acc;
                    },
                    new Map<
                        string,
                        {
                            count: number;
                            attendeeHasThis: number | false;
                        }
                    >()
                )
                .entries(),
        ];
    }, [currentAttendeeId, reactions]);

    return (
        <Box display="block" w="100%" {...rest}>
            {reactionsGrouped.map(([reaction, info]) => (
                <ReactionBadge
                    mb={2}
                    mr={2}
                    key={`reaction-${reaction}`}
                    reaction={reaction}
                    count={info.count}
                    onClick={async () => {
                        if (info.attendeeHasThis) {
                            await reactionQs.deleteReaction(info.attendeeHasThis);
                            // TODO: How do we delete the duplicated reaction???
                        } else {
                            await reactionQs.addReaction({
                                data: {},
                                messageId,
                                symbol: reaction,
                                type: Chat_ReactionType_Enum.Emoji,
                            });
                            if (duplicatedMessageId) {
                                await reactionQs.addReaction({
                                    data: {},
                                    messageId: duplicatedMessageId,
                                    symbol: reaction,
                                    type: Chat_ReactionType_Enum.Emoji,
                                });
                            }
                        }
                        messageQs.refetch(messageId);
                    }}
                />
            ))}
        </Box>
    );
}