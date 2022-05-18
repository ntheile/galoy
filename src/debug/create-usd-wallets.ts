/**
 * how to run:
 * yarn ts-node --files -r tsconfig-paths/register src/debug/create-usd-wallets.ts
 */

import { WalletCurrency } from "@domain/shared"
import { WalletType } from "@domain/wallets"
import { isUp } from "@services/lnd/health"
import { params as unauthParams } from "@services/lnd/unauth"
import { setupMongoConnection } from "@services/mongodb"
import { AccountsRepository, WalletsRepository } from "@services/mongoose"

const createUsdWallets = async () => {
  const mongoose = await setupMongoConnection()

  const users = mongoose.connection.db
    .collection("users")
    .aggregate([{ $group: { _id: "$_id" } }], { cursor: { batchSize: 100 } })

  let progress = 0
  for await (const user of users) {
    const account = await AccountsRepository().findByUserId(user._id)
    if (account instanceof Error) return account

    const existingWallets = await WalletsRepository().listByAccountId(account.id)
    if (existingWallets instanceof Error) return existingWallets

    if (!existingWallets.find((wallet) => wallet.currency === "USD")) {
      await WalletsRepository().persistNew({
        accountId: account.id,
        type: WalletType.Checking,
        currency: WalletCurrency.Usd,
      })
      progress++
    }
  }
  console.log(`${progress} users updated`)
}

const main = async () => {
  return createUsdWallets()
}

setupMongoConnection()
  .then(async (mongoose) => {
    await Promise.all(unauthParams.map((lndParams) => isUp(lndParams)))
    await main()
    return mongoose.connection.close()
  })
  .catch((err) => console.log(err))
