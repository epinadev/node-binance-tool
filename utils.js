const fs = require('fs');

const parseTicker = (ticker) => {
    return {
        symbol: ticker.symbol,
        datetime: ticker.datetime,
        price: parseFloat(ticker.info.lastPrice),
        vwap: ticker.vwap,
        volume: ticker.baseVolume,
        h24: {
            open: ticker.open,
            high: ticker.high,
            low: ticker.low,
            change: ticker.percentage,
        },
    };
};

const loadData = (file) => {
    try {
        const rawdata = fs.readFileSync(`data/${file}.json`);
        const data = JSON.parse(rawdata);

        return data;
    } catch (e) {
        return { error: 'Non existing file' }
    }
};

const saveData = (file, data) => {
    try {
        const strData = JSON.stringify(data);

        fs.writeFileSync(`data/${file}.json`, strData);
    } catch (e) {
        return { error: 'Error saving the file' }
    }
}

module.exports.parseTicker = parseTicker;
module.exports.loadData = loadData;
module.exports.saveData = saveData;
