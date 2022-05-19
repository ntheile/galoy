/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable prettier/prettier */
import { ApolloServer } from "apollo-server"
import { ApolloGateway, IntrospectAndCompose } from "@apollo/gateway"
import {
  ApolloServerPluginLandingPageGraphQLPlayground
} from "apollo-server-core";


function bootGateway(){
   
    const gateway = new ApolloGateway({
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: [
            { name: 'galoy', url: 'http://localhost:4002/graphql' },
            // { name: 'merchant', url: 'http://localhost:4003/graphql' },
            // ...additional subgraphs...
          ],
        }),
      });

    const server = new ApolloServer({
        gateway,
        plugins: [
          ApolloServerPluginLandingPageGraphQLPlayground(),
        ],
    })
    
    server.listen().then(({ url }) => {
        console.log(`🚀 Gateway ready at ${url}`)
    }).catch(err => { 
        console.error(err)
    })
}

bootGateway();
