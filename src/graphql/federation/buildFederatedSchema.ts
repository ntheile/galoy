/* eslint-disable prettier/prettier */
import {
    lexicographicSortSchema,
    extendSchema,
    parse,
} from "graphql"
import { buildSubgraphSchema } from "@apollo/subgraph"
import { makeExecutableSchema } from "@graphql-tools/schema"
import { getResolversFromSchema, printSchemaWithDirectives } from "@graphql-tools/utils"
import { applyMiddleware } from "graphql-middleware"

// `
//   extend type User @key(fields: "id") 
// `
export function buildFederationSchema(schemaInput, permissions, walletIdMiddleware, sdlExtendTypes) {
    let schemaString = printSchemaWithDirectives(lexicographicSortSchema(schemaInput))
    schemaString = `
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

    ` + schemaString;
    const parsedSDL = parse(schemaString)
    const resolvers = getResolversFromSchema(schemaInput)
    const subgraphSchema = buildSubgraphSchema(parsedSDL)
    const executableSchema = makeExecutableSchema({ typeDefs: subgraphSchema, resolvers })
    let schema = applyMiddleware(executableSchema, permissions, walletIdMiddleware)
    schema = extendSchema(schema, parse(sdlExtendTypes));
    return schema;
}