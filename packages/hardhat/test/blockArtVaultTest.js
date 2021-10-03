const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

describe("EthBlockArt fee splitting", function () {
  const validStyleId = 1;
  let BlockArtVaultFactory;
  let BlockStyleFactory;
  let blockStyle;
  let vault;
  let users;

  async function recordBalances() {
    let coinsBalance = (await vault.coinsBalance()).toNumber();
    let charityBalance = (await vault.charityBalance()).toNumber();
    let artistBalance = (await vault.getStyleFees(validStyleId)).toNumber();
    return [coinsBalance, charityBalance, artistBalance];
  }

  before('initialize', async () => {
    BlockArtVaultFactory = await ethers.getContractFactory("BlockArtVault");
    BlockStyleFactory = await ethers.getContractFactory("BlockStyle");
    blockStyle = await BlockStyleFactory.deploy("baseURI", "contractURI");

    users = await ethers.getSigners()
    await blockStyle.mint(users[0].address, 42, 0, 0, "canvas");
  });

  it("should not deploy BlockArtVault without a valid BlockStyle address", async function () {
    await expect(BlockArtVaultFactory.deploy(ethers.constants.AddressZero)).to.be.reverted;
  });

  it("should deploy BlockArtVault successfully with a valid BlockStyle address", async function () {
    vault = await BlockArtVaultFactory.deploy(blockStyle.address);
    let minTreasuryFeeBasisPoints = (await vault.minTreasuryFeeBasisPoints()).toNumber();

    describe("when calling depositAndSplit", () => {
      it("should not accept styleFeeBasisPoints = -1", async () => {
        await expect(vault.depositAndSplit(validStyleId, -1, 0)).to.be.reverted;
      })

      it("should not accept styleFeeBasisPoints > 10000", async () => {
        await expect(vault.depositAndSplit(validStyleId, 123456, 0)).to.be.revertedWith("invalid styleFeeBasisPoints + charityFeeBasisPoints");
      })

      it("should not accept charityFeeBasisPoints = -1", async () => {
        await expect(vault.depositAndSplit(validStyleId, 0, -1)).to.be.reverted;
      })

      it("should not accept charityFeeBasisPoints > 10000", async () => {
        await expect(vault.depositAndSplit(validStyleId, 0, 10001)).to.be.revertedWith("invalid styleFeeBasisPoints + charityFeeBasisPoints");
      })

      it("should not accept styleFeeBasisPoints + charityFeeBasisPoints too big for minTreasuryFeeBasisPoints", async () => {
        await expect(vault.depositAndSplit(validStyleId, 5000, 5000)).to.be.revertedWith("invalid styleFeeBasisPoints + charityFeeBasisPoints");
        await expect(vault.depositAndSplit(validStyleId, 4800, 4800)).to.be.revertedWith("invalid styleFeeBasisPoints + charityFeeBasisPoints");
      })

      it("should not accept calls with no value", async () => {
        await expect(vault.depositAndSplit(validStyleId, 0, 0)).to.be.revertedWith("msg.value must not be 0");
      })

      it("should support sending everything to the treasury", async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances();
        await vault.depositAndSplit(validStyleId, 0, 0, {value: 1000});

        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances();

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 1000);
        expect(charityBalanceAfter).to.equal(charityBalanceBefore);
        expect(artistBalanceAfter).to.equal(artistBalanceBefore);
      })

      it("should support sending everything to the artist (minus minTreasuryFeeBasisPoints)", async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances();
        await vault.depositAndSplit(validStyleId, 10000 - minTreasuryFeeBasisPoints, 0, {value: 1000});

        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances();

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 50); // 5% to the treasury
        expect(charityBalanceAfter).to.equal(charityBalanceBefore);
        expect(artistBalanceAfter).to.equal(artistBalanceBefore + 950);
      })

      it("should support sending everything to charity (minus minTreasuryFeeBasisPoints)", async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances();
        await vault.depositAndSplit(validStyleId, 0, 10000 - minTreasuryFeeBasisPoints, {value: 1000});

        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances();

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 50); // 5% to the treasury
        expect(charityBalanceAfter).to.equal(charityBalanceBefore + 950);
        expect(artistBalanceAfter).to.equal(artistBalanceBefore);
      })

      it("should support arbitrary splits like 40% each to charity and artist, 20% to treasury", async () => {
        let [coinsBalanceBefore, charityBalanceBefore, artistBalanceBefore] = await recordBalances();
        await vault.depositAndSplit(validStyleId, 40 * 100, 40 * 100, {value: 1000});

        let [coinsBalanceAfter, charityBalanceAfter, artistBalanceAfter] = await recordBalances();

        expect(coinsBalanceAfter).to.equal(coinsBalanceBefore + 200);
        expect(charityBalanceAfter).to.equal(charityBalanceBefore + 400);
        expect(artistBalanceAfter).to.equal(artistBalanceBefore + 400);
      })
    });
  });
});
