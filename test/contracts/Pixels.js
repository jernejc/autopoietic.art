const expect = require("chai").expect;
const BN = require('bn.js');

const Pixels = artifacts.require("Pixels");
const PixelsToken = artifacts.require("PixelsToken");

contract("Pixels coloring tests", async accounts => {
  let pixelsInstance;
  let pixelsTokenInstance;

  // Some general defaults
  const position = web3.utils.utf8ToHex("PT232");
  const color = web3.utils.stringToHex("FFFAAA");
  const bid = new BN(10);

  const positions = ["PT233", "PT234", "PT235", "PT236", "PT237"].map(item => web3.utils.utf8ToHex(item));
  const colors = ["FFFAAA", "FFFAAA", "FFFAAA", "FFFAAA", "FFFAAA"].map(item => web3.utils.stringToHex(item));
  const bids = [bid, bid, bid, bid, bid];
  const bidsSum = bids.reduce((a, b) => b.add(a), new BN(0)); // sum all bids, returns BN

  before(async () => {
    pixelsInstance = await Pixels.deployed();
    pixelsTokenInstance = await PixelsToken.deployed();

    // account[0] already has $PXT from constructing the contract
    // credit account[1] with some $PXT
    await pixelsTokenInstance.credit({ from: accounts[1], value: web3.utils.toWei('2', 'ether') });
    // give pixels contract allowance to spend in accounts[0] behalve
    await pixelsTokenInstance.increaseAllowance(pixelsInstance.address, new BN(1000))
    // give pixels contract allowance to spend in accounts[1] behalve
    await pixelsTokenInstance.increaseAllowance(pixelsInstance.address, new BN(1000), { from: accounts[1] })
  });

  it("set pixel color", async () => {
    const initialBalanceAccount = await pixelsTokenInstance.balanceOf(accounts[0]);
    const initialBalanceContract = await pixelsTokenInstance.balanceOf(pixelsInstance.address);

    try {
      await pixelsInstance.setColor(position, color, bid.toString());

      // Verfiy color is set
      const NewPixelColor = await pixelsInstance.getColor(position);
      expect(NewPixelColor.toString()).to.equal(color.toString());
      // Verify account balance
      const finalBalanceAccount = await pixelsTokenInstance.balanceOf(accounts[0]);
      expect(finalBalanceAccount.toString()).to.equal(initialBalanceAccount.sub(bid).toString());
      // Verify contract balance
      const finalBalanceContract = await pixelsTokenInstance.balanceOf(pixelsInstance.address);
      expect(finalBalanceContract.toString()).to.equal(initialBalanceContract.add(bid).toString());
    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("set pixels colors", async () => {
    const initialBalanceAccount = await pixelsTokenInstance.balanceOf(accounts[0]);
    const initialBalanceContract = await pixelsTokenInstance.balanceOf(pixelsInstance.address);

    try {
      await pixelsInstance.setColors(positions, colors, bids.map(item => item.toString()));

      // Verfiy color is set
      const NewPixelColor = await pixelsInstance.getColor(positions[0]);
      expect(NewPixelColor.toString()).to.equal(colors[0].toString());
      // Verify account balance
      const finalBalanceAccount = await pixelsTokenInstance.balanceOf(accounts[0]);
      expect(finalBalanceAccount.toString()).to.equal(initialBalanceAccount.sub(bidsSum).toString());
      // Verify contract balance
      const finalBalanceContract = await pixelsTokenInstance.balanceOf(pixelsInstance.address);
      expect(finalBalanceContract.toString()).to.equal(initialBalanceContract.add(bidsSum).toString());
    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  });

  it("should detect colors lenght missmatch", async () => {
    const detectedError = "Pixels: positions and colors length mismatch";

    try {
      await pixelsInstance.setColors(positions, colors.filter((_, i) => i !== 0), bids.map(item => item.toString())); // remove first item from colors
    } catch (error) {
      expect(error.toString()).to.contain(detectedError);
    }
  })

  it("should detect bids lenght missmatch", async () => {
    const detectedError = "Pixels: positions and bids length mismatch";

    try {
      await pixelsInstance.setColors(positions, colors, bids.map(item => item.toString()).filter((_, i) => i !== 0)); // remove first item from bids
    } catch (error) {
      expect(error.toString()).to.contain(detectedError);
    }
  })

  it("should detect bids are too low", async () => {
    const detectedError = "Pixels: All bids must be higher than existing";

    try {
      await pixelsInstance.setColors(positions, colors, bids);
    } catch (error) {
      expect(error.toString()).to.contain(detectedError);
    }
  })

  it("should refund existing bids when new one is applied", async () => {
    const newBids = bids.map(item => item.add(new BN(1)));
    const newBidsSum = newBids.reduce((a, b) => b.add(a), new BN(0));

    const initialBalanceAccount0 = await pixelsTokenInstance.balanceOf(accounts[0]);
    const initialBalanceAccount1 = await pixelsTokenInstance.balanceOf(accounts[1]);

    try {
      await pixelsInstance.setColors(positions, colors, newBids.map(item => item.toString()), { from: accounts[1] });

      const finalBalanceAccount0 = await pixelsTokenInstance.balanceOf(accounts[0]);
      expect(finalBalanceAccount0.toString()).to.equal(initialBalanceAccount0.add(bidsSum).toString());
      const finalBalanceAccount1 = await pixelsTokenInstance.balanceOf(accounts[1]);
      expect(finalBalanceAccount1.toString()).to.equal(initialBalanceAccount1.sub(newBidsSum).toString());
      const finalBalanceContract = await pixelsTokenInstance.balanceOf(pixelsInstance.address);
      expect(finalBalanceContract.toString()).to.equal('65'); // we know the value based on previous tests, needs re-factor
    } catch (error) {
      console.error(error);
      assert.fail("One or more errors occured.");
    }
  })

});