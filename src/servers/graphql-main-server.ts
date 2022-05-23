/* eslint-disable prettier/prettier */
import dotenv from "dotenv"
//import { applyMiddleware } from "graphql-middleware"
import { shield } from "graphql-shield"

import { setupMongoConnection } from "@services/mongodb"
import { activateLndHealthCheck } from "@services/lnd/health"
import { baseLogger } from "@services/logger"

import { GALOY_API_PORT } from "@config"

import { buildFederationSchema } from "@graphql/federation/buildFederatedSchema"

import { walletIdMiddleware } from "@servers/middlewares/wallet-id"

import { gqlMainSchema } from "../graphql"

import { isAuthenticated, startApolloServer } from "./graphql-server"

const graphqlLogger = baseLogger.child({ module: "graphql" })

dotenv.config()

export async function startApolloServerForCoreSchema() {
  
  // original schema
  // const schema = applyMiddleware(gqlMainSchema, permissions, walletIdMiddleware);

  const schema = buildFederationSchema(gqlMainSchema, permissions, walletIdMiddleware, `
    extend type User @key(fields: "id") 
  `);

  //#region Apollo Federation
  // https://www.apollographql.com/docs/federation/subgraphs/
  // @todo - figure out how to get add the federation schema via Code-First objects and not SDL
  // const sdl = await readFile(`${__dirname}/../graphql/main/schema.graphql`, "utf-8")
  // let schemaString = printSchemaWithDirectives(lexicographicSortSchema(gqlMainSchema))
  // schemaString = `
  //   extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  // ` + schemaString;
  // const parsedSDL = parse(schemaString)
  // const resolvers = getResolversFromSchema(gqlMainSchema)
  // const subgraphSchema = buildSubgraphSchema(parsedSDL)
  // const executableSchema = makeExecutableSchema({ typeDefs: subgraphSchema, resolvers })
  // let schema = applyMiddleware(executableSchema, permissions, walletIdMiddleware)
  // schema = extendSchema(schema, parse(`
  //   extend type User @key(fields: "id") 
  // `));
  // import("@services/fs").then(({ writeSDLFile }) => {
  //   writeSDLFile(
  //     __dirname + "/schema.graphql",
  //     printSchemaWithDirectives(lexicographicSortSchema(schema)),
  //   )
  // })
  //#endregion

  return startApolloServer({
    schema,
    port: GALOY_API_PORT,
    startSubscriptionServer: true,
    enableApolloUsageReporting: true,
  })
}

if (require.main === module) {
  setupMongoConnection(true)
    .then(async () => {
      activateLndHealthCheck()
      await startApolloServerForCoreSchema()
    })
    .catch((err) => graphqlLogger.error(err, "server error"))
}

export const permissions = shield(
  {
    Query: {
      me: isAuthenticated,
      onChainTxFee: isAuthenticated,
    },
    Mutation: {
      twoFAGenerate: isAuthenticated,
      twoFASave: isAuthenticated,
      twoFADelete: isAuthenticated,

      userQuizQuestionUpdateCompleted: isAuthenticated,
      deviceNotificationTokenCreate: isAuthenticated,

      userUpdateUsername: isAuthenticated,
      userUpdateLanguage: isAuthenticated,
      accountUpdateDefaultWalletId: isAuthenticated,
      userContactUpdateAlias: isAuthenticated,

      lnInvoiceFeeProbe: isAuthenticated,
      lnNoAmountInvoiceFeeProbe: isAuthenticated,

      lnInvoiceCreate: isAuthenticated,
      lnUsdInvoiceCreate: isAuthenticated,
      lnNoAmountInvoiceCreate: isAuthenticated,

      lnInvoicePaymentSend: isAuthenticated,
      lnNoAmountInvoicePaymentSend: isAuthenticated,
      lnNoAmountUsdInvoicePaymentSend: isAuthenticated,

      intraLedgerPaymentSend: isAuthenticated,

      onChainAddressCreate: isAuthenticated,
      onChainAddressCurrent: isAuthenticated,
      onChainPaymentSend: isAuthenticated,
      onChainPaymentSendAll: isAuthenticated,
    },
  },
  { allowExternalErrors: true },
)