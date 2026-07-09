//	Live .svg reload + WebSocket RPC bridge to window.EZU ( tools/ezu-server.mjs ).

import { Load, Parse, Serialize	} from './Application.js'

let
watchPath = null
,	ws = null
,	uiRef = null
,	pushDebounce = null
	//	Serialize() of the document as last loaded from disk (or matched to disk).
,	diskBaseline = null

export const
setWatchPath	= path => {
	watchPath = path
	path && sessionStorage.setItem( 'ezu-watch', path )
}

const
markDiskBaseline	= () => {
	diskBaseline = Serialize()
}

const
normalizedSvgText	= text => new XMLSerializer().serializeToString( Parse( text ) )

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

const
fetchSvgText	= async path => {
	const
	res = await fetch( new URL( path, import.meta.url ), { cache: 'no-store' } )
	if	( !res.ok ) throw new Error( `${ res.status } ${ path }` )
	return	res.text()
}

const
applyLoadedFile	= ( path, text, { SyncDocInputs, FILE_NAME } = {} ) => {
	Load( text )
	setWatchPath( path )
	markDiskBaseline()
	FILE_NAME && ( FILE_NAME.value = path.replace( /^.*\//, '' ).replace( /\.svg$/i, '' ) )
	SyncDocInputs?.()
	pushSnapshot()
}

//	Explicit load (sample button, ?svg=, MCP loadSVG) — always replaces the canvas.
export const
loadSVGFile	= async ( path, ui = {} ) => {
	applyLoadedFile( path, await fetchSvgText( path ), ui )
}

//	Disk watch: reload only when safe, or after the user confirms discarding edits.
const
reloadWatchedFile	= async path => {
	const
	text = await fetchSvgText( path )
	,	diskNow = normalizedSvgText( text )
	,	mem = Serialize()

	//	Already matches disk (e.g. just saved via ezu_save_file) — refresh baseline only.
	if	( mem === diskNow ) {
		setWatchPath( path )
		markDiskBaseline()
		return
	}

	//	Unsaved in-memory edits vs last disk load — ask before discarding.
	if	( diskBaseline != null && mem !== diskBaseline ) {
		if	( !confirm(
			`${ path } changed on disk.\n\nReload and discard unsaved edits?`
		) ) return
	}

	applyLoadedFile( path, text, uiRef ?? {} )
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
					await reloadWatchedFile( watchPath )
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
