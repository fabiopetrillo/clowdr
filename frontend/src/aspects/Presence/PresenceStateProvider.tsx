import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PresenceState, State } from "./PresenceState";

export const PresenceStateContext = React.createContext<PresenceState>(State);

export function usePresenceState(): PresenceState {
    return React.useContext(PresenceStateContext);
}

export function PresenceStateProvider({
    children,
    token,
}: {
    children: string | JSX.Element | Array<JSX.Element>;
    token: string;
}): JSX.Element {
    useEffect(() => {
        State.begin(token);
    }, [token]);

    const location = useLocation();
    useEffect(() => {
        State.pageChanged(location.pathname);
    }, [location.pathname]);

    return <PresenceStateContext.Provider value={State}>{children}</PresenceStateContext.Provider>;
}
