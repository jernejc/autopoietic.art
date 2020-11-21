
const expect = require("chai").expect;
const duration = require("../helpers/duration");

const PixelsBid = artifacts.require("PixelsBid");
const Pixels = artifacts.require("Pixels");

contract("PixelsBid tests", async accounts => {

  const _color = web3.utils.stringToHex("FFFFFF");
  const _position = "10010";
  const _price = 2000000;
  const _defaultPrice = 1000000;
  const _contractFee = 10000;
  const _million = 1000000;

  let instance, PixelsContractInstance;

  beforeEach(async () => {
    instance = await PixelsBid.deployed();

    const PixelsContractAddress = await instance.PixelsContract();
    PixelsContractInstance = await Pixels.at(PixelsContractAddress);
  });

  it("check defaultPrice", async () => {
    const defaultPrice = await instance.defaultPrice();
    expect(defaultPrice.toNumber()).to.equal(_defaultPrice, "Default buy price should be 100");
  });

  it("create and purchase a non existing pixel", async () => {
    try {
      const NonExistingPixel = await PixelsContractInstance.exists(_position);
      expect(NonExistingPixel).to.equal(false, "NonExistingPixel pixel should not exist");

      await instance.purchase(_position, _color, { value: _price });

      const NewPixelExists = await PixelsContractInstance.exists(_position);
      expect(NewPixelExists).to.equal(true, "Newly created pixel should exist");

      const contractBalance = await web3.eth.getBalance(instance.address);
      expect(parseInt(contractBalance)).to.equal(_price);

    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("fail to purchase an existing pixel", async () => {
    try {
      const ExistingPixel = await PixelsContractInstance.exists(_position);
      expect(ExistingPixel).to.equal(true, "ExistingPixel pixel should exist");

      try {
        await instance.purchase(_position, _color, { from: accounts[1], value: _price });
      } catch (error) {
        expect(error.reason).to.equal("PixelsBid: You can only purchase a non-existing pixel");
      }

    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("place bid on existing pixel", async () => {
    try {
      const ExistingPixel = await PixelsContractInstance.exists(_position);
      expect(ExistingPixel).to.equal(true, "ExistingPixel pixel should exist");

      await instance.placeBid(_position, duration.days(1), { from: accounts[1], value: _price });

      const pixelBid = await instance.getBidForPixel(_position);

      expect(pixelBid[1].toNumber()).to.equal(_price);
      expect(pixelBid[0]).to.equal(accounts[1]);

    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("fail to place bid with price 0", async () => {
    try {

      try {
        await instance.placeBid(_position, duration.days(1), { from: accounts[1], value: 0 });
      } catch (error) {
        expect(error.reason).to.equal("PixelsBid: Bid amount should be greater than 0 or currently highest bid");
      }
      
    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("fail to place bid with price lower than existing bid", async () => {
    try {

      try {
        await instance.placeBid(_position, duration.days(1), { from: accounts[1], value: _price - 1000 });
      } catch (error) {
        expect(error.reason).to.equal("PixelsBid: Bid amount should be greater than 0 or currently highest bid");
      }
      
    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("fail to place bid on non-existing pixel", async () => {
    try {

      try {
        await instance.placeBid("03434", duration.days(1), { from: accounts[1], value: _price });
      } catch (error) {
        expect(error.reason).to.equal("PixelsBid: Pixel position must exist");
      }
      
    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("place higher bid on pixel with existing bid", async () => {
    try {
      const preRefundBalance = await web3.eth.getBalance(accounts[1]); // save balance before refund

      await instance.placeBid(_position, duration.days(1), { from: accounts[2], value: _price + _price });

      const pixelBid = await instance.getBidForPixel(_position);

      expect(pixelBid[1].toNumber()).to.equal(_price + _price);
      expect(pixelBid[0]).to.equal(accounts[2]);

      // Make sure the existing bid was refunded
      const afterRefundBalance = await web3.eth.getBalance(accounts[1]);
      const expectedAfterRefundBalance = parseInt(preRefundBalance) + _price;
      
      expect(expectedAfterRefundBalance).to.equal(parseInt(afterRefundBalance));

    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("accept the highest bid for given pixel", async () => {
    try {
      const oldOwner = await PixelsContractInstance.ownerOf(_position);
      expect(oldOwner).to.equal(accounts[0]); // make sure the default account is the current owner

      const preAcceptanceBalance = await web3.eth.getBalance(oldOwner); // save balance of owner before bid is accepted
      const preAcceptanceContractBalance = await web3.eth.getBalance(instance.address); // save balance of contract before bid is accepted

      const pixelBid = await instance.getBidForPixel(_position);
      const bidAmount = pixelBid[1].toNumber();

      await PixelsContractInstance.setApprovalForAll(instance.address, true); // contract needs to be approved for transfer
      await instance.acceptBid(_position, { from: oldOwner });

      const newOwner = await PixelsContractInstance.ownerOf(_position);
      expect(newOwner).to.equal(pixelBid[0]);

      const contractFee = bidAmount * _contractFee / _million;
      const ownerFee = bidAmount - contractFee;

      console.log('bidAmount', bidAmount);
      console.log('contractFee', contractFee);
      console.log('ownerFee', ownerFee);

      const afterAcceptanceBalance = await web3.eth.getBalance(oldOwner);
      const afterAcceptanceContractBalance = await web3.eth.getBalance(instance.address);

      //expect(afterAcceptanceBalance).to.equal(parseInt(preAcceptanceBalance) + ownerFee);
      expect(afterAcceptanceContractBalance).to.equal(parseInt(preAcceptanceContractBalance) + contractFee);

    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

});