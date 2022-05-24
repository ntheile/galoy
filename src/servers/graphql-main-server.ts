import { readFileSync } from "fs"

import dotenv from "dotenv"

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

  const federationExtendTypes = readFileSync(
    `${__dirname}/../graphql/federation/federation.graphql`,
  ).toString("utf-8")
  const schema = buildFederationSchema(
    gqlMainSchema,
    permissions,
    walletIdMiddleware,
    federationExtendTypes,
  )

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
