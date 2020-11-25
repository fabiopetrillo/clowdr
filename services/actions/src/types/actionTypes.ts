type Maybe<T> = T | null;

type uuid = string;

type SampleOutput = {
    accessToken: string;
};

type EchoOutput = {
    message: string;
};

type ProtectedEchoOutput = {
    message: string;
};

type CreateChannelOutput = {
    id: uuid;
};

type GetChannelTokenOutput = {
    token: string;
};

type SampleInput = {
    username: string;
    password: string;
};

type EchoInput = {
    message: string;
};

type GetChannelTokenInput = {
    channelId: uuid;
};

type Query = {
    echo?: Maybe<EchoOutput>;
    getChannelToken?: Maybe<GetChannelTokenOutput>;
    protectedEcho?: Maybe<ProtectedEchoOutput>;
};

type Mutation = {
    createChannel?: Maybe<CreateChannelOutput>;
};

type echoArgs = {
    message: string;
};

type getChannelTokenArgs = {
    channelId: uuid;
};

type protectedEchoArgs = {
    message: string;
};

type createChannelArgs = {
    name: string;
};
