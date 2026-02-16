import {expectType, expectError} from 'tsd';
import abortRace from './index.js';

// Valid usage with typed tasks
expectType<Promise<string>>(
	abortRace([
		async _signal => 'hello',
		async _signal => 'world',
	]),
);

// Valid usage with options
expectType<Promise<number>>(
	abortRace(
		[async _signal => 42],
		{signal: new AbortController().signal},
	),
);

// Signal parameter is AbortSignal
void abortRace([
	async signal => {
		expectType<AbortSignal>(signal);
		return 'ok';
	},
]);

// Invalid usage: not an array of functions
expectError(abortRace('not an array'));
expectError(abortRace([123]));

// Invalid usage: tasks don't return promises
expectError(abortRace([(signal: AbortSignal) => 'sync']));
