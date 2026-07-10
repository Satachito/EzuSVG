import { test, beforeEach }	from 'node:test'
import assert				from 'node:assert/strict'
import { parseHTML }		from 'linkedom'

const
{ window: linkedomWindow, document } = parseHTML( '<!doctype html><html><body><div id=wrap></div></body></html>' )

globalThis.document		= document
globalThis.DOMParser		= linkedomWindow.DOMParser
globalThis.CSS			= { escape: id => id.replace( /([^\w-])/g, '\\$1' ) }
globalThis.XMLSerializer	= class {
	serializeToString( node ) {
		return	node.outerHTML ?? node.documentElement?.outerHTML ?? ''
	}
}
//	Proxy: linkedom's dispatchEvent throws; Application.Changed only needs a no-op.
globalThis.window		= new Proxy(
	linkedomWindow
,	{
		get	: ( t, p ) => p === 'dispatchEvent' ? () => true : t[ p ]
	,	set	: ( t, p, v ) => ( p === 'dispatchEvent' ? true : ( t[ p ] = v, true ) )
	}
)

const
store = new Map
globalThis.localStorage	= {
	getItem		: k => ( store.has( k ) ? store.get( k ) : null )
,	setItem		: ( k, v ) => store.set( k, String( v ) )
,	removeItem	: k => store.delete( k )
}

//	Minimal svg-editor stand-in used by Application.js
const
wrap = document.getElementById( 'wrap' )
let	svg = null
,	selected = []

globalThis.MAIN_EDITOR	= {
	SVG				: () => svg
,	Selected		: () => selected
,	Select			: els => { selected = els }
,	Draw			: () => {}
,	SetSVG			: next => {
		svg?.remove()
		svg = next
		wrap.append( svg )
		selected = []
	}
,	DispatchSelection: () => {}
}

const {
	Parse
,	Serialize
,	Mutate
,	Commit
,	CaptureSelection
,	RestoreSelection
,	BLANK
}	= await import( '../Application.js' )

import { Undo, ClearJobs, dones }	from '../Jobs.js'

beforeEach( () => {
	ClearJobs()
	store.clear()
	MAIN_EDITOR.SetSVG( Parse( BLANK( 100, 100 ) ) )
} )

test( 'Mutate is one undo step and restores selection on undo', async () => {
	const
	root = MAIN_EDITOR.SVG()
	const
	r = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' )
	r.id = 'box'
	r.setAttribute( 'width', '10' )
	r.setAttribute( 'height', '10' )
	Mutate(
		'Add'
	,	() => {
			root.append( r )
			MAIN_EDITOR.Select( [ r ] )
		}
	)
	assert.equal( CaptureSelection()[ 0 ], '#box' )
	assert.equal( dones.length, 1 )

	await Undo()
	assert.equal( MAIN_EDITOR.SVG().querySelector( '#box' ), null )
	assert.deepEqual( MAIN_EDITOR.Selected(), [] )
} )

test( 'failed Mutate rolls back SVG and selection with no undo entry', () => {
	const
	root = MAIN_EDITOR.SVG()
	const
	r = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' )
	r.id = 'keep'
	root.append( r )
	MAIN_EDITOR.Select( [ r ] )

	assert.throws(
		() => Mutate(
			'AI'
		,	() => {
				r.setAttribute( 'fill', 'red' )
				throw new Error( 'boom' )
			}
		)
	,	/boom/
	)
	assert.equal( MAIN_EDITOR.SVG().querySelector( '#keep' )?.getAttribute( 'fill' ), null )
	assert.equal( MAIN_EDITOR.Selected()[ 0 ]?.id, 'keep' )
	assert.equal( dones.length, 0 )
} )

test( 'Commit undo restores prior selection selectors', async () => {
	const
	root = MAIN_EDITOR.SVG()
	const
	a = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' )
	a.id = 'a'
	root.append( a )
	MAIN_EDITOR.Select( [ a ] )
	const
	before = Serialize()
	,	beforeSel = CaptureSelection()

	a.setAttribute( 'fill', 'navy' )
	Commit( 'Paint', before, beforeSel )
	assert.equal( dones.length, 1 )

	MAIN_EDITOR.Select( [] )
	await Undo()
	assert.equal( MAIN_EDITOR.Selected()[ 0 ]?.id, 'a' )
	RestoreSelection( [] )
	assert.deepEqual( MAIN_EDITOR.Selected(), [] )
} )
