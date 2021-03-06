var async = require("async"),
    fs = require("fs"),
    merge = require("deepmerge"),
    underscore = require("underscore");

/**
 * Main component, renders data from parser.
 * @param {Object} configuration
 */
var main = module.exports = function (configuration) {
    this.configuration = underscore.extend({
        header: "",
        footer: "",
        groups: {},
        tables: {},
        template: __dirname + "/template.md",
        user: null,
        pass: null,
        database: ""
    }, configuration);

    this.loader = new (require(__dirname + "/loader"))(configuration);
    this.parser = new (require(__dirname + "/parser"))(this.loader);
    this.template = underscore.template(fs.readFileSync(this.configuration.template, {encoding: "utf8"}));
};

/**
 * Loads and parses data from all tables.
 * @param {function} callBack Call back function.
 */
main.prototype.load = function (callBack) {
    var self = this,
        series = [
            function (seriesCallBack) {
                return self.loader.all(seriesCallBack);
            },
            function (seriesCallBack) {
                return self.parser.all(seriesCallBack);
            }
        ];

    async.series(series, callBack);
};

/**
 * Extending default table list data by parsed data.
 * @param {Object} tables List of table data.
 * @returns {Object}
 */
main.prototype.merge = function (tables) {
    var self = this;
    underscore.each(tables, function (value, key) {
        if ((self.parser[key] === null) && (self.parser[key] === undefined)) {
            console.error("Unknown table: " + key);
            return;
        }
        tables[key] = merge(tables[key], self.parser.data[key]);
    });

    return tables;
};

/**
 * Extending all tables information from configuration by parsed data.
 */
main.prototype.mergeAll = function () {
    this.runToAllTables(this.merge);
};

/**
 * If **tables** directive is string - translates as RegExp of table names, to groups and tables.
 */
main.prototype.prepareAllTables = function () {
    this.runToAllTables(this.prepareTables);
};

/**
 * @param {Function} method Function that will be called for all tables in configuration.
 */
main.prototype.runToAllTables = function (method) {
    var self = this,
        groups = self.configuration.groups;

    self.configuration.tables = method(self.configuration.tables);

    underscore.each(groups, function (group, key) {
        groups[key].tables = self.prepareTables(groups[key].tables);
    });
};

/**
 * If **tables** directive is string - translates as RegExp of table names.
 * @param {*} tables Tables directive from configuration.
 * @returns {Object}
 */
main.prototype.prepareTables = function (tables) {
    if (typeof tables !== "string") {
        return tables;
    }
    var pattern = new RegExp(tables),
        result = {},
        allTables = underscore.keys(this.loader.data);

    underscore.each(allTables, function (name) {
        if (pattern.test(name) === true) {
            result[name] = {};
        }
    });

    return result;
};

/**
 * Enter point.
 * @param {function} callBack Call back function.
 */
main.prototype.run = function (callBack) {
    var self = this;
    this.load(function (errors) {
        self.prepareAllTables();
        self.mergeAll();
        callBack(errors, self.template(self.configuration));
    });
};
