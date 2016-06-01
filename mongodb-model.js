'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Promise = require('bluebird');
var _ = require('lodash');
var catalogModel = require('./catalog.model');

var SectionSchema = new Schema({
  catalogRef        : {type: Schema.Types.ObjectId, ref: 'Catalog'},
  parentRef         : {type: Schema.Types.ObjectId, ref: 'Section'},
  name              : String,
  description       : String,
  seqNo             : Number,
  assets            : [{type: Schema.Types.ObjectId, ref: 'Clips'}],
  sections          : [{type: Schema.Types.ObjectId, ref: 'Section'}],
  posterImage       : {type: String, match: catalogModel.imageUrlRegex()},
  createdAt         : {type: Date, 'default': new Date()},
  updatedAt         : {type: Date, 'default': new Date()},
  contentPartnersRef: [{type: Schema.Types.ObjectId, ref: 'ContentPartner'}]
});


SectionSchema.post('save', function(section) {
  // set contentPartnersRef - recursively find all assets and corresponding content Partners

  return Promise.resolve() // force Bluebird promise chain
  .then(function() {
    return mongoose.models.Section.findAllAssets(section._id);
  })
  .then(function(assets) {

    if (assets && assets.length) {

      return Promise.map(assets, function(asset) {
        return mongoose.models.Clip.findById(asset).lean().exec()
        .then(function (foundAsset) {
          if (foundAsset && foundAsset.sourceInfo && foundAsset.sourceInfo.partnerCode) {
            return foundAsset.sourceInfo.partnerCode;
          }
          return;
        });
      });
    }

    return [];
  })
  .then(function(partnerCodesArray) {
    partnerCodesArray = _.compact(_.uniq(partnerCodesArray));

    return Promise.map(partnerCodesArray, function(partnerCode) {
      return mongoose.models.ContentPartner.findOne({code: partnerCode}, '_id').lean();
    });

  })
  .then(function(partnerIds) {
    return mongoose.models.Section.update({_id: section._id}, {contentPartnersRef: partnerIds, updatedAt: new Date()});
  })
  .then(function(){
    // trigger updating of parent section, or catalog if no parent section
    if (section.parentRef) {
      return mongoose.models.Section.findById(section.parentRef);
    }
    if (section.catalogRef) {
      return mongoose.models.Catalog.findById(section.catalogRef);
    }
    return null;
  })
  .then(function(updatedParent) {
    if (updatedParent) {
      return updatedParent.save();
    }
    return;
  })
  .catch(function(err) {
    console.log('Error in Section post save hook:', err);
  });
});

SectionSchema.pre('remove', function(next) {

  Promise.all(this.sections.map(function(section) {
    return mongoose.models.Section.findById(section.toString())
     .exec()
     .then(function(secToRemove) {
       return secToRemove.remove();
     });
  }))
  .then(function(){
    next();
  });
});

SectionSchema.statics.findAllAssets = function (id) {
  var self = this;

  return new Promise(function(resolve, reject) {
    Promise.resolve()
    .then(function() {
      return mongoose.models.Section.findById(id).exec();
    })
    .then(function(section) {
      //base case
      if (section && section.assets && section.assets.length) {
        resolve(_.compact(section.assets));
      //recursive case
      } else if (section && section.sections && section.sections.length){
        var subAssetArray = [];
        Promise.all(section.sections.map(function(subSection) {
          return self.findAllAssets(subSection)
          .then(function(subAssets){
            subAssetArray = subAssets ? subAssetArray.concat(subAssets) : subAssetArray;
          });
        }))
        .then(function(){
          resolve(subAssetArray);
        })
        .catch(function(err) {
          reject(err);
        });
      //base case 2 - no assets or sections
      } else {
        resolve();
      }
    });
  });
};

module.exports = mongoose.model('Section', SectionSchema);
