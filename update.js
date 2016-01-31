var Parser     = require('./parser'),
    _          = require('lodash'),
    fs         = require('fs'),
    thisParser = new Parser();

//== TODO: Backup last files

function runUpdate() {
    thisParser.getCompetition(true)
        .then(competitionInfo => {
            _.forEach(competitionInfo, competition => {
                console.log('GetMatches for', _.keys(competition).length, 'divisions');
                _.forEach(competition, division => {
                    thisParser.getMatches(division)
                        .then(m => {
                            console.log('Ready', division.name, m.length);
                        }).catch(e => {
                        console.error(e);
                    });
                });
            });
            fs.writeFileSync('./data/lastupdate.json', JSON.stringify({ date: new Date() }));
        })
        .catch(e => {
            console.error(e);
        });
}

runUpdate();