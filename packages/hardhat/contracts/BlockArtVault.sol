// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2021 karmacoma

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./BStyle.sol";


/// @dev all the accounting is done in basis points (1/100th of a percent) to leave enough room for small fees.
/// For instance, a 0.35% fee split is just expressed as `35`.
contract BlockArtVault is Ownable, ReentrancyGuard {
    using Address for address payable;

    /// @dev 100% in basis points
    uint256 constant ONE_HUNDRED_PERCENT = 100 * 100;

    /// @dev fees collected for treasury
    uint256 public coinsBalance = 0;

    /// @dev fees collected for charities
    uint256 public charityBalance = 0;

    /// @dev style collectable fee balance
    mapping(uint256 => uint256) scfb;

    /// @dev minimum treasury fee in basis points
    uint256 public minTreasuryFeeBasisPoints = 5_00; // 5%

    /// @dev style nft
    address public immutable stylesAddr;

    /// @dev the address that is allowed to call deposit functions
    address public blockArtFactory;

    event CharityBalanceDonated(
        address indexed to,
        uint256 amount
    );

    event StyleFeeCollected(
        address indexed to,
        uint256 indexed styleId,
        uint256 amount
    );

    event TreasuryBalanceCollected(
        address indexed to,
        uint256 amount
    );

    event NewDeposit(
        uint256 indexed styleId,
        uint256 styleFee,
        uint256 charityFee,
        uint256 treasuryFee
    );

    /// @dev check if sender owns token
    modifier onlyStyleOwner(uint256 styleId) {
        BlockStyle _style = BlockStyle(stylesAddr);
        require(msg.sender == _style.ownerOf(styleId), "Sender not Owner");
        _;
    }


    /// @dev check if sender is the allowed factory contract
    modifier onlyFromFactory() {
        require(blockArtFactory != address(0), "must first initialize factory address with setFactoryAddress");
        require(msg.sender == blockArtFactory, "Sender not BlockArtFactory");
        _;
    }


    constructor(address _stylesAddr) {
        require(_stylesAddr != address(0), "Address of the BlockStyle contract can not be the zero address");
        stylesAddr = _stylesAddr;
    }


    /// @dev this function is called by BlockArtFactory at mint time
    /// @dev the frontend should ensure that `styleFeeBasisPoints + charityFeeBasisPoints`
    ///      leaves enough room for `minTreasuryFeeBasisPoints`
    ///
    /// @param styleFeeBasisPoints The style fee in basis points
    /// @param charityFeeBasisPoints The charity fee in basis points
    function depositAndSplit(
        uint256 styleId,
        uint256 styleFeeBasisPoints,
        uint256 charityFeeBasisPoints
    ) external payable onlyFromFactory {
        require((styleFeeBasisPoints + charityFeeBasisPoints + minTreasuryFeeBasisPoints) <= ONE_HUNDRED_PERCENT,
            "invalid styleFeeBasisPoints + charityFeeBasisPoints");
        require(msg.value > 0, "msg.value must not be 0");
        require(BlockStyle(stylesAddr).ownerOf(styleId) != address(0), "styleId does not exist");

        uint256 styleFee = applyFee(msg.value, styleFeeBasisPoints);
        uint256 charityFee = applyFee(msg.value, charityFeeBasisPoints);

        // attribute the styleFee to the owner of that BlockStyle
        scfb[styleId] += styleFee;

        charityBalance += charityFee;

        // attribute the rest to the treasury
        uint256 treasuryFee = msg.value - styleFee - charityFee;
        coinsBalance += treasuryFee;

        emit NewDeposit(styleId, styleFee, charityFee, treasuryFee);
    }


    /// @dev Called from the factory when a new style is minted, art is reminted or burned
    function depositToTreasury() external payable onlyFromFactory {
        coinsBalance += msg.value;
    }


    function getStyleBalance(uint256 styleId) public view returns(uint256) {
        require(BlockStyle(stylesAddr).ownerOf(styleId) != address(0), "styleId does not exist");
        return scfb[styleId];
    }


    /// @dev BlockStyle owner collects style fees
    function collectStyleFees(uint256 styleId)
        external
        onlyStyleOwner(styleId)
        nonReentrant
    {
        uint256 _amount = getStyleBalance(styleId);
        scfb[styleId] = 0;
        emit StyleFeeCollected(msg.sender, styleId, _amount);
        payable(msg.sender).sendValue(_amount);
    }


    /// @dev Contract Owner triggers a transfer of the entire charity balance to some address
    function donateCharityBalance(address payable beneficiary) external onlyOwner nonReentrant {
        require(beneficiary != address(0), "beneficiary must not be the zero address");
        uint256 _amount = charityBalance;
        charityBalance = 0;
        emit CharityBalanceDonated(beneficiary, _amount);
        beneficiary.sendValue(_amount);
    }


    /// @dev Contract Owner collects treasury fees
    function collectCoins() external onlyOwner nonReentrant {
        uint256 _amount = coinsBalance;
        coinsBalance = 0;
        emit TreasuryBalanceCollected(msg.sender, _amount);
        payable(msg.sender).sendValue(_amount);
    }


    function setMinTreasuryFeeBasisPoints(uint256 newMinTreasuryFeeBasisPoints) external onlyOwner {
        require(newMinTreasuryFeeBasisPoints <= ONE_HUNDRED_PERCENT, "invalid minTreasuryFeeBasisPoints");
        minTreasuryFeeBasisPoints = newMinTreasuryFeeBasisPoints;
    }


    function setFactoryAddress(address _blockArtFactory) external onlyOwner {
        require(_blockArtFactory != address(0), "invalid factory address");
        blockArtFactory = _blockArtFactory;
    }


    function applyFee(uint256 value, uint256 feeBasisPoints) private pure returns(uint256) {
        // multiply first to avoid truncation by the division
        return (value * feeBasisPoints) / ONE_HUNDRED_PERCENT;
    }
}