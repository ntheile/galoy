import { getCurrentPrice } from "@app/prices"
import { getDealerConfig } from "@config"
import { CENTS_PER_USD } from "@domain/fiat"
import { ErrorLevel, ExchangeCurrencyUnit, WalletCurrency } from "@domain/shared"
import { NewDealerPriceService } from "@services/dealer-price"
import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
} from "@services/tracing"

const usdHedgeEnabled = getDealerConfig().usd.hedgingEnabled

const dealer = NewDealerPriceService()

export const usdFromBtcMidPriceFn = async (
  amount: BtcPaymentAmount,
): Promise<UsdPaymentAmount | DealerPriceServiceError> => {
  const midPriceRatio = await getMidPriceRatio()
  if (midPriceRatio instanceof Error) return midPriceRatio

  const usdPaymentAmount = {
    amount: BigInt(Math.ceil(Number(amount.amount) * midPriceRatio)),
    currency: WalletCurrency.Usd,
  }

  addAttributesToCurrentSpan({
    "usdFromBtcMidPriceFn.midPriceRatio": midPriceRatio,
    "usdFromBtcMidPriceFn.incoming.amount": Number(amount.amount),
    "usdFromBtcMidPriceFn.incoming.unit":
      amount.currency === WalletCurrency.Btc
        ? ExchangeCurrencyUnit.Btc
        : ExchangeCurrencyUnit.Usd,
    "usdFromBtcMidPriceFn.outgoing.amount": Number(usdPaymentAmount.amount),
    "usdFromBtcMidPriceFn.outgoing.unit":
      usdPaymentAmount.currency === WalletCurrency.Usd
        ? ExchangeCurrencyUnit.Usd
        : ExchangeCurrencyUnit.Btc,
  })

  return usdPaymentAmount
}

export const btcFromUsdMidPriceFn = async (
  amount: UsdPaymentAmount,
): Promise<BtcPaymentAmount | DealerPriceServiceError> => {
  const midPriceRatio = await getMidPriceRatio()
  if (midPriceRatio instanceof Error) return midPriceRatio

  const btcPaymentAmount = {
    amount: BigInt(Math.ceil(Number(amount.amount) / midPriceRatio)),
    currency: WalletCurrency.Btc,
  }

  addAttributesToCurrentSpan({
    "btcFromUsdMidPriceFn.midPriceRatio": midPriceRatio,
    "btcFromUsdMidPriceFn.incoming.amount": Number(amount.amount),
    "btcFromUsdMidPriceFn.incoming.unit":
      amount.currency === WalletCurrency.Usd
        ? ExchangeCurrencyUnit.Usd
        : ExchangeCurrencyUnit.Btc,
    "btcFromUsdMidPriceFn.outgoing.amount": Number(btcPaymentAmount.amount),
    "btcFromUsdMidPriceFn.outgoing.unit":
      btcPaymentAmount.currency === WalletCurrency.Btc
        ? ExchangeCurrencyUnit.Btc
        : ExchangeCurrencyUnit.Usd,
  })

  return btcPaymentAmount
}

export const getCurrentPriceInCentsPerSat = async (): Promise<
  CentsPerSatsRatio | PriceServiceError
> => {
  const price = await getCurrentPrice()
  if (price instanceof Error) return price

  return (price * CENTS_PER_USD) as CentsPerSatsRatio
}

export const getMidPriceRatio = async (): Promise<
  CentsPerSatsRatio | DealerPriceServiceError | PriceServiceError
> => {
  let midPriceRatio = usdHedgeEnabled
    ? await dealer.getCentsPerSatsExchangeMidRate()
    : await getCurrentPriceInCentsPerSat()
  if (midPriceRatio instanceof Error && usdHedgeEnabled) {
    recordExceptionInCurrentSpan({
      error: midPriceRatio,
      level: ErrorLevel.Critical,
    })
    midPriceRatio = await getCurrentPriceInCentsPerSat()
  }

  return midPriceRatio
}
