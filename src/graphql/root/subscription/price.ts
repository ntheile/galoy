import crypto from "crypto"

import { SAT_PRICE_PRECISION_OFFSET } from "@config"

import { GT } from "@graphql/index"
import PricePayload from "@graphql/types/payload/price"
import SatAmount from "@graphql/types/scalar/sat-amount"
import ExchangeCurrencyUnit from "@graphql/types/scalar/exchange-currency-unit"

import { Prices } from "@app"
import { PubSubService } from "@services/pubsub"
import { customPubSubTrigger, PubSubDefaultTriggers } from "@domain/pubsub"

const pubsub = PubSubService()

const PriceInput = GT.Input({
  name: "PriceInput",
  fields: () => ({
    amount: { type: GT.NonNull(SatAmount) },
    amountCurrencyUnit: { type: GT.NonNull(ExchangeCurrencyUnit) },
    priceCurrencyUnit: { type: GT.NonNull(ExchangeCurrencyUnit) },
  }),
})

const PriceSubscription = {
  type: GT.NonNull(PricePayload),
  args: {
    input: { type: GT.NonNull(PriceInput) },
  },
  resolve: (source, args) => {
    if (source.errors) {
      return { errors: source.errors }
    }
    const amountPriceInCents = args.input.amount * source.satUsdCentPrice
    return {
      errors: [],
      price: {
        formattedAmount: amountPriceInCents.toString(),
        base: Math.round(amountPriceInCents * 10 ** SAT_PRICE_PRECISION_OFFSET),
        offset: SAT_PRICE_PRECISION_OFFSET,
        currencyUnit: "USDCENT",
      },
    }
  },
  subscribe: async (_, args) => {
    const { amount, amountCurrencyUnit, priceCurrencyUnit } = args.input

    const immediateTrigger = customPubSubTrigger({
      event: PubSubDefaultTriggers.PriceUpdate,
      suffix: crypto.randomUUID(),
    })

    for (const input of [amountCurrencyUnit, priceCurrencyUnit]) {
      if (input instanceof Error) {
        pubsub.publishImmediate({
          trigger: immediateTrigger,
          payload: { errors: [{ message: input.message }] },
        })
        return pubsub.createAsyncIterator({ trigger: immediateTrigger })
      }
    }

    if (amountCurrencyUnit !== "BTCSAT" || priceCurrencyUnit !== "USDCENT") {
      // For now, keep the only supported exchange price as SAT -> USD
      pubsub.publishImmediate({
        trigger: immediateTrigger,
        payload: { errors: [{ message: "Unsupported exchange unit" }] },
      })
    } else if (amount >= 1000000) {
      // SafeInt limit, reject for now
      pubsub.publishImmediate({
        trigger: immediateTrigger,
        payload: { errors: [{ message: "Unsupported exchange amount" }] },
      })
    } else {
      const satUsdPrice = await Prices.getCurrentPrice()
      if (!(satUsdPrice instanceof Error)) {
        pubsub.publishImmediate({
          trigger: immediateTrigger,
          payload: { satUsdCentPrice: 100 * satUsdPrice },
        })
      }
      return pubsub.createAsyncIterator({
        trigger: [immediateTrigger, PubSubDefaultTriggers.PriceUpdate],
      })
    }

    return pubsub.createAsyncIterator({ trigger: immediateTrigger })
  },
}

export default PriceSubscription
