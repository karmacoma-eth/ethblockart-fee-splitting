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

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

abstract contract ERC721Ref is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _ids; // token IDs

    mapping(uint256 => uint256) private _bas; // block art supply
    mapping(uint256 => uint256) private _sas; // style art supply
    mapping(uint256 => uint256) private _ats; // art to style
    mapping(uint256 => uint256) private _atb; // art to block
    mapping(uint256 => uint256) private _atv; // art to value
    string _contractURI;
    string baseURI;

    /// @dev Only owner can mint, stores information about the block and style used
    /// @param to The token receiver
    /// @param blockNumber The blocknumber associated
    /// @param styleId The style used
    /// @param value The cost paid
    /// @param metadata The tokenURI pointing to the metadata
    function mint(
        address to,
        uint256 blockNumber,
        uint256 styleId,
        uint256 value,
        string memory metadata
    ) external onlyOwner returns (uint256) {
        _ids.increment();
        uint256 newId = _ids.current();

        _bas[blockNumber] = _bas[blockNumber] + 1;
        _sas[styleId] = _sas[styleId] + 1;
        _ats[newId] = styleId;
        _atb[newId] = blockNumber;
        _atv[newId] = value;

        _safeMint(to, newId);
        _setTokenURI(newId, metadata);

        return newId;
    }

    function _setBaseURI(string memory uri) public onlyOwner {
        baseURI = uri;
    }

    /// @notice Getters

    function _baseURI() override internal view virtual returns (string memory) {
        return baseURI;
    }

    function blockArtSupply(uint256 blockNumber)
        external
        view
        returns (uint256)
    {
        return _bas[blockNumber];
    }

    function styleArtSupply(uint256 styleId) public view returns (uint256) {
        return _sas[styleId];
    }

    function tokenToStyle(uint256 id) public view returns (uint256) {
        require(_exists(id), "Unknown query for unknown token");
        return _ats[id];
    }

    function tokenToBlock(uint256 id) public view returns (uint256) {
        require(_exists(id), "Unknown query for unknown token");
        return _atb[id];
    }

    function tokenToValue(uint256 id) public view returns (uint256) {
        require(_exists(id), "Unknown query for unknown token");
        return _atv[id];
    }

    /// @notice Contract metadata URI management

    function _setContractURI(string memory uri) internal onlyOwner {
        _contractURI = uri;
    }

    function contractURI() external view returns (string memory) {
        return _contractURI;
    }
}