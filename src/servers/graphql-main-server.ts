/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from "fs"

import dotenv from "dotenv"
import { printSchema, parse, lexicographicSortSchema } from "graphql"
import { applyMiddleware } from "graphql-middleware"
import { shield } from "graphql-shield"

import { setupMongoConnection } from "@services/mongodb"
import { activateLndHealthCheck } from "@services/lnd/health"
import { baseLogger } from "@services/logger"

import { GALOY_API_PORT } from "@config"

import { gql } from "apollo-server"
import { buildSubgraphSchema } from "@apollo/subgraph"

import { makeExecutableSchema } from "graphql-tools"
import { mergeTypeDefs } from "@graphql-tools/merge"

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
  const schema = applyMiddleware(gqlMainSchema, permissions, walletIdMiddleware);
  const federatedSchema = buildSubgraphSchema( parse(printSchema(lexicographicSortSchema(schema))) )
  // const executableSchema = makeExecutableSchema({typeDefs: federatedSchema }); // gotta figure out how to get resolvers
  //#endregion

  return startApolloServer({
    schema: federatedSchema,
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
