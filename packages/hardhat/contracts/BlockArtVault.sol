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
import "./BStyle.sol";

// TODO: deposit to treasury only (on events like burn and remint)
// TODO: move other fund management functions (artist collecting fees, etc)
// TODO: make this upgradable?
// TODO: natspec everything out
// TODO: add some reentrancy guard goodness

/// @dev all the accounting is done in basis points (1/100th of a percent) to leave enough room for small fees. For instance, a 0.35% fee split is just expressed as `35`.
contract BlockArtVault is Ownable {
    /// @dev 100% in basis points
    uint256 constant ONE_HUNDRED_PERCENT = 10e5;

    /// @dev fees collected for treasury
    uint256 public coinsBalance = 0;

    /// @dev fees collected for charities
    uint256 public charityBalance = 0;

    /// @dev style collectable fee balance
    mapping(uint256 => uint256) scfb;

    /// @dev minimum treasury fee in basis points
    uint256 public minTreasuryFeeBasisPoints = 500; // 5%

    /// @dev style nft
    address public immutable stylesAddr;

    event CharityBalanceDonated(
        address indexed to,
        uint256 amount
    );

    event StyleFeeCollected(
        address indexed to,
        uint256 styleId,
        uint256 amount
    );

    /// @dev check if sender owns token
    modifier onlyStyleOwner(uint256 styleId) {
        BlockStyle _style = BlockStyle(stylesAddr);
        require(msg.sender == _style.ownerOf(styleId), "Sender not Owner");
        _;
    }


    constructor(address _stylesAddr) {
        stylesAddr = _stylesAddr;
    }


    /// @dev this function is called by BlockArtFactory at mint time
    /// @dev the frontend should ensure that `styleFeeBasisPoints + charityFeeBasisPoints` leaves enough room for `minTreasuryFeeBasisPoints`
    ///
    /// @param styleFeeBasisPoints The style fee in basis points
    /// @param charityFeeBasisPoints The charity fee in basis points
    function depositAndSplit(
        uint256 styleId,
        uint256 styleFeeBasisPoints,
        uint256 charityFeeBasisPoints
    ) external payable {
        require((styleFeeBasisPoints + charityFeeBasisPoints + minTreasuryFeeBasisPoints) <= ONE_HUNDRED_PERCENT, "invalid styleFeeBasisPoints + charityFeeBasisPoints");

        uint256 styleFee = applyFee(msg.value, styleFeeBasisPoints);
        uint256 charityFee = applyFee(msg.value, charityFeeBasisPoints);

        // attribute the styleFee to the owner of that BlockStyle
        scfb[styleId] += styleFee;

        charityBalance += charityFee;

        // attribute the rest to the treasury
        coinsBalance += msg.value - styleFee - charityFee;
    }


    function depositToTreasury() external payable {
        coinsBalance += msg.value;
    }


    /// @dev BlockStyle owner collects style fees
    function collectStyleFees(uint256 styleId)
        external
        onlyStyleOwner(styleId)
    {
        uint256 _amount = scfb[styleId];
        scfb[styleId] = 0;
        payable(msg.sender).transfer(_amount);
        
        emit StyleFeeCollected(msg.sender, styleId, _amount);
    }


    /// @dev Contract Owner triggers a transfer of the entire charity balance to some address
    function donateCharityBalance(address payable beneficiary) external onlyOwner {
        uint256 _amount = charityBalance;
        charityBalance = 0;
        beneficiary.transfer(_amount);

        emit CharityBalanceDonated(beneficiary, _amount);
    }


    /// @dev Contract Owner collects treasury fees
    function collectCoins() external onlyOwner {
        uint256 _amount = coinsBalance;
        coinsBalance = 0;
        payable(msg.sender).transfer(_amount);
    }


    function setMinTreasuryFeeBasisPoints(uint256 newMinTreasuryFeeBasisPoints) external onlyOwner {
        require(newMinTreasuryFeeBasisPoints <= ONE_HUNDRED_PERCENT, "invalid minTreasuryFeeBasisPoints");
        minTreasuryFeeBasisPoints = newMinTreasuryFeeBasisPoints;
    }


    function getStyleBalance(uint256 styleId) external view returns (uint256) {
        return scfb[styleId];
    }


    function applyFee(uint256 value, uint256 feeBasisPoints) private pure returns(uint256) {
        return value / feeBasisPoints * ONE_HUNDRED_PERCENT;
    }
}