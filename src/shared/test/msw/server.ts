import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** Node MSW server for the vitest integration suite. */
export const server = setupServer(...handlers);
