/* global angular */
'use strict';

var chai = require('chai')
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , mockResponse = require('traverson-mock-response')()
  , waitFor = require('poll-forever')
  , assert = chai.assert
  , expect = chai.expect
  , traversonAngular = require('./angular_test_helper');

chai.use(sinonChai);

/*
 * Tests for all of Json Walker's request methods except getResource, which is
 * tested extensively in json_get_resource.js. This test suite contains tests
 * for get, post, put, delete and patch. Each http method verb has it's own
 * describe-section. Since most of the code path is the same for getResource
 * and get, post, ..., there are just a few basic tests here for each verb.
 * The getResource tests are more comprehensive.
 */
describe('The JSON client\'s', function() {

  var get;
  var post;
  var put;
  var patch;
  var del;

  var executeRequest;
  var successCallback;
  var errorCallback;

  var rootUri = 'http://api.io';
  var api = traversonAngular.from(rootUri).json();

  var getUri = rootUri + '/link/to/resource';
  var postUri = rootUri + '/post/something/here';
  var putUri = rootUri + '/put/something/here';
  var patchUri = rootUri + '/patch/me';
  var deleteUri = rootUri + '/delete/me';
  var templateUri = rootUri + '/template/{param}';

  var rootResponse = mockResponse({
    'get_link': getUri,
    'post_link': postUri,
    'put_link': putUri,
    'patch_link': patchUri,
    'delete_link': deleteUri,
    'template_link': templateUri
  });

  var result = mockResponse({ result: 'success' });

  var payload = {
    some: 'stuff',
    data: 4711
  };

  beforeEach(function() {
    get = sinon.stub();
    post = sinon.stub();
    put = sinon.stub();
    patch = sinon.stub();
    del = sinon.stub();
    api.walker.request = {
      get: get,
      post: post,
      put: put,
      patch: patch,
      del: del,
    };
    successCallback = sinon.spy();
    errorCallback = sinon.spy();

    get.withArgs(rootUri, sinon.match.func).callsArgWithAsync(
        1, null, rootResponse, rootResponse.body);
    get.withArgs(getUri, sinon.match.func).callsArgWithAsync(1, null,
        result, result.body);
    get.withArgs(postUri, sinon.match.func).callsArgWithAsync(1,
        new Error('GET is not implemented for this URI, please POST ' +
        'something'));

    executeRequest = sinon.stub(api.finalAction.constructor.prototype,
        'executeRequest');
  });

  afterEach(function() {
    api.finalAction.constructor.prototype.executeRequest.restore();
  });

  describe('get method', function() {

    it('should follow the links', function(done) {
      api
      .newRequest()
      .follow('get_link')
      .get()
      .then(successCallback, errorCallback);
      waitFor(
        function() { return successCallback.called; },
        function() {
          expect(successCallback).to.have.been.calledWith(result);
          expect(errorCallback).to.not.have.been.called;
          done();
        }
      );
    });

    it('should call errorCallback with err', function(done) {
      var err = new Error('test error');
      // Default stubbing from beforeEach is not what we want here.
      // IMO, get.reset() should be enough, but isnt?
      get = sinon.stub();
      api.walker.request = { get: get };
      get.callsArgWithAsync(1, err);
      api
      .newRequest()
      .get()
      .then(successCallback, errorCallback);
      waitFor(
        function() { return errorCallback.called; },
        function() {
          expect(successCallback).to.not.have.been.called;
          expect(errorCallback).to.have.been.calledWith(err);
          done();
        }
      );
    });

    it('should call errorCallback with err when walking along the links fails',
        function(done) {
      var err = new Error('test error');
      // Default stubbing from beforeEach is not what we want here.
      // IMO, get.reset() should be enough, but isnt?
      get = sinon.stub();
      api.walker.request = { get: get };
      get.withArgs(rootUri, sinon.match.func).callsArgWithAsync(
          1, null, rootResponse);
      get.withArgs(getUri, sinon.match.func).callsArgWithAsync(1, err);
      api
      .newRequest()
      .follow('get_link', 'another_link')
      .get()
      .then(successCallback, errorCallback);
      waitFor(
        function() { return errorCallback.called; },
        function() {
          expect(successCallback).to.not.have.been.called;
          expect(errorCallback).to.have.been.calledWith(err);
          done();
        }
      );
    });

  });

  describe('getUri method', function() {

    it('should follow the links and yield the last URI', function(done) {
      api
      .newRequest()
      .follow('get_link')
      .getUri()
      .then(successCallback, errorCallback);
      waitFor(
        function() { return successCallback.called; },
        function() {
          expect(successCallback).to.have.been.calledWith(getUri);
          expect(errorCallback).to.not.have.been.called;
          expect(get.callCount).to.equal(1);
          done();
        }
      );
    });

    it('should yield resolved URI if last URI is a URI template',
        function(done) {
      api
      .newRequest()
      .follow('template_link')
      .withTemplateParameters({ param: 'substituted' })
      .getUri()
      .then(successCallback, errorCallback);
      waitFor(
        function() { return successCallback.called; },
        function() {
          expect(successCallback).to.have.been.calledWith(
              rootUri + '/template/substituted');
          expect(errorCallback).to.not.have.been.called;
          expect(get.callCount).to.equal(1);
          done();
        }
      );
    });
  });


  describe('post method', function() {

    var result = mockResponse({ result: 'success' }, 201);

    it('should follow the links and post to the last URI',
        function(done) {
      executeRequest.withArgs(postUri, sinon.match.object, post, payload,
          sinon.match.func).callsArgWithAsync(4, null, result, postUri);
      api
      .newRequest()
      .follow('post_link')
      .post(payload)
      .then(successCallback, errorCallback);
      waitFor(
        function() { return successCallback.called; },
        function() {
          expect(errorCallback).to.not.have.been.called;
          expect(successCallback).to.have.been.calledWith(result);
          done();
        }
      );
    });

    it('should call errorCallback with err when post fails',
        function(done) {
      var err = new Error('test error');
      executeRequest.withArgs(postUri, sinon.match.object, post, payload,
          sinon.match.func).callsArgWithAsync(4, err);
      api
      .newRequest()
      .follow('post_link')
      .post(payload)
      .then(successCallback, errorCallback);
      waitFor(
        function() { return errorCallback.called; },
        function() {
          expect(errorCallback).to.have.been.calledWith(err);
          expect(successCallback).to.not.have.been.called;
          done();
        }
      );
    });

  });

  describe('put method', function() {

    var result = mockResponse({ result: 'success' }, 200);

    it('should follow the links and put to the last URI',
        function(done) {
      executeRequest.withArgs(putUri, sinon.match.object, put, payload,
          sinon.match.func).callsArgWithAsync(4, null, result, putUri);
      api
      .newRequest()
      .follow('put_link')
      .put(payload)
      .then(successCallback, errorCallback);
      waitFor(
        function() { return successCallback.called; },
        function() {
          expect(successCallback).to.have.been.calledWith(result);
          expect(errorCallback).to.not.have.been.called;
          done();
        }
      );
    });

    it('should call errorCallback with err when put fails',
        function(done) {
      var err = new Error('test error');
      executeRequest.withArgs(putUri, sinon.match.object, put, payload,
          sinon.match.func).callsArgWithAsync(4, err);
      api
      .newRequest()
      .follow('put_link')
      .put(payload)
      .then(successCallback, errorCallback);
      waitFor(
        function() { return errorCallback.called; },
        function() {
          expect(errorCallback).to.have.been.calledWith(err);
          expect(successCallback).to.not.have.been.called;
          done();
        }
      );
    });
  });

  describe('patch method', function() {

    var result = mockResponse({ result: 'success' }, 200);

    it('should follow the links and patch the last URI',
        function(done) {
      executeRequest.withArgs(patchUri, sinon.match.object, patch, payload,
          sinon.match.func).callsArgWithAsync(4, null, result, patchUri);
      api
      .newRequest()
      .follow('patch_link')
      .patch(payload)
      .then(successCallback, errorCallback);
      waitFor(
        function() { return successCallback.called; },
        function() {
          expect(successCallback).to.have.been.calledWith(result);
          expect(errorCallback).to.not.have.been.called;
          done();
        }
      );
    });

    it('should call errorCallback with err when patch fails',
        function(done) {
      var err = new Error('test error');
      executeRequest.withArgs(patchUri, sinon.match.object, patch, payload,
          sinon.match.func).callsArgWithAsync(4, err, null);
      api
      .newRequest()
      .follow('patch_link')
      .patch(payload)
      .then(successCallback, errorCallback);
      waitFor(
        function() { return errorCallback.called; },
        function() {
          expect(errorCallback).to.have.been.calledWith(err);
          expect(successCallback).to.not.have.been.called;
          done();
        }
      );
    });
  });

  describe('delete method', function() {

    var result = mockResponse(null, 204);

    it('should follow the links and delete the last URI',
        function(done) {
      executeRequest.withArgs(deleteUri, sinon.match.object, del, null,
          sinon.match.func).callsArgWithAsync(4, null, result, deleteUri);
      api
      .newRequest()
      .follow('delete_link')
      .delete()
      .then(successCallback, errorCallback);
      waitFor(
        function() { return successCallback.called; },
        function() {
          expect(successCallback).to.have.been.calledWith(result);
          expect(errorCallback).to.not.have.been.called;
          done();
        }
      );
    });

    it('should call errorCallback with err when deleting fails',
        function(done) {
      var err = new Error('test error');
      executeRequest.withArgs(deleteUri, sinon.match.object, del, null,
          sinon.match.func).callsArgWithAsync(4, err);
      api
      .newRequest()
      .follow('delete_link')
      .del()
      .then(successCallback, errorCallback);
      waitFor(
        function() { return errorCallback.called; },
        function() {
          expect(errorCallback).to.have.been.calledWith(err);
          expect(successCallback).to.not.have.been.called;
          done();
        }
      );
    });
  });
});
