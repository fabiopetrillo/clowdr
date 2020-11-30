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

type GenerateVonageTokenOutput = {
    token: string;
};

type SampleInput = {
    username: string;
    password: string;
};

type EchoInput = {
    message: string;
};

type Query = {
    echo?: Maybe<EchoOutput>;
    protectedEcho?: Maybe<ProtectedEchoOutput>;
};

type Mutation = {
    generateVonageToken?: Maybe<GenerateVonageTokenOutput>;
};

type echoArgs = {
    message: string;
};

type protectedEchoArgs = {
    message: string;
};

type generateVonageTokenArgs = {
    roomId: uuid;
};
