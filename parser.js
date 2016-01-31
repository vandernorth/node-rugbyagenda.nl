String.prototype.cleanup = function () {
    return this.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "-");
};
String.prototype.undash  = function () {
    return this.replace(/[^a-zA-Z0-9]+/g, " ").replace(/\w\S*/g, function ( txt ) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

var cheerio                 = require('cheerio'),
    _                       = require('lodash'),
    http                    = require('http'),
    fs                      = require('fs'),
    moment                  = require('moment'),
    url                     = require('url'),
    competitionCategoryUrls = [
        {
            name: 'Heren',
            url:  'http://www.rugby.nl/page/heren'
        },
        {
            name: 'Dames',
            url:  'http://www.rugby.nl/page/dames-competitie'
        },
        {
            name: 'Colts',
            url:  'http://www.rugby.nl/page/colts'
        },
        {
            name: 'Junioren',
            url:  'http://www.rugby.nl/page/junioren'
        },
        {
            name: 'Cubs',
            url:  'http://www.rugby.nl/page/cubs'
        }
    ];

var Parser = function () {
};

Parser.prototype.getCompetition = function ( override ) {
    return new Promise(( resolve, reject ) => {
        if ( !override && fs.existsSync('./data/competition.json') ) {
            resolve(JSON.parse(fs.readFileSync('./data/competition.json').toString()));
        }
        else {
            console.warn('Competition file not available, creating a new one.', override, fs.existsSync('./data/competition.json'));
            this.getCompetitionsPerType().then(resolve).catch(reject);
        }
    });
};

Parser.prototype.getCompetitionsPerType = function () {

    return new Promise(( resolve, reject ) => {
        var waitForThis = [];
        competitionCategoryUrls.forEach(category => {
            waitForThis.push(this.getCompetitionType(category.url, category.name));
        });

        Promise
            .all(waitForThis)
            .then(competitions => {

                var result = {};
                competitions.forEach(c => {
                    result[c.key] = c.data;
                });

                fs.writeFileSync('./data/competition.json', JSON.stringify(result));
                resolve(result);
            })
            .catch(error => {
                console.error('Error:', error);
            });

    });
};

Parser.prototype.getCompetitionType = function ( curl, cname ) {
    return new Promise(( resolve, reject ) => {
        var req = http.request({
            hostname: url.parse(curl).hostname,
            path:     url.parse(curl).path,
            port:     80,
            method:   'GET'
        }, res => {
            var htmlpage = '';
            res.on('data', chunk => {
                htmlpage += chunk;
            });
            res.on('end', () => {
                resolve({
                    key:  cname,
                    data: this.parseCompetitions(htmlpage)
                });
            });
        });
        req.end();
    });
};

Parser.prototype.updateCompetitions = function () {
    return new Promise(( resolve, reject ) => {
        this.getCompetitions()
            .then(competitions => {
                return this.getDivisions(competitions);
            })
            .then(competition => {
                competition.lastUpdate = (new Date()).toJSON();
                console.log('WriteFile!');
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
                //console.log('[fetch] competitions ready');
                resolve(this.parseCompetitions(htmlpage));
            });
        });
        req.end();
    });
};

Parser.prototype.parseCompetitions = function ( htmlpage ) {
    var result = {}, $ = cheerio.load(htmlpage);

    $('#content').find('a.btn-warning[href]').each(function () {
        result[$(this).text()] = {
            url:        $(this).attr('href'),
            name:       $(this).text(),
            lastUpdate: (new Date()).toJSON()
        };
    });

    return result;
};

Parser.prototype.getDivisions = function ( competitions ) {

    //console.log('[fetch] divisions', _.keys(competitions).length);

    return new Promise(( resolve, reject ) => {
        var processed = 0;
        _.forEach(competitions, competition => {
            //console.log('[fetch] division', competition.name);
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
                    //console.log('[fetch] division ready', competition.name);
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
        var filename = division.name.cleanup() + '.json';
        var req      = http.request({
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
                this.parseMatches(htmlpage, filename);
            });
        });
        req.end();
    });
};

Parser.prototype.parseMatches = function ( htmlpage, filename ) {
    var result = {
        teams:      [],
        matches:    [],
        lastUpdate: (new Date()).toJSON()
    }, $       = cheerio.load(htmlpage);

    //== Teams
    $('#team-ranking').find('tr').not('.header').each(function () {
        result.teams.push({
            rank:        $($(this).find('td').get(0)).text(),
            name:        $($(this).find('td').get(1)).text(),
            playedGames: $($(this).find('td').get(2)).text(),
            won:         $($(this).find('td').get(3)).text(),
            lost:        $($(this).find('td').get(4)).text(),
            equal:       $($(this).find('td').get(5)).text(),
            points:      $($(this).find('td').get(6)).text(),
            scoreWon:    $($(this).find('td').get(7)).text(),
            scoreLost:   $($(this).find('td').get(8)).text(),
            scoreDiff:   $($(this).find('td').get(9)).text()

        });
    });

    //== Matches
    $('.results').find('tr.header').each(function () {
        moment.locale('nl');
        var dateString = $(this).prev().find('td').text(), date = moment(dateString, 'ddd DD MMMM YYYY');
        $(this).nextUntil('.header', 'tr').each(function () {
            if ( $(this).find('td').length > 1 ) {
                var thisMatch = {
                    date:     date.format('YYYY-MM-DD'),
                    datetime: moment(dateString + ' ' + $(this).find('td:nth-child(1)').text(), 'ddd DD MMMM YYYY hh:mm').toDate(),
                    kickoff:  $(this).find('td:nth-child(1)').text(),
                    location: $(this).find('td:nth-child(2)').text(),
                    homeTeam: $(this).find('td:nth-child(3)').text(),
                    awayTeam: $(this).find('td:nth-child(4)').text(),
                    matchUrl: $(this).find('td:nth-child(5) a').attr('href'),
                    score:    $(this).find('td:nth-child(5)').text().replace(/(\d+ - \d+)/, "$1").trim()
                };
                result.matches.push(thisMatch);
            }
        });
    });

    fs.writeFile('./data/' + filename, JSON.stringify(result));

    return result;
};

module.exports = Parser;