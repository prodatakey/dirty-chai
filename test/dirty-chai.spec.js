'use strict';

describe('dirty chai', function() {
  describe('ok', function() {
    describe('when true expression', function() {
      it('should not assert function', function() {
          expect(true).to.be.ok();
      });

      it('should not assert property', function() {
          expect(true).to.be.ok.and.not.equal(false);
      });

      it('should not assert another chain conversion', function() {
          expect(true).to.be.ok.and.not.false();
      });

      it('should not assert with ensure', function() {
          expect(true).to.be.ok.ensure();
          expect(true).to.be.ok.not.ensure();
      });
    });

    describe('when false expression', function() {
      it('should assert non-function at chain end', function() {
        expect(function() {
          expect(true).to.not.be.ok.and.not.equal(false);
        }).to.throw(/expected true to be falsy/);
      });

      it('should assert with custom message at chain end', function() {
        expect(function() {
          expect(true).to.not.be.false.and.be.ok('true is not ok');
        }).to.throw(/true is not ok/);
      });

      it('should assert function mid-chain', function() {
        expect(function() {
          expect(true).to.not.be.ok().and.not.equal(false);
        }).to.throw(/expected true to be falsy/);
      });

      it('should assert with custom message mid-chain', function() {
        expect(function() {
          expect(true).to.not.be.ok('true is not ok').and.not.equal(false);
        }).to.throw(/true is not ok/);
      });

      it('should assert with custom message of terminating assert', function() {
        expect(function() {
          expect(true).to.be.ok.and.not.equal(true, 'true is not ok');
        }).to.throw(/true is not ok/);
      });

      it('should assert with ensure', function() {
        expect(function() {
          expect(true).to.not.be.ok.ensure();
        }).to.throw(/expected true to be falsy/);
      });
    });
  });

  describe('when plugin creates new property', function() {
    var stubCalled;

    beforeEach(function() {
      stubCalled = false;

      chai.use(function(chai, util) {
        util.addProperty(chai.Assertion.prototype, 'testAssertion', function() { stubCalled = true; console.log('stubCalled'); });
      });
    });

    afterEach(function() {
      chai.use(function(chai) {
        delete chai.Assertion.prototype.testAssertion;
      });
    });

    it('should be converted to a chainable method', function() {
      var assertion = new chai.Assertion(true);
      assertion.should.have.a.property('testAssertion').and.should.be.a('function');
    });

    it('should call assertion', function() {
      expect(true).to.testAssertion();

      expect(stubCalled).to.be.true();
    });
  });
});
