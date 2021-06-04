const { BinanceUtil } = require('./binance-connector');
const { loadData, saveData } = require('./utils');
const { TeleBot } = require('./telegram');
const { keys, set } = require('lodash');

const binance = new BinanceUtil();
const telegram = new TeleBot();
VOLUME_INCREASED_THRESHOLD = 15;
PRICE_CHANGE_THRESHOLD = 4;

global.trackedSymbols = {};

const analyzePrice = (symbol, priceChange) => {
    let message = '';
    const currentDate = new Date();
    const prevTrackedChange = trackedSymbols[symbol] || {
        priceChange: 0,
        priceUpdated: new Date(0),
    };

    const lastCheckTimeSpanSec =
        (currentDate - prevTrackedChange.priceUpdated) / 1000 / 60;

    if (Math.abs(priceChange) >= PRICE_CHANGE_THRESHOLD) {
        const prevTrackedPrice = prevTrackedChange.priceChange;
        const diff = Math.abs(
            Math.abs(prevTrackedChange) - Math.abs(priceChange)
        );
        if (
            // Prev track was negative or 0 and below 4% and now is above 4%
            (prevTrackedPrice <= 0 && priceChange > 0) ||
            // Prev track was positive or 0 and above 4% and now is below 4% 
            (prevTrackedPrice >= 0 && priceChange < 0) ||
            // The difference with the last tracked price is over 2%
            (diff > 2)
        ) {
            if (lastCheckTimeSpanSec > 40) {
                const action = priceChange > 0 ? 'increased' : 'decreased';
                message += `Price has ${action} in ${priceChange.toFixed(2)}%`;
                set(trackedSymbols, `${symbol}.priceChange`, priceChange);
                set(trackedSymbols, `${symbol}.priceUpdated`, currentDate);
            }
        }
    }

    return message;
};

const analyzeVolume = (symbol, volumeChange) => {
    let message = '';
    const currentDate = new Date();
    const prevTrackedChange = trackedSymbols[symbol] || {
        volumeChange: 0,
        volumeUpdated: new Date(0),
    };

    const lastCheckTimeSpanMins =
        (currentDate - prevTrackedChange.volumeUpdated) / 1000 / 60 / 60;

    if (lastCheckTimeSpanMins > 5) {
        if (Math.abs(volumeChange) >= VOLUME_INCREASED_THRESHOLD) {
            if (prevTrackedChange.volumeChange < volumeChange) {
                const volumeMessage = `Volume increased in ${volumeChange.toFixed(
                    2
                )}%`;
                message = message
                    ? `${message} and ${volumeMessage}`
                    : volumeMessage;
                set(trackedSymbols, `${symbol}.volumeChange`, volumeChange);
                set(trackedSymbols, `${symbol}.volumeUpdated`, currentDate);
            }
        }
    }

    return message;
};

const analyze = (lastUpdate, storedData, currentData) => {
    keys(storedData).forEach((symbol) => {
        const currentPrice = currentData[symbol].price;
        const storedPrice = storedData[symbol].price;
        const minutesPassed = (new Date() - lastUpdate) / 1000 / 60;
        const priceChange = (currentPrice * 100) / storedPrice - 100;
        const message = analyzePrice(symbol, priceChange);

        if (message) {
            const minutes = minutesPassed.toFixed();
            const finalMsg = `${symbol}: ${message} in the last ${minutes} mins`;

            telegram.send(finalMsg);
            console.log(finalMsg);
        }
    });

    return trackedSymbols;
};

const runAnalyzer = async () => {
    const symbolsTrack = loadData('symbols-track');
    const newData = await binance.getUsdtSymbolsData();
    const currentDate = new Date();

    if (!symbolsTrack.error) {
        const lastUpdate = new Date(symbolsTrack.lastUpdate || 0);
        const hours = (currentDate - lastUpdate) / 1000 / 60 / 60;

        if (hours > 1) {
            console.log('Updating symbols-track.json');
            saveData('symbols-track', {
                lastUpdate: currentDate.toISOString(),
                data: newData,
            });
            trackedSymbols = {};
        } else {
            console.log('...Analyzing');
            const storedData = symbolsTrack.data;
            analyze(lastUpdate, storedData, newData);
        }
    } else {
        trackedSymbols = {};
        console.log('Updating symbols-track.json');
        saveData('symbols-track', {
            lastUpdate: currentDate.toISOString(),
            data: newData,
        });
    }
};

class ChangeAnalyzer {
    constructor() {
        this.interval = false;
    }

    start() {
        // Cleanup
        saveData('symbols-track', {});
        this.interval = setInterval(runAnalyzer, 20000);
    }

    stop() {
        clearInterval(this.interval);
    }
}

module.exports.ChangeAnalyzer = ChangeAnalyzer;

// Get the first set of tokens
