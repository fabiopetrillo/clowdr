import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@chakra-ui/react";
import React from "react";

export default function SignupButton(): JSX.Element {
    const { isAuthenticated, loginWithRedirect } = useAuth0();
    return isAuthenticated ? (
        <></>
    ) : (
        <Button
            margin={0}
            onClick={() => loginWithRedirect({ screen_hint: "signup" })}
            colorScheme="blue"
        >
            Sign Up
        </Button>
    );
}