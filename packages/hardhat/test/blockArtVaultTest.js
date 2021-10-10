const { ethers } = require('hardhat')
const { use, expect } = require('chai')
const { solidity } = require('ethereum-waffle')

use(solidity)

describe('EthBlockArt fee splitting', function () {
  const validStyleId = 1
  const invalidStyleId = 42
  let BlockArtVaultFactory
  let BlockStyleFactory
  let blockStyle
  let vault, vaultWithWrongSigner, vaultWithStyleOwner
  let vaultOwner, styleOwner, someOtherUser, charityUser, mockFactoryContract

  async function recordBalances(someVault = vault) {
    let coinsBalance = (await someVault.coinsBalance()).toNumber()
    let charityBalance = (await someVault.charityBalance()).toNumber()
    let artistBalance = (await someVault.getStyleFees(validStyleId)).toNumber()
    return [coinsBalance, charityBalance, artistBalance]
  }

  before('initialize', async () => {
    BlockArtVaultFactory = await ethers.getContractFactory('BlockArtVault')
    BlockStyleFactory = await ethers.getContractFactory('BlockStyle')
    blockStyle = await BlockStyleFactory.deploy('baseURI', 'contractURI')

    ;[owner, styleOwner, someOtherUser, charityUser, mockFactoryContract] =
      await ethers.getSigners()
    await blockStyle.mint(styleOwner.address, 42, 0, 0, 'canvas')
  })

  it('should not deploy BlockArtVault without a valid BlockStyle address', async function () {
    await expect(BlockArtVaultFactory.deploy(ethers.constants.AddressZero)).to.be.reverted
  })

  it('should deploy BlockArtVault successfully with a valid BlockStyle address', async function () {
    vault = await BlockArtVaultFactory.deploy(blockStyle.address)
    let vaultWithWrongSigner = await vault.connect(someOtherUser)
    let vaultWithStyleOwner = await vault.connect(styleOwner)
    let vaultWithMockFactorySigner = await vault.connect(mockFactoryContract)

    let minTreasuryFeeBasisPoints = (await vault.minTreasuryFeeBasisPoints()).toNumber()

    describe('when factory address is not set', () => {
      it('should not accept calls to depositAndSplit', async () => {
        await expect(vault.depositAndSplit(validStyleId, 0, 0, { value: 1000 })).to.be.revertedWith(
          'must first initialize factory address with setFactoryAddress'
        )
      })

      it('should not accept calls to depositToTreasury', async () => {
        await expect(vault.depositToTreasury({ value: 1000 })).to.be.revertedWith(
          'must first initialize factory address with setFactoryAddress'
        )
      })
    })

    describe('when calling setFactoryAddress', () => {
      it('should not accept calls from random user', async () => {
        await expect(
          vaultWithWrongSigner.setFactoryAddress(mockFactoryContract.address)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('should not set it to 0x0', async () => {
        await expect(vault.setFactoryAddress(ethers.constants.AddressZero)).to.be.revertedWith(
          'invalid factory address'
        )
      })

      it('should let the owner set it to a valid address', async () => {
        await vault.setFactoryAddress(mockFactoryContract.address)
      })
    })

    describe('when calling depositAndSplit', () => {
      it("should not accept calls that don't come from the factory address", async () => {
        await expect(vault.depositAndSplit(validStyleId, 0, 0, { value: 1000 })).to.be.revertedWith(
          'Sender not BlockArtFactory'
        )
      })

      it('should not accept calls with an invalid styleId', async () => {
        await expect(
          vaultWithMockFactorySigner.depositAndSplit(invalidStyleId, 0, 0, { value: 1000 })
        ).to.be.revertedWith('ERC721: owner query for nonexistent token')
      })

      it('should not accept styleFeeBasisPoints = -1', async () => {
        await expect(vaultWithMockFactorySigner.depositAndSplit(validStyleId, -1, 0)).to.be.reverted
      })

      it('should not accept styleFeeBasisPoints > 10000', async () => {
        await expect(
          vaultWithMockFactorySigner.depositAndSplit(validStyleId, 123456, 0)
        ).to.be.revertedWith('invalid styleFeeBasisPoints + charityFeeBasisPoints')
      })

      it('should not accept charityFeeBasisPoints = -1', async () => {
        await expect(vaultWithMockFactorySigner.depositAndSplit(validStyleId, 0, -1)).to.be.reverted
      })

      it('should not accept charityFeeBasisPoints > 10000', async () => {
        await expect(
          vaultWithMockFactorySigner.depositAndSplit(validStyleId, 0, 10001)
        ).to.be.revertedWith('invalid styleFeeBasisPoints + charityFeeBasisPoints')
      })

      it('should not accept styleFeeBasisPoints + charityFeeBasisPoints too big for minTreasuryFeeBasisPoints', async () => {
        await expect(
          vaultWithMockFactorySigner.depositAndSplit(validStyleId, 5000, 5000)
        ).to.be.revertedWith('invalid styleFeeBasisPoints + charityFeeBasisPoints')
        await expect(
          vaultWithMockFactorySigner.depositAndSplit(validStyleId, 4800, 4800)
        ).to.be.revertedWith('invalid styleFeeBasisPoints + charityFeeBasisPoints')
      })

      it('should not accept calls with no value', async () => {
        await expect(
          vaultWithMockFactorySigner.depositAndSplit(validStyleId, 0, 0)
        ).to.be.revertedWith('msg.value must not be 0')
      })

      it('should support sending everything to the treasury', async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances()
        await vaultWithMockFactorySigner.depositAndSplit(validStyleId, 0, 0, { value: 1000 })
        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances()

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 1000)
        expect(charityBalanceAfter).to.equal(charityBalanceBefore)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore)
      })

      it('should support sending everything to the artist (minus minTreasuryFeeBasisPoints)', async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances()
        await vaultWithMockFactorySigner.depositAndSplit(
          validStyleId,
          10000 - minTreasuryFeeBasisPoints,
          0,
          { value: 1000 }
        )
        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances()

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 50) // 5% to the treasury
        expect(charityBalanceAfter).to.equal(charityBalanceBefore)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore + 950)
      })

      it('should support sending everything to charity (minus minTreasuryFeeBasisPoints)', async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances()
        await vaultWithMockFactorySigner.depositAndSplit(
          validStyleId,
          0,
          10000 - minTreasuryFeeBasisPoints,
          { value: 1000 }
        )
        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances()

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 50) // 5% to the treasury
        expect(charityBalanceAfter).to.equal(charityBalanceBefore + 950)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore)
      })

      it('should support arbitrary splits like 40% each to charity and artist, 20% to treasury', async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances()
        await vaultWithMockFactorySigner.depositAndSplit(validStyleId, 40 * 100, 40 * 100, {
          value: 1000,
        })
        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances()

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 200)
        expect(charityBalanceAfter).to.equal(charityBalanceBefore + 400)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore + 400)
      })

      it("should support arbitrary splits when the value can't be nicely split", async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances()
        await vaultWithMockFactorySigner.depositAndSplit(validStyleId, 40 * 100, 40 * 100, {
          value: 1001,
        })
        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances()

        // the 40% proportion is calculated for charity and artist, and the _rest_ is sent to treasury
        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 201)
        expect(charityBalanceAfter).to.equal(charityBalanceBefore + 400)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore + 400)
      })
    })

    describe('when calling collectCoins()', () => {
      it('should not accept withdrawals from random addresses', async () => {
        await expect(vaultWithWrongSigner.collectCoins()).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })

      it('should transfer the correct amount to the owner', async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances()

        expect(coinsBalanceBefore).to.be.gt(0)
        await expect(() => vault.collectCoins()).to.changeEtherBalance(owner, coinsBalanceBefore)

        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances()

        expect(coinsBalanceAfter).to.equal(0)
        expect(charityBalanceAfter).to.equal(charityBalanceBefore)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore)
      })
    })

    describe('when calling collectStyleFees(uint256)', () => {
      it('should not accept withdrawals from random addresses', async () => {
        await expect(vaultWithWrongSigner.collectStyleFees(validStyleId)).to.be.revertedWith(
          'Sender not Owner'
        )
      })

      it('should not accept withdrawals from the vault owner', async () => {
        await expect(vault.collectStyleFees(validStyleId)).to.be.revertedWith('Sender not Owner')
      })

      it('should not accept withdrawals for invalid style id', async () => {
        let invalidStyleId = (validStyleId + 1) * 42
        await expect(vaultWithStyleOwner.collectStyleFees(invalidStyleId)).to.be.revertedWith(
          'ERC721: owner query for nonexistent token'
        )
      })

      it('should transfer the correct amount to the style owner', async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances()

        expect(artistBalanceBefore).to.be.gt(0)
        await expect(() =>
          vaultWithStyleOwner.collectStyleFees(validStyleId)
        ).to.changeEtherBalance(styleOwner, artistBalanceBefore)

        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances()

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore)
        expect(charityBalanceAfter).to.equal(charityBalanceBefore)
        expect(artistBalanceAfter).to.equal(0)
      })
    })

    describe('when calling donateCharityBalance(address)', () => {
      it('should not accept withdrawals from random addresses', async () => {
        await expect(
          vaultWithWrongSigner.donateCharityBalance(someOtherUser.address)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('should reject transfers to address zero', async () => {
        await expect(vault.donateCharityBalance(ethers.constants.AddressZero)).to.be.revertedWith(
          'beneficiary must not be the zero address'
        )
      })

      it('should transfer the correct amount to the designated address', async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances()

        expect(charityBalanceBefore).to.be.gt(0)
        await expect(() => vault.donateCharityBalance(charityUser.address)).to.changeEtherBalance(
          charityUser,
          charityBalanceBefore
        )
        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances()

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore)
        expect(charityBalanceAfter).to.equal(0)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore)
      })
    })
  })

  it('should support updating minTreasuryFeeBasisPoints', async () => {
    let vaultWithNewMinTreasuryFeeFromOwner = await BlockArtVaultFactory.deploy(blockStyle.address)
    await vaultWithNewMinTreasuryFeeFromOwner.setFactoryAddress(mockFactoryContract.address)

    let vaultWithNewMinTreasuryFeeFromFactory = await vaultWithNewMinTreasuryFeeFromOwner.connect(
      mockFactoryContract
    )
    let vaultWithNewMinTreasuryFeeWrongSigner =
      vaultWithNewMinTreasuryFeeFromOwner.connect(someOtherUser)

    describe('when calling setMinTreasuryFeeBasisPoints(uint256)', () => {
      it('should reject calls from random addresses', async () => {
        await expect(
          vaultWithNewMinTreasuryFeeWrongSigner.setMinTreasuryFeeBasisPoints(0)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('should validate the new value', async () => {
        await expect(
          vaultWithNewMinTreasuryFeeFromOwner.setMinTreasuryFeeBasisPoints(123456)
        ).to.be.revertedWith('invalid minTreasuryFeeBasisPoints')
      })

      it('should support setting minTreasuryFeeBasisPoints to 0%', async () => {
        await vaultWithNewMinTreasuryFeeFromOwner.setMinTreasuryFeeBasisPoints(0)

        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances(
          vaultWithNewMinTreasuryFeeFromOwner
        )
        await vaultWithNewMinTreasuryFeeFromFactory.depositAndSplit(
          validStyleId,
          50 * 100,
          50 * 100,
          { value: 1000 }
        )
        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances(
          vaultWithNewMinTreasuryFeeFromOwner
        )

        // nothing sent to treasury
        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore)
        expect(charityBalanceAfter).to.equal(charityBalanceBefore + 500)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore + 500)
      })

      it('should support setting minTreasuryFeeBasisPoints to 100%', async () => {
        await vaultWithNewMinTreasuryFeeFromOwner.setMinTreasuryFeeBasisPoints(100 * 100)

        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances(
          vaultWithNewMinTreasuryFeeFromOwner
        )
        await vaultWithNewMinTreasuryFeeFromFactory.depositAndSplit(validStyleId, 0, 0, {
          value: 1000,
        })
        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances(
          vaultWithNewMinTreasuryFeeFromOwner
        )

        // everything sent to treasury
        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 1000)
        expect(charityBalanceAfter).to.equal(charityBalanceBefore)
        expect(artistBalanceAfter).to.equal(artistBalanceBefore)

        // can't event ask for a 0.01% fee split in this case
        await expect(
          vaultWithNewMinTreasuryFeeFromFactory.depositAndSplit(validStyleId, 1, 1, { value: 1000 })
        ).to.be.revertedWith('invalid styleFeeBasisPoints + charityFeeBasisPoints')
      })
    })
  })
})
