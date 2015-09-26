var cheerio  = require('cheerio'),
    _        = require('lodash'),
    http     = require('http'),
    fs       = require('fs'),
    moment   = require('moment'),
    url      = require('url'),
    startUrl = 'http://www.rugby.nl/competitie/competitie';

var Parser = function () {

};

Parser.prototype.getCompetition = function (override) {
    return new Promise(( resolve, reject ) => {
        if ( !override || fs.existsSync('./data/competition.json') ) {
            resolve(JSON.parse(fs.readFileSync('./data/competition.json').toString()));
        }
        else {
            this.updateCompetitions().then(resolve).catch(reject);
        }
    });

};

Parser.prototype.updateCompetitions = function () {
    return new Promise(( resolve, reject ) => {
        this.getCompetitions()
            .then(competitions => {
                return this.getDivisions(competitions);
            })
            .then(competition => {
                fs.writeFileSync('./data/competition.json', JSON.stringify(competition));
                resolve(competition);
            })
            .catch(e => {
                console.error('Error: ', e);
            });
    });
};

Parser.prototype.getCompetitions = function () {
    return new Promise(( resolve, reject ) => {
        console.log('[fetch] competitions');
        var req = http.request({
            hostname: url.parse(startUrl).hostname,
            path:     url.parse(startUrl).path,
            port:     80,
            method:   'GET'
        }, res => {
            var htmlpage = '';
            res.on('data', chunk => {
                htmlpage += chunk;
            });
            res.on('end', () => {
                console.log('[fetch] competitions ready');
                resolve(this.parseCompetitions(htmlpage));
            });
        });
        req.end();
    });
};

Parser.prototype.parseCompetitions = function ( htmlpage ) {
    var result = {}, $ = cheerio.load(htmlpage);

    $('#block-menu-menu-competities-menu').find('a').each(function () {
        result[$(this).text()] = {
            url:  $(this).attr('href'),
            name: $(this).text()
        };
    });

    return result;
};

Parser.prototype.getDivisions = function ( competitions ) {

    console.log('[fetch] divisions', _.keys(competitions).length);

    return new Promise(( resolve, reject ) => {
        var processed = 0;
        _.forEach(competitions, competition => {
            console.log('[fetch] division', competition.name);
            var req = http.request({
                hostname: url.parse(startUrl).hostname,
                path:     competition.url,
                port:     80,
                method:   'GET'
            }, res => {
                var htmlpage = '';
                res.on('data', chunk => {
                    htmlpage += chunk;
                });
                res.on('end', () => {
                    console.log('[fetch] division ready', competition.name);
                    processed++;
                    competition.divisions = this.parseDivisions(htmlpage);
                    if ( processed === _.keys(competitions).length ) {
                        resolve(competitions);
                    }
                });
            });
            req.end();
        });
    });
};

Parser.prototype.parseDivisions = function ( htmlpage ) {
    var result = {}, $ = cheerio.load(htmlpage);

    $('.region.region-sidebar-first').find('a').each(function () {
        result[$(this).text()] = {
            url:  $(this).attr('href'),
            name: $(this).text()
        };
    });

    return result;
};

Parser.prototype.getMatches = function ( division ) {
    return new Promise(( resolve, reject ) => {
        var filename = division.name.split(' ').join('_') + '.json';
        console.log(division.name, '-', filename);

        var req = http.request({
            hostname: url.parse(division.url).hostname,
            path:     url.parse(division.url).path,
            port:     80,
            method:   'GET'
        }, res => {
            var htmlpage = '';
            res.on('data', chunk => {
                htmlpage += chunk;
            });
            res.on('end', () => {
                console.log('[fetch] matches ready', filename);
                this.parseMatches(htmlpage, filename);
            });
        });
        req.end();

    });
};

Parser.prototype.parseMatches = function ( htmlpage, filename ) {
    var result = {
        teams:   [],
        matches: []
    }, $       = cheerio.load(htmlpage);

    //== Teams
    $('#team-ranking').find('tr').not('.header').each(function () {
        result.teams.push({
            name: $($(this).find('td').get(1)).text()
        });
    });

    //== Matches
    $('.results').find('tr.header').each(function () {
        moment.locale('nl');
        var dateString = $(this).prev().find('td').text(), date = moment(dateString, 'ddd DD MMMM YYYY');
        console.log('MatchDay', date.format('ll'));
        $(this).nextUntil('.header', 'tr').each(function () {
            if ( $(this).find('td').length > 1 ) {
                var thisMatch = {
                    date:     date.format('YYYY-MM-DD'),
                    datetime: moment(dateString + ' ' + $(this).find('td:nth-child(1)').text(), 'ddd DD MMMM YYYY hh:mm').toDate(),
                    kickoff:  $(this).find('td:nth-child(1)').text(),
                    location: $(this).find('td:nth-child(2)').text(),
                    homeTeam: $(this).find('td:nth-child(3)').text(),
                    awayTeam: $(this).find('td:nth-child(4)').text(),
                    mathUrl:  $(this).find('td:nth-child(5) a').attr('href'),
                    score:    $(this).find('td:nth-child(5) a').text().replace(/(\d+ - \d+)/, "$1").trim()
                };
                result.matches.push(thisMatch);
            }
        });
    });

    console.log(result);
    fs.writeFile('./data/' + filename, JSON.stringify(result));

    return result;
};

module.exports = Parser;