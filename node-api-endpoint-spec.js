'use strict';
/* jshint expr:true */
var expect = require('chai').expect;
var app = require('../../app');
var request = require('supertest');
var _ = require('lodash');

describe('Library API - Admin only access', function(){

  var adminToken;

  before(function(done){
    request(app)
    .post('/oauth/token')
    .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({grant_type: 'password', username: 'admin@admin.com', password: 'c@bb@ge', client_id: 'admintestclient', client_secret: 'testsecret'})
    .end(function(err, res){
      expect(res.status).to.equal(200);
      adminToken = res.body.access_token;
      expect(res.body.access_token).to.exist;
      done();
    });
  });

  describe('GET /v1/libraries', function() {

    it('should respond with JSON array', function(done) {
      request(app)
        .get('/v1/libraries')
        .set('Authorization', adminToken)
        .end(function(err, res) {
          expect(res.status).to.equal(200);
          expect(res.type).to.equal('application/json');
          expect(res.body).to.be.an.instanceof(Array); 
          done();
        });
    });
  });

  describe('GET /v1/libraries/search', function() {

    it('should return an array of libraries that match the search query', function(done) {
      request(app)
      .get('/v1/libraries/search?q=skee+tv+2')
      .set('Authorization', adminToken)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        expect(res.body.payload.length).to.equal(1);
        expect(res.body.meta.count).to.equal(1);
        done();
      });
    });
  });

  describe("GET /v1/libraries/:id", function() {

    it("should respond with an object", function(done) {
      request(app)
      .get('/v1/libraries/babac4212ab457c0de625d11')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.type).to.equal('application/json');
        expect(res.body.payload).to.have.property('name', 'Skee TV 2');
        expect(res.body.meta.count).to.equal(3);
        done();
      });
    });

    it("should observe pagination", function(done) {
      request(app)
      .get('/v1/libraries/babac4212ab457c0de625d11?page=2&pageSize=2')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.type).to.equal('application/json');
        expect(res.body.payload).to.have.property('name', 'Skee TV 2');
        expect(res.body.payload.assets.length).to.equal(1);
        expect(res.body.meta.count).to.equal(3);
        done();
      });
    });
    
    it("should observe pageSize query param exclusively", function(done) {
      request(app)
      .get('/v1/libraries/babac4212ab457c0de625d11?pageSize=2')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.type).to.equal('application/json');
        expect(res.body.payload).to.have.property('name', 'Skee TV 2');
        expect(res.body.payload.assets.length).to.equal(2);
        expect(res.body.payload.assets[0].name).to.equal('Lil Wayne on Bus');
        expect(res.body.meta.count).to.equal(3);
        done();
      });
    });

    it("should observe page number query param exclusively", function(done) {
      request(app)
      .get('/v1/libraries/babac4212ab457c0de625d11?page=2')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.type).to.equal('application/json');
        expect(res.body.payload).to.have.property('name', 'Skee TV 2');
        expect(res.body.payload.assets.length).to.equal(0);
        expect(res.body.meta.count).to.equal(3);
        done();
      });
    });

    it("should sort populated assets via the sortBy query param in descending order", function(done) {
      request(app)
      .get('/v1/libraries/babac4212ab457c0de625d11?sortBy=-ingestDate')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.type).to.equal('application/json');
        expect(res.body.payload.assets[0]).to.have.property('name', 'Paradiso Girls');
        expect(res.body.payload.assets.length).to.equal(3);
        expect(res.body.meta.count).to.equal(3);
        done();
      });
    });

    it("should sort populated assets via the sortBy query param in ascending order", function(done) {
      request(app)
      .get('/v1/libraries/babac4212ab457c0de625d11?sortBy=ingestDate')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.type).to.equal('application/json');
        expect(res.body.payload.assets[2]).to.have.property('name', 'Paradiso Girls');
        expect(res.body.payload.assets.length).to.equal(3);
        expect(res.body.meta.count).to.equal(3);
        done();
      });
    });

    it("should return correct library assets determined by all query params", function(done) {
      request(app)
      .get('/v1/libraries/babac4212ab457c0de625d11?sortBy=-ingestDate&page=2&pageSize=1')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.type).to.equal('application/json');
        expect(res.body.payload.assets[0]).to.have.property('name', 'Lil Wayne on Bus');
        expect(res.body.payload.assets.length).to.equal(1);
        expect(res.body.meta.count).to.equal(3);
        done();
      });
    });

    it("should respond with a 500 status if bad API endpoint called", function(done) {
      request(app)
      .get('/v1/libraries/55a6fb9b3d03da')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(500);
        done();
      });
    });

    it("should respond with a 404 if library doesn't exists at endpoint", function(done) {
      request(app)
      .get('/v1/libraries/babac4212ab457c0de625d00')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(404);
        done();
      });
    });
  });

  describe('POST /v1/libraries', function () {

    it('should respond with a 201 upon successful library addition', function (done) {
      request(app)
      .post('/v1/libraries')
      .set('Authorization', adminToken)
      .send({_id: 'babac4212ab457c0de625d13', name: 'Skee TV 3'})
      .end(function(err, res){
        expect(err).to.be.null;
        expect(res.statusCode).to.equal(201);
        expect(res.body).to.have.property('name', 'Skee TV 3');
        done();
      });
    });
  });

  describe('PUT/PATCH /v1/libraries:id', function () {

    it('should update library and return 200 status', function (done) {
      request(app)
      .put('/v1/libraries/babac4212ab457c0de625d12')
      .set('Authorization', adminToken)
      .send({name: 'Skee TV 4'})
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.body.name).to.equal('Skee TV 4');
        done();
      });
    }); 

    it('should correctly update assets array on asset removal and return 200 status', function (done) {
      request(app)
      .put('/v1/libraries/babac4212ab457c0de625d12')
      .set('Authorization', adminToken)
      .send({assets: ['55a59ce5292a11fc944ffcc8']})
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.body.name).to.equal('Skee TV 4');
        expect(res.body.assets.length).to.equal(1);
        done();
      });
    }); 

    it('should return 404 if no library found at endpoint', function (done) {
      request(app)
      .put('/v1/libraries/aaabbb9b3d03dafcdbaaaaa9')
      .set('Authorization', adminToken)
      .send({name: 'Mashup Lib2'})
      .end(function(err, res){
        expect(res.status).to.equal(404);
        done();
      });
    });
  });

  describe('PATCH /v1/libraries:id/addassets', function () {

    it('should add assets to library and return 200 status', function (done) {
      request(app)
      .patch('/v1/libraries/babac4212ab457c0de625d12/addassets')
      .set('Authorization', adminToken)
      .send({assets: ['55c14860b0bb93403fee1170', '55c149e5c22bee6b3f5de2a0']})
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.body.assets.length).to.equal(3);
        done();
      });
    });

    it('should not add duplicate assets to library and return 200 status', function (done) {
      request(app)
      .patch('/v1/libraries/babac4212ab457c0de625d12/addassets')
      .set('Authorization', adminToken)
      .send({assets: ['55c14860b0bb93403fee1170', '55c149e5c22bee6b3f5de2a0']})
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(res.body.assets.length).to.equal(3);
        done();
      });
    }); 
  });

  describe('PATCH /v1/libraries:id/removeassets', function () {

    it('should remove assets from library and return 200 status', function (done) {
      request(app)
      .patch('/v1/libraries/babac4212ab457c0de625d12/removeassets')
      .set('Authorization', adminToken)
      .send({ assets: ["55a59ce5292a11fc944ffcc8"]})
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(_.contains(res.body.assets, '55c14860b0bb93403fee1170')).to.be.true;
        expect(_.contains(res.body.assets, '55a59ce5292a11fc944ffcc8')).to.be.false;
        expect(res.body.assets.length).to.equal(2);
        done();
      });
    }); 

    it('should remove multiple assets from library and return 200 status', function (done) {
      request(app)
      .patch('/v1/libraries/babac4212ab457c0de625d12/removeassets')
      .set('Authorization', adminToken)
      .send({ assets: ['55c14860b0bb93403fee1170', '55c149e5c22bee6b3f5de2a0']})
      .end(function(err, res){
        expect(res.status).to.equal(200);
        expect(_.contains(res.body.assets, '55c14860b0bb93403fee1170')).to.be.false;
        expect(res.body.assets.length).to.equal(0);
        done();
      });
    }); 
  });

  describe('DELETE /v1/libraries/:id', function () {
    
    it('should delete library with 204 status', function (done) {
      var agent = request(app);

      agent.delete('/v1/libraries/babac4212ab457c0de625d12')
      .set('Authorization', adminToken)
      .end(function(err, res){
        expect(res.status).to.equal(204);
        done();
      });
    });

    it('should return 404 after deletion', function (done) {
      var agent = request(app);

        agent.get('/v1/libraries/babac4212ab457c0de625d12')
        .set('Authorization', adminToken)
        .end(function(err, res){
          expect(res.status).to.equal(404);
          done();
        });    
    });
  });
}); 