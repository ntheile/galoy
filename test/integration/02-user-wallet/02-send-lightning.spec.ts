import { createHash, randomBytes } from "crypto"
import { TransactionLimits, yamlConfig } from "src/config"
import {
  InsufficientBalanceError,
  LightningPaymentError,
  SelfPaymentError,
  TransactionRestrictedError,
  ValidationInternalError,
} from "src/error"
import { FEECAP } from "src/lndAuth"
import { getActiveLnd, nodesPubKey } from "src/lndUtils"
import { baseLogger } from "src/logger"
import { InvoiceUser } from "src/schema"
import { getHash, sleep } from "src/utils"
import {
  cancelHodlInvoice,
  checkIsBalanced,
  createHodlInvoice,
  createInvoice,
  decodePaymentRequest,
  getInvoice,
  getUserWallet,
  lndOutside1,
  lndOutside2,
  settleHodlInvoice,
  waitFor,
  waitUntilChannelBalanceSyncAll,
} from "test/helpers"

const date = Date.now() + 1000 * 60 * 60 * 24 * 8
// required to avoid oldEnoughForWithdrawal validation
jest.spyOn(global.Date, "now").mockImplementation(() => new Date(date).valueOf())
jest.mock("src/realtimePrice", () => require("test/mocks/realtimePrice"))
jest.mock("src/phone-provider", () => require("test/mocks/phone-provider"))

let userWallet0, userWallet1, userWallet2
let initBalance0, initBalance1
const amountInvoice = 1000
const transactionLimits = new TransactionLimits({
  config: yamlConfig.limits,
  level: "1",
})

beforeAll(async () => {
  userWallet0 = await getUserWallet(0)
  userWallet1 = await getUserWallet(1)
  userWallet2 = await getUserWallet(2)
})

beforeEach(async () => {
  ;({ BTC: initBalance0 } = await userWallet0.getBalances())
  ;({ BTC: initBalance1 } = await userWallet1.getBalances())
})

afterEach(async () => {
  await checkIsBalanced()
})

afterAll(() => {
  jest.restoreAllMocks()
})

