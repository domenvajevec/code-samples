'use strict';

var _ = require('lodash');
var WM = require('xxx');
var config = require('../../config');
var Promise = require('bluebird');
var request = require('request');
var log = require('../../services/logging');

// Get list of libraries
exports.index = function(req, res) {
  WM.Library.find(function (err, libraries) {
    if(err) { return handleError(res, err); }
    return res.status(200).json(libraries);
  });
};

// Get a single library - returns object with payload and meta.count which denotes the number of assets in library
exports.show = function(req, res) {
  var page = +req.query.page > 0 ? +req.query.page - 1 : 0;
  var pageSize = +req.query.pageSize || config.global.defaultPageSize;
  var query = req.query.q ? new RegExp(req.query.q, 'i') : '';
  var count;
  var countPopulateObj = {
    path  : 'assets',
    select: '_id',
    match : {name: query}
  };
  var assetPopulateObj = {
    path  : 'assets',
    select: '_id name duration ingestDate lastModified publishStatus renditions',
    match : {name: query},
    options: {
      sort: req.query.sortBy || 'name',
      limit: pageSize || 0,
      skip: pageSize * page,
    }
  };

  if (!req.query.q) {
    delete countPopulateObj.match;
    delete assetPopulateObj.match;
  }

  WM.Library.findById(req.params.id).lean()
  .populate(countPopulateObj)
  .exec()
  .then(function(libraryForCount) {
    if(!libraryForCount) { return res.sendStatus(404); }
    count = libraryForCount.assets.length;
  })
  .then(function() {
    return WM.Library.findById(req.params.id)
    .lean()
    .populate(assetPopulateObj)
    .populate('partnerRef');
  })
  .then(function(library) {
    //computing bestThumbnail from renditions here because bestThumbnail can't be selected in populated assets, removing renditions when done
    _.each(library.assets, function(asset) {
      if (asset.renditions.length) {
        asset.bestThumbnail = findBestThumbnail(asset.renditions);
        delete asset.renditions;
      }
    });
    return res.status(200).json({payload: library, meta: {count: count}});
  }, function (err) {
    return handleError(res, err);
  });
};

// Searches for library by name
exports.search = function(req, res) {
  var query = new RegExp(req.query.q, 'i');
  var libraryPromise = WM.Library.find({name: query});
  var countPromise = WM.Library.count({name: query});

  Promise.all([libraryPromise, countPromise])
  .spread(function(catalogs, count) {
    return res.status(200).json({payload: catalogs, meta: {count: count}});
  })
  .catch(function(err) {
    return handleError(res, err);
  });
};

// Creates a new library in the DB.
exports.create = function(req, res) {
  WM.Library.create(req.body, function(err, library) {
    if(err) { return handleError(res, err); }
    // Add library to corresponding ContentPartner
    if(library.partnerRef) {
      WM.ContentPartner.update({"_id": library.partnerRef},
        {$addToSet: {"libraries": library}},
        function(err){
          if(err) { return handleError(res, err); }
          return res.status(201).json(library);
        }
      );
    }
    else {
      return res.status(201).json(library);
    }
  });
};

// Updates an existing library in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  WM.Library.findById(req.params.id, function (err, library) {
    if (err) { return handleError(res, err); }
    if(!library) { return res.sendStatus(404); }
    var updated = _.extend(library, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      // Add library to corresponding ContentPartner
      if(library.partnerRef) {
        WM.ContentPartner
        .update({"_id": library.partnerRef},
          {$addToSet: {"libraries": library}},
          function(err){
            if (err) { return handleError(err); }
            return res.status(200).json(library);
          }
        );
      }
      else {
        return res.status(200).json(library);
      }
    });
  });
};

// Deletes a library from the DB.
exports.destroy = function(req, res) {
  WM.Library.findById(req.params.id, function (err, library) {
    if(err) { return handleError(res, err); }
    if(!library) { return res.sendStatus(404); }
    // Remove library from corresponding ContentPartner
    if(library.partnerRef) {
      WM.ContentPartner.update({"_id": library.partnerRef},
        {$pull: {"libraries": library._id}},
        function(err) {
          if(err) { return handleError(res, err); }
          library.remove(function(err) {
            if(err) { return handleError(res, err); }
            return res.sendStatus(204);
          });
        }
      );
    }
    else {
      library.remove(function(err) {
        if(err) { return handleError(res, err); }
        return res.sendStatus(204);
      });
    }
  });
};


// Adds additional assets to assets array
exports.addAssets = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  WM.Library.findById(req.params.id, function (err, library) {
    if (err) { return handleError(res, err); }
    if(!library) { return res.sendStatus(404); }

    _.each(req.body.assets, function(asset) {
      library.assets.addToSet(asset);
    });

    library.markModified('assets');

    library.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.status(200).json(library);
    });
  });
};

// Removes assets from assets array
exports.removeAssets = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  WM.Library.findById(req.params.id, function (err, library) {
    if (err) { return handleError(res, err); }
    if(!library) { return res.sendStatus(404); }

    _.each(req.body.assets, function(asset) {
      _.remove(library.assets, function(libAsset) {
        return libAsset.toString() === asset.toString();
      });
    });

    library.markModified('assets');

    library.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.status(200).json(library);
    });
  });
};

function handleError(res, err) {
  return res.status(500).send(err);
}

function findBestThumbnail(renditions) {
  return _.reduce(renditions, function(memo, rendition){
    if (/thumbnail/i.test(rendition.purpose) && /large/i.test(rendition.size)) {
      memo.url = rendition.url.replace(/^https?\:/, 'https:');
    }
    if (/thumbnail/i.test(rendition.purpose) && !memo.url){
      memo.url = rendition.url.replace(/^https?\:/, 'https:');
    }
    return memo;
  },{}).url;
}
