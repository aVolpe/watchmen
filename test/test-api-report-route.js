var request = require('supertest');
var assert = require('assert');
var express = require('express');
var passport = require('passport');
var mockPassport = require('passport-mock');
var storageFactory = require('../lib/storage/storage-factory');
var storage = storageFactory.getStorageInstance('test');

var app = require('../webserver/app')(storage);

describe('report route', function () {

  var server;
  var PORT = 3355;
  var validService;

  var USERS = [
    {id: 1, email: 'admin@domain.com', isAdmin: true},
    {id: 2, email: 'user@domain.com', isAdmin: false}
  ];

  var API_ROOT = '/api/report';

  var agent = request.agent(app);

  before(function (done) {

    app.use(passport.initialize());
    app.use(passport.session());

    var mock = mockPassport(passport, USERS);
    mock(app);

    server = app.listen(PORT, function () {
      if (server.address()) {
        console.log('starting server in port ' + PORT);
        done();
      } else {
        console.log('something went wrong... couldn\'t listen to that port.');
        process.exit(1);
      }
    });
  });

  after(function () {
    server.close();
  });

  beforeEach(function () {
    validService = {
      name: 'my new service',
      pingServiceName: 'http-head',
      url: 'http://apple.com',
      timeout: 10000,
      port: 80,
      interval: 60000,
      failureInterval: 30000,
      warningThreshold: 30000
    };
  });

  describe('reporting a service', function () {

    describe('with an anonymous user', function () {

      before(function (done) {
        agent.get('/logout').expect(302, done);
      });

      it('should not require auth', function (done) {
        storage.addService(validService, function (err, id) {
          assert.ifError(err);
          agent
              .get(API_ROOT + '/services/' + id)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .send()
              .end(function (err, res) {
                assert.equal(res.body.service.interval, validService.interval);
                done(err);
              });
        });
      });

      it('should return 404 if the service does not exist', function (done) {
        agent
            .get(API_ROOT + '/services/22222')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .send()
            .end(function (err) {
              done(err);
            });
      });

      it('should have not access if restrictions are applied', function (done) {
        validService.restrictedTo = "other@domain.com";
        storage.addService(validService, function (err, id) {
          assert.ifError(err);
          agent
              .get(API_ROOT + '/services/' + id)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .send()
              .end(function (err, res) {
                done(err);
              });
        });
      });

    });

    describe('with an authenticated user', function () {

      before(function (done) {
        agent.get('/login/test/2').expect(200, done);
      });

      it('should have not access if restrictions are applied but user is not included', function (done) {
        validService.restrictedTo = "other@domain.com";
        storage.addService(validService, function (err, id) {
          assert.ifError(err);
          agent
              .get(API_ROOT + '/services/' + id)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .send()
              .end(function (err, res) {
                done(err);
              });
        });
      });

      it('should have access if restrictions include the current user', function (done) {
        validService.restrictedTo = "user@domain.com";
        storage.addService(validService, function (err, id) {
          assert.ifError(err);
          agent
              .get(API_ROOT + '/services/' + id)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .send()
              .end(function (err, res) {
                done(err);
              });
        });
      });

    });
  });

  describe('loading all services', function () {

    describe('with an anonymous user', function () {

      before(function (done) {
        agent.get('/logout').expect(302, done);
      });

      it('should not require auth', function (done) {
        storage.flush_database(function () {
          storage.addService(validService, function (err, id) {
            assert.ifError(err);
            agent
                .get(API_ROOT + '/services')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .send()
                .end(function (err, res) {
                  assert.equal(res.body.length, 1);
                  assert.ok(res.body[0].status);
                  assert.equal(res.body[0].service.interval, validService.interval);
                  done(err);
                });
          });
        });
      });

    });
  });

});