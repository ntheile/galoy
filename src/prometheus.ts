import { AdminWallet } from "./LightningAdminImpl";
import { setupMongoConnection } from "./mongodb";
import { Price } from "./priceImpl";

const express = require('express');
const server = express();

const client = require('prom-client');
const register = require('prom-client').register

const equity_g = new client.Gauge({ name: 'shareholder', help: 'value of shareholder' })
const liabilities_g = new client.Gauge({ name: 'liabilities', help: 'how much money customers has' })
const lightning_g = new client.Gauge({ name: 'lightning', help: 'how much money there is our books for lnd' })
const lnd_g = new client.Gauge({ name: 'lnd', help: 'how much money in our node' })
const lndOnChain_g = new client.Gauge({ name: 'lnd_onchain', help: 'how much fund is onChain in lnd' })
const lndOffChain_g = new client.Gauge({ name: 'lnd_offchain', help: 'how much fund is offChain in our node' })
const assetsLiabilitiesDifference_g = new client.Gauge({ name: 'assetsEqLiabilities', help: 'do we have a balanced book' })
const lndBalanceSheetDifference_g = new client.Gauge({ name: 'lndBalanceSync', help: 'are lnd in syncs with our books' })
// const price_g = new client.Gauge({ name: 'price', help: 'BTC/USD price' })

const main = async () => {
	const adminWallet = new AdminWallet()

  server.get('/metrics', async (req, res) => {
    
    try {
      const price = new Price()
      await price.update()
    } catch (err) {
      console.error(`issue getting price: ${err}`)
    }

    await adminWallet.updateEscrows()
    await adminWallet.updateUsersPendingPayment()
    
    const {equity, lightning, liabilities} = await adminWallet.getBalanceSheet()
    const { assetsLiabilitiesDifference, lndBalanceSheetDifference } = await adminWallet.balanceSheetIsBalanced()
    equity_g.set(equity)
    liabilities_g.set(liabilities)
    lightning_g.set(lightning)
    assetsLiabilitiesDifference_g.set(assetsLiabilitiesDifference)
    lndBalanceSheetDifference_g.set(lndBalanceSheetDifference)
    
    const { total, onChain, offChain } = await adminWallet.lndBalances()
    lnd_g.set(total)
    lndOnChain_g.set(onChain)
    lndOffChain_g.set(offChain)
    // price_g.set(price)

    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
  })

  server.get('/healthz', async (req, res) => {
    res.send('OK')
  })
    
  const port = process.env.PORT || 3000;
  console.log(
    `Server listening to ${port}, metrics exposed on /metrics endpoint`,
  )
  server.listen(port);
}

setupMongoConnection().then(() => main()).catch((err) => console.log(err))