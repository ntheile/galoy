import { readFile } from "fs/promises"

import dotenv from "dotenv"
import { parse } from "graphql"
import { applyMiddleware } from "graphql-middleware"
import { shield } from "graphql-shield"

import { setupMongoConnection } from "@services/mongodb"
import { activateLndHealthCheck } from "@services/lnd/health"
import { baseLogger } from "@services/logger"

import { GALOY_API_PORT } from "@config"

import { buildSubgraphSchema } from "@apollo/subgraph"

import { makeExecutableSchema } from "@graphql-tools/schema"

import { getResolversFromSchema } from "@graphql-tools/utils"

import { gqlMainSchema } from "../graphql"

import { isAuthenticated, startApolloServer } from "./graphql-server"
import { walletIdMiddleware } from "./middlewares/wallet-id"

const graphqlLogger = baseLogger.child({ module: "graphql" })

dotenv.config()

export async function startApolloServerForCoreSchema() {
  const permissions = shield(
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

  // original schema
  // const schema = applyMiddleware(gqlMainSchema, permissions, walletIdMiddleware);

  //#region Apollo Federation
  // https://www.apollographql.com/docs/federation/subgraphs/
  // @todo - figure out how to get add the federation schema via Code-First objects and not SDL
  const sdl = await readFile(`${__dirname}/../graphql/main/schema.graphql`, "utf-8")
  const parsedSDL = parse(sdl)
  const resolvers = getResolversFromSchema(gqlMainSchema)
  const subgraphSchema = buildSubgraphSchema(parsedSDL)
  const executableSchema = makeExecutableSchema({ typeDefs: subgraphSchema, resolvers })
  const schema = applyMiddleware(executableSchema, permissions, walletIdMiddleware)
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
