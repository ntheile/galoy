/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { RemoteGraphQLDataSource } from "@apollo/gateway"

/**
 * This forwards all headers from the supergraph gateway to the subgraph child services
 * can use this in the context via sniffing out the header and for general proxy stuff
 */
export class useForwardHeaders extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }) {
    const headers = context.headers;
    if (!headers){
        return;
    }
    for (const key in headers) {
        const value = headers[key];
        if (value) {
            request.http?.headers.set(key, String(value));
        }
    }
  }
}
