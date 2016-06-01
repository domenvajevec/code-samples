(function() {
  'use strict';

  describe('xxx Service', function() {
    var WeAPI, $httpBackend, ENV, apiEndpoint;
    var mockClips = [{ name: 'Clip' }, { name: 'Clip2' }];

    beforeEach(function() {

      module(function($provide) {
        $provide.constant('ENV', { general: { endpoint: 'https://localhost:3070/v1'}});
      });

      module('xxx');

      inject(function($injector) {
        WeAPI = $injector.get('WeAPI');
        $httpBackend = $injector.get('$httpBackend');
        ENV = $injector.get('ENV');
        apiEndpoint = ENV.general.endpoint;
      });
    });

    afterEach(function() {
      $httpBackend.verifyNoOutstandingExpectation();
      $httpBackend.verifyNoOutstandingRequest();
    });

    it('exists', function() {
      expect(WeAPI).toBeDefined();
    });

    describe('changePassword function', function () {

      it('Calls correct user API endpoint in oder to change password', function () {
        $httpBackend.expectPUT(apiEndpoint + '/users/55a6ebb9eeacf9e6d66aaaaa/password', {newPassword: 'password123'})
        .respond(200);

        WeAPI.changePassword('55a6ebb9eeacf9e6d66aaaaa', 'password123');
        $httpBackend.flush();
      });
    });

    describe('createOne function', function() {

      var newPartner = { name: 'Partner1' };
      it('calls the API to create an object', function() {
        $httpBackend.expectPOST(ENV.general.endpoint + '/contentpartners')
        .respond(201, newPartner);

        WeAPI.createOne('contentpartners', newPartner)
        .then(function(response) {
          expect(response.data.name).toEqual('Partner1');
          expect(response.status).toEqual(201);
        });
        $httpBackend.flush();
      });
    });

    describe('deleteOne function', function() {

      it('calls the API to delete an object', function() {
        $httpBackend.expectDELETE(ENV.general.endpoint + '/clips/333334212ab457c0de625d88')
        .respond(204);

        WeAPI.deleteOne('clips', '333334212ab457c0de625d88')
        .then(function(response) {
          expect(response.status).toEqual(204);
        });
        $httpBackend.flush();
      });
    });

    describe('deleteMANY function', function() {

      it('calls the API to delete multiple objects', function() {
        $httpBackend.expectDELETE(apiEndpoint + '/clips/333334212ab457c0de625d88')
        .respond(204);

        $httpBackend.expectDELETE(apiEndpoint + '/clips/333334212ab457c0de625d89')
        .respond(204);

        WeAPI.deleteMany('clips', ['333334212ab457c0de625d88', '333334212ab457c0de625d89']);

        $httpBackend.flush();
      });
    });

    describe('editOne function', function() {

      var editedPartner = { name: 'Partner2' };
      it('calls the API to edit an object', function() {
        $httpBackend.expectPATCH(apiEndpoint + '/contentpartners/333334212ab457c0de625d88')
        .respond(200, editedPartner);

        WeAPI.editOne('contentpartners', '333334212ab457c0de625d88', editedPartner)
        .then(function(response) {
          expect(response.data.name).toEqual('Partner2');
          expect(response.status).toEqual(200);
        });
        $httpBackend.flush();
      });
    });

    describe('editMANY function', function() {

      it('calls the API to edit multiple object', function() {
        $httpBackend.expectPATCH(apiEndpoint + '/clips/333334212ab457c0de625d88')
        .respond(200);

        $httpBackend.expectPATCH(apiEndpoint + '/clips/333334212ab457c0de625d89')
        .respond(200);

        WeAPI.editMany('clips', ['333334212ab457c0de625d88', '333334212ab457c0de625d89'], {description: 'test'});

        $httpBackend.flush();
      });
    });

    describe('editOneProp function', function () {

      it('should format API call endpoint and pass property', function () {
        $httpBackend.expectPATCH(apiEndpoint + '/libraries/333334212ab457c0de625d88/addassets',
          {assets: ['333334212ab457c0de625d00', '333334212ab457c0de625d99']})
        .respond(200);

        WeAPI.editOneProp('libraries', '333334212ab457c0de625d88', 'addassets',
          { assets: ['333334212ab457c0de625d00', '333334212ab457c0de625d99'] });

        $httpBackend.flush();
      });
    });

    describe('editManyProp function', function () {

      it('should call multiple correctly formatted API endpoints in order to add element to multiple objects array type property', function () {
        $httpBackend.expectPATCH(apiEndpoint + '/clips/333334212ab457c0de625d88/addprop',
          {talentMembers: [{talentRef: '55a5b3dc3ea66c119a48a20c', role: 'producer'}]})
        .respond(200);

        $httpBackend.expectPATCH(apiEndpoint + '/clips/333334212ab457c0de625d89/addprop',
          {talentMembers: [{talentRef: '55a5b3dc3ea66c119a48a20c', role: 'producer'}]})
        .respond(200);

        WeAPI.editManyProp('clips', ['333334212ab457c0de625d88', '333334212ab457c0de625d89'], 'addprop',
          {talentMembers: [{talentRef: '55a5b3dc3ea66c119a48a20c', role: 'producer'}]});

        $httpBackend.flush();
      });
    });

    describe('filter function', function () {

      it('should correctly format API call when no optional arguments present', function () {
        $httpBackend.expectGET(apiEndpoint + '/clips/filter?filters=%7B%7D&page=1&pageSize=15&q=&sortBy=')
        .respond(200, { payload: mockClips, meta: {count: 2 } });

        WeAPI.filter('clips/filter');

        $httpBackend.flush();
      });

      it('should correctly format API call when optional arguments including filter are present', function () {
        $httpBackend.expectGET(apiEndpoint + '/clips/filter?filters=%7B%22catalog%22:%5B%22000702212ab457c0de625d88%22%5D%7D&page=2&pageSize=30&q=&sortBy=-name')
        .respond(200, { payload: mockClips, meta: {count: 2 } });

        WeAPI.filter('clips/filter', 2, 30, '-name', {catalog: ['000702212ab457c0de625d88']})

        $httpBackend.flush();
      });

      it('should correctly format API call when optional arguments including filter and search query are present', function () {
        $httpBackend.expectGET(apiEndpoint + '/clips/filter?filters=%7B%22catalog%22:%5B%22000702212ab457c0de625d88%22%5D%7D&page=2&pageSize=30&q=Aria+Crescendo&sortBy=-name')
        .respond(200, { payload: mockClips, meta: {count: 2 } });

        WeAPI.filter('clips/filter', 2, 30, '-name', {catalog: ['000702212ab457c0de625d88']}, 'Aria Crescendo')

        $httpBackend.flush();
      });
    });

    describe('getAll function', function() {

      it('returns an array of API data', function() {
        $httpBackend.expectGET(apiEndpoint + '/clips?page=1')
        .respond(200, {payload: mockClips, meta: {count: 2}});

        WeAPI.getAll('clips', 1)
        .then(function(response) {
          expect(response.data.payload instanceof Array).toEqual(true);
          expect(response.data.meta.count).toEqual(2);
        });
        $httpBackend.flush();
      });

      it('returns an array of data depending on pageSize argument', function() {
        $httpBackend.expectGET(ENV.general.endpoint + '/clips?page=1&pageSize=1')
        .respond(200, {payload: [mockClips[0]], meta: {count: 2}});

        WeAPI.getAll('clips', 1, 1)
        .then(function(response) {
          expect(response.data.payload.length).toEqual(1);
        });
        $httpBackend.flush();
      });

      it('Sets populate_refs query param when populate argument present', function () {
        $httpBackend.expectGET(ENV.general.endpoint + '/clips?page=1&pageSize=1&populate_refs=1')
        .respond(200, [mockClips[0]]);

        WeAPI.getAll('clips', 1, 1, true);
        $httpBackend.flush();
      });
    });

    describe('getOne function', function() {

      it('calls the API and returns one retrieved object', function() {
        $httpBackend.expectGET(apiEndpoint + '/clips/333334212ab457c0de625d88')
        .respond(200, mockClips[0]);

        WeAPI.getOne('clips', '333334212ab457c0de625d88')
        .then(function(response) {
          expect(response.data instanceof Object).toEqual(true);
          expect(response.data.name).toEqual('Clip');
        });
        $httpBackend.flush();
      });
    });



    describe('search function', function() {
      //deprecated on weadmin
      it('calls the search endpoint and receives an array of found results', function() {
        $httpBackend.expectGET(apiEndpoint + '/search?filter=&page=1&pageSize=10&q=dude&sortBy=')
        .respond(200, mockClips);

        WeAPI.search('dude', 1, 10)
        .then(function(response) {
          expect(response.data.length).toEqual(2);
          expect(response.data[0].name).toEqual('Clip');
          expect(response.status).toEqual(200);
        });
        $httpBackend.flush();
      });
    });

    describe('transcodeClip function', function () {
      it('Calls the correct clips/:id/transcode api endpoint', function () {
        $httpBackend.expectPOST(apiEndpoint + '/clips/333334212ab457c0de625d88/transcode')
        .respond(200);

        WeAPI.transcodeClip('333334212ab457c0de625d88');
        $httpBackend.flush();
      });
    });

    describe('transcodeLib function', function () {
      it('Calls the correct libraries/:id/transcode api endpoint', function () {
        $httpBackend.expectPOST(apiEndpoint + '/libraries/333334212ab457c0de625d88/transcode')
        .respond(200);

        WeAPI.transcodeLib('333334212ab457c0de625d88');
        $httpBackend.flush();
      });
    });

    describe('updateProjectHistory function', function () {
      it('should correctly format api call to projects/:projectId/historyedit/:historyId', function () {
        $httpBackend.expectPUT(apiEndpoint + '/projects/333334212ab457c0de625d88/historyedit/222224212ab457c0de625d88', {note: 'Note'})
        .respond(200);

        WeAPI.updateProjectHistory('333334212ab457c0de625d88', '222224212ab457c0de625d88', {note: 'Note'});
        $httpBackend.flush();
      });
    });
  });
}());
