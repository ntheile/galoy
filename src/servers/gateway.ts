import { ApolloServer } from "apollo-server-express"
import { ApolloGateway, IntrospectAndCompose } from "@apollo/gateway"
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core"
import express from "express"

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
  })

  const apolloServer = new ApolloServer({
    gateway,
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
  })

  await apolloServer.start()
  apolloServer.applyMiddleware({ app })

  app.listen({ port }, () => {
    console.log(`Server ready at http://localhost:${port}/graphql`)
  })
}

bootGateway()
