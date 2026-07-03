#!/usr/bin/env node
//	EzuSVG MCP server — natural-language agents control the live SVG via ezu-server.
//
//	Prerequisites:
//	  npm run dev                    ( ezu-server on :8973 )
//	  open http://localhost:8973/?svg=Samples/Icons.svg
//
//	Claude Code / Cursor MCP config ( .mcp.json ):
//	  { "mcpServers": { "ezusvg": { "command": "node", "args": ["tools/ezu-mcp.mjs"] } } }

import { McpServer	} from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport	} from '@modelcontextprotocol/sdk/server/stdio.js'
import { writeFile	} from 'node:fs/promises'
import { z	} from 'zod'
import { ezuStatus, ezuGetSVG, ezuRpc	} from './ezu-client.mjs'
import { webPath, isUnderWeb	} from './ezu-paths.mjs'

const
server = new McpServer( {
	name	: 'ezusvg'
,	version	: '1.0.0'
} )

const
textResult	= obj => ( {
	content	: [ { type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify( obj, null, '\t' ) } ]
} )

const
resolveSvgPath	= rel => {
	const
	clean = rel.replace( /^\/+/, '' )
	,	abs = webPath( clean )
	if	( !isUnderWeb( abs ) ) throw new Error( `Path must be under Web/: ${ rel }` )
	if	( !clean.endsWith( '.svg' ) ) throw new Error( 'Path must end with .svg' )
	return	{ rel: clean, abs }
}

server.tool(
	'ezu_status'
,	'Check whether a browser editor is connected to ezu-server, and the document size / element count / selection.'
,	{}
,	async () => textResult( await ezuStatus() )
)

server.tool(
	'ezu_get_svg'
,	'Read the live SVG document from the open browser ( markup + selection + size ). Falls back to the last cached snapshot.'
,	{}
,	async () => textResult( await ezuGetSVG() )
)

server.tool(
	'ezu_get_selection'
,	'List the CSS selectors of the elements currently selected in the browser editor.'
,	{}
,	async () => {
		const	{ result } = await ezuRpc( 'getSelection', {} )
		return	textResult( { selection: result } )
	}
)

server.tool(
	'ezu_select'
,	'Select elements in the browser editor by CSS selector ( highlights them and syncs the panels ).'
,	{
		select	: z.string()
	}
,	async ( { select } ) => {
		const	{ result } = await ezuRpc( 'select', { select } )
		return	textResult( { selection: result } )
	}
)

server.tool(
	'ezu_apply'
,	`Apply one or more ops to the live SVG document ( same ops as window.EZU.apply; one call = one undo step ).
Elements are addressed by CSS selector ( "select" ).
Ops:
  { "op":"add",       "svg":"<circle .../>", "parent"?, "before"? }
  { "op":"update",    "select":"#sun", "attrs"?: { "fill":"red", "stroke":null }, "text"? }
  { "op":"remove",    "select" }
  { "op":"restack",   "select", "toFront"? }
  { "op":"setCanvas", "width", "height", "viewBox"? }
  { "op":"setDoc",    "svg" }`
,	{
		ops	: z.array( z.record( z.any() ) )
	}
,	async ( { ops } ) => {
		const	{ result: issues } = await ezuRpc( 'apply', { ops } )
		const	snap = await ezuGetSVG()
		return	textResult( { applied: ops.length, issues, ...snap } )
	}
)

server.tool(
	'ezu_load_file'
,	'Load an .svg file into the browser editor and watch it for live reload. Path is relative to Web/ ( e.g. Samples/Icons.svg ).'
,	{
		path	: z.string()
	}
,	async ( { path: rel } ) => {
		resolveSvgPath( rel )
		const	{ result } = await ezuRpc( 'loadSVG', { path: rel.replace( /^\/+/, '' ) } )
		return	textResult( result )
	}
)

server.tool(
	'ezu_save_file'
,	'Save the live SVG document to an .svg file under Web/.'
,	{
		path	: z.string()
	}
,	async ( { path: rel } ) => {
		const	{ rel: clean, abs } = resolveSvgPath( rel )
		,	snap = await ezuGetSVG()
		if	( !snap.svg ) throw new Error( 'No document to save.' )
		await writeFile( abs, `<?xml version="1.0" encoding="UTF-8"?>\n${ snap.svg }\n`, 'utf8' )
		return	textResult( { saved: true, path: clean, elements: snap.elements } )
	}
)

const
transport = new StdioServerTransport()
await server.connect( transport )
