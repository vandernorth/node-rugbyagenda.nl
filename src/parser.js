"use strict";
import axios   from 'axios';
import cheerio from "cheerio";
import _       from "lodash";
import https   from "https";
import fs      from "fs";
import moment  from "moment";
import url     from "url";

String.prototype.cleanup = function() {
    return this.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "-");
};

const seasonURL = "https://www.rugby.nl/competitie/speelschema/seizoen-2021-2022/";

export default class Parser {

    async getCompetition(override) {
        if (!override && fs.existsSync('../data/competition.json')) {
            return JSON.parse(fs.readFileSync('../data/competition.json').toString());
        } else {
            console.warn('Competition file not available, creating a new one.', override, fs.existsSync('./data/competition.json'));
            return this.downloadCompetitions();
        }
    }

    async downloadCompetitions() {
        const competitionHtml = (await axios.get(seasonURL)).data,
              competitions    = this.parseCompetitions(competitionHtml);

        fs.writeFileSync('../data/competition.json', JSON.stringify(competitions, null, '\t'));
        return competitions;
    }

    parseCompetitions(html) {
        const result = {}, $ = cheerio.load(html);
        $('a[target="_blank"]').each(function() {
            const href = $(this).attr('href');

            if (!href || href.indexOf('erugby.nl') === -1) {
                return;
            }

            const type     = $(this).closest('accordion').attr('title'),
                  name     = $(this).text(),
                  fullName = `${_.capitalize(type)} - ${name.toLowerCase()}`;

            result[fullName] = {
                url:        href,
                name:       fullName,
                title:      name,
                lastUpdate: (new Date()).toJSON(),
                filename:   fullName.cleanup(),
                type
            };
        });

        return result;
    }

    updateCompetitions() {
        return new Promise((resolve, reject) => {
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
    }

    getCompetitions() {
        return new Promise((resolve, reject) => {
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
    }

    getDivisions(competitions) {
        return new Promise((resolve, reject) => {
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
                        if (processed === _.keys(competitions).length) {
                            resolve(competitions);
                        }
                    });
                });
                req.end();
            });
        });
    }

    parseDivisions(htmlpage) {
        let result = {}, $ = cheerio.load(htmlpage);

        $('.region.region-sidebar-first').find('a').each(function() {
            result[$(this).text()] = {
                url:  $(this).attr('href'),
                name: $(this).text()
            };
        });

        return result;
    }

    getMatches(division) {
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
    }

    parseMatches(htmlpage, filename) {
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
                if ($(this).find('td').length > 1) {
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

        fs.writeFileSync('../data/' + filename, JSON.stringify(result));
        return result;
    }

}
