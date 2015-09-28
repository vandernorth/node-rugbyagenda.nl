var Parser     = require('./parser'),
    _          = require('lodash'),
    fs          = require('fs'),
    thisParser = new Parser();

//== TODO: Backup last files

function runUpdate() {
    console.log('Running update');
    thisParser.getCompetition(true)
        .then(competitionInfo => {
            _.forEach(competitionInfo, competition => {
                _.forEach(competition.divisions, division => {
                    console.log('GetMatches', division.name);
                    thisParser.getMatches(division)
                        .then(m => {
                            console.log('Ready', division.name, m.length);
                            fs.writeFileSync('./data/lastupdate.json',JSON.stringify({date:new Date()}));
                        }).catch(e => {
                            console.error(e);
                        });
                });
            });
        })
        .catch(e => {
            console.error(e);
        });
}

runUpdate();