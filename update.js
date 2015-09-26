var Parser     = require('./parser'),
    _          = require('lodash'),
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