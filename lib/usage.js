'use strict';

var validation = require('./validation');
var _ = require('lodash');

/**
 * Wrapper for Usage operations
 *
 * @param opts {Object} - initialization options
 * @param opts.client {Object} - restify client wrapper to use
 * @param [opts.validation] {Object} - options for validator initialization
 * @returns {Transaction}
 * @constructor
 */
function Usage(opts) {
    if(!(this instanceof Usage)) {
        return new Usage(opts);
    }
    this.client = opts.client;
    this.validate = validation(opts.validation);
}

/**
 * Method for uploading usage as a CSV
 *
 * @param usageData {Object} Each key of that doc is the accountId, and for each accountId, the object may include
 *                           unit, quantity, startDate, endDate, subscriptionId, chargeId, description
 * @param defaultData {Object} defines default values for all entries of usageData (for instance, startDate or unit)
 * @param callback(err, uploadId)
 */
Usage.prototype.post = function(usageData, defaultData, callback) {
    var filename = 'usage-' + Math.floor(new Date().getTime()/1000).toString(10) + '.csv'
        , csvContent = ''
        , addRow = function(rowData) {
            csvContent += _.map(rowData, function(value) {
                if (typeof value === 'undefined') {
                    return '';
                } else if (typeof value === 'number') {
                    return value.toString();
                } else if (value instanceof Date) {
                    return value.toISOString().replace(/^(\d+)-(\d+)-(\d+)T.*$/, '$2/$3/$1');
                } else {
                    return value.toString().replace(/[,\"]/g, '');
                }
            }).join(',') + '\r\n';
        };
    addRow(['ACCOUNT_ID', 'UOM', 'QTY', 'STARTDATE', 'ENDDATE', 'SUBSCRIPTION_ID', 'CHARGE_ID', 'DESCRIPTION']);
    _.forOwn(usageData, function(data, accountId) {
        _.defaults(data, defaultData);
        addRow([accountId, data.unit, data.quantity, data.startDate, data.endDate, data.subscriptionId, data.chargeId, data.description]);
    });
    this.client.upload('/usage', 'file', filename, csvContent, function(err, result) {
        if (err) {
            callback(err);
        } else {
            var uploadId = result.checkImportStatus.match(/\/usage\/([^\/]+)\/status$/)[1];
            if (!uploadId) {
                callback(new Error('Cannot extract upload id from usage upload response'));
            } else {
                callback(null, uploadId);
            }
        }
    });
};

/**
 * Method to get the status of a single usage upload
 *
 * @param uploadId string unique id coming extracted by .post()
 * @param callback(err, importStatus)
 */
Usage.prototype.status = function(uploadId, callback) {
    this.client.get('/usage/' + uploadId + '/status', function(err, result) {
        if (err) {
            callback(err);
        } else {
            callback(null, result.importStatus);
        }
    });
};

module.exports = Usage;