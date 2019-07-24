const Blockchain = require('./index');
const Block = require('./block');
const { cryptoHash } = require('../util');
const Wallet = require('../wallet');
const Transaction = require('../wallet/transaction');

describe('Blockchain', () => {
  let blockchain, newChain, originalChain;

  beforeEach(() => {
    blockchain = new Blockchain();
    newChain = new Blockchain();
    originalChain = blockchain.chain;
  });

  it('contains a `chain` Array instance', () => {
    expect(blockchain.chain instanceof Array).toBe(true);
  });

  it('starts with the genesis block', () => {
    expect(blockchain.chain[0]).toEqual(Block.genesis());
  });

  it('adds a new block to the chain', () => {
    const newData = 'Poems the Cat';
    blockchain.addBlock({ data: newData });
    expect(blockchain.chain[blockchain.chain.length-1].data).toEqual(newData);
  });

  describe('isValidChain()', () => {
    describe('when the chain does not start with the genesis block', () => {
      it('returns false', () => {
        blockchain.chain[0] = { data: 'fake-genesis' };
        expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
      });
    });

    describe('when the chain starts with the genesis block and has multiple blocks', () => {
      beforeEach(() => {
        blockchain.addBlock({ data: 'Cat' });
        blockchain.addBlock({ data: 'Another Cat' });
        blockchain.addBlock({ data: 'Poetry' });
      });

      describe('and a prevHash reference has changed', () => {
        it('returns false', () => {
          blockchain.chain[2].prevHash = 'broken-prevHash';
          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });

      describe('and the chain contains a block with an invalid field', () => {
        it('returns false', () => {
          blockchain.chain[2].data = 'basement-cat-data';
          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });

      describe('and the chain contains a block with a jumped difficulty', () => {
        it('returns false', () => {
          const prevBlock = blockchain.chain[blockchain.chain.length - 1];
          const prevHash = prevBlock.hash;
          const timestamp = Date.now();
          const nonce = 0;
          const data = [];
          const difficulty = prevBlock.difficulty - 3;
          const hash = cryptoHash(timestamp, prevHash, difficulty, nonce, data);
          const badBlock = new Block({
            timestamp, prevHash, hash, nonce, difficulty, data
          });

          blockchain.chain.push(badBlock);
          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });

      describe('and the chain does not contain any invalid blocks', () => {
        it('returns true', () => {
          expect(Blockchain.isValidChain(blockchain.chain)).toBe(true);
        });
      });
    });
  });

  describe('replaceChain()', () => {
    let errorMock, logMock;
    beforeEach(() => {
      errorMock = jest.fn();
      logMock = jest.fn();

      global.console.error = errorMock;
      global.console.log = logMock;
    });

    describe('when the new chain is not longer', () => {
      beforeEach(() => {
        newChain.chain[0] = { new: 'chain' };
        blockchain.replaceChain(newChain.chain);
      });

      it('does not replace the chain', () => {
        expect(blockchain.chain).toEqual(originalChain);
      });

      it('logs an error', () => {
        expect(errorMock).toHaveBeenCalled();
      });
    });

    describe('when the new chain is longer', () => {
      beforeEach(() => {
        newChain.addBlock({ data: 'Cat' });
        newChain.addBlock({ data: 'Another Cat' });
        newChain.addBlock({ data: 'Poetry' });
      });

      describe('and the new chain is invalid', () => {
        beforeEach(() => {
          newChain.chain[2].hash = 'fakeness';
          blockchain.replaceChain(newChain.chain);
        });

        it('does not replace the chain', () => {
          expect(blockchain.chain).toEqual(originalChain);
        });

        it('logs an error', () => {
          expect(errorMock).toHaveBeenCalled();
        });
      });

      describe('and the new chain is valid', () => {
        beforeEach(() => {
          blockchain.replaceChain(newChain.chain);
        });

        it('replaces the chain', () => {
          expect(blockchain.chain).toEqual(newChain.chain);
        });

        it('logs chain replacement', () => {
          expect(logMock).toHaveBeenCalled();
        });
      });
    });
  });

  describe('validTransactionData()', () => {
    let transaction, rewardTransaction, wallet;

    beforeEach(() => {
      wallet = new Wallet();
      transaction = wallet.createTransaction({ recipient: 'foo-address', amount: 65 });
      rewardTransaction = Transaction.rewardTransaction({ minerWallet: wallet });
    });

    describe('and the transaction data is valid', () => {
      it('returns true', () => {
        newChain.addBlock({ data: [transaction, rewardTransaction]});

        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(true);
      });
    });

    describe('and the transaction data has multiple rewards', () => {
      it('returns false', () => {
        newChain.addBlock({ data: [transaction, rewardTransaction, rewardTransaction]});

        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(false);
      });
    });

    describe('and the transaction data has at least one malformed outputMap', () => {
      describe('and the transaction is not a reward transaction', () => {
        it('returns false', () => {
          transaction.outputMap[wallet.publicKey] = 999999;
          newChain.addBlock({ data: [transaction, rewardTransaction] });

          expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(false);
        });
      });

      describe('and the transaction is a reward transaction', () => {
        it('returns false', () => {
          rewardTransaction.outputMap[wallet.publicKey] = 999999;

          newChain.addBlock({ data: [transaction, rewardTransaction] });

          expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(false);
        });
      });
    });

    describe('and the transaction data has at least one malformed input', () => {
      it('returns false', () => { });
    });

    describe('and a block contains multiple identical transactions', () => {
      it('returns false', () => { });
    });
  });
});