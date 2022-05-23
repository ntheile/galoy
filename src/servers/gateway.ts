import { readFileSync } from "fs"

import { ApolloServer } from "apollo-server-express"
import { ApolloGateway, IntrospectAndCompose } from "@apollo/gateway"
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core"
import express from "express"

import { isDev, isRunningJest } from "@config"

import { useForwardHeaders } from "./middlewares/useForwardHeaders"

// https://www.apollographql.com/docs/federation/gateway
async function bootGateway() {
  const port = 4000
  const app = express()
  let gateway

  if (isDev && !isRunningJest) {
    // load schema via introspection
    gateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: [
          { name: "galoy", url: "http://localhost:4002/graphql" },
          { name: "merchants", url: "http://localhost:4003/graphql" },
          // ...additional subgraphs...
        ],
      }),
      buildService({ url }) {
        return new useForwardHeaders({ url })
      },
    })
  } else {
    // load schema via static SDL
    const supergraphSdl = readFileSync(
      `${__dirname}/../graphql/federation/supergraph.graphql`, // supergraph.graphql is generated via gen-supergraphSDL.sh
    ).toString()
    gateway = new ApolloGateway({
      supergraphSdl,
      buildService({ url }) {
        return new useForwardHeaders({ url })
      },
    })
  }

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
