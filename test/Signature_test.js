const PriceOracleData = artifacts.require('PriceOracleData');
const TestSignature = artifacts.require('TestSignature');

const { expectEvent, time } = require('@openzeppelin/test-helpers');
const { uint, keccak256, now, numToHex, address, sendRPC, fixed, bytes, encode, sign } = require('./helpers');

describe('Signature', () => {
  let signatureContract;
  let priceData;
  const privateKey = '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10';
  const signer = '0x1826265c3156c3B9b9e751DC4635376F3CD6ee06';

  beforeEach(async () => {
    priceData = await PriceOracleData.new();
    signatureContract = await TestSignature.new();
  });

  it('has correct default data', async () => {
    let { 0: timestamp, 1: value } = await priceData.get(address(0), 'ETH');

    expect(timestamp.toNumber()).to.be.equal(0);
    expect(value.toNumber()).to.be.equal(0);
  });

  it('getSigner() should ecrecover correctly', async () => {
    const [{ message, signature }] = sign(encode('prices', await time.latest(), [['ETH', 700]]), privateKey);
    await priceData.put(message, signature, {
      gas: 1000000,
    });

    expect(await signatureContract.getSigner(message, signature)).to.be.equal(signer);
    expect(await signatureContract.getSigner(bytes('bad'), signature)).not.to.be.equal(signer);
    await expect(signatureContract.getSigner(message, bytes('0xbad'))).to.be.reverted;
  });

  it('should save data from put()', async () => {
    const timestamp = (await time.latest()) - 1;
    const ethPrice = 700;
    const [{ message, signature }] = sign(encode('prices', timestamp, [['ETH', ethPrice]]), privateKey);

    const putTx = await priceData.put(message, signature, {
      gas: 1000000,
    });

    expect(putTx.receipt.gasUsed).to.be.lessThan(86000);
  });

  it('sending data from before previous checkpoint should fail', async () => {
    const timestamp = (await time.latest()) - 1;
    let [{ message, signature }] = sign(encode('prices', timestamp, [['ABC', 100]]), privateKey);
    await priceData.put(message, signature, {
      gas: 1000000,
    });

    const timestamp2 = timestamp - 1;
    const [{ message: message2, signature: signature2 }] = sign(
      encode('prices', timestamp2, [['ABC', 150]]),
      privateKey
    );
    const putTx = await priceData.put(message2, signature2, {
      gas: 1000000,
    });

    expectEvent(putTx, 'UpdateFailed', {});

    ({ 0: signedTimestamp, 1: value } = await priceData.get(signer, 'ABC'));
    expect(value / 1e6).to.be.equal(100);
  });

  it('signing future timestamp should not write to storage', async () => {
    const timestamp = (await time.latest()) + 3601;
    const [{ message, signature }] = sign(encode('prices', timestamp, [['ABC', 100]]), privateKey);
    const putTx = await priceData.put(message, signature, {
      gas: 1000000,
    });

    expectEvent(putTx, 'UpdateFailed', {});

    ({ 0: signedTimestamp, 1: value } = await priceData.get(signer, 'ABC'));
    expect(+value).to.be.equal(0);
  });

  it('two pairs with update', async () => {
    const timestamp = (await time.latest()) - 2;
    const signed = sign(
      encode('prices', timestamp, [
        ['ABC', 100],
        ['BTC', 9000],
      ]),
      privateKey
    );

    for ({ message, signature } of signed) {
      await priceData.put(message, signature, {
        gas: 1000000,
      });
    }

    ({ 0: signedTime, 1: value } = await priceData.get(signer, 'BTC'));
    expect(value / 1e6).to.be.equal(9000);

    ({ 0: signedTime, 1: value } = await priceData.get(signer, 'ABC'));
    expect(value / 1e6).to.be.equal(100);

    //2nd tx
    const later = timestamp + 1;

    const signed2 = sign(
      encode('prices', later, [
        ['ABC', 101],
        ['BTC', 9001],
      ]),
      privateKey
    );

    for ({ message, signature } of signed2) {
      const wrote2b = await priceData.put(message, signature, {
        gas: 1000000,
      });
      expect(wrote2b.receipt.gasUsed).to.be.lessThan(75000);
    }

    ({ 0: signedTime, 1: value } = await priceData.get(signer, 'BTC'));
    expect(value / 1e6).to.be.equal(9001);

    ({ 0: signedTime, 1: value } = await priceData.get(signer, 'ABC'));
    expect(value / 1e6).to.be.equal(101);
  });
});
