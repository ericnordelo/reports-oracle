const Web3 = require('web3');
const BigNumber = require('bignumber.js');

const web3 = new Web3(); // no provider, since we won't make any calls

const fixed = (num) => {
  return new BigNumber(num).toFixed();
};

function uint(n) {
  return web3.utils.toBN(n).toString();
}

function keccak256(str) {
  return web3.utils.keccak256(str);
}

function address(n) {
  return `0x${n.toString(16).padStart(40, '0')}`;
}

function bytes(str) {
  return web3.eth.abi.encodeParameter('string', str);
}

function uint256(int) {
  return web3.eth.abi.encodeParameter('uint256', int);
}

function numToHex(num) {
  return web3.utils.numberToHex(num);
}

function numToBigNum(num) {
  return web3.utils.toBN(num);
}

function now() {
  return Math.floor(new Date() / 1000);
}

async function currentBlockTimestamp(web3_) {
  const blockNumber = await sendRPC(web3_, 'eth_blockNumber', []);
  const block = await sendRPC(web3_, 'eth_getBlockByNumber', [blockNumber.result, false]);
  return block.result.timestamp;
}

function sendRPC(web3_, method, params) {
  return new Promise((resolve, reject) => {
    if (!web3_.currentProvider || typeof web3_.currentProvider === 'string') {
      return reject(`cannot send from currentProvider=${web3_.currentProvider}`);
    }

    web3_.currentProvider.send(
      {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: new Date().getTime(), // Id of the request; anything works, really
      },
      (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      }
    );
  });
}

function getKeyAndValueType(kind) {
  switch (kind) {
    case 'prices':
      return ['symbol', 'decimal'];
    default:
      throw new Error(`Unknown kind of data "${kind}"`);
  }
}

function fancyParameterEncoder(paramType) {
  let actualParamType = paramType,
    actualParamEnc = (x) => x;

  // We add a decimal type for reporter convenience.
  // Decimals are encoded as uints with 6 decimals of precision on-chain.
  if (paramType === 'decimal') {
    actualParamType = 'uint64';
    actualParamEnc = (x) => web3.utils.toBN(1e6).muln(x).toString();
  }

  if (paramType == 'symbol') {
    actualParamType = 'string';
    actualParamEnc = (x) => x.toUpperCase();
  }

  return [actualParamType, actualParamEnc];
}

function encode(kind, timestamp, pairs) {
  const [keyType, valueType] = getKeyAndValueType(kind);
  const [kType, kEnc] = fancyParameterEncoder(keyType);
  const [vType, vEnc] = fancyParameterEncoder(valueType);
  const actualPairs = Array.isArray(pairs) ? pairs : Object.entries(pairs);
  return actualPairs.map(([key, value]) => {
    return web3.eth.abi.encodeParameters(['string', 'uint64', kType, vType], [kind, timestamp, kEnc(key), vEnc(value)]);
  });
}

function encodeRotationMessage(rotationTarget) {
  return web3.eth.abi.encodeParameters(['string', 'address'], ['rotate', rotationTarget]);
}

function sign(messages, privateKey) {
  const actualMessages = Array.isArray(messages) ? messages : [messages];
  return actualMessages.map((message) => {
    const hash = web3.utils.keccak256(message);
    const { r, s, v } = web3.eth.accounts.sign(hash, privateKey);
    const signature = web3.eth.abi.encodeParameters(['bytes32', 'bytes32', 'uint8'], [r, s, v]);
    const signatory = web3.eth.accounts.recover(hash, v, r, s);
    return { hash, message, signature, signatory };
  });
}

module.exports = {
  sendRPC,
  address,
  bytes,
  now,
  numToBigNum,
  numToHex,
  uint256,
  uint,
  keccak256,
  currentBlockTimestamp,
  fixed,
  encode,
  sign,
  encodeRotationMessage,
};
