require('dotenv').config();

const ccxt = require('ccxt');
const { parseTicker, loadData, saveData } = require('./utils');
const { each, get } = require('lodash');
const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;

class BinanceUtil {
    constructor(futures = false) {
        this.futures = futures;
        this.lastQuerySymbols = false;

        const options = {};
        if (futures) options.defaultType = 'future';

        this.exchange = new ccxt.binance({
            apiKey: API_KEY,
            secret: API_SECRET,
            timeout: 30000,
            enableRateLimit: true,
            options,
        });
    }

    async test() {
        return await this.getUsdtSymbolsData();
    }

    async getUsdtSymbolsData() {
        const symbols = await this.getUsdtSymbolsNames();
        const tickers = await this.exchange.fetchTickers(symbols);
        const tickersMap = {};

        each(tickers, (data, symbolName) => {
            tickersMap[symbolName] = parseTicker(data);
        });

        return tickersMap;
    }

    async fetchUsdtSymbolsNamesFromServer() {
        const markets = await this.exchange.fetchMarkets();
        const excludedSymbols = [
            'TUSD/USDT',
            'BUSD/USDT',
            'USDC/USDT',
            'DAI/USDT',
            'JUV/USDT',
            'SUS/USDT',
        ];

        const symbols = markets
            .map((m) => m.symbol)
            .filter(
                (m) =>
                    m.endsWith('USDT') &&
                    !m.includes('UP') &&
                    !m.includes('DOWN') &&
                    !m.includes('BULL') &&
                    !m.includes('BEAR') &&
                    !excludedSymbols.includes(m)
            );

        saveData('symbols', {
            lastUpdate: new Date().toISOString(),
            symbols,
        });

        return symbols;
    }

    async getUsdtSymbolsNames() {
        const storedSymbols = loadData('symbols');
        const currentDate = new Date();

        if (!storedSymbols.error) {
            const lastUpdate = new Date(storedSymbols.lastUpdate);
            const hours = (currentDate - lastUpdate) / 1000 / 60 / 60;

            if (hours > 2) {
                return await this.fetchUsdtSymbolsNamesFromServer();
            }

            return storedSymbols.symbols;
        }

        return await this.fetchUsdtSymbolsNamesFromServer();
    }

    async getSymbolChangeInUsdt(symbol, timeInMins = 5) {
        // Returns how much has changed a symbol in time
    }

    async calculateConversion(base, quote, quantity) {
        base = base.toUpperCase();
        quote = quote.toUpperCase();
        const symbol =
            base !== 'USDT' ? `${base}/${quote}` : `${quote}/${base}`;
        const price = await this.getTicker(symbol, true);

        return base === 'USDT' ? quantity / price : price * quantity;
    }

    async getTicker(symbol, onlyPrice = true) {
        const ticker = await this.exchange.fetchTicker(symbol);
        const parsedTicker = parseTicker(ticker);

        return onlyPrice ? parsedTicker.price : parsedTicker;
    }

    async getBalances() {
        const balanceInfo = await this.exchange.fetchBalance();
        const balances = get(balanceInfo, 'info.balances', []);
        return balances
            .filter(({ free, locked }) => free > 0 || locked > 0)
            .map(({ asset, free, locked }) => ({
                asset,
                free: parseFloat(free),
                locked: parseFloat(locked),
            }));
    }

    async buyMarket(symbol, quantity, spend) {
        if (!quantity) {
            if (spend) {
                const price = await this.getTicker(symbol);

                quantity = spend / price;
            } else {
                const balances = await this.getBalances();
                const asset = symbol.split('/')[0];
                const balance = balances.find(b.asset === asset);

                quantity = get(balance, 'free', 0);
            }
        }

        return await this.exchange.createMarketOrder(symbol, 'buy', quantity);
    }

    async buyLimit(symbol, quantity, spend, at) {
        quantity = !quantity ? spend / at : quantity;
        return await this.exchange.createLimitBuyOrder(symbol, quantity, at);
    }

    // ===========================
    // SELL FUNCTIONS
    // ===========================
    async sell(symbol, quantity, at) {
        if (this.futures) {
            return sellFuture(symbol, quantity, at);
        }

        const balances = await this.getBalances();
        const asset = symbol.split('/')[0];
        const balance = balances.find((b) => b.asset === asset);
        const assetBalance = get(balance, 'free', 0);

        if (!assetBalance) return { error: `No balance for ${asset}` };

        if (quantity.includes('%')) {
            const quantityPerc = Number(quantity.split('%')[0]);
            quantity = (assetBalance * quantityPerc) / 100;
        }

        return at
            ? this.exchange.createLimitSellOrder(symbol, quantity, at)
            : this.exchange.createMarketOrder(symbol, 'sell', quantity);
    }

    async sellAll(quote = 'USDT') {
        const balances = await getBalances();
        const promises = [];

        balances.forEach((balance) => {
            if (balance.asset !== 'USDT' && !balance.asset.includes('LD')) {
                const symbol = `${balance.asset}/${quote}`;
                promises.push(this.sell(symbol, '100%'));
            }
        });

        return Promise.all(promises);
    }

    async sellFuture(symbol, quantity, at) {
        const trades = await this.exchange.fetchMyTrades('ONT/USDT');

        return at
            ? this.exchange.createLimitSellOrder(symbol, quantity, at)
            : this.exchange.createMarketOrder(symbol, 'sell', quantity);
    }
}

module.exports.BinanceUtil = BinanceUtil;
