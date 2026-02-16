/**
Race multiple async operations with automatic AbortSignal cleanup for losers.

@template T
@param {Array<(signal: AbortSignal) => Promise<T>>} tasks - Functions that receive an AbortSignal and return a Promise.
@param {object} [options]
@param {AbortSignal} [options.signal] - An external AbortSignal for cancelling all tasks.
@returns {Promise<T>} The result of the winning task.
*/
export default async function abortRace(tasks, options = {}) {
	const {signal: parentSignal} = options;

	if (parentSignal?.aborted) {
		throw parentSignal.reason ?? new Error('Aborted');
	}

	const controllers = tasks.map(() => new AbortController());
	let winnerIndex = -1;

	const abortLosers = index => {
		if (winnerIndex !== -1) {
			return;
		}

		winnerIndex = index;

		for (const [i, controller] of controllers.entries()) {
			if (i !== index) {
				controller.abort(new Error('Race lost'));
			}
		}
	};

	const abortAll = reason => {
		for (const controller of controllers) {
			controller.abort(reason);
		}
	};

	const onParentAbort = () => {
		abortAll(parentSignal?.reason ?? new Error('Aborted'));
	};

	if (parentSignal) {
		parentSignal.addEventListener('abort', onParentAbort, {once: true});
	}

	try {
		const promises = tasks.map(async (task, index) => {
			const linkedSignal = parentSignal
				? AbortSignal.any([controllers[index].signal, parentSignal]) // eslint-disable-line n/no-unsupported-features/node-builtins
				: controllers[index].signal;

			const result = await task(linkedSignal);
			abortLosers(index);
			return result;
		});

		return await Promise.race(promises);
	} catch (error) {
		abortAll(error);
		throw error;
	} finally {
		if (parentSignal) {
			parentSignal.removeEventListener('abort', onParentAbort);
		}
	}
}
