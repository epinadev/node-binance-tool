const { ArgumentParser } = require('argparse');
const { BinanceUtil } = require('./binance-connector');
const { ChangeAnalyzer } = require('./change-analyzer');

// ===========================
// COMMAND LINE ARGUMENT HANDLERS
// ===========================

const parser = new ArgumentParser({
    description: 'Argparse example',
});

parser.add_argument('--price', { action: 'store' });
parser.add_argument('--ticker', { action: 'store' });
parser.add_argument('--balance', { action: 'store_true' });

parser.add_argument('--buy', { action: 'store' });
parser.add_argument('--spend', { action: 'store' });
parser.add_argument('--with', { action: 'store' });

parser.add_argument('--sell', { action: 'store' });
parser.add_argument('--to', { action: 'store' });
parser.add_argument('--quantity', { action: 'store' });
parser.add_argument('--at', { action: 'store' });

parser.add_argument('--convert', { action: 'store' });

parser.add_argument('--futures', { action: 'store_true' });
parser.add_argument('--test', { action: 'store_true' });
parser.add_argument('--listen', { action: 'store_true' });

const args = parser.parse_args();
const binance = new BinanceUtil(args.futures);

if (args.balance) {
    binance.getBalances().then((balances) => console.log(balances));
}

// Get the price of a given token
else if (args.price) {
    const symbol = args.price.toUpperCase() + '/USDT';

    binance.getTicker(symbol).then((price) => console.log(price));
}

// Get the full ticker
else if (args.ticker) {
    const symbol = args.ticker.toUpperCase() + '/USDT';

    binance.getTicker(symbol, false).then((ticker) => console.log(ticker));
}

// Create BUY Order for a give token
else if (args.buy) {
    const base = args.buy.toUpperCase();
    const quote = args.with || 'USDT';
    const symbol = `${base}/${quote}`;
    const spend = args.spend;
    const at = args.at;
    const quantity = args.quantity;
    const buyPromise = at
        ? binance.buyLimit(symbol, quantity, spend, at)
        : binance.buyMarket(symbol, quantity, spend);

    buyPromise
        .then((order) => console.log(order))
        .catch((error) => console.log(error));
}

// Create a SELL Order for a give token
else if (args.sell) {
    const base = args.sell.toUpperCase();
    const quote = args.to || 'USDT';
    const symbol = `${base}/${quote}`;
    const at = args.at;
    const quantity = args.quantity || '100%';

    if (args.sell === 'ALL') {
        binance
            .sellAll(quote)
            .then((resp) => console.log(resp))
            .catch((error) => console.log(error));
    } else {
        binance
            .sell(symbol, quantity, at)
            .then((order) => console.log(order))
            .catch((error) => console.log(error));
    }
}

// Convert quantities
else if (args.convert) {
    const base = args.convert.toUpperCase();
    const quote = args.to || 'USDT';
    const quantity = args.quantity || 1;

    binance
        .calculateConversion(base, quote, quantity)
        .then((amount) => console.log(amount))
        .catch((error) => console.log(error));
}

// Detect abnormal changes in the price or volume
else if (args.listen) {
    const analyzer = new ChangeAnalyzer();

    analyzer.start();
}

// For test only
else if (args.test) {
    binance.test().then((r) => console.log(r));
}
