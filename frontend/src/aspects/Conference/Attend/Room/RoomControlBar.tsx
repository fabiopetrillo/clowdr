import { gql } from "@apollo/client";
import {
    Badge,
    Button,
    HStack,
    List,
    ListItem,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverCloseButton,
    PopoverContent,
    PopoverHeader,
    PopoverTrigger,
    Portal,
    useDisclosure,
} from "@chakra-ui/react";
import React, { useMemo } from "react";
import { RoomDetailsFragment, RoomPersonRole_Enum, RoomPrivacy_Enum } from "../../../../generated/graphql";
import { FAIcon } from "../../../Icons/FAIcon";
import useRoomMembers from "../../../Room/useRoomMembers";
import useCurrentUser from "../../../Users/CurrentUser/useCurrentUser";
import { AddRoomPersonModal } from "./AddRoomPersonModal";

export function RoomControlBar({ roomDetails }: { roomDetails: RoomDetailsFragment }): JSX.Element {
    const user = useCurrentUser();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const roomMembers = useRoomMembers();

    const roomMembersList = useMemo(
        () => (
            <List>
                {roomMembers ? (
                    roomMembers.roomPeople.map((person) => (
                        <ListItem key={person.id}>
                            <FAIcon icon="user" iconStyle="s" mr={5} />
                            {person.attendee.displayName}
                        </ListItem>
                    ))
                ) : (
                    <></>
                )}
            </List>
        ),
        [roomMembers]
    );

    return (
        <HStack justifyContent="flex-end" m={4}>
            {roomDetails.roomPeople.find(
                (person) =>
                    user.user.attendees.find((myAttendee) => myAttendee.id === person.attendee.id) &&
                    person.roomPersonRoleName === RoomPersonRole_Enum.Admin
            ) ? (
                <Button colorScheme="green" aria-label="Add people to room" title="Add people to room" onClick={onOpen}>
                    <FAIcon icon="plus" iconStyle="s" mr={3} />
                    Add people
                </Button>
            ) : (
                <></>
            )}
            {roomDetails.roomPrivacyName === RoomPrivacy_Enum.Private ? (
                <Popover>
                    <PopoverTrigger>
                        <Button aria-label="Members of this room" title="Members of this room">
                            <FAIcon icon="users" iconStyle="s" />
                            <Badge ml={2}>{roomMembers ? roomMembers.roomPeople.length : "0"} </Badge>
                        </Button>
                    </PopoverTrigger>
                    <Portal>
                        <PopoverContent>
                            <PopoverArrow />
                            <PopoverHeader>Room Members</PopoverHeader>
                            <PopoverCloseButton />
                            <PopoverBody>{roomMembersList}</PopoverBody>
                        </PopoverContent>
                    </Portal>
                </Popover>
            ) : (
                <></>
            )}
            <AddRoomPersonModal roomId={roomDetails.id} isOpen={isOpen} onClose={onClose} />
        </HStack>
    );
}

gql`
    mutation AddParticipantToRoom($attendeeId: uuid!, $roomId: uuid!) {
        insert_RoomPerson_one(object: { attendeeId: $attendeeId, roomId: $roomId, roomPersonRoleName: PARTICIPANT }) {
            id
        }
    }

    query SearchAttendees($conferenceId: uuid!, $displayName: String!) {
        Attendee(where: { conferenceId: { _eq: $conferenceId }, displayName: { _ilike: $displayName } }) {
            id
            displayName
        }
    }
`;