/**
 * Internal dependencies
 */
import createPreloadingMiddleware, { getStablePath } from '../preloading';

describe( 'Preloading Middleware', () => {
	describe( 'getStablePath', () => {
		it( 'returns same value if no query parameters', () => {
			const path = '/foo/bar';

			expect( getStablePath( path ) ).toBe( path );
		} );

		it( 'returns a stable path', () => {
			const abc = getStablePath( '/foo/bar?a=5&b=1&c=2' );
			const bca = getStablePath( '/foo/bar?b=1&c=2&a=5' );
			const bac = getStablePath( '/foo/bar?b=1&a=5&c=2' );
			const acb = getStablePath( '/foo/bar?a=5&c=2&b=1' );
			const cba = getStablePath( '/foo/bar?c=2&b=1&a=5' );
			const cab = getStablePath( '/foo/bar?c=2&a=5&b=1' );

			expect( abc ).toBe( bca );
			expect( bca ).toBe( bac );
			expect( bac ).toBe( acb );
			expect( acb ).toBe( cba );
			expect( cba ).toBe( cab );
		} );
	} );

	describe( 'given preloaded data', () => {
		describe( 'when data is requested from a preloaded endpoint', () => {
			describe( 'and it is requested for the first time', () => {
				it( 'should return the preloaded data', () => {
					const body = {
						status: 'this is the preloaded response',
					};
					const preloadedData = {
						'wp/v2/posts': {
							body,
						},
					};
					const preloadingMiddleware = createPreloadingMiddleware(
						preloadedData
					);
					const requestOptions = {
						method: 'GET',
						path: 'wp/v2/posts',
					};

					const response = preloadingMiddleware( requestOptions );
					return response.then( ( value ) => {
						expect( value ).toEqual( body );
					} );
				} );
			} );

			describe( 'and it has already been requested', () => {
				it( 'should not return the preloaded data', () => {
					const body = {
						status: 'this is the preloaded response',
					};
					const preloadedData = {
						'wp/v2/posts': {
							body,
						},
					};
					const preloadingMiddleware = createPreloadingMiddleware(
						preloadedData
					);
					const requestOptions = {
						method: 'GET',
						path: 'wp/v2/posts',
					};
					const nextSpy = jest.fn();

					preloadingMiddleware( requestOptions, nextSpy );
					expect( nextSpy ).not.toHaveBeenCalled();
					preloadingMiddleware( requestOptions, nextSpy );
					expect( nextSpy ).toHaveBeenCalled();
				} );
			} );

			describe( 'and the OPTIONS request has a parse flag', () => {
				it( 'should return the full response if parse: false', () => {
					const data = {
						body: {
							status: 'this is the preloaded response',
						},
						headers: {
							Allow: 'GET, POST',
						},
					};

					const preloadedData = {
						OPTIONS: {
							'wp/v2/posts': data,
						},
					};

					const preloadingMiddleware = createPreloadingMiddleware(
						preloadedData
					);

					const requestOptions = {
						method: 'OPTIONS',
						path: 'wp/v2/posts',
						parse: false,
					};

					const response = preloadingMiddleware( requestOptions );
					return response.then( ( value ) => {
						expect( value ).toEqual( data );
					} );
				} );

				it( 'should return only the response body if parse: true', () => {
					const body = {
						status: 'this is the preloaded response',
					};

					const preloadedData = {
						OPTIONS: {
							'wp/v2/posts': {
								body,
								headers: {
									Allow: 'GET, POST',
								},
							},
						},
					};

					const preloadingMiddleware = createPreloadingMiddleware(
						preloadedData
					);

					const requestOptions = {
						method: 'OPTIONS',
						path: 'wp/v2/posts',
						parse: true,
					};

					const response = preloadingMiddleware( requestOptions );
					return response.then( ( value ) => {
						expect( value ).toEqual( body );
					} );
				} );
			} );
		} );

		describe( 'when the requested data is not from a preloaded endpoint', () => {
			it( 'should not return preloaded data', () => {
				const body = {
					status: 'this is the preloaded response',
				};
				const preloadedData = {
					'wp/v2/posts': {
						body,
					},
				};
				const preloadingMiddleware = createPreloadingMiddleware(
					preloadedData
				);
				const requestOptions = {
					method: 'GET',
					path: 'wp/v2/fake_resource',
				};
				const nextSpy = jest.fn();

				preloadingMiddleware( requestOptions, nextSpy );
				expect( nextSpy ).toHaveBeenCalled();
			} );
		} );
	} );

	it( 'should normalize on stable path', async () => {
		const body = { content: 'example' };
		const preloadedData = {
			'wp/v2/demo-reverse-alphabetical?foo=bar&baz=quux': { body },
			'wp/v2/demo-alphabetical?baz=quux&foo=bar': { body },
		};
		const preloadingMiddleware = createPreloadingMiddleware(
			preloadedData
		);

		let requestOptions = {
			method: 'GET',
			path: 'wp/v2/demo-reverse-alphabetical?baz=quux&foo=bar',
		};

		let value = await preloadingMiddleware( requestOptions, () => {} );
		expect( value ).toEqual( body );

		requestOptions = {
			method: 'GET',
			path: 'wp/v2/demo-alphabetical?foo=bar&baz=quux',
		};

		value = await preloadingMiddleware( requestOptions, () => {} );
		expect( value ).toEqual( body );
	} );

	it( 'should remove OPTIONS type requests from the cache after the first hit', async () => {
		const body = { content: 'example' };
		const preloadedData = {
			OPTIONS: {
				'wp/v2/demo': { body },
			},
		};

		const preloadingMiddleware = createPreloadingMiddleware(
			preloadedData
		);

		const requestOptions = {
			method: 'OPTIONS',
			path: 'wp/v2/demo',
		};

		const firstMiddleware = jest.fn();
		preloadingMiddleware( requestOptions, firstMiddleware );
		expect( firstMiddleware ).not.toHaveBeenCalled();

		await preloadingMiddleware( requestOptions, firstMiddleware );

		const secondMiddleware = jest.fn();
		await preloadingMiddleware( requestOptions, secondMiddleware );
		expect( secondMiddleware ).toHaveBeenCalledTimes( 1 );
	} );

	describe.each( [ [ 'GET' ], [ 'OPTIONS' ] ] )( '%s', ( method ) => {
		describe.each( [
			[ 'all empty', {} ],
			[ 'method empty', { [ method ]: {} } ],
		] )( '%s', ( label, preloadedData ) => {
			it( 'should move to the next middleware if no preloaded data', () => {
				const preloadingMiddleware = createPreloadingMiddleware(
					preloadedData
				);
				const requestOptions = {
					method,
					path: 'wp/v2/posts',
				};

				const callback = ( options ) => {
					expect( options ).toBe( requestOptions );
					return true;
				};

				const ret = preloadingMiddleware( requestOptions, callback );
				expect( ret ).toBe( true );
			} );
		} );
	} );
} );
