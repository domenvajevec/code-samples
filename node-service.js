'use strict';

var WM = require('xxx');
var _ = require('lodash');
var Promise = require('bluebird');
var formatClipsAdmin = require('../presenters/adminclip.presenter');
var config = require('../../config');
var log = require('../../services/logging');

module.exports = filter;

function filter(req, res) {
  var page = +req.query.page > 0 ? +req.query.page - 1 : 0;
  var pageSize = req.query.pageSize || config.global.defaultPageSize;
  var filters = req.query.filters ? JSON.parse(req.query.filters) : {};
  var clipsPromise, countPromise, query, sortOrder;

  //-----------------------------------------------------------
  // for searches by clip id
  //-----------------------------------------------------------

  if (req.query.q && req.query.q.match(/^[a-fA-F0-9]{24}$/)){
    return Promise.resolve()
    .then(function() {
      return WM.Clip.findById(req.query.q);
    })
    .then(function(clip) {
      if (!clip) {return res.status(200).json({payload: [], meta: {count: 0}});}
      return res.status(200).json(formatClipsAdmin([clip], 1));
    })
    .catch(function(err){
      handleError(err);
    });
  }

  //----------- end search by id -------------------------------------------------

  if (req.query.sortBy) {
    sortOrder = req.query.sortBy === 'relevance' ?  {score: {$meta: 'textScore'}} : req.query.sortBy;
  } else {
    sortOrder = 'name';
  }

  if (!_checkForNotAllowed(filters)) {
    return res.sendStatus(400);
  }

  filters = _formatFilters(filters);

  var libraryFilter = filters.libraries;
  var catalogFilter = filters.catalogs;
  var sectionFilter = filters.sections;

  delete filters.libraries;
  delete filters.catalogs;
  delete filters.sections;

  // -------------------------------------------------------------------------
  // library, catalog and section filters - note: only one of each allowed ---
  // -------------------------------------------------------------------------

  if (libraryFilter.length){

    return WM.Library.find({_id: {$in: libraryFilter}}).lean().exec()
    .then(function(results) {
      //return library assets
      return _.reduce(results, function(memo, library) {
        return memo.concat(library.assets.map(asset => asset.toString()));
      }, []);

    })
    .then(function(assets) {
      _filterLibCatSecAssets(assets);
    }, function(err) {
      handleError(res, err);
    });
  }

  if (catalogFilter.length) {
    return Promise.reduce(catalogFilter, function(memo, catalog) {
      return WM.Catalog.findAllAssets(catalog)
        .then(function(assets) {
          memo = memo.concat(assets.map(asset => asset.toString()));
          return memo;
        });
    }, [])
    .then(function(allAssets) {
      _filterLibCatSecAssets(allAssets);
    })
    .catch(function(err) {
      handleError(res, err);
    });
  }

  if (sectionFilter.length) {
    return Promise.reduce(sectionFilter, function(memo, section) {
      return WM.Section.findAllAssets(section)
        .then(function(assets) {
          memo = memo.concat(assets.map(asset => asset.toString()));
          return memo;
        });
    }, [])
    .then(function(allAssets) {
      _filterLibCatSecAssets(allAssets);
    })
    .catch(function(err) {
      handleError(res, err);
    });
  }

  // ------------------------------------------------------------------
  // all other filters (no lib, cat or section filter applied)---------
  // ------------------------------------------------------------------

  Promise.resolve()
  .then(function() {
    query = _preFormatQuery(req.query.q, filters.andFilters);

    clipsPromise = WM.Clip.find(query, {score: {$meta: 'textScore'}}).sort(sortOrder).skip(page * pageSize).limit(pageSize);

    //deal with empty query and mongo out of memory error
    if (_.isEmpty(query.$and)) {
      query = {};
      if (req.query.sortBy === 'relevance') {sortOrder = 'name';}
      clipsPromise = WM.Clip.find(query).sort(sortOrder).skip(page * pageSize).limit(pageSize);
    }

    countPromise = WM.Clip.count(query);
    return Promise.all([clipsPromise, countPromise]);
  })
  .spread(function(clips, count) {
    return res.status(200).json(formatClipsAdmin(clips, count));
  })
  .catch(function(err) {
    return handleError(res, err);
  });

  //////////// helpers

  function _filterLibCatSecAssets(assets) {
    // if library, catalog or section filter is applied, we need to first get assets that belong to them,
    // then apply filters and query to those results

    var clipsPromise, countPromise, query;

    Promise.resolve()
    .then(function() {
      query = _preFormatQuery(req.query.q, filters.andFilters);
      query.$and.push({_id: {$in: assets}});

      clipsPromise = WM.Clip.find(query, {score: {$meta: 'textScore'}}).sort(sortOrder).skip(page * pageSize).limit(pageSize);

      //deal with empty query and mongo out of memory error
      if (!req.query.q) {
        if (req.query.sortBy === 'relevance') {sortOrder = 'name';}
        clipsPromise = WM.Clip.find(query).sort(sortOrder).skip(page * pageSize).limit(pageSize);
      }

      countPromise = WM.Clip.count(query);

      return Promise.all([clipsPromise, countPromise]);
    })
    .spread(function(clips, count) {
      return res.status(200).json(formatClipsAdmin(clips, count));
    })
    .catch(function(err) {
      return handleError(res, err);
    });
  }

  function _preFormatQuery(query, filters) {
    // transform query params and filters into mongo query

    var formattedQuery;
    if (!_.isEmpty(query)) {
      formattedQuery = {$and: [{$text: {$search: query}}]};
    } else {
      formattedQuery = {$and: []};
    }

    if (!_.isEmpty(filters)) {
      formattedQuery.$and = formattedQuery.$and.concat(filters);
    }
    return formattedQuery;
  }
}



