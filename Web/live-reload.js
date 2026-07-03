//	Live .svg reload + WebSocket RPC bridge to window.EZU ( tools/ezu-server.mjs ).

import { Load	} from './Application.js'

let
watchPath = null
,	ws = null
,	uiRef = null
,	pushDebounce = null

export const
setWatchPath	= path => {
	watchPath = path
	path && sessionStorage.setItem( 'ezu-watch', path )
}

const
snapshot	= () => {
	const
	svg = MAIN_EDITOR.SVG()
	let	width = null, height = null
	try { [ width, height ] = MAIN_EDITOR.DocSize() } catch {}
	return	{
		svg			: window.EZU.getSVG()
	,	selection	: window.EZU.getSelection()
	,	width
	,	height
	,	elements	: svg ? svg.querySelectorAll( '*' ).length : 0
	,	watchPath
	}
}

const
pushSnapshot	= () => {
	if	( !ws || ws.readyState !== WebSocket.OPEN ) return
	ws.send( JSON.stringify( { type: 'doc-update', ...snapshot() } ) )
}

const
MUTATING	= new Set( [ 'apply', 'loadSVG', 'select' ] )

const
runRpc	= async ( method, params ) => {
	switch ( method ) {
	case 'getSVG':
		return	snapshot()
	case 'getSelection':
		return	window.EZU.getSelection()
	case 'apply':
		return	window.EZU.apply( params.ops )
	case 'select': {
		const
		svg = MAIN_EDITOR.SVG()
		MAIN_EDITOR.Select( params.select === 'svg' ? [] : [ ...svg.querySelectorAll( params.select ) ] )
		return	window.EZU.getSelection()
	}
	case 'loadSVG':
		await loadSVGFile( params.path, uiRef ?? {} )
		return	snapshot()
	default:
		throw new Error( `unknown RPC method "${ method }"` )
	}
}

const
handleRpc	= async msg => {
	const	{ id, method, params = {} } = msg
	try {
		const
		result = await runRpc( method, params )
		ws.send( JSON.stringify( { type: 'rpc-result', id, result } ) )
		if	( MUTATING.has( method ) ) pushSnapshot()
	} catch ( er ) {
		ws.send( JSON.stringify( { type: 'rpc-error', id, error: String( er.message || er ) } ) )
	}
}

export const
loadSVGFile	= async ( path, { SyncDocInputs, FILE_NAME } = {} ) => {
	const
	res = await fetch( new URL( path, import.meta.url ), { cache: 'no-store' } )
	if	( !res.ok ) throw new Error( `${ res.status } ${ path }` )
	Load( await res.text() )
	setWatchPath( path )
	FILE_NAME && ( FILE_NAME.value = path.replace( /^.*\//, '' ).replace( /\.svg$/i, '' ) )
	SyncDocInputs?.()
	pushSnapshot()
}

const
connectBridge	= () => {
	if	( location.protocol !== 'http:' && location.protocol !== 'https:' ) return

	const
	proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
	,	url = `${ proto }//${ location.host }/__ezu/ws`
	,	connect = () => {
		ws = new WebSocket( url )
		ws.onopen = () => {
			ws._everOpen = true
			ws.send( JSON.stringify( { type: 'editor-ready', ...snapshot() } ) )
		}
		ws.onmessage = async ev => {
			let	msg
			try { msg = JSON.parse( ev.data ) } catch { return }
			if	( msg.type === 'svg-changed' ) {
				if	( !watchPath || msg.path !== watchPath ) return
				try {
					await loadSVGFile( watchPath, uiRef ?? {} )
				} catch ( er ) {
					console.error( '[live-reload]', er )
				}
				return
			}
			if	( msg.type === 'rpc' ) void handleRpc( msg )
		}
		ws.onclose = ev => { if ( ev.target._everOpen ) setTimeout( connect, 1500 ) }
	}
	connect()

	//	keep the server's cached snapshot fresh across in-editor edits
	window.addEventListener(
		'doc-changed'
	,	() => {
			clearTimeout( pushDebounce )
			pushDebounce = setTimeout( pushSnapshot, 300 )
		}
	)
}

export const
initLiveReload	= async ( ui, { Report } = {} ) => {
	uiRef = ui
	const
	fromUrl = new URLSearchParams( location.search ).get( 'svg' )
	,	fromStore = sessionStorage.getItem( 'ezu-watch' )
	,	path = fromUrl || fromStore

	setWatchPath( path )
	connectBridge()

	if	( fromUrl ) {
		try {
			await loadSVGFile( fromUrl, ui )
		} catch ( er ) {
			Report ? Report( er ) : console.error( er )
		}
	}
}
