import { workerData, parentPort } from 'worker_threads';
import fs from 'fs';
import readline from 'readline';

const writeNextLine = (filePath: string, text: string) => {
	const lineId = fs.openSync(filePath, 'a', 666);
	fs.writeSync(lineId, text, null, 'utf8');
	fs.closeSync(lineId);
};

const search = () => {
	if (!workerData || !parentPort) {
		return;
	}

	const { searchedPrefix, analizedFile } = workerData;

	const fileName = `./found_salts/found_salts_${searchedPrefix}.csv`;
	if (!fs.existsSync(fileName)) {
		fs.writeFileSync(fileName, 'salt,address\n');
	}

	const rl = readline.createInterface({
		input: fs.createReadStream(analizedFile),
		crlfDelay: Infinity,
	});

	let foundSalts = 0;
	rl.on('line', (line) => {
		const [salt, address] = line.split(',');

		if (address.toLowerCase().startsWith(searchedPrefix)) {
			writeNextLine(fileName, `${salt},${address}\n`);

			foundSalts++;
		}
	});

	rl.on('close', () => {
		parentPort.postMessage(foundSalts);
	});
};

search();
