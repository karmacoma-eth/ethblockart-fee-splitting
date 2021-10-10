# 🏦 BlockArtVault

This is a submission to the ETHGlobal October 2021 hackathon.

We introduce a new smart contract integration for [ethblock.art](https://ethblock.art/), such that at mint time, users can select how the minting fee will be split between:

- the style artist
- the EthBlockArt treasury
- a charity fund

The UI is responsible for providing this affordance to users (TBD) and submitting it in the minting transaction.

On the smart contract end, a new [BlockArtFactoryV3.mintArt()](https://github.com/karmacoma-eth/scaffoldy-ethblockart/blob/master/packages/hardhat/contracts/BlockArtFactoryV3.sol#L100) function expects two new arguments:

- `uint256 styleFeeBasisPoints`
- `uint256 charityFeeBasisPoints`

It passes these along to a new [BlockArtVault.sol](https://github.com/karmacoma-eth/scaffoldy-ethblockart/blob/master/packages/hardhat/contracts/BlockArtVault.sol) contract that is responsible for holding all the funds and doing all the accounting.

For instance, the [depositAndSplit](https://github.com/karmacoma-eth/scaffoldy-ethblockart/blob/master/packages/hardhat/contracts/BlockArtVault.sol#L80) function computes the `styleFee` and `charityFee` based on user input and credits them to the appropriate balances. The rest goes to the treasury (`coinsBalance`), retrievable by the `BlockArtVault` owner.

The intention for the charity fund is for the EthBlockArt community to vote on a specific charity to donate funds to. At the end of the process, the `BlockArtVault` owner would call [donateCharityBalance(address payable beneficiary)](https://github.com/karmacoma-eth/scaffoldy-ethblockart/blob/master/packages/hardhat/contracts/BlockArtVault.sol#L126) to send the entire `charityBalance` to the designated charity address.


# Testing

Having all the funds managed in `BlockArtVault` makes it easier to test different corner cases around deposits and withdrawals, and `BlockArtFactory` can focus on the administration of styles and art.

See the tests in [blockArtVaultTest.js](https://github.com/karmacoma-eth/scaffoldy-ethblockart/blob/master/packages/hardhat/test/blockArtVaultTest.js):

```
  EthBlockArt fee splitting
    ✅ should not deploy BlockArtVault without a valid BlockStyle address
    ✅ should deploy BlockArtVault successfully with a valid BlockStyle address (48ms)
    ✅ should support updating minTreasuryFeeBasisPoints

  when calling depositAndSplit
    ✅ should not accept styleFeeBasisPoints = -1
    ✅ should not accept styleFeeBasisPoints > 10000
    ✅ should not accept charityFeeBasisPoints = -1
    ✅ should not accept charityFeeBasisPoints > 10000
    ✅ should not accept styleFeeBasisPoints + charityFeeBasisPoints too big for minTreasuryFeeBasisPoints
    ✅ should not accept calls with no value
    ✅ should support sending everything to the treasury (39ms)
    ✅ should support sending everything to the artist (minus minTreasuryFeeBasisPoints)
    ✅ should support sending everything to charity (minus minTreasuryFeeBasisPoints) (38ms)
    ✅ should support arbitrary splits like 40% each to charity and artist, 20% to treasury
    ✅ should support arbitrary splits when the value can't be nicely split

  when calling collectCoins()
    ✅ should not accept withdrawals from random addresses
    ✅ should transfer the correct amount to the owner

  when calling collectStyleFees(uint256)
    ✅ should not accept withdrawals from random addresses
    ✅ should not accept withdrawals from the vault owner
    ✅ should not accept withdrawals for invalid style id
    ✅ should transfer the correct amount to the style owner (39ms)

  when calling donateCharityBalance(address)
    ✅ should not accept withdrawals from random addresses
    ✅ should reject transfers to address zero
    ✅ should transfer the correct amount to the designated address

  when calling setMinTreasuryFeeBasisPoints(uint256)
    ✅ should reject calls from random addresses
    ✅ should validate the new value
    ✅ should support setting minTreasuryFeeBasisPoints to 0% (38ms)
    ✅ should support setting minTreasuryFeeBasisPoints to 100% (40ms)


  27 passing (1s)

✨  Done in 3.29s.
```

# 🧰 How to

Compile:

    yarn compile


Run tests:

    yarn tests


Run Slither:

    (cd packages/hardhat && slither .)


# Improvement Ideas

💌 voting for the charity based on verified EthBlockArt holder status in Discord

⏳ a timelock mechanism for the charity donations (i.e. nominate a new beneficiary address that can only receive funds after being nominated for X days)
