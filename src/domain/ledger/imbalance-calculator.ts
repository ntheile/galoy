const MS_PER_HOUR = (60 * 60 * 1000) as MilliSeconds
const MS_PER_DAY = (24 * MS_PER_HOUR) as MilliSeconds

export const ImbalanceCalculator = ({
  volumeLightningFn,
  volumeOnChainFn,
  sinceDaysAgo,
}: ImbalanceCalculatorConfig): ImbalanceCalculator => {
  const since = new Date(new Date().getTime() - sinceDaysAgo * MS_PER_DAY)

  const getNetInboundFlow = async ({
    volumeFn,
    walletId,
    since,
  }: {
    volumeFn: GetVolumeSinceFn
    walletId: WalletId
    since: Date
  }) => {
    const volume_ = await volumeFn({
      walletId,
      timestamp: since,
    })
    if (volume_ instanceof Error) return volume_

    return (volume_.incomingBaseAmount - volume_.outgoingBaseAmount) as NetInboundFlow
  }

  const getSwapOutImbalance = async (walletId: WalletId) => {
    const lnNetInbound = await getNetInboundFlow({
      since,
      walletId,
      volumeFn: volumeLightningFn,
    })
    if (lnNetInbound instanceof Error) return lnNetInbound

    const onChainNetInbound = await getNetInboundFlow({
      since,
      walletId,
      volumeFn: volumeOnChainFn,
    })
    if (onChainNetInbound instanceof Error) return onChainNetInbound

    return (lnNetInbound - onChainNetInbound) as SwapOutImbalance
  }

  return {
    getSwapOutImbalance,
  }
}