describe("UserWallet - Lightning Pay", () => {
  it("sends to another Galoy user with memo", async () => {
    const memo = "invoiceMemo"

    const invoice = await userWallet2.addInvoice({ value: amountInvoice, memo })
    await userWallet1.pay({ invoice })

    const matchTx = (tx) => tx.type === "on_us" && tx.hash === getHash(invoice)

    const user1Txn = await userWallet1.getTransactions()
    expect(user1Txn.filter(matchTx)[0].description).toBe(memo)
    expect(user1Txn.filter(matchTx)[0].type).toBe("on_us")

    const user2Txn = await userWallet2.getTransactions()
    expect(user2Txn.filter(matchTx)[0].description).toBe(memo)
    expect(user2Txn.filter(matchTx)[0].type).toBe("on_us")
  })

  it("sends to another Galoy user with two different memos", async () => {
    const memo = "invoiceMemo"
    const memoPayer = "my memo as a payer"

    const request = await userWallet2.addInvoice({ value: amountInvoice, memo })
    await userWallet1.pay({ invoice: request, memo: memoPayer })

    const matchTx = (tx) => tx.type === "on_us" && tx.hash === getHash(request)

    const user2Txn = await userWallet2.getTransactions()
    expect(user2Txn.filter(matchTx)[0].description).toBe(memo)
    expect(user2Txn.filter(matchTx)[0].type).toBe("on_us")

    const user1Txn = await userWallet1.getTransactions()
    expect(user1Txn.filter(matchTx)[0].description).toBe(memoPayer)
    expect(user1Txn.filter(matchTx)[0].type).toBe("on_us")
  })

  it("sends to another Galoy user a push payment", async () => {
    const res = await userWallet1.pay({
      username: userWallet0.user.username,
      amount: amountInvoice,
    })

    const { BTC: finalBalance0 } = await userWallet0.getBalances()
    const userTransaction0 = await userWallet0.getTransactions()
    const { BTC: finalBalance1 } = await userWallet1.getBalances()
    const userTransaction1 = await userWallet1.getTransactions()

    expect(res).toBe("success")
    expect(finalBalance0).toBe(initBalance0 + amountInvoice)
    expect(finalBalance1).toBe(initBalance1 - amountInvoice)

    expect(userTransaction0[0]).toHaveProperty("username", userWallet1.user.username)
    expect(userTransaction0[0]).toHaveProperty(
      "description",
      `from ${userWallet1.user.username}`,
    )
    expect(userTransaction1[0]).toHaveProperty("username", userWallet0.user.username)
    expect(userTransaction1[0]).toHaveProperty(
      "description",
      `to ${userWallet0.user.username}`,
    )

    userWallet0 = await getUserWallet(0)
    userWallet1 = await getUserWallet(1)

    expect(userWallet0.user.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: userWallet1.user.username }),
      ]),
    )

    expect(userWallet1.user.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: userWallet0.user.username }),
      ]),
    )
  })

  it("pay zero amount invoice", async () => {
    const { request } = await createInvoice({ lnd: lndOutside1 })
    const result = await userWallet1.pay({ invoice: request, amount: amountInvoice })
    expect(result).toBe("success")

    const { BTC: finalBalance } = await userWallet1.getBalances()
    expect(finalBalance).toBe(initBalance1 - amountInvoice)
  })

  it("fails if sends to self", async () => {
    const invoice = await userWallet1.addInvoice({
      value: amountInvoice,
      memo: "self payment",
    })
    await expect(userWallet1.pay({ invoice })).rejects.toThrow(SelfPaymentError)
  })

  it("fails if sends to self an on us push payment", async () => {
    await expect(
      userWallet1.pay({
        username: userWallet1.user.username,
        amount: amountInvoice,
      }),
    ).rejects.toThrow(SelfPaymentError)
  })

  it("fails when user has insufficient balance", async () => {
    const { request: invoice } = await createInvoice({
      lnd: lndOutside1,
      tokens: initBalance1 + 1000000,
    })
    await expect(userWallet1.pay({ invoice })).rejects.toThrow(InsufficientBalanceError)
  })

  it("fails if the user try to send a negative amount", async () => {
    const destination = nodesPubKey[0]
    await expect(
      userWallet1.pay({
        destination,
        username: userWallet0.user.username,
        amount: -amountInvoice,
      }),
    ).rejects.toThrow("amount can't be negative")
  })

  it("fails to pay when channel capacity exceeded", async () => {
    const { request } = await createInvoice({ lnd: lndOutside1, tokens: 1500000 })
    await expect(userWallet0.pay({ invoice: request })).rejects.toThrow(
      LightningPaymentError,
    )
  })

  it("fails to pay zero amount invoice without separate amount", async () => {
    const { request } = await createInvoice({ lnd: lndOutside1 })
    // TODO: use custom ValidationError not apollo error
    await expect(userWallet1.pay({ invoice: request })).rejects.toThrow(
      ValidationInternalError,
    )
  })

  it("fails to pay regular invoice with separate amount", async () => {
    const { request } = await createInvoice({ lnd: lndOutside1, tokens: amountInvoice })
    // TODO: use custom ValidationError not apollo error
    await expect(
      userWallet1.pay({ invoice: request, amount: amountInvoice }),
    ).rejects.toThrow(ValidationInternalError)
  })

  it("fails to pay when withdrawalLimit exceeded", async () => {
    const { request } = await createInvoice({
      lnd: lndOutside1,
      tokens: transactionLimits.withdrawalLimit() + 1,
    })
    await expect(userWallet1.pay({ invoice: request })).rejects.toThrow(
      TransactionRestrictedError,
    )
  })

  it("fails to pay when amount exceeds onUs limit", async () => {
    const request = await userWallet0.addInvoice({
      value: transactionLimits.onUsLimit() + 1,
    })
    await expect(userWallet1.pay({ invoice: request })).rejects.toThrow(
      TransactionRestrictedError,
    )
  })

  const createInvoiceHash = () => {
    const randomSecret = () => randomBytes(32)
    const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex")
    const secret = randomSecret()
    const id = sha256(secret)
    return { id, secret: secret.toString("hex") }
  }

  const functionToTests = [
    {
      name: "getFeeAndPay",
      initialFee: 0,
      fn: function fn(wallet) {
        return async (input) => {
          await wallet.getLightningFee(input)
          return await wallet.pay(input)
        }
      },
    },
    {
      name: "directPay",
      initialFee: FEECAP,
      fn: function fn(wallet) {
        return async (input) => {
          return await wallet.pay(input)
        }
      },
    },
  ]

  functionToTests.forEach(({ fn, name, initialFee }) => {
    describe(`${name}`, () => {
      it("pay invoice", async () => {
        const { request } = await createInvoice({
          lnd: lndOutside1,
          tokens: amountInvoice,
        })
        const result = await fn(userWallet1)({ invoice: request })
        expect(result).toBe("success")

        const { BTC: finalBalance } = await userWallet1.getBalances()
        expect(finalBalance).toBe(initBalance1 - amountInvoice)
      })

      it("fails when repaying invoice", async () => {
        const { request } = await createInvoice({
          lnd: lndOutside1,
          tokens: amountInvoice,
        })
        await fn(userWallet1)({ invoice: request })
        const intermediateBalance = await userWallet1.getBalances()
        const result = await fn(userWallet1)({ invoice: request })
        expect(result).toBe("already_paid")

        const finalBalance = await userWallet1.getBalances()
        expect(finalBalance).toStrictEqual(intermediateBalance)
      })

      it("pay invoice with High CLTV Delta", async () => {
        const { request } = await createInvoice({
          lnd: lndOutside1,
          tokens: amountInvoice,
          cltv_delta: 200,
        })
        const result = await await fn(userWallet1)({ invoice: request })
        expect(result).toBe("success")
        const { BTC: finalBalance } = await userWallet1.getBalances()
        expect(finalBalance).toBe(initBalance1 - amountInvoice)
      })

      it("pay invoice to another Galoy user", async () => {
        const memo = "my memo as a payer"

        const paymentOtherGaloyUser = async ({ walletPayer, walletPayee }) => {
          const { BTC: payerInitialBalance } = await walletPayer.getBalances()
          const { BTC: payeeInitialBalance } = await walletPayee.getBalances()

          const request = await walletPayee.addInvoice({ value: amountInvoice })
          await fn(walletPayer)({ invoice: request, memo })

          const { BTC: payerFinalBalance } = await walletPayer.getBalances()
          const { BTC: payeeFinalBalance } = await walletPayee.getBalances()

          expect(payerFinalBalance).toBe(payerInitialBalance - amountInvoice)
          expect(payeeFinalBalance).toBe(payeeInitialBalance + amountInvoice)

          const hash = getHash(request)
          const matchTx = (tx) => tx.type === "on_us" && tx.hash === hash

          const user2Txn = await walletPayee.getTransactions()
          const user2OnUsTxn = user2Txn.filter(matchTx)
          expect(user2OnUsTxn[0].type).toBe("on_us")
          await checkIsBalanced()

          const user1Txn = await walletPayer.getTransactions()
          const user1OnUsTxn = user1Txn.filter(matchTx)
          expect(user1OnUsTxn[0].type).toBe("on_us")

          // making request twice because there is a cancel state, and this should be re-entrant
          expect(await walletPayer.updatePendingInvoice({ hash })).toBeTruthy()
          expect(await walletPayee.updatePendingInvoice({ hash })).toBeTruthy()
          expect(await walletPayer.updatePendingInvoice({ hash })).toBeTruthy()
          expect(await walletPayee.updatePendingInvoice({ hash })).toBeTruthy()
        }

        await paymentOtherGaloyUser({
          walletPayee: userWallet2,
          walletPayer: userWallet1,
        })
        await paymentOtherGaloyUser({
          walletPayee: userWallet2,
          walletPayer: userWallet0,
        })
        await paymentOtherGaloyUser({
          walletPayee: userWallet1,
          walletPayer: userWallet2,
        })

        // jest.mock("src/lndAuth", () => ({
        //   // remove first lnd so that ActiveLnd return the second lnd
        //   params: jest
        //     .fn()
        //     .mockReturnValueOnce(addProps(inputs.shift()))
        // }))
        // await paymentOtherGaloyUser({walletPayee: userWallet1, walletPayer: userWallet2})

        userWallet0 = await getUserWallet(0)
        userWallet1 = await getUserWallet(1)
        userWallet2 = await getUserWallet(2)

        expect(userWallet0.user.contacts.length).toBeGreaterThanOrEqual(1)
        expect(userWallet0.user.contacts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: userWallet2.user.username }),
          ]),
        )
      })

      it("pay invoice to lnd outside2", async () => {
        const { request } = await createInvoice({
          lnd: lndOutside2,
          tokens: amountInvoice,
          is_including_private_channels: true,
        })

        const { BTC: initialBalance } = await userWallet1.getBalances()

        const result = await fn(userWallet1)({
          invoice: request,
          memo: "pay an unconnected node",
        })

        // wait for balance updates because invoice event
        // arrives before wallet balances updates in lnd
        await waitUntilChannelBalanceSyncAll()

        expect(result).toBe("success")
        const { BTC: finalBalance } = await userWallet1.getBalances()

        // const { id } = await decodePaymentRequest({ lnd: lndOutside2, request })
        // const { results: [{ fee }] } = await MainBook.ledger({ account: userWallet1.accountPath, hash: id })
        // ^^^^ this fetch the wrong transaction

        // TODO: have a way to do this more programatically?
        // base rate: 1, fee Rate: 1
        const fee = 0

        expect(finalBalance).toBe(initialBalance - amountInvoice - fee)
      })

      it("pay hodl invoice", async () => {
        const { id, secret } = createInvoiceHash()

        const { request } = await createHodlInvoice({
          id,
          lnd: lndOutside1,
          tokens: amountInvoice,
        })
        const result = await fn(userWallet1)({ invoice: request })

        expect(result).toBe("pending")
        const { BTC: balanceBeforeSettlement } = await userWallet1.getBalances()
        expect(balanceBeforeSettlement).toBe(
          initBalance1 - amountInvoice * (1 + initialFee),
        )

        // FIXME: necessary to not have openHandler ?
        // https://github.com/alexbosworth/ln-service/issues/122
        await waitFor(async () => {
          try {
            await settleHodlInvoice({ lnd: lndOutside1, secret })
            return true
          } catch (error) {
            baseLogger.warn({ error }, "settleHodlInvoice failed. trying again.")
            return false
          }
        })

        await waitFor(async () => {
          const { is_confirmed } = await getInvoice({ lnd: lndOutside1, id })
          return is_confirmed
        })

        await waitUntilChannelBalanceSyncAll()

        const { BTC: finalBalance } = await userWallet1.getBalances()
        expect(finalBalance).toBe(initBalance1 - amountInvoice)
      }, 60000)

      it("don't settle hodl invoice", async () => {
        const { id } = createInvoiceHash()

        const { request } = await createHodlInvoice({
          id,
          lnd: lndOutside1,
          tokens: amountInvoice,
        })
        const result = await fn(userWallet1)({ invoice: request })

        expect(result).toBe("pending")
        baseLogger.info("payment has timeout. status is pending.")

        const { BTC: intermediateBalance } = await userWallet1.getBalances()
        expect(intermediateBalance).toBe(initBalance1 - amountInvoice * (1 + initialFee))

        await waitFor(async () => {
          try {
            await cancelHodlInvoice({ id, lnd: lndOutside1 })
            return true
          } catch (error) {
            baseLogger.warn({ error }, "cancelHodlInvoice failed. trying again.")
            return false
          }
        })

        await waitFor(async () => {
          const { is_canceled } = await getInvoice({ lnd: lndOutside1, id })
          return is_canceled
        })

        // wait for balance updates because invoice event
        // arrives before wallet balances updates in lnd
        await waitUntilChannelBalanceSyncAll()

        const { BTC: finalBalance } = await userWallet1.getBalances()
        expect(finalBalance).toBe(initBalance1)
      }, 60000)
    })
  })

  it.skip("cancel the payment if the fee is too high", async () => {
    // TODO
  })

  it.skip("expired payment", async () => {
    const memo = "payment that should expire"

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Lightning = require("src/Lightning")
    jest.spyOn(Lightning, "delay").mockImplementation(() => ({
      value: 1,
      unit: "seconds",
      additional_delay_value: 0,
    }))

    const { lnd } = getActiveLnd()

    const request = await userWallet1.addInvoice({ value: amountInvoice, memo })
    const { id } = await decodePaymentRequest({ lnd, request })
    expect(await InvoiceUser.countDocuments({ _id: id })).toBe(1)

    // is deleting the invoice the same as when as invoice expired?
    // const res = await cancelHodlInvoice({ lnd, id })
    // baseLogger.debug({res}, "cancelHodlInvoice result")

    await sleep(5000)

    // hacky way to test if an invoice has expired
    // without having to to have a big timeout.
    // let i = 30
    // let hasExpired = false
    // while (i > 0 || hasExpired) {
    //   try {
    //     baseLogger.debug({i}, "get invoice start")
    //     const res = await getInvoice({ lnd, id })
    //     baseLogger.debug({res, i}, "has expired?")
    //   } catch (err) {
    //     baseLogger.warn({err})
    //   }
    //   i--
    //   await sleep(1000)
    // }

    // try {
    //   await pay({ lnd: lndOutside1, request })
    // } catch (err) {
    //   baseLogger.warn({err}, "error paying expired/cancelled invoice (that is intended)")
    // }

    // await expect(pay({ lnd: lndOutside1, request })).rejects.toThrow()

    // await sleep(1000)

    await userWallet1.getBalances()

    // FIXME: test is failing.
    // lnd doens't always delete invoice just after they have expired

    // expect(await InvoiceUser.countDocuments({_id: id})).toBe(0)

    // try {
    //   await getInvoice({ lnd, id })
    // } catch (err) {
    //   baseLogger.warn({err}, "invoice should not exist any more")
    // }

    // expect(await userWallet1.updatePendingInvoice({ hash: id })).toBeFalsy()
  }, 150000)
})
