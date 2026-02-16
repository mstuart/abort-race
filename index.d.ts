export type AbortRaceOptions = {
	/**
	An external `AbortSignal` for cancelling all tasks.
	*/
	signal?: AbortSignal;
};

/**
Race multiple async operations with automatic `AbortSignal` cleanup for losers.

When one task resolves, all other tasks' signals are aborted. If a task throws, all others are aborted and the error is re-thrown.

@param tasks - Functions that receive an `AbortSignal` and return a `Promise`.
@param options - Options for the race.
@returns The result of the winning task.

@example
```
import abortRace from 'abort-race';

const result = await abortRace([
	async signal => {
		const response = await fetch('https://api1.example.com', {signal});
		return response.json();
	},
	async signal => {
		const response = await fetch('https://api2.example.com', {signal});
		return response.json();
	},
]);

console.log(result);
```
*/
export default function abortRace<T>(
	tasks: ReadonlyArray<(signal: AbortSignal) => Promise<T>>,
	options?: AbortRaceOptions,
): Promise<T>;
