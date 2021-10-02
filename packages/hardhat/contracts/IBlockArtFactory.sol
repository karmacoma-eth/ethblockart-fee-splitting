// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2020 adrianleb

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

interface BlockArtFactory {
    struct Bp {
        uint256 bNumber;
        uint256 value;
    }

    /// @dev Mint BlockArt NFTs, splits fees from value,
    /// @dev gives style highest between minimum/multiplier diff, and rest goes to treasury
    /// @param to The token receiver
    /// @param blockNumber The blocknumber associated
    /// @param styleId The style used
    /// @param metadata The tokenURI pointing to the metadata
    function mintArt(
        address to,
        uint256 blockNumber,
        uint256 styleId,
        string memory metadata
    ) external payable;

    /// @dev owner of BlockArts can change their token metadata URI for a fee
    function burnArt(uint256 tokenId) external payable;

    /// @dev owner of BlockArts can change their token metadata URI for a fee
    function remint(uint256 tokenId, string memory metadata)
        external
        payable;

    /// @dev Calculate the cost of minting a BlockArt NFT for a given block and style
    /// @dev Starts with the price floor
    /// @dev Checks for existing price for block, or does dutch auction
    /// @dev Applies style fee multiplier or minimum fee, whichever is highest
    /// @param blockNumber Block number selected
    /// @param styleId BlockStyle ID selected
    function calcArtPrice(uint256 blockNumber, uint256 styleId)
        external
        view
        returns (uint256);

    /// @dev Mint BlockStyle NFTs, anyone can mint a BlockStyle NFT for a fee set by owner of contract
    /// @param to The token receiver
    /// @param cap Initial supply cap
    /// @param feeMul Initial Fee Multiplier
    /// @param feeMin Initial Minimum Fee
    /// @param canvas The token canvas URI
    function mintStyle(
        address to,
        uint256 cap,
        uint256 feeMul,
        uint256 feeMin,
        string memory canvas
    ) external payable;

    /// @dev Checks if is possible to mint with selected Style
    function canMintWithStyle(uint256 styleId)
        external
        view
        returns (uint256);

    /// @notice Withdrawals

    /// @dev BlockStyle owner collects style fees
    function collectStyleFees(uint256 styleId)
        external;

    /// @dev Contract Owner collects treasury fees
    function collectCoins() external;

    /// @dev Contract Owner collects balance
    function collectBalance() external;

    /// @notice Getters

    function getStyleBalance(uint256 styleId) external view returns (uint256);
    function getCoinsBalance() external view returns (uint256);
    function getPriceCeil() external view returns (uint256);
    function getPriceFloor() external view returns (uint256);
    function getDutchLength() external view returns (uint256);
    function getPsfb(uint256 blockNumber) external view returns (uint256);

    /// @notice Internal Constants Management

    function setPsfb(uint256 blockNumber, uint256 value) external;
    function setFloor(uint256 value) external;
    function setCeil(uint256 value) external;
    function setStylePrice(uint256 value) external;
    function setDutchLength(uint256 value) external;
    function setRemintFee(uint256 value) external;
    function setStyleBaseURI(string memory uri) external;
    function setArtContractURI(string memory uri) external;

    /// @notice Allowed Styles List Management
    function addStyle(uint256 styleId) external;
    function removeStyle(uint256 styleId) external;
    function isStyleListed(uint256 styleId) external view returns (bool);
    function setPsfbs(Bp[] calldata psfba) external;
    function setAsl(uint256[] calldata asls) external;

    /// @dev transfers ownership of blockart and blockstyle token contracts owned by factory
    function transferTokensOwnership(address to) external;
}