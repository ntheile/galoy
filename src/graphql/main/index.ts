import { readFileSync } from "fs"

import {
  GraphQLSchema,
  lexicographicSortSchema,
  printSchema,
  parse,
  extendSchema,
} from "graphql"

import { ALL_INTERFACE_TYPES } from "@graphql/types"

import { isDev, isRunningJest } from "@config"

import QueryType from "./queries"
import MutationType from "./mutations"

import SubscriptionType from "./subscriptions"

if (isDev && !isRunningJest) {
  import("@services/fs").then(({ writeSDLFile }) => {
    const federationExtendTypes = readFileSync(
      `${__dirname}/../federation/federation.graphql`,
    ).toString("utf-8")
    const schema = extendSchema(gqlMainSchema, parse(federationExtendTypes), {
      assumeValidSDL: true,
    })
    const schemaString = printSchema(lexicographicSortSchema(schema))
    writeSDLFile(__dirname + "/schema.graphql", schemaString)
  })
}

export const gqlMainSchema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  subscription: SubscriptionType,
  types: ALL_INTERFACE_TYPES,
})
