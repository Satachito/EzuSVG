#!/usr/bin/env node
//	EzuSVG dev server: static Web/ + .svg live-reload under Web/ + document RPC bridge.
//
//	Browser ( window.EZU ) ↔ WebSocket ↔ this server ↔ HTTP ↔ ezu-mcp.mjs
//
//	Usage:
//	  node tools/ezu-server.mjs
//	  open http://localhost:8283/?svg=Samples/Icons.svg

import path from 'node:path'
import { createDevServer } from '../Web/SAT/DevServer.mjs'
import { ROOT, WEB, PORT } from './ezu-paths.mjs'

const
HOST	= process.env.EZU_HOST || '127.0.0.1'

createDevServer( {
	name			: 'ezu-server'
,	root			: ROOT
,	web				: WEB
,	port			: PORT
,	host			: HOST
,	apiPrefix		: '/__ezu'
,	watch			: [ {
		dir		: WEB
	,	match	: name => {
			if	( name.includes( `${ path.sep }node_modules${ path.sep }` )
				|| name.startsWith( `node_modules${ path.sep }` ) ) return false
			return	name.endsWith( '.svg' )
		}
	} ]
,	changeType		: 'svg-changed'
,	snapshotTypes	: [ 'editor-ready', 'doc-update' ]
,	applySnapshot	: ( msg, prev ) => ( {
		svg			: msg.svg
	,	selection	: msg.selection ?? []
	,	width		: msg.width
	,	height		: msg.height
	,	elements	: msg.elements
	,	watchPath	: msg.watchPath ?? prev?.watchPath ?? null
	} )
,	logSnapshot		: snap => `${ snap.elements ?? 0 } elements`
,	statusOf		: ( snap, connected ) => ( {
		connected
	,	watchPath	: snap?.watchPath ?? null
	,	width		: snap?.width ?? null
	,	height		: snap?.height ?? null
	,	elements	: snap?.elements ?? 0
	,	selection	: snap?.selection ?? []
	} )
,	documentRoute	: 'svg'
,	getDocument		: 'getSVG'
,	noDocumentError	: 'No editor connected and no cached document.'
,	noEditorError	: 'No browser editor connected. Run npm run dev and open the editor.'
,	noStore			: () => true
,	examplePath		: '?svg=Samples/Icons.svg'
,	portEnvHint		: 'EZU_PORT=8280 node tools/ezu-server.mjs'
} )
