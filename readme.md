# abort-race

> Race multiple async operations with automatic AbortSignal cleanup for losers

## Install

```sh
npm install abort-race
```

## Usage

```js
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
// The response from whichever API responded first.
// The other request was automatically aborted.
```

## API

### abortRace(tasks, options?)

Race multiple async operations. The first task to resolve wins, and all other tasks are automatically aborted via their `AbortSignal`. If a task throws, all others are aborted and the error is re-thrown.

Returns a `Promise` that resolves with the winning task's result.

#### tasks

Type: `Array<(signal: AbortSignal) => Promise<T>>`

An array of functions that each receive an `AbortSignal` and return a `Promise`.

#### options

Type: `object`

##### signal

Type: `AbortSignal`

An external `AbortSignal` for cancelling all tasks. When this signal aborts, all tasks are aborted.

## Related

- [p-race](https://github.com/sindresorhus/p-race) - Race promises
- [signal-compose](https://github.com/mstuart/signal-compose) - Compose multiple AbortSignals

## License

MIT
