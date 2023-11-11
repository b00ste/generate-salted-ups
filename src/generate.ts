import {
	AbiCoder,
	BytesLike,
	concat,
	getCreate2Address,
	hexlify,
	keccak256,
	randomBytes,
	toBeHex,
	toUtf8Bytes,
} from 'ethers';
import fs from 'fs';
import { parentPort, workerData } from 'worker_threads';
import { ILSP23LinkedContractsFactory } from '../types/LSP23LinkedContractsFactory';
import {
	ALL_PERMISSIONS,
	ERC725YDataKeys,
	SupportedStandards,
} from '@lukso/lsp-smart-contracts';
import {
	URD_PERMISSIONS,
	keyManagerInitAddress,
	lsp23Address,
	saltedUniversalProfileFactoryAddress,
	universalProfileInitAddress,
	universalReceiverDelegateUpAddress,
	upPostDeploymentModuleAddress,
} from './constants';

const writeNextLine = (filePath: string, text: string) => {
	const lineId = fs.openSync(filePath, 'a', 666);
	fs.writeSync(lineId, text, null, 'utf8');
	fs.closeSync(lineId);
};

const calculateProxiesAddresses = (
	salt: BytesLike,
	primaryImplementationContractAddress: string,
	secondaryImplementationContractAddress: string,
	secondaryContractInitializationCalldata: BytesLike,
	secondaryContractAddControlledContractAddress: boolean,
	secondaryContractExtraInitializationParams: BytesLike,
	postDeploymentCalldata: BytesLike
) => {
	const generatedSalt = keccak256(
		new AbiCoder().encode(
			[
				'bytes32',
				'address',
				'bytes',
				'bool',
				'bytes',
				'address',
				'bytes',
			],
			[
				salt,
				secondaryImplementationContractAddress,
				secondaryContractInitializationCalldata,
				secondaryContractAddControlledContractAddress,
				secondaryContractExtraInitializationParams,
				upPostDeploymentModuleAddress,
				postDeploymentCalldata,
			]
		)
	);

	const expectedPrimaryContractAddress = getCreate2Address(
		lsp23Address,
		generatedSalt,
		keccak256(
			'0x3d602d80600a3d3981f3363d3d373d3d3d363d73' +
				(primaryImplementationContractAddress as string).slice(2) +
				'5af43d82803e903d91602b57fd5bf3'
		)
	);

	const expectedSecondaryContractAddress = getCreate2Address(
		lsp23Address,
		keccak256(expectedPrimaryContractAddress),
		keccak256(
			'0x3d602d80600a3d3981f3363d3d373d3d3d363d73' +
				(secondaryImplementationContractAddress as string).slice(2) +
				'5af43d82803e903d91602b57fd5bf3'
		)
	);

	return [expectedPrimaryContractAddress, expectedSecondaryContractAddress];
};

const getSaltAndAddress = () => {
	/// ------ Generate Random Salt for Universal Profile deployment (we can also use custom salt) ------
	const salt = hexlify(randomBytes(32));
	/// -------------------------------------------------------------------------------------------------

	/// ------ Data for Key Manager deployment ------
	const secondaryContractDeploymentInit: ILSP23LinkedContractsFactory.SecondaryContractDeploymentInitStruct =
		{
			fundingAmount: 0,
			implementationContract: keyManagerInitAddress,
			addPrimaryContractAddress: true,
			initializationCalldata: keccak256(
				toUtf8Bytes('initialize(address)')
			).substring(0, 10),
			extraInitializationParams: '0x',
		};
	/// ---------------------------------------------------

	/// ------ Encode Data Keys & Values for updating permissions & LSP3Metadata ------
	const postDeploymentModuleCalldata = new AbiCoder().encode(
		['bytes32[]', 'bytes[]'],
		[
			[
				// ------ LSP1 ------
				ERC725YDataKeys.LSP1.LSP1UniversalReceiverDelegate,
				// ------------------

				// ------ LSP3 ------
				SupportedStandards.LSP3Profile.key,
				// ------------------

				// ------ LSP6 ------
				ERC725YDataKeys.LSP6['AddressPermissions[]'].length,
				concat([
					ERC725YDataKeys.LSP6['AddressPermissions[]'].index,
					toBeHex(0, 16),
				]),
				concat([
					ERC725YDataKeys.LSP6['AddressPermissions:Permissions'],
					saltedUniversalProfileFactoryAddress,
				]),
				concat([
					ERC725YDataKeys.LSP6['AddressPermissions[]'].index,
					toBeHex(1, 16),
				]),
				concat([
					ERC725YDataKeys.LSP6['AddressPermissions:Permissions'],
					universalReceiverDelegateUpAddress,
				]),
				// ------------------
			],
			[
				// ------ LSP1 ------
				universalReceiverDelegateUpAddress,
				// ------------------

				// ------ LSP3 ------
				SupportedStandards.LSP3Profile.value,
				// ------------------

				// ------ LSP6 ------
				toBeHex(2, 16),
				saltedUniversalProfileFactoryAddress,
				ALL_PERMISSIONS,
				universalReceiverDelegateUpAddress,
				URD_PERMISSIONS,
				// ------------------
			],
		]
	);
	/// -------------------------------------------------------------------------------

	/// ------ Pre-calculate the addresses for the Universal Profile & Key Manager ------
	const [universalProfileAddress] = calculateProxiesAddresses(
		salt,
		universalProfileInitAddress,
		keyManagerInitAddress,
		secondaryContractDeploymentInit.initializationCalldata,
		secondaryContractDeploymentInit.addPrimaryContractAddress,
		secondaryContractDeploymentInit.extraInitializationParams,
		postDeploymentModuleCalldata
	);
	/// ---------------------------------------------------------------------------------

	return {
		salt,
		address: universalProfileAddress,
	};
};

const generate = () => {
	if (!workerData || !parentPort) {
		return;
	}

	const { timestamp, requestsPerWorker } = workerData;
	const fileName = `./salts/salts_${timestamp}.csv`;

	if (!fs.existsSync(fileName)) {
		fs.writeFileSync(fileName, 'salt,address\n');
	}

	for (let index = 0; index < Number(requestsPerWorker); index++) {
		const { salt, address } = getSaltAndAddress();
		writeNextLine(fileName, `${salt},${address}\n`);
		if (index % 1000 === 0) {
			parentPort.postMessage(index);
		}
	}
};

generate();
