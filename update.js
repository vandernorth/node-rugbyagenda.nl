var thisParser = new Parser();

//== TODO: Backup last files

function runUpdate() {
    thisParser.getCompetition(true)
        .then(competitionInfo => {
            _.forEach(competitionInfo, competition => {
                _.forEach(competition.divisions, division => {
                    thisParser.getMatches(division);
                });
            });
        })
        .catch(e => {
            console.error(e);
        });
}

runUpdate();