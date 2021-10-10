// deploy/00_deploy_your_contract.js

//const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer, styleOwner, artMinter } = await getNamedAccounts();
  await deploy("OldBlockArtFactory", {
    from: deployer,
    //args: [ "Hello", ethers.utils.parseEther("1.5") ],
    log: true,
  });

  await deploy("BlockStyle", {
    from: deployer,
    args: ["baseURI", "contractURI"],
    log: true,
  });

  await deploy("BlockArt", {
    from: deployer,
    args: ["contractURI"],
    log: true,
  });

  const BlockStyle = await ethers.getContract("BlockStyle", deployer);

  const balance = await BlockStyle.balanceOf(styleOwner);
  if (balance == 0) {
    console.log("style owner has no BlockStyle NFT yet, minting one");
    await BlockStyle.mint(styleOwner, 200, 0, 0, "", { from: deployer});
  }

  const styleId = 1;
  const styleCreator = await BlockStyle.getCreator(styleId);
  // verify that we just minted style 1
  console.log("styleCreator of styleId 1 is", styleCreator);
  console.log("styleCreator === styleOwner", styleCreator == styleOwner);
  if (styleCreator !== styleOwner) {
    console.log("creating a new styleId for our styleOwner");

    /*
    function mint(
      address to,
      uint256 cap,
      uint256 feeMul,
      uint256 feeMin,
      string memory canvas)
    */
    await BlockStyle.mint(styleOwner, 200, 0, 0, "", { from: deployer});
  } else {
    console.log("no need to mint a new style id");
  }

  const BlockArt = await ethers.getContract("BlockArt", deployer);
  const OldBlockArtFactory = await ethers.getContract("OldBlockArtFactory", deployer);

  await deploy("BlockArtVault", {
    from: deployer,
    args: [BlockStyle.address],
    log: true,
  });

  const BlockArtVault = await ethers.getContract("BlockArtVault", deployer);

  await deploy("BlockArtFactoryV3", {
    from: deployer,
    args: [BlockArt.address, BlockStyle.address, OldBlockArtFactory.address, BlockArtVault.address],
    log: true,
  });

  const BlockArtFactoryV3 = await ethers.getContract("BlockArtFactoryV3", deployer);

};

module.exports.tags = ["OldBlockArtFactory"];
