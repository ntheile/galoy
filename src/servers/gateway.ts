import { ApolloServer } from "apollo-server-express"
import { ApolloGateway, IntrospectAndCompose } from "@apollo/gateway"
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core"
import express from "express"

import { useForwardHeaders } from "./middlewares/useForwardHeaders"

async function bootGateway() {
  const port = 4000
  const app = express()

  // https://www.apollographql.com/docs/federation/gateway
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: "galoy", url: "http://localhost:4002/graphql" },
        { name: "merchants", url: "http://localhost:4003/graphql" },
        // ...additional subgraphs...
      ],
    }),
    // https://www.apollographql.com/blog/backend/auth/setting-up-authentication-and-authorization-apollo-federation/
    buildService({ url }) {
      return new useForwardHeaders({ url })
    },
  })

  const apolloServer = new ApolloServer({
    gateway,
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
    // forward headers
    context: async ({ req }) => {
      if (req.headers) {
        return { headers: req.headers }
      }
    },
  })

  await apolloServer.start()
  apolloServer.applyMiddleware({ app })

  app.listen({ port }, () => {
    console.log(`Server ready at http://localhost:${port}/graphql`)
  })
}

bootGateway()
