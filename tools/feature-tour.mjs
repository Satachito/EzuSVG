#!/usr/bin/env node
//	Live feature tour — steps through EzuSVG capabilities in the open browser tab.
//
//	Prerequisites:
//	  cd Web && npm run dev
//	  open http://localhost:8283
//
//	Run:
//	  node tools/feature-tour.mjs

import { ezuStatus, ezuRpc } from './ezu-client.mjs'

const
sleep	= ms => new Promise( r => setTimeout( r, ms ) )
,	log	= msg => console.log( `\n▶ ${ msg }` )
,	apply	= ( ops, timeout = 30_000 ) => ezuRpc( 'apply', { ops }, timeout )
,	select	= sel => ezuRpc( 'select', { select: sel } )

const
run	= async () => {
	const	st = await ezuStatus()
	if	( !st.connected ) {
		console.error( 'No browser editor connected. Run `cd Web && npm run dev`, then open http://localhost:8283' )
		process.exit( 1 )
	}

	log( '1/12 — Load blank canvas' )
	await ezuRpc( 'loadSVG', { path: 'Samples/FeatureTour.svg' }, 30_000 )
	await sleep( 800 )

	log( '2/12 — Place title' )
	await apply( [
		{ op: 'add', svg: `<text id="title" x="420" y="56" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle" fill="#0f172a">EzuSVG</text>
<text id="subtitle" x="420" y="86" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#64748b">Feature Tour — live editing from your agent</text>` }
	] )
	await sleep( 1200 )

	log( '3/12 — Add shapes ( rect / circle / ellipse )' )
	await apply( [
		{ op: 'add', svg: `<g id="card-shapes">
  <rect x="48" y="120" width="220" height="150" rx="14" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>
  <text x="158" y="152" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle" fill="#1e3a8a">Shapes</text>
  <rect id="demo-rect" x="78" y="172" width="56" height="40" rx="6" fill="#60a5fa"/>
  <circle id="demo-circle" cx="158" cy="192" r="22" fill="#34d399"/>
  <ellipse id="demo-ellipse" cx="228" cy="192" rx="34" ry="22" fill="#fbbf24"/>
</g>` }
	] )
	await sleep( 1400 )

	log( '4/12 — Add path and text' )
	await apply( [
		{ op: 'add', svg: `<g id="card-path">
  <rect x="310" y="120" width="220" height="150" rx="14" fill="#fef9c3" stroke="#ca8a04" stroke-width="2"/>
  <text x="420" y="152" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle" fill="#713f12">Paths &amp; Text</text>
  <path id="demo-path" d="M340 210 C 380 150, 460 250, 500 180" fill="none" stroke="#a16207" stroke-width="4" stroke-linecap="round"/>
  <text id="demo-text" x="420" y="238" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#854d0e">Vector editing</text>
</g>` }
	] )
	await sleep( 1400 )

	log( '5/12 — Add MCP integration card' )
	await apply( [
		{ op: 'add', svg: `<g id="card-mcp">
  <rect x="572" y="120" width="220" height="150" rx="14" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>
  <text x="682" y="152" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle" fill="#4c1d95">MCP Bridge</text>
  <rect id="mcp-badge" x="612" y="172" width="140" height="52" rx="10" fill="#8b5cf6"/>
  <text id="mcp-label" x="682" y="204" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#ffffff">ezu_apply</text>
</g>` }
	] )
	await sleep( 1400 )

	log( '6/12 — Select element ( #demo-rect )' )
	await select( '#demo-rect' )
	await sleep( 1600 )

	log( '7/12 — Change fill on selection' )
	await apply( [
		{ op: 'update', select: '#demo-rect', attrs: { fill: '#ef4444', stroke: '#991b1b', 'stroke-width': '3' } }
	] )
	await sleep( 1400 )

	log( '8/12 — Select circle and resize' )
	await select( '#demo-circle' )
	await apply( [
		{ op: 'update', select: '#demo-circle', attrs: { r: '30', fill: '#10b981' } }
	] )
	await sleep( 1400 )

	log( '9/12 — Update text' )
	await select( '#demo-text' )
	await apply( [
		{ op: 'update', select: '#demo-text', text: 'Text edit ✓' }
	,	{ op: 'update', select: '#demo-text', attrs: { fill: '#15803d', 'font-weight': 'bold' } }
	] )
	await sleep( 1400 )

	log( '10/12 — Add footer' )
	await apply( [
		{ op: 'add', svg: `<g id="footer">
  <line x1="120" y1="330" x2="720" y2="330" stroke="#cbd5e1" stroke-width="2"/>
  <text x="420" y="368" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#334155">The browser SVG updates live — no reload</text>
  <text x="420" y="396" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#64748b">ezu_status · ezu_get_svg · ezu_select · ezu_apply · ezu_load_file · ezu_save_file</text>
</g>` }
	] )
	await sleep( 1400 )

	log( '11/12 — Highlight MCP badge' )
	await select( '#mcp-badge' )
	await apply( [
		{ op: 'update', select: '#mcp-badge', attrs: { fill: '#4f46e5' } }
	,	{ op: 'update', select: '#mcp-label', text: 'Controlled from Cursor' }
	] )
	await sleep( 1400 )

	log( '12/12 — Add accent dots and finish' )
	await apply( [
		{ op: 'add', svg: `<g id="dots">
  <circle id="dot-0" cx="180" cy="450" r="10" fill="#f43f5e"/>
  <circle id="dot-1" cx="300" cy="450" r="10" fill="#3b82f6"/>
  <circle id="dot-2" cx="420" cy="450" r="10" fill="#22c55e"/>
  <circle id="dot-3" cx="540" cy="450" r="10" fill="#eab308"/>
  <circle id="dot-4" cx="660" cy="450" r="10" fill="#a855f7"/>
</g>` }
	] )
	await select( '#mcp-badge' )

	log( 'Done — check your EzuSVG tab(s)' )
}

run().catch( err => {
	console.error( err )
	process.exit( 1 )
} )
