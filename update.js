const Parser     = require('./parser'),
      _          = require('lodash'),
      fs         = require('fs'),
      thisParser = new Parser();

async function runUpdate() {
    const competitionInfo = await thisParser.getCompetition(true),
          start           = Date.now().valueOf();

    console.info('Sync started');
    await Promise.all(_.map(competitionInfo, competition => {
        return Promise.all(_.map(competition, division => {
            return thisParser.getMatches(division)
                .catch(e => console.error(e));
        }));
    }));
    console.info('Sync ready after', (Date.now().valueOf() - start) / 1000, 's');
    fs.writeFileSync('./data/lastupdate.json', JSON.stringify({ date: new Date() }));
}

module.exports = runUpdate;
