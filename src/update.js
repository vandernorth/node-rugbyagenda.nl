import Parser from "./parser.js";
import _      from "lodash";
import fs     from "fs";

const thisParser = new Parser();

export default async function runUpdate() {
    console.info('Sync started');
    const start           = Date.now().valueOf(),
          competitionInfo = await thisParser.getCompetition(true);

    await Promise.all(_.map(competitionInfo, division => {
        return thisParser.getMatches(division)
            .catch(e => console.error(e));
    }));

    console.info('Sync ready after', (Date.now().valueOf() - start) / 1000, 's');
    fs.writeFileSync('../data/lastupdate.json', JSON.stringify({date: new Date()}));
}

runUpdate();
