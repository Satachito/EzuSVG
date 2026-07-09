export	const
Report = _ => ( console.error( _ ), alert( _ ) )

export	const
STORAGE_KEY	= 'tokyo.828.ezusvg'

export	const
SVG_NS	= 'http://www.w3.org/2000/svg'

//	Create an SVG element with attributes.
export	const
NE	= ( tag, attrs = {} ) => {
	const
	el = document.createElementNS( SVG_NS, tag )
	Object.entries( attrs ).forEach( ( [ k, v ] ) => el.setAttribute( k, v ) )
	return el
}

export	const
BLANK	= ( W = 512, H = 512 ) =>
	`<svg xmlns="${ SVG_NS }" width="${ W }" height="${ H }" viewBox="0 0 ${ W } ${ H }"></svg>`

const
Px	= $ => {
	if	( $ == null || /%/.test( $ ) ) return NaN
	const
	_ = parseFloat( $ )
	return _ > 0 ? _ : NaN
}

//	Ensure width / height / viewBox are all present and coherent so the
//	editor can lay the document out and zoom it.
const
Normalize	= svg => {
	const
	vb = svg.getAttribute( 'viewBox' )?.split( /[\s,]+/ ).map( Number )
	let
	W = Px( svg.getAttribute( 'width' ) )
	let
	H = Px( svg.getAttribute( 'height' ) )
	isNaN( W ) && ( W = vb?.[ 2 ] > 0 ? vb[ 2 ] : 512 )
	isNaN( H ) && ( H = vb?.[ 3 ] > 0 ? vb[ 3 ] : 512 )
	svg.setAttribute( 'width', W )
	svg.setAttribute( 'height', H )
	vb || svg.setAttribute( 'viewBox', `0 0 ${ W } ${ H }` )
	return svg
}

export	const
Parse	= text => {
	const
	doc = new DOMParser().parseFromString( text, 'image/svg+xml' )
	const
	er = doc.querySelector( 'parsererror' )
	if	( er ) throw new Error( `SVG parse error: ${ er.textContent.split( '\n' )[ 0 ] }` )
	if	( doc.documentElement.nodeName !== 'svg' ) throw new Error( 'Not an SVG document.' )
	return Normalize( document.importNode( doc.documentElement, true ) )
}

export	const
Serialize	= () => {
	const
	svg = MAIN_EDITOR.SVG()
	return svg ? new XMLSerializer().serializeToString( svg ) : ''
}

export	const
Changed	= () => (
	localStorage.setItem( STORAGE_KEY, Serialize() )
,	window.dispatchEvent( new Event( 'doc-changed' ) )
,	MAIN_EDITOR.Draw()
)

import Do, { ClearJobs } from './Jobs.js'

const
Restore	= _ => async () => (
	MAIN_EDITOR.SetSVG( Parse( _ ) )
,	Changed()
)

//	Record an already-applied mutation against the `before` snapshot.
export	const
Commit	= ( label, before ) => {
	const
	after = Serialize()
	before === after || Do( label, Restore( after ), Restore( before ) )
	Changed()
}

export	const
Mutate	= ( label, fn ) => {
	const
	before = Serialize()
	try {
		fn()
	} catch ( er ) {
		//	full rollback — no undo entry for a failed batch
		MAIN_EDITOR.SetSVG( Parse( before ) )
		Changed()
		throw er
	}
	Commit( label, before )
}

export	const
Load	= ( text, commit = true ) => {
	commit && MAIN_EDITOR.SVG()
		?	Mutate( 'Load', () => MAIN_EDITOR.SetSVG( Parse( text ) ) )
		:	(	MAIN_EDITOR.SetSVG( Parse( text ) )
			,	ClearJobs()
			,	Changed()
			)
}

//	Text content of a <text> element, tspan-per-line aware.
export	const
GetText	= el => {
	const
	ts = el.querySelectorAll( 'tspan' )
	return ts.length ? [ ...ts ].map( _ => _.textContent ).join( '\n' ) : el.textContent
}

export	const
SetText	= ( el, v ) => {
	const
	lines = v.split( '\n' )
	if	( lines.length < 2 ) return void ( el.textContent = v )
	el.textContent = ''
	const
	x = el.getAttribute( 'x' ) || 0
	lines.forEach(
		( l, i ) => {
			const
			t = NE( 'tspan', { x, dy: i ? '1.2em' : 0 } )
			t.textContent = l
			el.append( t )
		}
	)
}
