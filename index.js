require("console-stamp")(console);

var Parser     = require('./parser'),
    fs         = require('fs'),
    thisParser = new Parser(),
    doT        = require('express-dot'),
    ical       = require('ical-generator'),
    util       = require('util'),
    morgan     = require('morgan'),
    _          = require('lodash');

var express = require('express');
var app     = express();

app.use(morgan('combined'));
app.set('views', __dirname + '/views');
app.set('view engine', 'dot');
app.engine('dot', doT.__express);
app.get('/', function ( req, res ) {
    thisParser.getCompetition().then(competitionInfo => {
        res.render('home', {
            competition: _.map(competitionInfo, c => {
                var a       = c;
                a.divisions = _.map(c.divisions, b=> b);
                return a.divisions.length > 0 ? a : false;
            })
        });
    })
});

app.get(/^\/agenda\/([\d\w-]+)\/$/, function ( req, res ) {
    try {
        var info = require('./data/' + req.params[0] + '.json');
        res.render('agenda', {
            url:   'http://www.rugbyagenda.nl/ical/' + req.params[0] + '/',
            teams: info.teams,
            name:  req.params[0].split('_').join(' ')
        });
    }
    catch ( ex ) {
        console.error(ex);
        res.end('Agenda not found');
    }
});

app.get(/^\/ical\/([\d\w-]+)\/([\d\w-]+)?\/?$/, function ( req, res ) {
    try {
        var name = req.params[0], matches = require('./data/' + name + '.json'),
            team = req.params[1];

        console.log('[ical]', name, team);

        var cal = ical({
            domain:   'rugbyagenda.nl',
            name:     'Rugby Competitie - ' + name.split('_').join(' '),
            prodId:   {
                company: 'erugby.nl',
                product: 'ical'
            },
            timezone: 'Europe/Amsterdam',
            events:   icalMatches(matches.matches, team)
        });

        //cal.serve(res);
        res.render('agenda', { url: cal.toString() });
    }
    catch ( ex ) {
        console.error(ex);
        res.end('Agenda not found');
    }
});

function icalMatches( matches, team ) {
    return _.compact(_.map(matches, match => {
        if ( !team || (team && (compareName(team, match.homeTeam) || compareName(team, match.awayTeam))) ) {
            return {
                start:       new Date(match.datetime),
                end:         new Date(new Date(match.datetime).getTime() + 7200000),
                timestamp:   new Date(),
                summary:     match.homeTeam + ' vs ' + match.awayTeam,
                organizer:   match.homeTeam + ' <unknown@rugby.nl>',
                description: util.format('Thuisteam: %s\nGastteam: %s\nKickoff: %s\nLocation: %s\nScore: %s\n', match.homeTeam, match.awayTeam, match.kickoff, match.location, match.score),
                url:         match.url,
                location:    match.location
            };
        }
    }));
}

function compareName( a, b ) {
    return a.cleanup() === b.cleanup();
}

try {
    process.chdir(__dirname);
    console.log('New directory: ' + process.cwd());
}
catch ( err ) {
    console.log('chdir: ' + err);
}

var server = app.listen(82, () => {
    console.log('rugbyagenda.nl listning on port 82');
    console.log('Working directory', process.cwd(), __dirname);
});