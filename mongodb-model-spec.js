'use strict';
/* jshint expr:true */
var dbUtils = require('./dbutils');
var expect  = require('chai').expect;
var WM      = require('../registermodels');
var Promise = require('bluebird');

describe("Section Model", function() {

  it("should exist", function() {
    var section = new WM.Section();
    expect(WM.Section).to.exist;
    expect(section).to.be.an.instanceOf(WM.Section);
  });

  describe("#save", function() {

    it("should save properly formatted instance", function(done) {
      var catalog       = new WM.Catalog();
      var parentSection = new WM.Section();
      var childSection1 = new WM.Section();
      var childSection2 = new WM.Section();
      var clip1         = new WM.Clip();
      var clip2         = new WM.Clip();

      var section = new WM.Section({
        catalogRef : catalog._id,
        description: 'Section desc',
        parentRef  : parentSection._id,
        name       : 'Featured',
        seqNo      : 1,
        assets     : [clip1._id, clip2._id],
        sections   : [childSection1._id, childSection2._id]
      });

      section.save(function(err, data){
        expect(err).to.be.null;
        expect(data.toObject()).to.contain.all.keys(['catalogRef', 'description', 'parentRef', 'name', 'seqNo', 'assets', 'sections']);
        expect(data.createdAt).to.be.an.instanceof(Date);
        done();
      });
    });
  });

  describe('#remove', function () {
    it('should remove section and referenced subsections', function () {
      var section1 = WM.Section.create({name: 'Grandchild Section', _id: '11112407e7684dc403333333'});
      var section2 = WM.Section.create({name: 'Grandchild Sibling Section', _id: '11112407e7684dc404444444'});
      var section3 = WM.Section.create({name: 'Child Section',  _id: '11112407e7684dc402222222', sections: ['11112407e7684dc403333333', '11112407e7684dc404444444']});
      var section4 = WM.Section.create({name: 'Parent Section',  _id: '11112407e7684dc401111111',  sections: ['11112407e7684dc402222222']});

      return Promise.all([section1, section2, section3, section4])
      .then(function() {
        return WM.Section.findOne({_id: '11112407e7684dc401111111'}).exec();
      })
      .then(function(parent) {
        expect(parent.sections.length).to.equal(1);
        return parent.remove();
      })
      .then(function() {
        return WM.Section.find({});
      })
      .then(function(sections) {
        expect(sections.length).to.equal(0);
      });
    });
  });

  describe('#findAllAssets static method', function () {
    it('should return an array of assets from all containing subsection', function () {
      var section1 = WM.Section.create({name: 'Grandchild Section', _id: '11112407e7684dc403333333', assets: ['11112407e7684dc401234567', '11112407e7684dc412345678']});
      var section2 = WM.Section.create({name: 'Grandchild Sibling Section', _id: '11112407e7684dc404444444', assets: ['11112407e7684dc401234511', '11112407e7684dc401234522']});
      var section3 = WM.Section.create({name: 'Child Section',  _id: '11112407e7684dc402222222', sections: ['11112407e7684dc403333333', '11112407e7684dc404444444']});
      var section4 = WM.Section.create({name: 'Parent Section',  _id: '11112407e7684dc401111111',  sections: ['11112407e7684dc402222222']});

      return Promise.all([section1, section2, section3, section4])
      .then(function() {
        return WM.Section.findAllAssets('11112407e7684dc401111111');
      })
      .then(function(assets) {
        expect(assets.length).to.equal(4);
      });
    });

    it('should ignore non-existent assets', function () {
      var section1 = WM.Section.create({name: 'Grandchild Section', _id: '11112407e7684dc403333333', assets: ['11112407e7684dc401234567', null]});
      var section2 = WM.Section.create({name: 'Grandchild Sibling Section', _id: '11112407e7684dc404444444', assets: ['11112407e7684dc401234511', '11112407e7684dc401234522']});
      var section3 = WM.Section.create({name: 'Child Section',  _id: '11112407e7684dc402222222', sections: ['11112407e7684dc403333333', '11112407e7684dc404444444']});
      var section4 = WM.Section.create({name: 'Parent Section',  _id: '11112407e7684dc401111111',  sections: ['11112407e7684dc402222222']});

      return Promise.all([section1, section2, section3, section4])
      .then(function() {
        return WM.Section.findAllAssets('11112407e7684dc401111111');
      })
      .then(function(assets) {
        expect(assets.length).to.equal(3);
      });
    });
  });

  describe('Post save set contentPartnersRef hook', function () {
    it('should update contentPartnersRef array with a list of contentpartner references of all included assets in all containing subsections', function () {
      var now = new Date();

      var cp1 = WM.ContentPartner.create({code: 'nbcu', _id: '12312407e7684dc403333333'});
      var cp2 = WM.ContentPartner.create({code: 'skeetv', _id: '23412407e7684dc403333333'});
      var cp3 = WM.ContentPartner.create({code: 'qd3', _id: '34512407e7684dc403333333'});
      var clip1 = WM.Clip.create({sourceInfo: {partnerCode: 'nbcu'}, _id: '11112407e7684dc401234567'});
      var clip2 = WM.Clip.create({sourceInfo: {partnerCode: 'skeetv'}, _id: '11112407e7684dc412345678'});
      var clip3 = WM.Clip.create({sourceInfo: {partnerCode: 'qd3'}, _id: '11112407e7684dc401234511'});
      var clip4 = WM.Clip.create({sourceInfo: {partnerCode: 'qd3'}, _id: '11112407e7684dc401234522'});
      var sec1 = WM.Section.create({name: 'Grandchild Section', _id: '11112407e7684dc403333333', assets: ['11112407e7684dc401234567', '11112407e7684dc412345678']});
      var sec2 = WM.Section.create({name: 'Grandchild Sibling Section', _id: '11112407e7684dc404444444', assets: ['11112407e7684dc401234511', '11112407e7684dc401234522']});
      var sec3 = WM.Section.create({name: 'Child Section', _id: '11112407e7684dc402222222', sections: ['11112407e7684dc403333333', '11112407e7684dc404444444']});
      var sec4 = WM.Section.create({name: 'Parent Section', _id: '11112407e7684dc401111111',  sections: ['11112407e7684dc402222222']});

      return Promise.all([cp1, cp2, cp3, clip1, clip2, clip3, clip4, sec1, sec2, sec3, sec4])
      .delay(100) //wait for post save hooks
      .then(function(a) {
        return WM.Section.findById('11112407e7684dc401111111');
      })
      .then(function(section) {
        expect(section.contentPartnersRef).to.be.instanceof(Array);
        expect(section.contentPartnersRef.length).to.equal(3);
        expect(section.updatedAt).to.be.above(now);
      });
    });

    it('should update parent section\'s contentPartnerRef when updating subsection', function () {
      var cp1 = WM.ContentPartner.create({code: 'nbcu', _id: '12312407e7684dc403333333'});
      var cp2 = WM.ContentPartner.create({code: 'skeetv', _id: '23412407e7684dc403333333'});
      var cp3 = WM.ContentPartner.create({code: 'qd3', _id: '34512407e7684dc403333333'});
      var clip1 = WM.Clip.create({sourceInfo: {partnerCode: 'nbcu'}, _id: '11112407e7684dc401234567'});
      var clip2 = WM.Clip.create({sourceInfo: {partnerCode: 'skeetv'}, _id: '11112407e7684dc412345678'});
      var clip3 = WM.Clip.create({sourceInfo: {partnerCode: 'qd3'}, _id: '11112407e7684dc401234511'});
      var sec1 = WM.Section.create({name: 'Child Section', _id: '11112407e7684dc402222222', assets: ['11112407e7684dc401234567', '11112407e7684dc412345678'], parentRef: '11112407e7684dc401111111'});
      var sec2 = WM.Section.create({name: 'Parent Section', _id: '11112407e7684dc401111111',  sections: ['11112407e7684dc402222222']});

      return Promise.all([cp1, cp2, cp3, clip1, clip2, clip3, sec1, sec2])
      .delay(100)
      .then(function() {
        return WM.Section.findById('11112407e7684dc401111111');
      })
      .then(function(parentSection) {
        expect(parentSection.contentPartnersRef).to.be.instanceof(Array);
        expect(parentSection.contentPartnersRef.length).to.equal(2);
        return;
      })
      .then(function() {
        return WM.Section.findById('11112407e7684dc402222222');
      })
      .then(function(childSection) {
        childSection.assets.push('11112407e7684dc401234511');
        return childSection.save();
      })
      .delay(100)
      .then(function() {
        return WM.Section.findById('11112407e7684dc401111111');
      })
      .then(function(section) {
        expect(section.contentPartnersRef).to.be.instanceof(Array);
        expect(section.contentPartnersRef.length).to.equal(3);
      });
    });

    it('should update parent catalog\'s contentPartnerRef when updating subsection', function () {

      var cp1 = WM.ContentPartner.create({code: 'nbcu', _id: '12312407e7684dc403333333'});
      var cp2 = WM.ContentPartner.create({code: 'skeetv', _id: '23412407e7684dc403333333'});
      var cp3 = WM.ContentPartner.create({code: 'qd3', _id: '34512407e7684dc403333333'});
      var clip1 = WM.Clip.create({sourceInfo: {partnerCode: 'nbcu'}, _id: '11112407e7684dc401234567'});
      var clip2 = WM.Clip.create({sourceInfo: {partnerCode: 'skeetv'}, _id: '11112407e7684dc412345678'});
      var clip3 = WM.Clip.create({sourceInfo: {partnerCode: 'qd3'}, _id: '11112407e7684dc401234511'});
      var sec1 = WM.Section.create({name: 'Child Section', _id: '11112407e7684dc402222222', assets: ['11112407e7684dc401234567', '11112407e7684dc412345678'], parentRef: '11112407e7684dc401111111', catalogRef: '11112407e7684dc401111234'});
      var sec2 = WM.Section.create({name: 'Parent Section', _id: '11112407e7684dc401111111',  sections: ['11112407e7684dc402222222'], parentRef: null, catalogRef: '11112407e7684dc401111234'});
      var sec3 = WM.Catalog.create({name: 'Main Catalog',  _id: '11112407e7684dc401111234',  sections: ['11112407e7684dc401111111']});

      return Promise.all([cp1, cp2, cp3, clip1, clip2, clip3, sec1, sec2, sec3])
      .delay(100)
      .then(function() {
        return WM.Catalog.findById('11112407e7684dc401111234');
      })
      .then(function(catalogFirstPass) {
        expect(catalogFirstPass.contentPartnersRef).to.be.instanceof(Array);
        expect(catalogFirstPass.contentPartnersRef.length).to.equal(2);
        return;
      })
      .then(function() {
        return WM.Section.findById('11112407e7684dc402222222');
      })
      .then(function(childSection) {
        childSection.assets.push('11112407e7684dc401234511');
        return childSection.save();
      })
      .delay(100)
      .then(function() {
        return WM.Catalog.findById('11112407e7684dc401111234');
      })
      .then(function(catalog) {
        expect(catalog.contentPartnersRef).to.be.instanceof(Array);
        expect(catalog.contentPartnersRef.length).to.equal(3);
      });
    });
  });
});
