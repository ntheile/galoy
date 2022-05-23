import { readFileSync } from "fs"

import { lexicographicSortSchema, extendSchema, parse, printSchema } from "graphql"
import { buildSubgraphSchema } from "@apollo/subgraph"
import { makeExecutableSchema } from "@graphql-tools/schema"
import { getResolversFromSchema } from "@graphql-tools/utils"
import { applyMiddleware } from "graphql-middleware"
import { gqlMainSchema } from "@graphql/main"

// https://www.apollographql.com/docs/enterprise-guide/federated-schema-design/
// `
//   extend type User @key(fields: "id")
// `
export function buildFederationSchema(
  schemaInput,
  permissions,
  walletIdMiddleware,
  federationExtendTypes,
) {
  const schemaString = printSchema(lexicographicSortSchema(schemaInput))
  // schemaString = `
  //   extend schema @link(url: "https://specs.apollo.dev/federation/v2.0",
  //     import: ["@key", "@shareable", "@inaccessible", "@override", "@external", "@provides", "@requires"  ])

  // ` + schemaString;
  const parsedSDL = parse(schemaString)
  const resolvers = getResolversFromSchema(schemaInput)
  const subgraphSchema = buildSubgraphSchema(parsedSDL)
  const executableSchema = makeExecutableSchema({ typeDefs: subgraphSchema, resolvers })
  let schema = applyMiddleware(executableSchema, permissions, walletIdMiddleware)
  // https://github.com/graphql/graphql-js/issues/1478#issuecomment-415862812
  schema = extendSchema(schema, parse(federationExtendTypes), { assumeValidSDL: true })
  // inject new federated schema
  return schema
}

// const schema = buildFederatedSchemaFromFile(`${__dirname}/../graphql/main/schema.graphql`, permissions, walletIdMiddleware);
export function buildFederatedSchemaFromFile(file, permissions, walletIdMiddleware) {
  const typeDefs = parse(readFileSync(file).toString("utf-8"))
  const resolvers = getResolversFromSchema(gqlMainSchema)
  const subgraphSchema = buildSubgraphSchema(typeDefs)
  const executableSchema = makeExecutableSchema({ typeDefs: subgraphSchema, resolvers })
  const schema = applyMiddleware(executableSchema, permissions, walletIdMiddleware)
  return schema
}

export function writeFederationSchemaToFile(federatedSchema) {
  import("@services/fs").then(({ writeSDLFile }) => {
    const federationExtendTypes = readFileSync(
      `${__dirname}/../federation/federation.graphql`,
    ).toString("utf-8")
    const schema = extendSchema(federatedSchema, parse(federationExtendTypes), {
      assumeValidSDL: true,
    })
    const schemaString = printSchema(lexicographicSortSchema(schema))
    writeSDLFile(__dirname + "/../main/schema.graphql", schemaString)
  })
}
