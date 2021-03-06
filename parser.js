"use strict";
String.prototype.cleanup = function() {
    return this.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "-");
};

String.prototype.undash = function() {
    return this.replace(/[^a-zA-Z0-9]+/g, " ").replace(/\w\S*/g, function( txt ) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

const cheerio                 = require('cheerio'),
      _                       = require('lodash'),
      https                   = require('https'),
      fs                      = require('fs'),
      moment                  = require('moment'),
      url                     = require('url'),
      competitionCategoryUrls = [
          {
              name: 'Heren',
              url:  'http://www.rugby.nl/page/heren-3'
          },
          {
              name: 'Dames',
              url:  'http://www.rugby.nl/page/dames-4'
          },
          {
              name: 'Colts',
              url:  'http://www.rugby.nl/page/colts-4'
          },
          {
              name: 'Junioren',
              url:  'http://www.rugby.nl/page/junioren-3'
          },
          {
              name: 'Cubs',
              url:  'http://www.rugby.nl/page/cubs-3'
          }
      ];

const Parser = function() {
};

Parser.prototype.getCompetition = function( override ) {
    return new Promise(( resolve, reject ) => {
        if ( !override && fs.existsSync('./data/competition.json') ) {
            resolve(JSON.parse(fs.readFileSync('./data/competition.json').toString()));
        } else {
            console.warn('Competition file not available, creating a new one.', override, fs.existsSync('./data/competition.json'));
            this.getCompetitionsPerType().then(resolve).catch(reject);
        }
    });
};

Parser.prototype.getCompetitionsPerType = function() {

    return new Promise(( resolve ) => {
        let waitForThis = [];
        competitionCategoryUrls.forEach(category => {
            waitForThis.push(this.getCompetitionType(category.url, category.name));
        });

        Promise
            .all(waitForThis)
            .then(competitions => {

                const result = {};
                competitions.forEach(c => result[c.key] = c.data);

                fs.writeFileSync('./data/competition.json', JSON.stringify(result));
                resolve(result);
            })
            .catch(error => {
                console.error('Error:', error);
            });

    });
};

Parser.prototype.getCompetitionType = function( curl, cname ) {
    return new Promise(( resolve, reject ) => {
        let req = https.request({
            hostname: url.parse(curl).hostname,
            path:     url.parse(curl).path,
            method:   'GET'
        }, res => {
            let htmlpage = '';
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

Parser.prototype.updateCompetitions = function() {
    return new Promise(( resolve, reject ) => {
        this.getCompetitions()
            .then(competitions => {
                return this.getDivisions(competitions);
            })
            .then(competition => {
                competition.lastUpdate = (new Date()).toJSON();
                fs.writeFileSync('./data/competition.json', JSON.stringify(competition));
                resolve(competition);
            })
            .catch(e => {
                console.error('Error: ', e);
            });
    });
};

Parser.prototype.getCompetitions = function() {
    return new Promise(( resolve, reject ) => {
        let req = https.request({
            hostname: url.parse(startUrl).hostname,
            path:     url.parse(startUrl).path,
            method:   'GET'
        }, res => {
            let htmlpage = '';
            res.on('data', chunk => {
                htmlpage += chunk;
            });
            res.on('end', () => {
                resolve(this.parseCompetitions(htmlpage));
            });
        });
        req.end();
    });
};

Parser.prototype.parseCompetitions = function( htmlpage ) {
    const result = {}, $ = cheerio.load(htmlpage);

    $('#content').find('a.btn-primary[href]').each(function() {
        result[$(this).text()] = {
            url:        $(this).attr('href'),
            name:       $(this).text(),
            lastUpdate: (new Date()).toJSON()
        };
    });

    return result;
};

Parser.prototype.getDivisions = function( competitions ) {
    return new Promise(( resolve, reject ) => {
        let processed = 0;
        _.forEach(competitions, competition => {
            let req = https.request({
                hostname: url.parse(startUrl).hostname,
                path:     competition.url,
                method:   'GET'
            }, res => {
                let htmlpage = '';
                res.on('data', chunk => {
                    htmlpage += chunk;
                });
                res.on('end', () => {
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

Parser.prototype.parseDivisions = function( htmlpage ) {
    let result = {}, $ = cheerio.load(htmlpage);

    $('.region.region-sidebar-first').find('a').each(function() {
        result[$(this).text()] = {
            url:  $(this).attr('href'),
            name: $(this).text()
        };
    });

    return result;
};

Parser.prototype.getMatches = function( division ) {
    return new Promise(resolve => {
        const filename = division.name.cleanup() + '.json',
              req      = https.request({
                  hostname: url.parse(division.url).hostname,
                  path:     url.parse(division.url).path,
                  method:   'GET'
              }, res => {
                  let htmlpage = '';
                  res.on('data', chunk => htmlpage += chunk);
                  res.on('end', () => resolve(this.parseMatches(htmlpage, filename)));
              });
        req.end();
    });
};

Parser.prototype.parseMatches = function( htmlpage, filename ) {
    let result = {
        teams:      [],
        matches:    [],
        lastUpdate: (new Date()).toJSON()
    }, $       = cheerio.load(htmlpage);

    //== Teams
    $('#team-ranking').find('tr').not('.header').each(function() {
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
    $('.results').find('tr.header').each(function() {
        moment.locale('nl');
        let dateString = $(this).prev().find('td').text(), date = moment(dateString, 'ddd DD MMMM YYYY');
        $(this).nextUntil('.header', 'tr').each(function() {
            if ( $(this).find('td').length > 1 ) {
                let thisMatch = {
                    date:     date.format('YYYY-MM-DD'),
                    datetime: moment(dateString + ' ' + $(this).find('td:nth-child(1)').text(), 'ddd DD MMMM YYYY hh:mm').toDate(),
                    kickoff:  $(this).find('td:nth-child(1)').text(),
                    location: $(this).find('td:nth-child(2)').text(),
                    homeTeam: $(this).find('td:nth-child(3)').text(),
                    awayTeam: $(this).find('td:nth-child(4)').text(),
                    score:    $(this).find('td:nth-child(5)').text().replace(/(\d+ - \d+)/, "$1").trim()
                };
                result.matches.push(thisMatch);
            }
        });
    });

    fs.writeFileSync('./data/' + filename, JSON.stringify(result));
    return result;
};

module.exports = Parser;
