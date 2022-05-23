import { GraphQLSchema, lexicographicSortSchema } from "graphql"

import { printSchemaWithDirectives } from "@graphql-tools/utils"

import { ALL_INTERFACE_TYPES } from "@graphql/types"

import { isDev, isRunningJest } from "@config"

import { buildFederationSchema } from "@graphql/federation/buildFederatedSchema"

import { permissions } from "@servers/graphql-main-server"

import { walletIdMiddleware } from "@servers/middlewares/wallet-id"

import QueryType from "./queries"
import MutationType from "./mutations"

import SubscriptionType from "./subscriptions"

if (isDev && !isRunningJest) {
  import("@services/fs").then(({ writeSDLFile }) => {
    const federatedSchema = buildFederationSchema(
      gqlMainSchema,
      permissions,
      walletIdMiddleware,
      `
        extend type User @key(fields: "id") 
      `,
    )
    writeSDLFile(
      __dirname + "/schema.graphql",
      printSchemaWithDirectives(lexicographicSortSchema(federatedSchema)),
    )
  })
}

export const gqlMainSchema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  subscription: SubscriptionType,
  types: ALL_INTERFACE_TYPES,
})