/////////////////////////////////////////

function _formatFilters(filters) {

// tranform incoming filters object into individual mongo dot notation properties {publishStatus: {isPublished: [true]}} => [{"publishStatus.isPublished: true"}]
// also handles multiple filters on same property ex: {mdFacet: {race: ['latinos', 'multiple']}} = > {"$or":[{"mdFacet.race":"latinos"},{"mdFacet.race":"multiple"}]
// and library, catalog and section filters ex: {"libraries":[],"catalogs":[],"sections":["111112212ab457c0de625d90","111112212ab457c0de625101"]}
// returns mongoose formatted query object ex:
// {formattedFilter : {"$and":[{"publishStatus.isPublished": true}, {"$or":[{"mdFacet.race":"latinos"},{"mdFacet.race":"whites"}]},
//                             "libraries":[],"catalogs":[],"sections":["111112212ab457c0de625d90","111112212ab457c0de625101"]}}
//

  var andFilters  = [];
  var orFilters   = [];
  var libraryList = [];
  var catalogList = [];
  var sectionList = [];

  if(_.isEmpty(filters)) { return {libraries: [], catalogs: [], sections: []};}

  _.each(Object.keys(filters), function(mainProp) {
    var subProp, combinedString;
    var obj = {};

    if (mainProp === 'library'){
      libraryList = filters.library;
      return;
    }

    if (mainProp === 'catalog'){
      catalogList = filters.catalog;
      return;
    }

    if (mainProp === 'section'){
      sectionList = filters.section;
      return;
    }

    // nested property filters ex: {publishStatus: {isPublished: [true]}}

    if (!_.isArray(filters[mainProp])){
      subProp = Object.keys(filters[mainProp]);
      combinedString = mainProp + '.' + subProp;

      // multiple filters ex: {mdFacet: {age: ['adults', 'babies']}}
      if (filters[mainProp][subProp].length > 1) {
        _.each(filters[mainProp][subProp], function(filterValue) {
          obj[combinedString] = filterValue;
          orFilters.push(obj);
          obj = {};
        });
        andFilters = andFilters.concat({$or: orFilters});
        orFilters = [];
      } else {

        obj[combinedString] = filters[mainProp][subProp][0];
        andFilters = andFilters.concat(obj);
      }

    // non nested property filters ex: {duration: [20]}
    } else {

      if (filters[mainProp].length > 1) {

        _.each(filters[mainProp], function(filterValue) {
          obj[mainProp] = filterValue;
          orFilters.push(obj);
          obj = {};
        });
        andFilters = andFilters.concat({$or: orFilters});
        orFilters = [];
      } else {
        obj[mainProp] = filters[mainProp][0];
        andFilters = andFilters.concat(obj);
      }
    }
  });

  return {andFilters: andFilters, libraries: libraryList, catalogs: catalogList, sections: sectionList};
}

function _checkForNotAllowed(filter) {
  //prevent user from using library and catalog/sections simultaneously
  return _.isObject(filter.library) ? (!_.isObject(filter.section) && !_.isObject(filter.catalog)) :
         _.isObject(filter.catalog) ? !_.isObject(filter.section) : true;
}

function handleError(res, err) {
  log.error(err);
  return res.status(500).send(err);
}
