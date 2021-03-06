"use strict";
require("console-stamp")(console);
require('string').extendPrototype();

const _          = require('lodash'),
      fs         = require('fs'),
      doT        = require('express-dot'),
      ical       = require('ical-generator'),
      util       = require('util'),
      morgan     = require('morgan'),
      moment     = require('moment'),
      express    = require('express'),
      app        = express(),
      Parser     = require('./parser'),
      runUpdate  = require('./update'),
      thisParser = new Parser();

let lastUpdate = 'Onbekend';

class RugbyAgenda {
    constructor() {
        moment.locale('nl-NL');
        RugbyAgenda.fixCWD();
        this.startServer();
        this.getLastUpdate();

        app.listen(3000, () => {
            console.log('rugbyagenda.nl listning on port 3000');
            console.log('Working directory', process.cwd(), __dirname);
        });

        setInterval(() => this.doUpdate(), 15 * 60 * 1000);
        this.doUpdate();
    }

    doUpdate() {
        runUpdate().then(() => {
            this.getLastUpdate();
            this.cleanCache();
        });
    }

    static fixCWD() {
        try {
            process.chdir(__dirname);
            console.info('New directory: ' + process.cwd());
        }
        catch ( err ) {
            console.info('chdir: ' + err);
        }
    }

    startServer() {
        let self = this;
        app.use(morgan('combined'));
        app.set('views', __dirname + '/views');
        app.set('view engine', 'dot');
        app.engine('dot', doT.__express);
        app.use('/public', express.static('public'));
        app.get('/', function( req, res ) {
            thisParser.getCompetition().then(competitionInfo => {
                res.render('home', {
                    competition: _.map(competitionInfo, ( competition, name ) => {
                        if ( name === 'Cubs' ) {
                            return;
                        }
                        var a       = { name: name };
                        a.divisions = _.sortBy(_.map(competition, b => b), 'name');
                        return a.divisions.length > 0 ? a : false;
                    }),
                    lastUpdate:  typeof lastUpdate === 'string' ? lastUpdate : lastUpdate.fromNow()
                });
            });
        });

        app.get(/^\/agenda\/([\d\w-]+)\/$/, function( req, res ) {
            try {
                const info = require('./data/' + req.params[0] + '.json');
                res.render('agenda', {
                    url:        'https://www.rugbyagenda.nl/ical/' + req.params[0] + '/',
                    teams:      _(info.teams).sortBy('name').value(),
                    name:       req.params[0].split('_').join(' '),
                    lastUpdate: typeof lastUpdate === 'string' ? lastUpdate : lastUpdate.fromNow()
                });
            }
            catch ( ex ) {
                console.error(ex);
                res.end('Agenda not found');
            }
        });

        app.get(/^\/ical\/([\d\w-]+)\/([\d\w-]+)?\/?$/, function( req, res ) {
            try {
                const name = req.params[0], matches = require('./data/' + name + '.json'),
                      team                          = req.params[1];

                const cal = ical({
                    domain:   'rugbyagenda.nl',
                    name:     'Rugby Competitie - ' + name.split('_').join(' '),
                    prodId:   {
                        company: 'erugby.nl',
                        product: 'ical'
                    },
                    timezone: 'Europe/Amsterdam',
                    events:   self.icalMatches(matches.matches, team)
                });

                cal.serve(res);
            }
            catch ( ex ) {
                console.error(ex);
                res.end('Agenda not found');
            }
        });

        app.get(/^\/watch\/([\d\w-]+)\/([\d\w-]+)?\/?$/, function( req, res ) {
            try {
                const name = req.params[0], matches = require('./data/' + name + '.json'),
                      team                          = req.params[1];

                res.render('watch', {
                    name:       name,
                    matches:    matches.matches,
                    teams:      matches.teams,
                    lastUpdate: moment(matches.lastUpdate).fromNow(),
                    team:       team
                });
            }
            catch ( ex ) {
                console.error(ex);
                res.end('Agenda not found');
            }
        });
    }

    icalMatches( matches, team ) {
        return _.compact(_.map(matches, match => {
            if ( !team || (team && (RugbyAgenda.compareName(team, match.homeTeam) || RugbyAgenda.compareName(team, match.awayTeam))) ) {

                const scoreAddition = (match.score && match.score.length > 3 && match.score !== "0 - 0") ? ` [${match.score}]` : '';
                return {
                    start:       new Date(match.datetime),
                    end:         new Date(new Date(match.datetime).getTime() + 7200000),
                    timestamp:   new Date(),
                    summary:     match.homeTeam + ' vs ' + match.awayTeam + scoreAddition,
                    organizer:   match.homeTeam + ' <unknown@rugby.nl>',
                    description: util.format('Thuisteam: %s\nGastteam: %s\nKickoff: %s\nLocation: %s\nScore: %s\n', match.homeTeam, match.awayTeam, match.kickoff, match.location, match.score),
                    url:         match.url,
                    location:    match.location
                };
            }
        }));
    }

    static compareName( a, b ) {
        return a.cleanup() === b.cleanup();
    }

    cleanCache() {
        _.keys(require.cache).filter(r => r.indexOf('data') > -1 && r.indexOf('.json') > -1).forEach(r => {
            console.log('Clearing cache for', r);
            delete require.cache[r];
        });
        console.info('cleanCache()::Ready');
    }

    getLastUpdate() {
        try {
            lastUpdate = moment(JSON.parse(fs.readFileSync('./data/lastupdate.json').toString()).date);
            console.log('Updates "lastupdate"', lastUpdate.format('LLL'));
        }
        catch ( e ) {
            console.error('Cannot get lastupdate', e);
            lastUpdate = 'Onbekend';
        }
    }
}

const rugbyAgenda = new RugbyAgenda();
module.exports    = rugbyAgenda;
