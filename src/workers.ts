import { Worker } from 'worker_threads';
import { select, input } from '@inquirer/prompts';
import fs from 'fs';
import { BytesLike } from 'ethers';

const generateSalts = async (
	workersCount: number,
	requestsPerWorker: number
) => {
	let totalSaltsGenerated = 0;
	let requestsFullfilled: number[] = Array(workersCount).fill(0);
	const timestamp = Date.now();

	const createWorker = (index: number) => {
		const worker = new Worker('./src/worker.js', {
			workerData: {
				path: './generate.ts',
				timestamp: `${timestamp}_${index}`,
				requestsPerWorker,
			},
		});

		worker.on('message', () => {
			totalSaltsGenerated += 1000;
			requestsFullfilled[index] += 1000;

			console.clear();
			console.log(`Workers active: '${workersCount}'`);
			console.log(`Salts generated: '${totalSaltsGenerated}'`);
			requestsFullfilled.forEach((value, index) => {
				console.log(
					`The worker '${index}' has finished '${value}' requests.`
				);
			});
		});
		worker.on('error', (msg) => {
			console.log(msg);
		});
	};

	for (let index = 0; index < workersCount; index++) {
		createWorker(index);
	}
};

const searchSalt = async (workersCount: number, searchedPrefix: BytesLike) => {
	const saltJsons = fs.readdirSync('./salts');

	const workers = new Array(workersCount).fill([]).map((_, index) => {
		const jsonsPerWorker = saltJsons.length / workersCount;

		const workerTasks = saltJsons.slice(
			index * jsonsPerWorker,
			index * jsonsPerWorker + jsonsPerWorker
		);

		return { workerTasks, tasksDone: 0 };
	});

	function createWorker(index: number) {
		const worker = new Worker('./src/worker.js', {
			workerData: {
				path: './search.ts',
				analizedFile: `./salts/${
					workers[index].workerTasks[workers[index].tasksDone++]
				}`,
				searchedPrefix,
			},
		});

		worker.on('exit', () => {
			if (workers[index].workerTasks.length > workers[index].tasksDone) {
				createWorker(index);
			}
		});
		worker.on('message', (data) => {
			console.log(
				`'${data}' salts found in the file '${
					workers[index].workerTasks[workers[index].tasksDone - 1]
				}'`
			);
		});
		worker.on('error', (msg) => {
			console.log(`An error ocurred: ${msg}`);
		});
	}

	for (let index = 0; index < workersCount; index++) {
		if (workers[index].workerTasks.length > 0) {
			createWorker(index);
		}
	}
};

const main = async () => {
	const response = await select({
		message: 'Please choose action:',
		choices: [{ value: 'generate salts' }, { value: 'search salt' }],
	});

	if (response === 'generate salts') {
		const workersCount = Number.parseInt(
			await input({
				message: 'How many threads do you want to use?',
				default: '20',
			})
		);

		const requests = Number.parseInt(
			await input({
				message: 'How many requests do you want to make?',
				default: '100000',
			})
		);

		generateSalts(workersCount, requests);
	}

	if (response === 'search salt') {
		const workersCount = Number.parseInt(
			await input({
				message: 'How many threads do you want to use?',
				default: '20',
			})
		);

		const searchedPrefix = await input({
			message: 'Please provide a searched prefix.',
			default: '0x0000',
		});

		searchSalt(workersCount, searchedPrefix);
	}
};

main();
