//	Shared HTTP client for ezu-server RPC ( used by ezu-mcp.mjs ).

import { EZU_BASE } from './ezu-paths.mjs'

export const
ezuFetch	= async ( path, init ) => {
	const
	res = await fetch( `${ EZU_BASE }${ path }`, init )
	if	( !res.ok ) {
		const	text = await res.text().catch( () => '' )
		throw new Error( text || `${ res.status } ${ path }` )
	}
	return	res.headers.get( 'content-type' )?.includes( 'json' )
		? res.json()
		: res.text()
}

export const
ezuStatus	= () => ezuFetch( '/__ezu/status' )

export const
ezuGetSVG	= () => ezuFetch( '/__ezu/svg' )

export const
ezuRpc	= ( method, params = {}, timeout ) => ezuFetch( '/__ezu/rpc', {
	method	: 'POST'
,	headers	: { 'Content-Type': 'application/json' }
,	body	: JSON.stringify( { method, params, timeout } )
} )
