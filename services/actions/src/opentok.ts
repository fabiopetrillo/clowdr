import OpenTok from "opentok";
import { promisify } from "util";

function initialiseOpenTok() {
    if (process.env.OPENTOK_API_KEY && process.env.OPENTOK_API_SECRET) {
        return new OpenTok(
            process.env.OPENTOK_API_KEY,
            process.env.OPENTOK_API_SECRET
        );
    } else {
        throw new Error(
            "OPENTOK_API_KEY and OPENTOK_API_SECRET environment vars must be set."
        );
    }
}

export const opentok = initialiseOpenTok();

export const createSession = promisify(opentok.createSession.bind(opentok));
