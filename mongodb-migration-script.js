'use strict';

/*
  TO RUN: MONGODB_URL=mongodb://localhost:27017/xxx node xxx
  MIGRATION PURPOSE: This will update xxx clips from the database an do the following changes:

  ASANA REF: https://app.asana.com/xxx

  DATA CHANGES:
  1)Add key and bucket properties to Source rendition (rendition.purpose === 'source') - infer from url
  2)Call S3.headObject to get rendition file size and set 'fileSize' property to source rendition

  IDEMPOTENCY: This script should be run once

  ROLLBACK STRATEGY: It is not possible to rollback without using datadumps.
*/

const mongoose = require('mongoose');
const WM = require('xxx');
const _ = require('lodash');
const Promise = require('bluebird');
const fs = require('fs');
const s3strings = require('../../util/s3strings');
const AWS = require('aws-sdk');

const rolename =  process.env.ROLENAME;
const creds = new AWS.SharedIniFileCredentials({profile:rolename});
AWS.config.credentials = creds;
const S3 = Promise.promisifyAll(new AWS.S3());
const startTime = Date.now();
let counter = 0;

if (!fs.existsSync('tmp/')) {
  console.log('Creating tmp directory');
  fs.mkdirSync('tmp');
}

fs.writeFileSync('tmp/errors.txt', '----- T3 Clip Update Errors ------');

// db setup
const mongodbUrl = process.env.MONGODB_URL;
console.log("mongoDb: " + mongodbUrl);

mongoose.connect(mongodbUrl);

mongoose.connection.on('error', err => {
  console.log("Connect URL", mongodbUrl, err.stack);
  process.exit();
});

mongoose.connection.on('connected', () => {
  console.log("connected");
  WM.SystemMigration.migrate(__filename, mongoose, process.argv);
});

// begin migration

Promise.resolve()
.then(() => {
  return WM.Clip.find({renditions: {$elemMatch: {url: {$regex: /^https:\/\/s3.amazonaws.com-xxx/}}}}).lean();
})
.then(clips => {
  var totalClips = clips.length;

  return Promise.each(clips, clip => {
    var sourceRenditionIndex = _.findIndex(clip.renditions, rendition => rendition.purpose === 'source');
    var sourceUrl = clip.renditions[sourceRenditionIndex].url;
    var keyAndBucket = s3strings.getBucketAndKey(sourceUrl);
    var key = keyAndBucket.key;
    var bucket = keyAndBucket.bucket;
    var fileSize;

    return new Promise((resolve, reject) => {
      var s3params = {
        Bucket: bucket,
        Key: decodeURIComponent(key),
      };

      S3.headObjectAsync(s3params)
      .then(data => {
        fileSize = data.ContentLength;
        return;
      })
      .then(() => {
        return WM.Clip.findById(clip._id);
      })
      .then(_clip => {
        var sourceRendition = _clip.renditions[sourceRenditionIndex];

        sourceRendition.key = key;
        sourceRendition.bucket = bucket;
        sourceRendition.fileSize = fileSize;

        _clip.renditions[sourceRenditionIndex] = sourceRendition;
        _clip.markModified('renditions');

        return _clip.save();
      })
      .then(savedClip => {
        console.log(`Processing clip ${++counter} of ${totalClips} - Clip ID: ${savedClip._id}`);
        resolve();
      })
      .catch(err => {
        fs.appendFile('tmp/errors.txt', `\n ${JSON.stringify({clipId: clip._id, err: err})}`, err => {
          if (err) {console.log("Error writing to log file");}
          resolve();
        });
      });
    });

  });
})
.catch(err => {
  console.log('Error: ', err);
})
.then(() => {
  mongoose.disconnect();
  console.log(`Done! Elapsed time: ${(Date.now() - startTime) / 1000} seconds`);
  process.exit(1);
});
