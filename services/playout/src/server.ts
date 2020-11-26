import {
    Channel,
    ChannelSummary,
    Input,
    InputSecurityGroup,
} from "@aws-sdk/client-medialive";
import express from "express";
import { medialive } from "./medialive";

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

async function getInputs(): Promise<Input[]> {
    const existingInputs = await medialive.listInputs({});
    if (existingInputs.Inputs) {
        return existingInputs.Inputs;
    } else {
        throw new Error("No inputs returned");
    }
}

async function getChannels(): Promise<ChannelSummary[]> {
    const existingChannels = await medialive.listChannels({});
    if (existingChannels.Channels) {
        return existingChannels.Channels;
    } else {
        throw new Error("No channel list returned");
    }
}

async function createInput(): Promise<Input> {
    const securityGroup = await createInputSecurityGroup();
    if (!securityGroup.Id) {
        throw new Error("ID missing from new input security group");
    }

    const input = await medialive.createInput({
        Destinations: [{ StreamName: "test-stream" }],
        Name: "test-input",
        Type: "RTMP_PUSH",
        InputSecurityGroups: [securityGroup.Id],
    });
    if (input.Input) {
        return input.Input;
    } else {
        throw new Error("No input was returned");
    }
}

async function createChannel(inputId: string): Promise<Channel> {
    const channel = await medialive.createChannel({
        Name: "test-channel",
        ChannelClass: "SINGLE_PIPELINE",
        InputAttachments: [
            { InputAttachmentName: "test-input", InputId: inputId },
        ],
        RoleArn: "arn:aws:iam::772617020864:role/MediaLiveAccessRole",
        EncoderSettings: {
            AudioDescriptions: [],
            OutputGroups: [
                { Name: "HLS group", Outputs: [], OutputGroupSettings: {} },
            ],
            TimecodeConfig: { Source: "EMBEDDED" },
            VideoDescriptions: [],
        },
        InputSpecification: {
            Codec: "AVC",
            Resolution: "HD",
            MaximumBitrate: "MAX_20_MBPS",
        },
        Destinations: [{ Id: "test-output", Settings: [{}] }],
    });
    if (channel.Channel) {
        return channel.Channel;
    } else {
        throw new Error("No channel was returned");
    }
}

export const app: express.Application = express();

app.get("/input/create", async (_req, res) => {
    try {
        const inputs = await getInputs();

        if (inputs.length === 0) {
            const newInput = await createInput();
            console.log("Created new input", newInput.Id, newInput.Name);
            res.status(200).json({
                message: `Created new input ${newInput.Id}`,
            });
        } else {
            res.status(200).json({ message: "Input already exists" });
        }
    } catch (e) {
        res.status(500).json(JSON.stringify(e));
        throw e;
    }
});

app.get("/channel/create", async (_req, res) => {
    try {
        const inputs = await getInputs();

        if (inputs.length < 1 || !inputs[0].Id) {
            throw new Error(
                "Can't create a channel without an input available"
            );
        }

        const channels = await getChannels();

        if (channels.length === 0) {
            const newChannel = await createChannel(inputs[0].Id);
            console.log("Created new channel", newChannel.Id, newChannel.Name);
            res.status(200).json({
                message: `Created new channel ${newChannel.Id}`,
            });
        } else {
            res.status(200).json({ message: "Input already exists" });
        }
    } catch (e) {
        res.status(500).json(JSON.stringify(e));
        throw e;
    }
});

const portNumber = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
export const server = app.listen(portNumber, function () {
    console.log(`App is listening on port ${process.env.PORT}!`);
});
