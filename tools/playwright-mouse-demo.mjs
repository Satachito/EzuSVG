#!/usr/bin/env node
//	Playwright mouse demo — visible drag / draw on the EzuSVG canvas.
//
//	Prerequisites:
//	  cd Web && npm run dev          ( ezu-server on :8973 )
//	  cd tools && npm install
//
//	Run:
//	  node tools/playwright-mouse-demo.mjs
//	  node tools/playwright-mouse-demo.mjs --headless

import { chromium } from 'playwright'

const
PORT	= Number( process.env.EZU_PORT || process.env.PORT ) || 8973
,	URL	= `http://localhost:${ PORT }/`
,	HEADLESS	= process.argv.includes( '--headless' )
,	SLOW_MO		= HEADLESS ? 0 : 80
,	STEP		= 28
,	sleep	= ms => new Promise( r => setTimeout( r, ms ) )
,	log	= msg => console.log( `\n▶ ${ msg }` )
,	center	= box => ( {
	x: box.x + box.width * .5
,	y: box.y + box.height * .5
} )
,	drag	= async ( page, from, to, steps = STEP ) => {
	await page.mouse.move( from.x, from.y, { steps: 12 } )
	await sleep( 120 )
	await page.mouse.down()
	await page.mouse.move( to.x, to.y, { steps } )
	await sleep( 120 )
	await page.mouse.up()
}

const
editorBox	= async page => {
	const
	el = page.locator( '#MAIN_EDITOR' )
	await el.waitFor( { state: 'visible', timeout: 15_000 } )
	const	box = await el.boundingBox()
	if	( !box ) throw new Error( 'svg-editor bounding box not found' )
	return box
}

const
run	= async () => {
	log( `Open ${ URL }` )
	const
	browser = await chromium.launch( { headless: HEADLESS, slowMo: SLOW_MO } )
	,	page = await browser.newPage( { viewport: { width: 1440, height: 900 } } )

	try {
		await page.goto( URL, { waitUntil: 'networkidle' } )
		await page.locator( '#MAIN_EDITOR' ).waitFor( { state: 'attached' } )

		log( '1/5 — New blank document' )
		await page.locator( '#NEW_DOC' ).click()
		await sleep( 400 )

		const
		box = await editorBox( page )
		,	mid = center( box )

		log( '2/5 — Rect tool: drag to draw' )
		await page.locator( '#TOOL_RECT' ).click()
		await sleep( 200 )
		await drag(
			page
		,	{ x: mid.x - 120, y: mid.y - 70 }
		,	{ x: mid.x + 40, y: mid.y + 50 }
		)
		await sleep( 700 )

		log( '3/5 — Ellipse tool: drag to draw' )
		await page.locator( '#TOOL_ELLIPSE' ).click()
		await sleep( 200 )
		await drag(
			page
		,	{ x: mid.x + 80, y: mid.y - 60 }
		,	{ x: mid.x + 200, y: mid.y + 30 }
		)
		await sleep( 700 )

		log( '4/5 — Select tool: drag the rect' )
		await page.locator( '#TOOL_SELECT' ).click()
		await sleep( 200 )
		await drag(
			page
		,	{ x: mid.x - 40, y: mid.y - 10 }
		,	{ x: mid.x + 30, y: mid.y + 60 }
		)
		await sleep( 700 )

		log( '5/5 — Marquee select (empty area drag)' )
		await drag(
			page
		,	{ x: box.x + box.width * .15, y: box.y + box.height * .15 }
		,	{ x: box.x + box.width * .85, y: box.y + box.height * .85 }
		,	STEP + 10
		)
		await sleep( 500 )

		log( 'Done — check the Playwright Chromium window' )
		if	( !HEADLESS ) await sleep( 2500 )
	} finally {
		await browser.close()
	}
}

run().catch( err => {
	console.error( err )
	process.exit( 1 )
} )
